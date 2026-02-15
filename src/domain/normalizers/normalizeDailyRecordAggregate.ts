// src/domain/normalizers/normalizeDailyRecordAggregate.ts
import type { DailyRecordAggregate } from "../type";
import { normalizeExerciseOrders } from "./normalizeExerciseOrders";
import { normalizeWeightOrders } from "./normalizeWeightOrders";

export const normalizeDailyRecordAggregate = (agg: DailyRecordAggregate): DailyRecordAggregate => {
  // 順番に意味が出る場合があるので、固定しておくのおすすめ
  const a1 = normalizeExerciseOrders(agg);
  const a2 = normalizeWeightOrders(a1);
  return a2;
};
