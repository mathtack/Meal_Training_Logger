import type { DailyRecordAggregate } from "../../domain/type";
import { normalizeDailyRecordAggregate } from "../../domain/normalizers/normalizeDailyRecordAggregate";
import { canonicalJSON, compareLegacyInventory, inventoryDigest, type InventoryCapture, type InventoryCloudSnapshot } from "./legacyInventory";
import { validateInventoryRecord } from "./validateInventoryRecord";

type CloudRow = InventoryCloudSnapshot["rows"][number] & { store_id: string };
export type BackfillSnapshot = Omit<InventoryCloudSnapshot, "rows"> & { rows: CloudRow[] };
type InventoryReport = Awaited<ReturnType<typeof compareLegacyInventory>>;
type Decision = { date: string; status: string; selectedChoice: string };

export const tableNames = [
  "daily_record", "weight_record", "wellness_record", "meal_record",
  "meal_attachment", "food_item", "food_material", "exercise_session",
  "exercise_item", "set_item",
] as const;
type Table = (typeof tableNames)[number];
export const emptyCounts = () => Object.fromEntries(tableNames.map(table => [table, 0])) as Record<Table, number>;
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/;
const sort = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

function entityRows(a: DailyRecordAggregate): Record<Table, { id?: string }[]> {
  return {
    daily_record: [a.daily_record], weight_record: a.weights,
    wellness_record: a.wellness ? [{ id: a.wellness.daily_record_id }] : [],
    meal_record: a.meals.map(m => m.meal_record),
    meal_attachment: a.meals.flatMap(m => m.attachments),
    food_item: a.meals.flatMap(m => m.food_items),
    food_material: [],
    exercise_session: a.exercise_sessions.map(s => s.session),
    exercise_item: a.exercise_sessions.flatMap(s => s.items),
    set_item: a.exercise_sessions.flatMap(s => s.items.flatMap(i => i.recording_style === "SETS" ? i.sets : [])),
  };
}

// SQL timestamptz stores instants, and optional JSON properties become SQL NULL.
// Keep fractional microseconds and required nullable fields in the comparison.
const timestampKeys = new Set(["created_at", "updated_at", "measured_at", "eaten_at", "started_at", "ended_at"]);
const wallTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/;
function instant(value: string) {
  const parts = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/);
  if (!parts) throw Error("invalid_timestamp_precision_or_zone");
  if (new Date(parts[1] + "Z").toISOString().slice(0, 19) !== parts[1]) throw Error("invalid_timestamp_precision_or_zone");
  const utc = new Date(parts[1] + parts[3]).toISOString().slice(0, 19);
  return utc + "." + (parts[2] ?? "").padEnd(6, "0") + "Z";
}

export function canonicalBackfillRecord(input: DailyRecordAggregate) {
  const a = structuredClone(input);
  const ordered = <T extends { id: string }>(getOrder: (row: T) => number | null | undefined) =>
    (l: T, r: T) => (getOrder(l) ?? Number.MAX_SAFE_INTEGER) - (getOrder(r) ?? Number.MAX_SAFE_INTEGER) || sort(l.id, r.id);
  a.weights.sort(ordered(w => w.measurement_order));
  a.meals.sort((l, r) => sort(l.meal_record.recording_category, r.meal_record.recording_category)
    || ordered((m: typeof l.meal_record) => m.meal_order)(l.meal_record, r.meal_record));
  for (const m of a.meals) {
    m.attachments.sort(ordered(row => row.attachment_order));
    m.food_items.sort(ordered(row => row.food_item_order));
  }
  a.exercise_sessions.sort((l, r) => ordered((s: typeof l.session) => s.session_order)(l.session, r.session));
  for (const s of a.exercise_sessions) {
    s.items.sort(ordered(row => row.item_order));
    for (const item of s.items) if (item.recording_style === "SETS") item.sets.sort(ordered(row => row.set_order));
  }
  return JSON.parse(JSON.stringify(a, (key, value: unknown) => {
    if (value === null && !["wellness", "food_amount", "food_calorie"].includes(key)) return undefined;
    return typeof value === "string" && timestampKeys.has(key) ? instant(value) : value;
  })) as DailyRecordAggregate;
}

export async function backfillChecksums(record: DailyRecordAggregate) {
  const normalized = canonicalBackfillRecord(record);
  return {
    full: await inventoryDigest(canonicalJSON(normalized)),
    content: await inventoryDigest(canonicalJSON(normalized, true)),
  };
}

type Source = { id: string; kind: "cloud" | "legacy"; owner: string; date: string; raw: unknown; reason?: string };
export type BackfillRow = Omit<Source, "raw"> & {
  record?: DailyRecordAggregate;
  sourceChecksum: string;
  checksums?: { full: string; content: string };
  counts?: Record<Table, number>;
  replacedLegacyOwner?: boolean;
  sessionTimesAssignedOffset?: number;
};

