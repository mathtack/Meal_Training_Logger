// src/domain/normalizers/normalizeWeightOrders.test.ts
import { describe, it, expect } from "vitest";
import { normalizeWeightOrders } from "./normalizeWeightOrders";
import type { DailyRecordAggregate, WeightRecord } from "../type";

const w = (p: Partial<WeightRecord>): WeightRecord => ({
  id: p.id ?? "w-id",
  daily_record_id: "dr-1",
  measurement_time_slot: p.measurement_time_slot ?? "MORNING",
  measured_at: p.measured_at ?? "2026-02-19T07:00:00.000Z",
  weight: p.weight ?? 100,
  measurement_order: p.measurement_order ?? 999,
  created_at: p.created_at ?? "2026-02-19T00:00:00.000Z",
  updated_at: p.updated_at ?? "2026-02-19T00:00:00.000Z",
});

describe("normalizeWeightOrders", () => {
  it("measurement_time_slot と時刻でソートした上で measurement_order を 0 から連番で振り直す", () => {
    const agg: DailyRecordAggregate = {
      daily_record: {
        id: "dr-1",
        user_id: "U",
        record_date: "2026-02-19",
        created_at: "2026-02-19T00:00:00.000Z",
        updated_at: "2026-02-19T00:00:00.000Z",
      },
      weights: [
        // 夜 22:00
        w({
          id: "w_evening",
          measurement_time_slot: "EVENING",
          measured_at: "2026-02-19T22:00:00.000Z",
          measurement_order: 0,
        }),
        // 朝 8:00
        w({
          id: "w_morning_2",
          measurement_time_slot: "MORNING",
          measured_at: "2026-02-19T08:00:00.000Z",
          measurement_order: 2,
        }),
        // 朝 7:00
        w({
          id: "w_morning_1",
          measurement_time_slot: "MORNING",
          measured_at: "2026-02-19T07:00:00.000Z",
          measurement_order: 1,
        }),
      ],
      wellness: null,
      meals: [],
      exercise_sessions: [],
    };

    const output = normalizeWeightOrders(agg);

    // 期待される並び順:
    //   朝 7:00 → 朝 8:00 → 夜 22:00
    expect(output.weights.map((o) => o.id)).toEqual([
      "w_morning_1",
      "w_morning_2",
      "w_evening",
    ]);

    // measurement_order は 0,1,2… で振り直されている
    expect(output.weights.map((o) => o.measurement_order)).toEqual([0, 1, 2]);
  });
});
