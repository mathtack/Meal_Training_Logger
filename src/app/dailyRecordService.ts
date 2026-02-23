// src/app/dailyRecordService.ts
import type {
  DailyRecordAggregate,
  ISODate,
  DailyRecordSummary,
} from "../domain/type";
import type { DailyRecordRepository } from "../ports/DailyRecordRepository";
import { dailyRecordRepositoryLocalStorage } from "../data/dailyRecordRepository.localStorage";
import { createEmptyDailyRecordAggregate } from "../domain/factories/createEmptyDailyRecordAggregate";
import { normalizeDailyRecordAggregate } from "../domain/normalizers/normalizeDailyRecordAggregate";

export type LoadResult = { record: DailyRecordAggregate; source: "saved" | "empty" };

export type DailyRecordHistoryEntry = DailyRecordSummary;

export const createDailyRecordService = (
  repo: DailyRecordRepository = dailyRecordRepositoryLocalStorage
) => {
  return {
    load(date: ISODate): LoadResult {
      const saved = repo.get(date);
      if (saved) {
        return { record: normalizeDailyRecordAggregate(saved), source: "saved" };
      }

      const empty = createEmptyDailyRecordAggregate(date);
      return { record: normalizeDailyRecordAggregate(empty), source: "empty" };
    },

    // 👇 履歴一覧取得（新しい日付が上）
    listHistory(): DailyRecordHistoryEntry[] {
      const summaries = repo.listSummaries();

      // record_date の降順に並べ替え（上が新しい）
      return summaries.slice().sort((a, b) => {
        if (a.record_date < b.record_date) return 1;
        if (a.record_date > b.record_date) return -1;
        return 0;
      });
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

