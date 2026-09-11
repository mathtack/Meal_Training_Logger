// src/domain/factories/createEmptyDailyRecordAggregate.ts
import type { DailyRecordAggregate, ISODate, ISODateTime } from "../type";
import { generateUUID } from "../generateUUID";

const nowISO = (): ISODateTime => new Date().toISOString();

export const createEmptyDailyRecordAggregate = (date: ISODate): DailyRecordAggregate => {
  const now = nowISO();

  return {
    daily_record: {
      id: generateUUID(),
      user_id: "TODO_USER_ID",
      record_date: date,
      created_at: now,
      updated_at: now,
    },
    weights: [],
    wellness: null,
    meals: [],
    exercise_sessions: [],
  };
};
