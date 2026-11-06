import type { DailyRecordAggregate, ISODate } from "../domain/type";
import { normalizeCloudDailyRecord, prepareDailyRecordForCloudSave } from "./dailyRecordCloud";
import {
  deleteDailyRecordFromSupabase, fetchDailyRecordFromSupabase,
  fetchDailyRecordHistoryFromSupabase, saveDailyRecordToSupabase,
} from "./dailyRecordSupabaseService";
import {
  deleteDailyRecordNormalized, fetchDailyRecordHistoryNormalized, fetchDailyRecordNormalized,
} from "./dailyRecordNormalizedQueryService";
import { saveDailyRecordNormalized } from "./dailyRecordNormalizedWriteService";

type Save = { userId: string; date: ISODate; record: DailyRecordAggregate };

const jsonb = {
  async read(params: Omit<Save, "record">) {
    const result = await fetchDailyRecordFromSupabase(params);
    return result.status === "found"
      ? { ...result, record: normalizeCloudDailyRecord({ ...params, record: result.record }) }
      : result;
  },
  history: fetchDailyRecordHistoryFromSupabase,
  remove: deleteDailyRecordFromSupabase,
  async save(params: Save) {
    const record = prepareDailyRecordForCloudSave(params);
    const result = await saveDailyRecordToSupabase({ ...params, record });
    return result.status === "error" ? result : { ...result, record };
  },
};

const normalized = {
  read: fetchDailyRecordNormalized,
  history: fetchDailyRecordHistoryNormalized,
  remove: deleteDailyRecordNormalized,
  async save(params: Save) {
    const record = normalizeCloudDailyRecord(params);
    const result = await saveDailyRecordNormalized({ ...params, record });
    if (result.status === "error") return result;
    return { status: result.status, record: { ...record, daily_record: result.identity } };
  },
};

export function getDailyRecordPersistence() {
  const mode = import.meta.env.VITE_DAILY_RECORD_PERSISTENCE;
  if (mode === undefined || mode === "" || mode === "jsonb") return jsonb;
  if (mode === "normalized") return normalized;
  throw Error("Invalid VITE_DAILY_RECORD_PERSISTENCE");
}
