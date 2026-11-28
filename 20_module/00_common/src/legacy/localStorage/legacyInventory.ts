import { normalizeDailyRecordAggregate } from "../../domain/normalizers/normalizeDailyRecordAggregate";
import type { DailyRecordAggregate } from "../../domain/type";
import { LEGACY_DAILY_RECORD_KEY_PREFIX, readLegacyDailyRecordSnapshot, type LegacyDailyRecordStorageReader } from "./readLegacyDailyRecords";
import { validateInventoryRecord } from "./validateInventoryRecord";

export type InventorySource = {
  sourceId: string; device: string; profile: string; origin: string;
  // Must be confirmed by the user, never inferred from legacy JSON.
  ownerId: string; ownerConfirmed: boolean;
};
export type InventoryCapture = {
  source: InventorySource; capturedAt: string; entries: [string, string | null][];
  beforeDigest: string; afterDigest: string; unchanged: boolean;
};
export type InventoryCloudSnapshot = {
  capturedAt: string; complete: boolean;
  rows: { user_id: string; record_date: string; record_json: unknown }[];
};

export function canonicalJSON(value: unknown, contentOnly = false): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v)
      .filter(([k, val]) => val !== undefined && !(contentOnly && ["created_at", "updated_at"].includes(k)))
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, val]) => [k, walk(val)]));
    return v;
  };
  return JSON.stringify(walk(value));
}
export async function inventoryDigest(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

const reader = (entries: [string, string | null][]): LegacyDailyRecordStorageReader => ({
  length: entries.length, key: i => entries[i]?.[0] ?? null,
  getItem: k => entries.find(([key]) => key === k)?.[1] ?? null,
});

/** Export only daily_record keys. A read failure aborts instead of claiming zero rows. */
export async function captureLegacyInventory(storage: LegacyDailyRecordStorageReader, source: InventorySource): Promise<InventoryCapture> {
  const scan = (): [string, string | null][] => {
    const keys = new Set<string>();
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(LEGACY_DAILY_RECORD_KEY_PREFIX)) keys.add(key);
    }
    return [...keys].sort().map(k => [k, storage.getItem(k)]);
  };
  const entries = scan();
  const beforeDigest = await inventoryDigest(canonicalJSON(entries));
  const afterDigest = await inventoryDigest(canonicalJSON(scan()));
  return { source, capturedAt: new Date().toISOString(), entries, beforeDigest, afterDigest, unchanged: beforeDigest === afterDigest };
}

async function hashes(value: unknown, ownerId: string, date: string) {
  validateInventoryRecord(value, date);
  const input = structuredClone(value) as DailyRecordAggregate;
  input.daily_record.user_id = ownerId;
  const normalized = normalizeDailyRecordAggregate(input);
  const full = canonicalJSON(normalized);
  const content = canonicalJSON(normalized, true);
  return { fullHash: await inventoryDigest(full), contentHash: await inventoryDigest(content), content };
}

export async function compareLegacyInventory(capture: InventoryCapture, cloud: InventoryCloudSnapshot) {
  const { source } = capture;
  if (!source.ownerConfirmed || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(source.ownerId)) throw new Error("owner_confirmation_required");
  if (!cloud.complete || !Number.isFinite(Date.parse(cloud.capturedAt))) throw new Error("complete_cloud_snapshot_required");
  if (!Number.isFinite(Date.parse(capture.capturedAt))) throw new Error("invalid_capture_time");
  if (!capture.unchanged || capture.beforeDigest !== capture.afterDigest || capture.beforeDigest !== await inventoryDigest(canonicalJSON(capture.entries))) throw new Error("source_changed_or_export_corrupt");
  if (new Set(capture.entries.map(([k]) => k)).size !== capture.entries.length || capture.entries.some(([k, v]) => !k.startsWith(LEGACY_DAILY_RECORD_KEY_PREFIX) || (v !== null && typeof v !== "string"))) throw new Error("invalid_export");
  const snapshot = readLegacyDailyRecordSnapshot(reader(capture.entries));
  type Classification = "candidate" | "duplicate" | "conflict" | "quarantine";
  const results: { key: string; date?: string; classification: Classification; reason?: string; local?: { fullHash: string; contentHash: string }; cloud?: { fullHash: string; contentHash: string }; decision?: string; options?: { choice: string; impact: string }[] }[] = snapshot.issues.map(i => ({ key: i.key, classification: "quarantine", reason: i.reason, decision: "pending: preserve raw export; resolve source defect before migration" }));
  for (const entry of snapshot.records) {
    const base = { key: entry.key, date: entry.recordDate };
    let local;
    try { local = await hashes(entry.record, source.ownerId, entry.recordDate); }
    catch { results.push({ ...base, classification: "quarantine", reason: "invalid_local_contract", decision: "pending: preserve raw export; inspect offline" }); continue; }
    const localHashes = { fullHash: local.fullHash, contentHash: local.contentHash };
    const matches = cloud.rows.filter(r => r.user_id === source.ownerId && r.record_date === entry.recordDate);
    if (!matches.length) { results.push({ ...base, classification: "candidate", local: localHashes }); continue; }
    if (matches.length !== 1) { results.push({ ...base, classification: "quarantine", reason: "duplicate_cloud_business_key", local: localHashes }); continue; }
    let remote;
    try { remote = await hashes(matches[0].record_json, matches[0].user_id, matches[0].record_date); }
    catch { results.push({ ...base, classification: "quarantine", reason: "invalid_cloud_contract", local: localHashes }); continue; }
    const duplicate = local.contentHash === remote.contentHash && local.content === remote.content;
    results.push({ ...base, classification: duplicate ? "duplicate" : "conflict", local: localHashes,
      cloud: { fullHash: remote.fullHash, contentHash: remote.contentHash },
      ...(!duplicate ? { decision: "pending: user decision required for this date", options: [
        { choice: "keep_cloud", impact: "Migrate cloud; retain local original without importing it." },
        { choice: "select_local", impact: "Propose local as migration source for this date; requires later explicit import." },
        { choice: "manual_merge", impact: "Create a separately reviewed merged source; preserve both originals." },
        { choice: "defer", impact: "Exclude this date until the conflict is resolved." },
      ] } : {}),
    });
  }
  results.sort((a, b) => a.key.localeCompare(b.key));
  const counts = { candidate: 0, duplicate: 0, conflict: 0, quarantine: 0 };
  for (const result of results) counts[result.classification]++;
  return { version: 1, source, capturedAt: capture.capturedAt, cloudCapturedAt: cloud.capturedAt,
    keyCount: capture.entries.length, beforeDigest: capture.beforeDigest, afterDigest: capture.afterDigest,
    counts, results, unresolved: results.some(r => r.classification === "conflict" || r.classification === "quarantine") };
}
