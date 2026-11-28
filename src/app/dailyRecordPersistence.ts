import type { DailyRecordAggregate, ISODate } from "../domain/type";
import { normalizeCloudDailyRecord } from "./dailyRecordCloud";
import {
  deleteDailyRecordNormalized, fetchDailyRecordHistoryNormalized, fetchDailyRecordNormalized,
} from "./dailyRecordNormalizedQueryService";
import { saveDailyRecordNormalized } from "./dailyRecordNormalizedWriteService";

type Save = { userId: string; date: ISODate; record: DailyRecordAggregate };

export const dailyRecordPersistence = {
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
