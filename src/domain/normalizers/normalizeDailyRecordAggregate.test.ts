// src/domain/normalizers/normalizeDailyRecordAggregate.test.ts
import { describe, it, expect } from "vitest";
import { normalizeDailyRecordAggregate } from "./normalizeDailyRecordAggregate";
import type {
  DailyRecordAggregate,
  DailyRecord,
  WeightRecord,
  ExerciseSessionAggregate,
  ExerciseSession,
  ExerciseItem,
  SetItem,
} from "../type";

const makeAggregateWithMessyOrders = (): DailyRecordAggregate => {
  const daily_record: DailyRecord = {
    id: "dr-1",
    user_id: "user-1",
    record_date: "2026-02-20",
    created_at: "2026-02-20T00:00:00.000Z",
    updated_at: "2026-02-20T00:00:00.000Z",
  };

  const weights: WeightRecord[] = [
    {
      id: "w_evening",
      daily_record_id: "dr-1",
      measurement_time_slot: "EVENING",
      measurement_order: 5,
      weight: 102.3,
      measured_at: "2026-02-19T22:00:00.000Z",
      created_at: "2026-02-19T00:00:00.000Z",
      updated_at: "2026-02-19T00:00:00.000Z",
    },
    {
      id: "w_morning_2",
      daily_record_id: "dr-1",
      measurement_time_slot: "MORNING",
      measurement_order: 3,
      weight: 100.5,
      measured_at: "2026-02-19T08:00:00.000Z",
      created_at: "2026-02-19T00:00:00.000Z",
      updated_at: "2026-02-19T00:00:00.000Z",
    },
    {
      id: "w_morning_1",
      daily_record_id: "dr-1",
      measurement_time_slot: "MORNING",
      measurement_order: 2,
      weight: 100.0,
      measured_at: "2026-02-19T07:00:00.000Z",
      created_at: "2026-02-19T00:00:00.000Z",
      updated_at: "2026-02-19T00:00:00.000Z",
    },
  ];

  const makeSetsItem = (params: {
    id: string;
    sessionId: string;
    itemOrder: number;
    sets: SetItem[];
  }): ExerciseItem => {
    const { id, sessionId, itemOrder, sets } = params;
    return {
      id,
      exercise_session_id: sessionId,
      item_order: itemOrder,
      body_part: null,
      exercise_name: `種目-${id}`,
      exercise_type: "ANAEROBIC",
      recording_style: "SETS",
      created_at: "2026-02-19T00:00:00.000Z",
      updated_at: "2026-02-19T00:00:00.000Z",
      sets,
    };
  };

  const makeSet = (
    p: Partial<SetItem> & { id: string; exercise_item_id: string }
  ): SetItem => ({
    id: p.id,
    exercise_item_id: p.exercise_item_id,
    set_order: p.set_order ?? 999,
    load_value: p.load_value ?? null,
    load_unit: p.load_unit ?? null,
    reps: p.reps ?? null,
    has_sides: p.has_sides ?? false,
    reps_left: p.reps_left ?? null,
    reps_right: p.reps_right ?? null,
    duration_seconds: p.duration_seconds ?? null,
    memo: p.memo ?? null,
    created_at: p.created_at ?? "2026-02-19T00:00:00.000Z",
    updated_at: p.updated_at ?? "2026-02-19T00:00:00.000Z",
  });

  const session1: ExerciseSessionAggregate = {
    session: {
      id: "sess-1",
      daily_record_id: "dr-1",
      session_order: 10, // ← わざと変な値
      session_label: "朝トレ",
      started_at: null,
      ended_at: null,
      memo: null,
      calories_burned: null,
      created_at: "2026-02-19T00:00:00.000Z",
      updated_at: "2026-02-19T00:00:00.000Z",
    } as ExerciseSession,
    items: [
      makeSetsItem({
        id: "item_s1_1",
        sessionId: "sess-1",
        itemOrder: 5,
        sets: [
          makeSet({
            id: "set_s1_1_1",
            exercise_item_id: "item_s1_1",
            set_order: 3,
          }),
          makeSet({
            id: "set_s1_1_2",
            exercise_item_id: "item_s1_1",
            set_order: 1,
          }),
        ],
      }),
      makeSetsItem({
        id: "item_s1_2",
        sessionId: "sess-1",
        itemOrder: 2,
        sets: [
          makeSet({
            id: "set_s1_2_1",
            exercise_item_id: "item_s1_2",
            set_order: 7,
          }),
        ],
      }),
    ],
  };

  const session2: ExerciseSessionAggregate = {
    session: {
      id: "sess-2",
      daily_record_id: "dr-1",
      session_order: 3, // ← こっちの方が小さい
      session_label: "夜トレ",
      started_at: null,
      ended_at: null,
      memo: null,
      calories_burned: null,
      created_at: "2026-02-19T00:00:00.000Z",
      updated_at: "2026-02-19T00:00:00.000Z",
    } as ExerciseSession,
    items: [
      makeSetsItem({
        id: "item_s2_1",
        sessionId: "sess-2",
        itemOrder: 99,
        sets: [
          makeSet({
            id: "set_s2_1_1",
            exercise_item_id: "item_s2_1",
            set_order: 2,
          }),
          makeSet({
            id: "set_s2_1_2",
            exercise_item_id: "item_s2_1",
            set_order: 0,
          }),
        ],
      }),
    ],
  };

  const aggregate: DailyRecordAggregate = {
    daily_record,
    weights,
    wellness: null,
    meals: [],
    // session_order も配列順もバラバラな状態からスタート
    exercise_sessions: [session2, session1],
  };

  return aggregate;
};

describe("DR-NORM-003 normalizeDailyRecordAggregate の冪等性", () => {
  it("同じ Aggregate に複数回かけても結果が変わらない", () => {
    const input = makeAggregateWithMessyOrders();

    const normalizedOnce = normalizeDailyRecordAggregate(input);
    const normalizedTwice = normalizeDailyRecordAggregate(normalizedOnce);

    // 冪等性: 2 回目以降は完全に同じ構造になる
    expect(normalizedTwice).toEqual(normalizedOnce);

    // おまけ: normalize が完全に no-op じゃないことの sanity check
    expect(normalizedOnce).not.toEqual(input);
  });
});