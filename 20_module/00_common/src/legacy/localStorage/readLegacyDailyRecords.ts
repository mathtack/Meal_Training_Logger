import type { DailyRecordAggregate, ISODate } from "../../domain/type";

export const LEGACY_DAILY_RECORD_KEY_PREFIX = "daily_record:";

export interface LegacyDailyRecordStorageReader {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
}

export interface LegacyDailyRecordEntry {
  key: string;
  recordDate: ISODate;
  record: DailyRecordAggregate;
}

export type LegacyDailyRecordIssueReason =
  | "invalid_key"
  | "missing_value"
  | "read_error"
  | "invalid_json"
  | "invalid_aggregate_shape"
  | "record_date_mismatch";

export interface LegacyDailyRecordIssue {
  key: string;
  reason: LegacyDailyRecordIssueReason;
  rawValue?: string;
}

export interface LegacyDailyRecordSnapshot {
  records: LegacyDailyRecordEntry[];
  issues: LegacyDailyRecordIssue[];
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isDailyRecordAggregate = (
  value: unknown,
): value is DailyRecordAggregate => {
  if (!isObject(value) || !isObject(value.daily_record)) return false;

  const dailyRecord = value.daily_record;

  return (
    typeof dailyRecord.id === "string" &&
    typeof dailyRecord.user_id === "string" &&
    typeof dailyRecord.record_date === "string" &&
    typeof dailyRecord.created_at === "string" &&
    typeof dailyRecord.updated_at === "string" &&
    Array.isArray(value.weights) &&
    (value.wellness === null || isObject(value.wellness)) &&
    Array.isArray(value.meals) &&
    Array.isArray(value.exercise_sessions)
  );
};

const listLegacyKeys = (storage: LegacyDailyRecordStorageReader): string[] => {
  const keys = new Set<string>();

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(LEGACY_DAILY_RECORD_KEY_PREFIX)) keys.add(key);
  }

  return [...keys].sort();
};

export const readLegacyDailyRecordSnapshot = (
  storage: LegacyDailyRecordStorageReader,
): LegacyDailyRecordSnapshot => {
  const records: LegacyDailyRecordEntry[] = [];
  const issues: LegacyDailyRecordIssue[] = [];

  for (const key of listLegacyKeys(storage)) {
    let rawValue: string | null;

    try {
      rawValue = storage.getItem(key);
    } catch {
      issues.push({ key, reason: "read_error" });
      continue;
    }

    if (rawValue === null) {
      issues.push({ key, reason: "missing_value" });
      continue;
    }

    const recordDate = key.slice(LEGACY_DAILY_RECORD_KEY_PREFIX.length);
    if (!ISO_DATE_PATTERN.test(recordDate)) {
      issues.push({ key, reason: "invalid_key", rawValue });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawValue);
    } catch {
      issues.push({ key, reason: "invalid_json", rawValue });
      continue;
    }

    if (!isDailyRecordAggregate(parsed)) {
      issues.push({ key, reason: "invalid_aggregate_shape", rawValue });
      continue;
    }

    if (parsed.daily_record.record_date !== recordDate) {
      issues.push({ key, reason: "record_date_mismatch", rawValue });
      continue;
    }

    records.push({
      key,
      recordDate: recordDate as ISODate,
      record: parsed,
    });
  }

  return { records, issues };
};
