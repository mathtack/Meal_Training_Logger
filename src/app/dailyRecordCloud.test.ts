import { describe, expect, it } from "vitest";
import type { DailyRecordAggregate, ISODate } from "../domain/type";
import {
  createEmptyCloudDailyRecord,
  prepareDailyRecordForCloudSave,
} from "./dailyRecordCloud";

const USER_ID = "user-1";
const DATE = "2026-09-03" as ISODate;
const SAVED_AT = "2026-09-03T12:34:56.000Z";

const createRecord = (): DailyRecordAggregate => ({
  daily_record: {
    id: "daily-1",
    user_id: "legacy-user",
    record_date: "2026-09-02",
    created_at: "2026-09-02T00:00:00.000Z",
    updated_at: "2026-09-02T01:00:00.000Z",
  },
  weights: [
    {
      id: "weight-2",
      daily_record_id: "daily-1",
      measurement_time_slot: "EVENING",
      measurement_order: 8,
      weight: 70,
      created_at: "2026-09-02T00:00:00.000Z",
      updated_at: "2026-09-02T01:00:00.000Z",
    },
    {
      id: "weight-1",
      daily_record_id: "daily-1",
      measurement_time_slot: "MORNING",
      measurement_order: 4,
      weight: 69,
      created_at: "2026-09-02T00:00:00.000Z",
      updated_at: "2026-09-02T01:00:00.000Z",
    },
  ],
  wellness: null,
  meals: [],
  exercise_sessions: [],
});

describe("dailyRecordCloud", () => {
  it("creates an empty record owned by the authenticated user", () => {
    const record = createEmptyCloudDailyRecord({ userId: USER_ID, date: DATE });

    expect(record.daily_record.user_id).toBe(USER_ID);
    expect(record.daily_record.record_date).toBe(DATE);
    expect(record.weights).toEqual([]);
  });

  it("normalizes and stamps the aggregate before a confirmed cloud save", () => {
    const source = createRecord();

    const prepared = prepareDailyRecordForCloudSave({
      record: source,
      userId: USER_ID,
      date: DATE,
      savedAt: SAVED_AT,
    });

    expect(prepared.daily_record).toMatchObject({
      id: "daily-1",
      user_id: USER_ID,
      record_date: DATE,
      created_at: "2026-09-02T00:00:00.000Z",
      updated_at: SAVED_AT,
    });
    expect(prepared.weights.map((weight) => weight.measurement_order)).toEqual([
      0,
      1,
    ]);
    expect(source.daily_record.user_id).toBe("legacy-user");
    expect(source.weights.map((weight) => weight.measurement_order)).toEqual([
      8,
      4,
    ]);
  });
});
