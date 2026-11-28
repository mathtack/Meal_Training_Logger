import { describe, it, expect } from "vitest";
import { buildDailyRecordReport } from "./dailyRecordReport";
import type { DailyRecordAggregate, ISODateTime } from "../../00_common/src/domain/type";
import { createEmptyDailyRecordAggregate } from "../../00_common/src/domain/factories/createEmptyDailyRecordAggregate";

// テスト用: 「ローカル日付＋ローカル時刻」→ UTC ISO に変換
const toUtcIso = (date: string, time: string): ISODateTime => {
  // date: "2026-02-19", time: "07:00"
  // ごうけん環境は JST(+09:00) 前提
  return new Date(`${date}T${time}:00+09:00`).toISOString() as ISODateTime;
};

describe("dailyRecordReport", () => {
  // DR-REP-001 基本ケース
  it("基本ケース（全部1件）のレポートが期待通りに生成される", () => {
    // 1. 入力データ（DailyRecordAggregate）のテスト用ダミーを作る
    const aggregate: DailyRecordAggregate = {
      daily_record: {
        id: "test-id",
        user_id: "user-1",
        record_date: "2026-02-19",
        created_at: "2026-02-19T07:00:00.000Z",
        updated_at: "2026-02-19T07:30:00.000Z",
      },
      weights: [
        {
          id: "w1",
          daily_record_id: "test-id",
          measurement_time_slot: "MORNING",
          measurement_order: 0,
          measured_at: toUtcIso("2026-02-19", "07:00"),
          weight: 144.4,
          created_at: "2026-02-19T07:00:00.000Z",
          updated_at: "2026-02-19T07:00:00.000Z",
        },
      ],
      wellness: {
        daily_record_id: "test-id",
        // 睡眠などの値は実際の type.ts に合わせて埋めてね
        sleep_duration_category: "LESS_THAN_6H",
        sleep_quality: "NORMAL",
        water_intake: "GTE_2L",
        physical_condition: "SLIGHTLY_TIRED",
        mood: "NORMAL",
        hunger_level: "NONE",
        bowel_movement: "TWICE",
        created_at: "2026-02-19T07:00:00.000Z",
        updated_at: "2026-02-19T07:00:00.000Z",
      },
      meals: [
        {
          meal_record: {
            id: "meal1",
            daily_record_id: "test-id",
            recording_category: "BREAKFAST",
            meal_order: 0,
            eaten_at: toUtcIso("2026-02-19", "07:00"),
            meal_memo: null,
            created_at: "2026-02-19T07:00:00.000Z",
            updated_at: "2026-02-19T07:00:00.000Z",
          },
          food_items: [
            {
              id: "food1",
              meal_record_id: "meal1",
              food_item_order: 0,
              food_name: "オートミール",
              food_amount: 60,
              food_amount_unit: "g",
              food_calorie: 230,
              created_at: "2026-02-19T07:00:00.000Z",
              updated_at: "2026-02-19T07:00:00.000Z",
            },
          ],
          attachments: [],
        },
      ],
      exercise_sessions: [
        {
          session: {
            id: "sess1",
            daily_record_id: "test-id",
            session_order: 0,
            started_at: toUtcIso("2026-02-19", "06:00"),
            ended_at: toUtcIso("2026-02-19", "06:30"),
            memo: null,
            calories_burned: null,
            created_at: "2026-02-19T06:00:00.000Z",
            updated_at: "2026-02-19T06:00:00.000Z",
          },
          items: [],
        },
      ],
    };

    // 2. レポートを生成する
    const text = buildDailyRecordReport(aggregate, {
      audience: "chatgpt", // 実装に合わせて
    });

    // 3. 期待値を定義する（仕様mdに合わせて）
    const expected = [
      "<体重・食事・運動記録 (2/19 木)>",
      "",
      "⚖ 体重",
      "[朝] #0 7:00 144.4kg",
      "[夜] （記録なし）",
      "",
      "🧠 コンディション",
      "🛌 睡眠：6時間未満 / 質：普通",
      "💧 水分：2L以上",
      "🔋 身体：少し疲れ",
      "💭 気分：普通",
      "🤤 空腹感：なし",
      "🚽 便通：2回",
      "",
      "🍽️ 食事",
      "[朝食] #0 7:00,230kcal：オートミール",
      "[昼食] （記録なし）",
      "[夕食] （記録なし）",
      "",
      "🏋️‍♂️ 運動",
      "（記録なし）",
    ].join("\n");

    // 4. 実際の結果と比較
    expect(text).toBe(expected);
  });
  // DR-REP-002 欠損ありケース
  it("一部のみ記録があるケースのレポートが仕様通りに生成される", () => {
    // 1. テスト用 Aggregate を組み立てる（朝体重1件・朝食1件・他は未記録）
    const aggregate: DailyRecordAggregate = {
      daily_record: {
        id: "test-id",
        user_id: "user-1",
        record_date: "2026-02-19",
        created_at: "2026-02-19T07:00:00.000Z",
        updated_at: "2026-02-19T07:30:00.000Z",
      },
      weights: [
        {
          id: "w-morning",
          daily_record_id: "test-id",
          measurement_time_slot: "MORNING",
          measured_at: toUtcIso("2026-02-19", "07:00"),
          weight: 144.4,
          measurement_order: 0,
          created_at: "2026-02-19T07:00:00.000Z",
          updated_at: "2026-02-19T07:00:00.000Z",
        },
      ],
      wellness: null,
      meals: [
        {
          meal_record: {
            id: "meal-breakfast",
            daily_record_id: "test-id",
            recording_category: "BREAKFAST",
            meal_order: 0,
            eaten_at: toUtcIso("2026-02-19", "07:00"),
            meal_memo: null,
            created_at: "2026-02-19T07:00:00.000Z",
            updated_at: "2026-02-19T07:00:00.000Z",
          },
          food_items: [
            {
              id: "food-0",
              meal_record_id: "meal-breakfast",
              food_item_order: 0,
              food_name: "オートミール",
              food_amount: 50,
              food_amount_unit: "g",
              food_calorie: 230,
              created_at: "2026-02-19T07:00:00.000Z",
              updated_at: "2026-02-19T07:00:00.000Z",
            },
          ],
          attachments: [],
        },
      ],
      exercise_sessions: [],
    };

    // 2. 実際のレポート生成
    const text = buildDailyRecordReport(aggregate, {
      audience: "chatgpt",
    });

    // 3. 期待結果（必要な部分だけでOK）
    const expected = [
      "<体重・食事・運動記録 (2/19 木)>",
      "",
      "⚖ 体重",
      "[朝] #0 7:00 144.4kg",
      "[夜] （記録なし）",
      "",
      "🍽️ 食事",
      "[朝食] #0 7:00,230kcal：オートミール",
      "[昼食] （記録なし）",
      "[夕食] （記録なし）",
      "",
      "🏋️‍♂️ 運動",
      "（記録なし）",
    ].join("\n");

    expect(text).toBe(expected);
  });
  // DR-REP-003 空データケース
  it("空の DailyRecordAggregate では各セクションが記録なし/非表示ルールに従う", () => {
    const date = "2026-02-19";
    const aggregate = createEmptyDailyRecordAggregate(date);

    const text = buildDailyRecordReport(aggregate, {
      audience: "chatgpt",
    });

    const expected = [
      "<体重・食事・運動記録 (2/19 木)>",
      "",
      "⚖ 体重",
      "[朝] （記録なし）",
      "[夜] （記録なし）",
      "",
      "🍽️ 食事",
      "[朝食] （記録なし）",
      "[昼食] （記録なし）",
      "[夕食] （記録なし）",
      "",
      "🏋️‍♂️ 運動",
      "（記録なし）",
    ].join("\n");

    expect(text).toBe(expected);
  });

  it("運動は Item/Sets に値がない場合、session memo だけでは Session を表示しない", () => {
    const date = "2026-02-19";
    const aggregate = createEmptyDailyRecordAggregate(date);

    aggregate.exercise_sessions = [
      {
        session: {
          id: "sess-memo-only",
          daily_record_id: aggregate.daily_record.id,
          session_order: 0,
          started_at: toUtcIso(date, "18:00"),
          ended_at: toUtcIso(date, "18:30"),
          memo: "メモのみ",
          created_at: "2026-02-19T18:00:00.000Z",
          updated_at: "2026-02-19T18:00:00.000Z",
        },
        items: [
          {
            id: "item-text-empty",
            exercise_session_id: "sess-memo-only",
            item_order: 0,
            exercise_name: "ウォームアップ",
            exercise_type: "AEROBIC",
            recording_style: "TEXT",
            free_text: "   ",
            created_at: "2026-02-19T18:00:00.000Z",
            updated_at: "2026-02-19T18:00:00.000Z",
          },
          {
            id: "item-sets-empty",
            exercise_session_id: "sess-memo-only",
            item_order: 1,
            exercise_name: "スクワット",
            exercise_type: "ANAEROBIC",
            recording_style: "SETS",
            sets: [],
            created_at: "2026-02-19T18:00:00.000Z",
            updated_at: "2026-02-19T18:00:00.000Z",
          },
        ],
      },
    ];

    const text = buildDailyRecordReport(aggregate, {
      audience: "chatgpt",
    });
    const lines = text.split("\n");

    expect(lines.some((l) => l.startsWith("Session #0"))).toBe(false);
    expect(lines.includes("（記録なし）")).toBe(true);
  });

  it("SETS の表示が左右フラグと連続同一セット圧縮の仕様に従う", () => {
    const date = "2026-02-19";
    const aggregate = createEmptyDailyRecordAggregate(date);

    aggregate.exercise_sessions = [
      {
        session: {
          id: "sess-sets-format",
          daily_record_id: aggregate.daily_record.id,
          session_order: 0,
          started_at: toUtcIso(date, "18:00"),
          ended_at: toUtcIso(date, "19:00"),
          memo: null,
          created_at: "2026-02-19T18:00:00.000Z",
          updated_at: "2026-02-19T18:00:00.000Z",
        },
        items: [
          {
            id: "item-no-sides",
            exercise_session_id: "sess-sets-format",
            item_order: 0,
            exercise_name: "スクワット",
            exercise_type: "ANAEROBIC",
            recording_style: "SETS",
            sets: [
              {
                id: "set-no-sides",
                exercise_item_id: "item-no-sides",
                set_order: 0,
                load_value: 50,
                load_unit: "KG",
                reps: 10,
                has_sides: false,
                created_at: "2026-02-19T18:00:00.000Z",
                updated_at: "2026-02-19T18:00:00.000Z",
              },
            ],
            created_at: "2026-02-19T18:00:00.000Z",
            updated_at: "2026-02-19T18:00:00.000Z",
          },
          {
            id: "item-sides-diff",
            exercise_session_id: "sess-sets-format",
            item_order: 1,
            exercise_name: "ランジ",
            exercise_type: "ANAEROBIC",
            recording_style: "SETS",
            sets: [
              {
                id: "set-sides-diff",
                exercise_item_id: "item-sides-diff",
                set_order: 0,
                load_value: 50,
                load_unit: "KG",
                has_sides: true,
                reps_left: 10,
                reps_right: 12,
                created_at: "2026-02-19T18:00:00.000Z",
                updated_at: "2026-02-19T18:00:00.000Z",
              },
            ],
            created_at: "2026-02-19T18:00:00.000Z",
            updated_at: "2026-02-19T18:00:00.000Z",
          },
          {
            id: "item-sides-same",
            exercise_session_id: "sess-sets-format",
            item_order: 2,
            exercise_name: "ブルガリアン",
            exercise_type: "ANAEROBIC",
            recording_style: "SETS",
            sets: [
              {
                id: "set-sides-same",
                exercise_item_id: "item-sides-same",
                set_order: 0,
                load_value: 50,
                load_unit: "KG",
                has_sides: true,
                reps_left: 10,
                reps_right: 10,
                created_at: "2026-02-19T18:00:00.000Z",
                updated_at: "2026-02-19T18:00:00.000Z",
              },
            ],
            created_at: "2026-02-19T18:00:00.000Z",
            updated_at: "2026-02-19T18:00:00.000Z",
          },
          {
            id: "item-sides-same-compressed",
            exercise_session_id: "sess-sets-format",
            item_order: 3,
            exercise_name: "レッグプレス",
            exercise_type: "ANAEROBIC",
            recording_style: "SETS",
            sets: [
              {
                id: "set-sides-same-compressed-0",
                exercise_item_id: "item-sides-same-compressed",
                set_order: 0,
                load_value: 50,
                load_unit: "KG",
                has_sides: true,
                reps_left: 10,
                reps_right: 10,
                created_at: "2026-02-19T18:00:00.000Z",
                updated_at: "2026-02-19T18:00:00.000Z",
              },
              {
                id: "set-sides-same-compressed-1",
                exercise_item_id: "item-sides-same-compressed",
                set_order: 1,
                load_value: 50,
                load_unit: "KG",
                has_sides: true,
                reps_left: 10,
                reps_right: 10,
                created_at: "2026-02-19T18:00:00.000Z",
                updated_at: "2026-02-19T18:00:00.000Z",
              },
              {
                id: "set-sides-same-compressed-2",
                exercise_item_id: "item-sides-same-compressed",
                set_order: 2,
                load_value: 50,
                load_unit: "KG",
                has_sides: true,
                reps_left: 10,
                reps_right: 10,
                created_at: "2026-02-19T18:00:00.000Z",
                updated_at: "2026-02-19T18:00:00.000Z",
              },
            ],
            created_at: "2026-02-19T18:00:00.000Z",
            updated_at: "2026-02-19T18:00:00.000Z",
          },
        ],
      },
    ];

    const text = buildDailyRecordReport(aggregate, {
      audience: "chatgpt",
    });

    expect(text).toContain("スクワット 50kg x 10rep");
    expect(text).toContain("ランジ 50kg x (左10rep+右12rep)");
    expect(text).toContain("ブルガリアン 50kg x 左右 x 10rep");
    expect(text).toContain("レッグプレス 50kg x 左右 x 10rep x 3set");
  });

  // DR-REP-004 並び順検証
  it("体重・食事・運動が order フィールドに従った順序で出力される", () => {
    const aggregate: DailyRecordAggregate = {
      daily_record: {
        id: "dr-order",
        user_id: "user-1",
        record_date: "2026-02-19",
        created_at: "2026-02-19T00:00:00.000Z",
        updated_at: "2026-02-19T00:00:00.000Z",
      },
      // weight は measurement_order を 2,0,1 の順で入れてみる
      weights: [
        {
          id: "w2",
          daily_record_id: "dr-order",
          measurement_time_slot: "MORNING",
          measurement_order: 2,
          measured_at: toUtcIso("2026-02-19", "08:00"),
          weight: 102.0,
          created_at: "2026-02-19T00:00:00.000Z",
          updated_at: "2026-02-19T00:00:00.000Z",
        },
        {
          id: "w0",
          daily_record_id: "dr-order",
          measurement_time_slot: "MORNING",
          measurement_order: 0,
          measured_at: toUtcIso("2026-02-19", "06:00"),
          weight: 100.0,
          created_at: "2026-02-19T00:00:00.000Z",
          updated_at: "2026-02-19T00:00:00.000Z",
        },
        {
          id: "w1",
          daily_record_id: "dr-order",
          measurement_time_slot: "MORNING",
          measurement_order: 1,
          measured_at: toUtcIso("2026-02-19", "07:00"),
          weight: 101.0,
          created_at: "2026-02-19T00:00:00.000Z",
          updated_at: "2026-02-19T00:00:00.000Z",
        },
      ],
      wellness: null,
      meals: [
        // BREAKFAST を meal_order 1,0,2 の順にシャッフルして突っ込む
        {
          meal_record: {
            id: "m1",
            daily_record_id: "dr-order",
            recording_category: "BREAKFAST",
            meal_order: 1,
            eaten_at: null,
            meal_memo: null,
            created_at: "2026-02-19T00:00:00.000Z",
            updated_at: "2026-02-19T00:00:00.000Z",
          },
          food_items: [
            {
              id: "f1",
              meal_record_id: "m1",
              food_item_order: 0,
              food_name: "トースト",
              food_amount: 1,
              food_amount_unit: "枚",
              food_calorie: 200,
              created_at: "2026-02-19T00:00:00.000Z",
              updated_at: "2026-02-19T00:00:00.000Z",
            },
          ],
          attachments: [],
        },
        {
          meal_record: {
            id: "m0",
            daily_record_id: "dr-order",
            recording_category: "BREAKFAST",
            meal_order: 0,
            eaten_at: null,
            meal_memo: null,
            created_at: "2026-02-19T00:00:00.000Z",
            updated_at: "2026-02-19T00:00:00.000Z",
          },
          food_items: [
            {
              id: "f0",
              meal_record_id: "m0",
              food_item_order: 0,
              food_name: "オートミール",
              food_amount: 1,
              food_amount_unit: "杯",
              food_calorie: 250,
              created_at: "2026-02-19T00:00:00.000Z",
              updated_at: "2026-02-19T00:00:00.000Z",
            },
          ],
          attachments: [],
        },
        {
          meal_record: {
            id: "m2",
            daily_record_id: "dr-order",
            recording_category: "BREAKFAST",
            meal_order: 2,
            eaten_at: null,
            meal_memo: null,
            created_at: "2026-02-19T00:00:00.000Z",
            updated_at: "2026-02-19T00:00:00.000Z",
          },
          food_items: [
            {
              id: "f2",
              meal_record_id: "m2",
              food_item_order: 0,
              food_name: "ヨーグルト",
              food_amount: 1,
              food_amount_unit: "個",
              food_calorie: 80,
              created_at: "2026-02-19T00:00:00.000Z",
              updated_at: "2026-02-19T00:00:00.000Z",
            },
          ],
          attachments: [],
        },
      ],
      exercise_sessions: [
        {
          session: {
            id: "session-0",
            daily_record_id: "dr-order",
            session_order: 0,
            started_at: toUtcIso("2026-02-19", "19:00"),
            ended_at: toUtcIso("2026-02-19", "19:30"),
            memo: null,
            created_at: "2026-02-19T19:00:00.000Z",
            updated_at: "2026-02-19T19:00:00.000Z",
          },
          items: [
            {
              id: "item-0",
              exercise_session_id: "session-0",
              item_order: 1, // わざと 1,0 とかにして order の効きを見るのもアリ
              exercise_name: "スクワット",
              recording_style: "SETS",
              exercise_type: "ANAEROBIC",
              created_at: "2026-02-19T19:00:00.000Z",
              updated_at: "2026-02-19T19:00:00.000Z",
              sets: [
                {
                  id: "set-1",
                  exercise_item_id: "item-0",
                  set_order: 1,
                  load_value: 60,
                  has_sides: false,
                  reps: 8,
                  created_at: "2026-02-19T19:00:00.000Z",
                  updated_at: "2026-02-19T19:00:00.000Z",
                },
              ],
            },
          ],
        },
        {
          session: {
            id: "session-1",
            daily_record_id: "dr-order",
            session_order: 1,
            started_at: toUtcIso("2026-02-19", "20:00"),
            ended_at: toUtcIso("2026-02-19", "20:30"),
            memo: null,
            created_at: "2026-02-19T20:00:00.000Z",
            updated_at: "2026-02-19T20:00:00.000Z",
          },
          items: [
            {
              id: "item-1",
              exercise_session_id: "session-1",
              item_order: 0,
              exercise_name: "ベンチプレス",
              recording_style: "SETS",
              exercise_type: "ANAEROBIC",
              created_at: "2026-02-19T20:00:00.000Z",
              updated_at: "2026-02-19T20:00:00.000Z",
              sets: [
                {
                  id: "set-0",
                  exercise_item_id: "item-1",
                  set_order: 0,
                  load_value: 40,
                  has_sides: false,
                  reps: 10,
                  created_at: "2026-02-19T20:00:00.000Z",
                  updated_at: "2026-02-19T20:00:00.000Z",
                },
              ],
            },
          ],
        },
      ],
    };

    const text = buildDailyRecordReport(aggregate, {
      audience: "chatgpt",
    });

    const lines = text.split("\n");

    // --- 体重: [朝] 行で #0/#1/#2 の順になっていること ---
    const morningLine = lines.find((l) => l.startsWith("[朝]")) ?? "";
    expect(morningLine).toContain("#0");
    expect(morningLine).toContain("#1");
    expect(morningLine).toContain("#2");
    expect(morningLine.indexOf("#0")).toBeLessThan(morningLine.indexOf("#1"));
    expect(morningLine.indexOf("#1")).toBeLessThan(morningLine.indexOf("#2"));

    // --- 食事: 朝食行で「オートミール → トースト → ヨーグルト」の順 ---
    const breakfastLine = lines.find((l) => l.startsWith("[朝食]")) ?? "";
    const idxOats = breakfastLine.indexOf("オートミール");
    const idxToast = breakfastLine.indexOf("トースト");
    const idxYogurt = breakfastLine.indexOf("ヨーグルト");
    expect(idxOats).toBeGreaterThanOrEqual(0);
    expect(idxToast).toBeGreaterThan(idxOats);
    expect(idxYogurt).toBeGreaterThan(idxToast);

    // --- 運動: Session #0 (朝トレ) → Session #1 (夜トレ) の順で出力される ---
    const session0Index = lines.findIndex((l) => l.startsWith("Session #0"));
    const session1Index = lines.findIndex((l) => l.startsWith("Session #1"));
    expect(session0Index).toBeGreaterThanOrEqual(0);
    expect(session1Index).toBeGreaterThan(session0Index);

    // Session #0 内に「スクワット」が出力されていること
    const squatIndex = lines.findIndex((l) => l.includes("スクワット"));
    expect(squatIndex).toBeGreaterThan(session0Index);

    // Session #1 内に「ベンチプレス」が出力されていること
    const benchIndex = lines.findIndex((l) => l.includes("ベンチプレス"));
    expect(benchIndex).toBeGreaterThan(session1Index);
  });
});
