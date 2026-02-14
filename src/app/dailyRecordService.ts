// src/app/dailyRecordService.ts
import type { DailyRecordAggregate, ISODate } from "../domain/type";
import type { DailyRecordRepository } from "../ports/DailyRecordRepository";
import { dailyRecordRepositoryLocalStorage } from "../data/dailyRecordRepository.localStorage";
import { normalizeExerciseOrders } from "../domain/normalizers/normalizeExerciseOrders";
import { createEmptyDailyRecordAggregate } from "../domain/factories/createEmptyDailyRecordAggregate";

export type LoadResult = { record: DailyRecordAggregate; source: "saved" | "empty" };

export const createDailyRecordService = (repo: DailyRecordRepository = dailyRecordRepositoryLocalStorage) => {
  return {
    load(date: ISODate): LoadResult {
      const saved = repo.get(date);
      if (saved) return { record: saved, source: "saved" };
      return { record: createEmptyDailyRecordAggregate(date), source: "empty" };
    },

    save(record: DailyRecordAggregate): void {
      const normalized = normalizeExerciseOrders(record);
      repo.save(normalized);
    },

    delete(date: ISODate): void {
      repo.delete(date);
    },
  };
};
