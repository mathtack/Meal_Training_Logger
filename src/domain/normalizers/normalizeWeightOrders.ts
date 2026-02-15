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
    const ao = a.w.measurement_order;
    const bo = b.w.measurement_order;

    // 1) 既存 order が両方あるならそれ優先
    if (Number.isFinite(ao) && Number.isFinite(bo)) return (ao as number) - (bo as number);
    // 2) 片方だけあるなら、ある方を先に
    if (Number.isFinite(ao)) return -1;
    if (Number.isFinite(bo)) return 1;

    // 3) なければ time_slot
    const sr = slotRank(a.w.measurement_time_slot) - slotRank(b.w.measurement_time_slot);
    if (sr !== 0) return sr;

    // 4) measured_at（nullは後ろ）
    const at = a.w.measured_at ?? "";
    const bt = b.w.measured_at ?? "";
    if (at !== bt) return at < bt ? -1 : 1;

    // 5) 最後は元の配列順で安定化
    return a.idx - b.idx;
  });

  const weights = sorted.map(({ w }, newIdx) => ({
    ...w,
    measurement_order: newIdx,
  }));

  return { ...agg, weights };
};
