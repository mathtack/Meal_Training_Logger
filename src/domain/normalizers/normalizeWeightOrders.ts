// src/domain/normalizers/normalizeWeightOrders.ts
import type { DailyRecordAggregate, WeightRecord } from "../type";

const slotRank = (slot: WeightRecord["measurement_time_slot"]): number => {
  switch (slot) {
    case "MORNING": return 0;
    case "EVENING": return 1;
    case "OTHER": return 2;
    default: return 9;
  }
};

export const normalizeWeightOrders = (agg: DailyRecordAggregate): DailyRecordAggregate => {
  const weightsWithIdx = agg.weights.map((w, idx) => ({ w, idx }));

  const sorted = weightsWithIdx.slice().sort((a, b) => {
    // 1) measurement_time_slot
    const sr = slotRank(a.w.measurement_time_slot) - slotRank(b.w.measurement_time_slot);
    if (sr !== 0) return sr;

    // 2) measured_at（nullは後ろ）
    const at = a.w.measured_at ?? null;
    const bt = b.w.measured_at ?? null;
    // 3) measured_at が同値なら元の配列順で安定化
    if (at === bt) return a.idx - b.idx;
    if (at === null) return 1;
    if (bt === null) return -1;
    if (at < bt) return -1;
    return 1;
  });

  const weights = sorted.map(({ w }, newIdx) => ({
    ...w,
    measurement_order: newIdx,
  }));

  return { ...agg, weights };
};
