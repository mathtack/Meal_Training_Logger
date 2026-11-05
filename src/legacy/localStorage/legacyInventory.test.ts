import { describe, expect, it, vi } from "vitest";
import { mapNormalizedDailyRecord } from "../../app/dailyRecordNormalizedReadMapper";
import { normalizedRecordFixture, normalizedUserId, normalizedDate } from "../../app/testing/normalizedRecordFixture";
import { canonicalJSON, captureLegacyInventory, compareLegacyInventory, inventoryDigest, type InventoryCloudSnapshot } from "./legacyInventory";

const source = { sourceId: "fixture-pc", device: "fictional", profile: "test", origin: "https://example.invalid", ownerId: normalizedUserId, ownerConfirmed: true };
const record = () => mapNormalizedDailyRecord(normalizedRecordFixture(), { userId: normalizedUserId, date: normalizedDate });
const key = `daily_record:${normalizedDate}`;
const capture = async (raw = JSON.stringify(record())) => {
  const getItem = vi.fn((k: string) => k === key ? raw : "SECRET_SESSION");
  const storage = { length: 2, key: (i: number) => ["sb-auth-token", key][i], getItem, setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() };
  return { value: await captureLegacyInventory(storage, source), storage };
};
const cloud = (value: unknown = record()): InventoryCloudSnapshot => ({ capturedAt: "2026-11-05T01:00:00Z", complete: true, rows: [{ user_id: normalizedUserId, record_date: normalizedDate, record_json: value }] });

describe("read-only legacy inventory", () => {
  it("captures only legacy values twice and never reads auth or writes storage", async () => {
    const { value, storage } = await capture();
    expect(value.unchanged).toBe(true);
    expect(storage.getItem.mock.calls).toEqual([[key], [key]]);
    for (const fn of [storage.setItem, storage.removeItem, storage.clear]) expect(fn).not.toHaveBeenCalled();
    expect(JSON.stringify(value)).not.toContain("SECRET_SESSION");
  });
  it("detects concurrent changes and refuses comparison", async () => {
    let n = 0;
    const value = await captureLegacyInventory({ length: 1, key: () => key, getItem: () => String(n++) }, source);
    expect(value.unchanged).toBe(false);
    await expect(compareLegacyInventory(value, cloud())).rejects.toThrow("source_changed");
  });
  it("does not turn enumeration/read failures into an empty inventory", async () => {
    await expect(captureLegacyInventory({ length: 1, key: () => { throw Error("blocked"); }, getItem: () => null }, source)).rejects.toThrow("blocked");
    await expect(captureLegacyInventory({ length: 1, key: () => key, getItem: () => { throw Error("blocked"); } }, source)).rejects.toThrow("blocked");
  });
  it("uses confirmed owner and normalizes orders without mutating originals", async () => {
    const local = record(); local.daily_record.user_id = "TODO_USER_ID";
    local.meals[0].food_items[0].food_item_order = 50;
    const remote = structuredClone(local); remote.daily_record.user_id = normalizedUserId;
    const { value } = await capture(JSON.stringify(local));
    const before = JSON.stringify(value);
    const result = await compareLegacyInventory(value, cloud(remote));
    expect(result.counts.duplicate).toBe(1);
    expect(JSON.stringify(value)).toBe(before);
  });
  it("distinguishes timestamp-only changes from content conflicts and keeps identity significant", async () => {
    const { value } = await capture();
    const remote = record(); remote.daily_record.updated_at = "2026-11-05T02:00:00Z";
    const result = await compareLegacyInventory(value, cloud(remote));
    expect(result.counts.duplicate).toBe(1);
    expect(result.results[0].local?.fullHash).not.toBe(result.results[0].cloud?.fullHash);
    remote.weights[0].weight++;
    const conflict = await compareLegacyInventory(value, cloud(remote));
    expect(conflict.counts.conflict).toBe(1);
    expect(conflict.results[0].options).toHaveLength(4);
    remote.weights[0].weight--; remote.daily_record.id = "10000000-0000-4000-8000-000000099999";
    expect((await compareLegacyInventory(value, cloud(remote))).counts.quarantine).toBe(1);
  });
  it("only marks absence as candidate in a complete snapshot for the matching owner", async () => {
    const { value } = await capture();
    const snapshot = cloud(); snapshot.rows[0].user_id = "other-owner";
    expect((await compareLegacyInventory(value, snapshot)).counts.candidate).toBe(1);
    snapshot.complete = false;
    await expect(compareLegacyInventory(value, snapshot)).rejects.toThrow("complete_cloud");
    value.source = { ...source, ownerConfirmed: false };
    await expect(compareLegacyInventory(value, cloud())).rejects.toThrow("owner_confirmation");
  });
  it.each([
    "{invalid", "null", JSON.stringify({ daily_record: {} }),
    JSON.stringify({ ...record(), weights: [null] }),
    JSON.stringify({ ...record(), unknown_data: "PRIVATE_RAW_MARKER" }),
    JSON.stringify({ ...record(), daily_record: { ...record().daily_record, record_date: "2026-11-06" } }),
  ])("quarantines malformed source without leaking raw values", async raw => {
    const { value } = await capture(raw);
    const result = await compareLegacyInventory(value, cloud());
    expect(result.counts.quarantine).toBe(1);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_RAW_MARKER");
  });
  it("quarantines impossible calendar dates and invalid nested fields", async () => {
    const { value } = await capture();
    const invalid = record(); invalid.daily_record.record_date = "2026-02-30";
    value.entries = [["daily_record:2026-02-30", JSON.stringify(invalid)]];
    value.beforeDigest = value.afterDigest = await inventoryDigest(canonicalJSON(value.entries));
    expect((await compareLegacyInventory(value, cloud())).counts.quarantine).toBe(1);
    for (const edit of [
      (r: ReturnType<typeof record>) => { r.meals[0].food_items[0].food_amount = "bad" as unknown as number; },
      (r: ReturnType<typeof record>) => { r.exercise_sessions[0].items[0].exercise_type = "INVALID" as "AEROBIC"; },
      (r: ReturnType<typeof record>) => { r.weights.push(structuredClone(r.weights[0])); },
      (r: ReturnType<typeof record>) => { r.weights[0].daily_record_id = "10000000-0000-4000-8000-000000000999"; },
    ]) {
      const r = record(); edit(r);
      expect((await compareLegacyInventory((await capture(JSON.stringify(r))).value, cloud())).counts.quarantine).toBe(1);
    }
  });
  it("quarantines invalid/duplicate cloud rows and rejects tampered exports", async () => {
    const { value } = await capture();
    expect((await compareLegacyInventory(value, cloud({}))).results[0].reason).toBe("invalid_cloud_contract");
    const snapshot = cloud(); snapshot.rows.push(snapshot.rows[0]);
    expect((await compareLegacyInventory(value, snapshot)).results[0].reason).toBe("duplicate_cloud_business_key");
    value.entries[0][1] = "{}";
    await expect(compareLegacyInventory(value, cloud())).rejects.toThrow("export_corrupt");
  });
  it("compares object property order deterministically and retains null drafts", async () => {
    expect(canonicalJSON({ b: 2, a: 1 })).toBe(canonicalJSON({ a: 1, b: 2 }));
    const { value } = await capture();
    expect((await compareLegacyInventory(value, cloud())).counts.duplicate).toBe(1);
  });
});
