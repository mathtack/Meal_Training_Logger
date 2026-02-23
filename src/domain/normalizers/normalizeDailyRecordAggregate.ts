// src/domain/normalizers/normalizeDailyRecordAggregate.ts
import type { DailyRecordAggregate } from "../type";
import { normalizeExerciseOrders } from "./normalizeExerciseOrders";
import { normalizeMealOrders } from "./normalizeMealOrders";
import { normalizeWeightOrders } from "./normalizeWeightOrders";

export const normalizeDailyRecordAggregate = (agg: DailyRecordAggregate): DailyRecordAggregate => {
  // 順番に意味が出る場合があるので、固定しておくのおすすめ
  const a1 = normalizeExerciseOrders(agg);
  const a2 = normalizeMealOrders(a1);
  const a3 = normalizeWeightOrders(a2);
  return a3;
};