export async function prepareBackfill(
  cloud: BackfillSnapshot, capture: InventoryCapture, previous: InventoryReport, decisions: Decision[],
  sessionOffset?: string,
) {
  if (sessionOffset !== undefined && !/^[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00)$/.test(sessionOffset)) throw Error("invalid_session_offset_policy");
  const owner = capture.source.ownerId;
  if (!uuid.test(owner) || !cloud.complete || !cloud.rows.every(r => r.user_id === owner)) throw Error("invalid_cloud_scope");
  if (previous.beforeDigest !== capture.beforeDigest || previous.afterDigest !== capture.afterDigest
    || previous.source.sourceId !== capture.source.sourceId || previous.source.ownerId !== owner) throw Error("inventory_source_mismatch");
  const latest = await compareLegacyInventory(capture, cloud);
  const sources: Source[] = cloud.rows.map(r => ({
    id: r.store_id, kind: "cloud", owner: r.user_id, date: r.record_date, raw: r.record_json,
    ...(!uuid.test(r.store_id) ? { reason: "invalid_store_id" } : {}),
  }));
  const excluded: { date?: string; reason: string }[] = [];
  for (const result of latest.results) {
    const original = previous.results.find(r => r.key === result.key);
    const date = result.date;
    const approved = original && original.local?.fullHash === result.local?.fullHash;
    if (result.classification === "duplicate" && approved) {
      excluded.push({ date, reason: "duplicate" });
      continue;
    }
    if (result.classification === "conflict" && approved && original.cloud?.fullHash === result.cloud?.fullHash
      && decisions.filter(d => d.date === date).length === 1
      && decisions.some(d => d.date === date && d.status === "resolved" && d.selectedChoice === "keep_cloud")) {
      excluded.push({ date, reason: "keep_cloud" });
      continue;
    }
    const raw = capture.entries.find(([key]) => key === result.key)?.[1];
    sources.push({
      id: await inventoryDigest(canonicalJSON([capture.source.sourceId, result.key])),
      kind: "legacy", owner, date: date ?? "", raw: raw ?? null,
      ...(result.classification === "candidate" && original?.classification === "candidate" && approved
        ? {} : { reason: result.reason ?? "source_decision_required" }),
    });
  }
  const rows: BackfillRow[] = [];
  const identities = new Map<string, BackfillRow[]>();
  const index = (key: string, row: BackfillRow) => {
    const values = identities.get(key) ?? [];
    values.push(row);
    identities.set(key, values);
  };
  for (const { raw, ...source } of sources.sort((a, b) => sort(a.date, b.date) || sort(a.kind, b.kind) || sort(a.id, b.id))) {
    const row: BackfillRow = { ...source, sourceChecksum: await inventoryDigest(canonicalJSON({ ...source, raw })) };
    rows.push(row);
    index("source:" + row.id, row);
    if (source.kind === "cloud" || !row.reason) index("business:" + row.owner + ":" + row.date, row);
    if (row.reason) continue;
    try {
      const parsed = source.kind === "legacy" ? JSON.parse(String(raw)) as unknown : raw;
      validateInventoryRecord(parsed, source.date);
      const record = structuredClone(parsed) as DailyRecordAggregate;
      const supplied = record.daily_record.user_id;
      if (supplied !== source.owner && supplied !== "TODO_USER_ID") {
        row.reason = "owner_mismatch";
        continue;
      }
      row.replacedLegacyOwner = supplied === "TODO_USER_ID";
      record.daily_record.user_id = source.owner;
      let assignedOffset = 0;
      for (const { session } of record.exercise_sessions) {
        for (const key of ["started_at", "ended_at"] as const) {
          const value = session[key];
          if (typeof value !== "string" || !wallTime.test(value)) continue;
          if (!sessionOffset) throw Error("exercise_session_timezone_unconfirmed");
          session[key] = value + sessionOffset;
          assignedOffset++;
        }
      }
      if (assignedOffset) row.sessionTimesAssignedOffset = assignedOffset;
      row.record = normalizeDailyRecordAggregate(record);
      row.checksums = await backfillChecksums(row.record);
      const entities = entityRows(row.record);
      row.counts = emptyCounts();
      for (const table of tableNames) {
        row.counts[table] = entities[table].length;
        for (const entity of entities[table]) index(table + ":" + entity.id?.toLowerCase(), row);
      }
    } catch (error) {
      row.reason = error instanceof Error && ["exercise_session_timezone_unconfirmed", "invalid_timestamp_precision_or_zone"].includes(error.message)
        ? error.message : "invalid_record_contract";
    }
  }
  for (const [identity, duplicates] of identities) if (duplicates.length > 1) {
    for (const row of duplicates) row.reason ??= identity.startsWith("business:") ? "duplicate_business_key"
      : identity.startsWith("source:") ? "duplicate_source_identity" : "duplicate_entity_id";
  }
  // Unresolved local overlap also blocks the corresponding cloud record.
  for (const row of rows.filter(r => r.kind === "legacy" && r.reason)) {
    for (const cloudRow of rows.filter(r => r.kind === "cloud" && r.date === row.date)) cloudRow.reason ??= "overlap_requires_review";
  }
  return { rows, excluded };
}
