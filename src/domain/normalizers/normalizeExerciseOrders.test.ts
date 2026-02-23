// src/domain/normalizers/normalizeExerciseOrders.test.ts
import { describe, it, expect } from "vitest";
import { normalizeExerciseOrders } from "./normalizeExerciseOrders";
import type {
  DailyRecordAggregate,
  ExerciseItem,
  ExerciseSessionAggregate,
  SetItem,
} from "../type";

/**
 * ExerciseItem(SETS) のテスト用ヘルパー
 */
type SetsExerciseItem = Extract<ExerciseItem, { recording_style: "SETS" }>;
type TextExerciseItem = Extract<ExerciseItem, { recording_style: "TEXT" }>;

const makeSetsItem = (
  p: Partial<Omit<SetsExerciseItem, "recording_style">> = {},
): SetsExerciseItem => {
  return {
    id: "ex-item-id",
    exercise_session_id: "sess-1",
    item_order: 999,
    body_part: null,
    exercise_name: "ベンチプレス",
    exercise_type: "ANAEROBIC",
    recording_style: "SETS",
    sets: [],
    created_at: "2026-02-19T00:00:00.000Z",
    updated_at: "2026-02-19T00:00:00.000Z",
    ...p,
  };
};

/**
 * ExerciseItem(TEXT) のテスト用ヘルパー
 */
const makeTextItem = (
  p: Partial<Omit<TextExerciseItem, "recording_style">> = {},
): TextExerciseItem => {
  return {
    id: "ex-item-id",
    exercise_session_id: "sess-1",
    item_order: 999,
    body_part: null,
    exercise_name: "フリー入力",
    exercise_type: "ANAEROBIC",
    recording_style: "TEXT",
    free_text: "メモ",
    created_at: "2026-02-19T00:00:00.000Z",
    updated_at: "2026-02-19T00:00:00.000Z",
    ...p,
  };
};

/**
 * SetItem のテスト用ヘルパー
 */
const makeSet = (p: Partial<SetItem> = {}): SetItem => {
  return {
    id: "set-id",
    exercise_item_id: "ex-item-id",
    set_order: 999,
    load_value: 50,
    load_unit: "KG",
    reps: 10,
    has_sides: false,
    reps_left: null,
    reps_right: null,
    duration_seconds: null,
    memo: null,
    created_at: "2026-02-19T00:00:00.000Z",
    updated_at: "2026-02-19T00:00:00.000Z",
    ...p,
  };
};

/**
 * session aggregate 相当を作る
 */
const makeSessionAgg = (params: {
  sessionId: string;
  sessionOrder?: number;
  items: ExerciseItem[];
}): ExerciseSessionAggregate => {
  const { sessionId, sessionOrder = 999, items } = params;

  return {
    session: {
      id: sessionId,
      daily_record_id: "dr-1",
      session_label: `セッション-${sessionId}`,
      session_order: sessionOrder,
      started_at: null,
      ended_at: null,
      memo: null,
      calories_burned: null,
      created_at: "2026-02-19T00:00:00.000Z",
      updated_at: "2026-02-19T00:00:00.000Z",
    },
    items,
  };
};

/**
 * DailyRecordAggregate を最小限組み立て
 */
const makeAgg = (sessions: ExerciseSessionAggregate[]): DailyRecordAggregate => {
  return {
    daily_record: {
      id: "dr-1",
      user_id: "u-1",
      record_date: "2026-02-19",
      created_at: "2026-02-19T00:00:00.000Z",
      updated_at: "2026-02-19T00:00:00.000Z",
    },
    weights: [],
    wellness: null,
    meals: [],
    exercise_sessions: sessions,
  };
};

const asSetsItem = (item: ExerciseItem): SetsExerciseItem => {
  expect(item.recording_style).toBe("SETS");
  if (item.recording_style !== "SETS") {
    throw new Error("Expected SETS item");
  }
  return item;
};

describe("DR-NORM-002: normalizeExerciseOrders", () => {
  it("session / item / set の order を 0 からの連番に振り直す", () => {
    // --- 入力データ（わざとバラバラの order を入れる）---
    const sess1 = makeSessionAgg({
      sessionId: "s1",
      sessionOrder: 5,
      items: [
        makeSetsItem({
          id: "item_s1_1",
          item_order: 10,
          // sets: 3 つ、set_order もバラバラ
          sets: [
            makeSet({ id: "set_1_1", exercise_item_id: "item_s1_1", set_order: 3 }),
            makeSet({ id: "set_1_2", exercise_item_id: "item_s1_1", set_order: 1 }),
            makeSet({ id: "set_1_3", exercise_item_id: "item_s1_1", set_order: 5 }),
          ],
        }),
        makeSetsItem({
          id: "item_s1_2",
          item_order: 99,
          sets: [
            makeSet({ id: "set_2_1", exercise_item_id: "item_s1_2", set_order: 10 }),
            makeSet({ id: "set_2_2", exercise_item_id: "item_s1_2", set_order: 20 }),
          ],
        }),
      ],
    });

    const sess2 = makeSessionAgg({
      sessionId: "s2",
      sessionOrder: 99,
      items: [
        makeSetsItem({
          id: "item_s2_1",
          item_order: 7,
          sets: [
            makeSet({ id: "set_3_1", exercise_item_id: "item_s2_1", set_order: 100 }),
          ],
        }),
      ],
    });

    const input: DailyRecordAggregate = makeAgg([sess1, sess2]);

    // --- 実行 ---
    const output = normalizeExerciseOrders(input);

    // --- session_order: 0, 1... に振り直されている ---
    expect(output.exercise_sessions.map((s) => s.session.session_order)).toEqual([0, 1]);

    // --- item_order: 各セッション内で 0,1... に振り直されている ---
    expect(output.exercise_sessions[0].items.map((it) => it.item_order)).toEqual([0, 1]);
    expect(output.exercise_sessions[1].items.map((it) => it.item_order)).toEqual([0]);

    // --- sets: recording_style = SETS の item では 0,1,2... に振り直される ---
    const s1Item1Sets = asSetsItem(output.exercise_sessions[0].items[0]).sets;
    const s1Item2Sets = asSetsItem(output.exercise_sessions[0].items[1]).sets;
    const s2Item1Sets = asSetsItem(output.exercise_sessions[1].items[0]).sets;

    expect(s1Item1Sets.map((s) => s.set_order)).toEqual([0, 1, 2]);
    expect(s1Item2Sets.map((s) => s.set_order)).toEqual([0, 1]);
    expect(s2Item1Sets.map((s) => s.set_order)).toEqual([0]);
  });

  it("recording_style=TEXT の item でも session/item order は振り直され、free_text は維持される", () => {
    const textItem = makeTextItem({
      id: "item_text",
      item_order: 50,
      free_text: "有酸素30分",
    });

    const sess = makeSessionAgg({
      sessionId: "s-text",
      sessionOrder: 3,
      items: [textItem],
    });

    const input = makeAgg([sess]);

    const output = normalizeExerciseOrders(input);

    const outSession = output.exercise_sessions[0];
    const outItem = outSession.items[0];

    // session_order / item_order 自体は 0 から振り直される
    expect(outSession.session.session_order).toBe(0);
    expect(outItem.item_order).toBe(0);

    // TEXT の free_text は維持される
    expect(outItem.recording_style).toBe("TEXT");
    if (outItem.recording_style === "TEXT") {
      expect(outItem.free_text).toBe("有酸素30分");
    }
  });
});
