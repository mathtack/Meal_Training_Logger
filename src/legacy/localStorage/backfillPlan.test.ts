import { describe, expect, it } from "vitest";
import { normalizedRecordFixture, normalizedDate, normalizedUserId, fixtureId } from "../../app/testing/normalizedRecordFixture";
import { mapNormalizedDailyRecord } from "../../app/dailyRecordNormalizedReadMapper";
import { backfillChecksums, prepareBackfill, type BackfillSnapshot } from "./backfillPlan";
import { captureLegacyInventory, compareLegacyInventory } from "./legacyInventory";

const userId = normalizedUserId;
const date = normalizedDate;
const record = () => mapNormalizedDailyRecord(normalizedRecordFixture(), { userId, date });
const source = { sourceId: "fixture", device: "test", profile: "test", origin: "https://example.invalid", ownerId: userId, ownerConfirmed: true };
const cloud = (record_json = record()): BackfillSnapshot => ({
  capturedAt: "2026-11-05T01:00:00Z", complete: true,
  rows: [{ store_id: fixtureId(998), user_id: userId, record_date: date, record_json }],
});
const capture = (payload = record()) => captureLegacyInventory({
  length: 1, key: () => "daily_record:" + date, getItem: () => JSON.stringify(payload),
}, source);

describe("backfill planning", () => {
  it("replaces the known legacy owner, preserves source, and excludes duplicate local rows", async () => {
    const payload = record();
    payload.daily_record.user_id = "TODO_USER_ID";
    const local = await capture(payload);
    const snapshot = cloud(payload);
    const previous = await compareLegacyInventory(local, snapshot);
    const plan = await prepareBackfill(snapshot, local, previous, []);
    expect(plan.excluded).toEqual([{ date, reason: "duplicate" }]);
    expect(plan.rows[0].record?.daily_record.user_id).toBe(userId);
    expect(plan.rows[0].replacedLegacyOwner).toBe(true);
    expect(plan.rows[0].counts?.food_item).toBe(4);
    expect(payload.daily_record.user_id).toBe("TODO_USER_ID");
  });

  it("requires a known approval for the exact conflict hashes", async () => {
    const local = await capture();
    const edited = record();
    edited.weights[0].weight++;
    const snapshot = cloud(edited);
    const previous = await compareLegacyInventory(local, snapshot);
    const decisions = [{ date, selectedChoice: "keep_cloud", status: "resolved" }];
    expect((await prepareBackfill(snapshot, local, previous, decisions)).excluded).toEqual([{ date, reason: "keep_cloud" }]);
    edited.weights[0].weight++;
    const changed = await prepareBackfill(snapshot, local, previous, decisions);
    expect(changed.rows.map(row => row.reason)).toEqual(["overlap_requires_review", "source_decision_required"]);
  });

  it("rejects a forged payload owner and blocks duplicate source/business identity", async () => {
    const local = await capture();
    const forged = record();
    forged.daily_record.user_id = fixtureId(994);
    const snapshot = cloud(forged);
    const previous = await compareLegacyInventory(local, snapshot);
    expect((await prepareBackfill(snapshot, local, previous, [])).rows[0].reason).toBe("owner_mismatch");
    const clean = cloud();
    const cleanReport = await compareLegacyInventory(local, clean);
    clean.rows.push({ ...clean.rows[0], store_id: fixtureId(993) });
    const duplicates = await prepareBackfill(clean, local, cleanReport, []);
    expect(duplicates.rows.filter(r => r.kind === "cloud").map(r => r.reason)).toEqual(["duplicate_business_key", "duplicate_business_key"]);
  });

  it("quarantines unzoned exercise times unless an explicit offset is supplied", async () => {
    const payload = record();
    payload.exercise_sessions[0].session.started_at = date + "T12:30:00";
    const local = await capture(payload);
    const snapshot = cloud(payload);
    const previous = await compareLegacyInventory(local, snapshot);
    expect((await prepareBackfill(snapshot, local, previous, [])).rows[0].reason).toBe("exercise_session_timezone_unconfirmed");
    const plan = await prepareBackfill(snapshot, local, previous, [], "+09:00");
    expect(plan.rows[0].sessionTimesAssignedOffset).toBe(1);
    expect(plan.rows[0].record?.exercise_sessions[0].session.started_at).toBe(date + "T12:30:00+09:00");
    expect(payload.exercise_sessions[0].session.started_at).toBe(date + "T12:30:00");
  });

  it("equates equivalent instants, preserving microseconds and full versus content hashes", async () => {
    const a = record();
    a.daily_record.updated_at = date + "T09:00:00.123456+09:00";
    const b = structuredClone(a);
    b.daily_record.updated_at = date + "T00:00:00.123456Z";
    expect(await backfillChecksums(a)).toEqual(await backfillChecksums(b));
    b.daily_record.updated_at = date + "T00:00:00.123457Z";
    const original = await backfillChecksums(a);
    const changed = await backfillChecksums(b);
    expect(changed.full).not.toBe(original.full);
    expect(changed.content).toBe(original.content);
  });
});
