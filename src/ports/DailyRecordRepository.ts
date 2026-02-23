// src/ports/DailyRecordRepository.ts
import type {
  DailyRecordAggregate,
  ISODate,
  DailyRecordSummary,
} from "../domain/type";

export interface DailyRecordRepository {
  get(date: ISODate): DailyRecordAggregate | null;
  save(record: DailyRecordAggregate): void;
  delete(date: ISODate): void;

  listSummaries(): DailyRecordSummary[];
}
