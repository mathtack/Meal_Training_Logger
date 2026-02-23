// src/data/dailyRecordRepository.localStorage.ts
import type { DailyRecordRepository } from "../ports/DailyRecordRepository";
import type { DailyRecordAggregate, ISODate } from "../domain/type";

// 既存の storage をそのまま使う（移動しない）
import { DailyRecordStorage } from "../domain/storage/dailyRecordStorage";

export const dailyRecordRepositoryLocalStorage: DailyRecordRepository = {
  get(date: ISODate): DailyRecordAggregate | null {
    return DailyRecordStorage.get(date);
  },
  save(record: DailyRecordAggregate): void {
    DailyRecordStorage.save(record);
  },
  delete(date: ISODate): void {
    DailyRecordStorage.delete(date);
  },
    listSummaries() {
    return DailyRecordStorage.listSummaries();
  },
};
