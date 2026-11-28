import { describe, expect, it, vi } from "vitest";
import type { DailyRecordAggregate, ISODate } from "../../domain/type";
import {
  readLegacyDailyRecordSnapshot,
  type LegacyDailyRecordStorageReader,
} from "./readLegacyDailyRecords";

type StoredValue = string | null | Error;

const createRecord = (date: ISODate): DailyRecordAggregate => ({
  daily_record: {
    id: `daily-${date}`,
    user_id: "legacy-user",
    record_date: date,
    created_at: `${date}T00:00:00.000Z`,
    updated_at: `${date}T01:00:00.000Z`,
  },
  weights: [],
  wellness: null,
  meals: [],
  exercise_sessions: [],
});

const createStorage = (entries: Record<string, StoredValue>) => {
  const keys = Object.keys(entries);
  const getItem = vi.fn((key: string): string | null => {
    const value = entries[key];
    if (value instanceof Error) throw value;
    return value ?? null;
  });
  const setItem = vi.fn();
  const removeItem = vi.fn();
  const clear = vi.fn();

  const storage = {
    get length() {
      return keys.length;
    },
    key: vi.fn((index: number) => keys[index] ?? null),
    getItem,
    setItem,
    removeItem,
    clear,
  } satisfies LegacyDailyRecordStorageReader & {
    setItem: typeof setItem;
    removeItem: typeof removeItem;
    clear: typeof clear;
  };

  return { storage, getItem, setItem, removeItem, clear };
};

describe("readLegacyDailyRecordSnapshot", () => {
  it("returns supported daily_record entries in deterministic order", () => {
    const olderDate = "2026-09-01" as ISODate;
    const newerDate = "2026-09-03" as ISODate;
    const olderRecord = createRecord(olderDate);
    const newerRecord = createRecord(newerDate);
    const { storage, getItem } = createStorage({
      [`daily_record:${newerDate}`]: JSON.stringify(newerRecord),
      "supabase.auth.token": "unrelated",
      [`daily_record:${olderDate}`]: JSON.stringify(olderRecord),
    });

    const result = readLegacyDailyRecordSnapshot(storage);

    expect(result).toEqual({
      records: [
        {
          key: `daily_record:${olderDate}`,
          recordDate: olderDate,
          record: olderRecord,
        },
        {
          key: `daily_record:${newerDate}`,
          recordDate: newerDate,
          record: newerRecord,
        },
      ],
      issues: [],
    });
    expect(getItem).not.toHaveBeenCalledWith("supabase.auth.token");
  });

  it("reports malformed candidates without normalizing or promoting them", () => {
    const mismatched = createRecord("2026-09-06" as ISODate);
    const { storage } = createStorage({
      "daily_record:not-a-date": JSON.stringify(mismatched),
      "daily_record:2026-09-04": "{not-json",
      "daily_record:2026-09-05": JSON.stringify({ daily_record: {} }),
      "daily_record:2026-09-07": JSON.stringify(mismatched),
      "daily_record:2026-09-08": null,
    });

    const result = readLegacyDailyRecordSnapshot(storage);

    expect(result.records).toEqual([]);
    expect(result.issues.map(({ key, reason }) => ({ key, reason }))).toEqual([
      { key: "daily_record:2026-09-04", reason: "invalid_json" },
      {
        key: "daily_record:2026-09-05",
        reason: "invalid_aggregate_shape",
      },
      { key: "daily_record:2026-09-07", reason: "record_date_mismatch" },
      { key: "daily_record:2026-09-08", reason: "missing_value" },
      { key: "daily_record:not-a-date", reason: "invalid_key" },
    ]);
    expect(result.issues[0].rawValue).toBe("{not-json");
  });

  it("continues scanning when an individual legacy value cannot be read", () => {
    const readableDate = "2026-09-02" as ISODate;
    const { storage } = createStorage({
      "daily_record:2026-09-01": new Error("blocked"),
      [`daily_record:${readableDate}`]: JSON.stringify(createRecord(readableDate)),
    });

    const result = readLegacyDailyRecordSnapshot(storage);

    expect(result.records.map((entry) => entry.recordDate)).toEqual([
      readableDate,
    ]);
    expect(result.issues).toEqual([
      { key: "daily_record:2026-09-01", reason: "read_error" },
    ]);
  });

  it("never writes, removes, or clears existing storage data", () => {
    const date = "2026-09-03" as ISODate;
    const rawValue = JSON.stringify(createRecord(date));
    const entries = { [`daily_record:${date}`]: rawValue };
    const { storage, setItem, removeItem, clear } = createStorage(entries);

    readLegacyDailyRecordSnapshot(storage);

    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(entries[`daily_record:${date}`]).toBe(rawValue);
  });
});
