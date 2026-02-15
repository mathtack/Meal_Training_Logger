// src/app/dailyRecordService.ts
import type { DailyRecordAggregate, ISODate } from "../domain/type";
import type { DailyRecordRepository } from "../ports/DailyRecordRepository";
import { dailyRecordRepositoryLocalStorage } from "../data/dailyRecordRepository.localStorage";
import { createEmptyDailyRecordAggregate } from "../domain/factories/createEmptyDailyRecordAggregate";
import { normalizeDailyRecordAggregate } from "../domain/normalizers/normalizeDailyRecordAggregate";

export type LoadResult = { record: DailyRecordAggregate; source: "saved" | "empty" };

export const createDailyRecordService = (repo: DailyRecordRepository = dailyRecordRepositoryLocalStorage) => {
  return {
    load(date: ISODate): LoadResult {
      const saved = repo.get(date);
      if (saved) return { record: normalizeDailyRecordAggregate(saved), source: "saved" };

      const empty = createEmptyDailyRecordAggregate(date);
      return { record: normalizeDailyRecordAggregate(empty), source: "empty" };
    },

    // 👇 normalized を返すのがポイント
    save(record: DailyRecordAggregate): DailyRecordAggregate {
      const normalized = normalizeDailyRecordAggregate(record);
      repo.save(normalized);
      return normalized;
    },

    delete(date: ISODate): void {
      repo.delete(date);
    },
  };
};

