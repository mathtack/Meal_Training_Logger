// src/domain/report/dailyRecordReport.ts
import type {
  DailyRecordAggregate,
  ISODateTime,
  MealAggregate,
  ExerciseSessionAggregate,
  WeightRecord,
  WellnessRecord,
  FoodItem,
  ExerciseItem,
  SetItem,
} from "../type";

import {
  SLEEP_DURATION_LABEL,
  SLEEP_QUALITY_LABEL,
  WATER_INTAKE_LABEL,
  PHYSICAL_CONDITION_LABEL,
  MOOD_LABEL,
  HUNGER_LEVEL_LABEL,
  BOWEL_MOVEMENT_LABEL,
  lookupLabel,
} from "../labels/wellnessLabels";

export type ReportAudience = "chatgpt" | "dietitian" | "copilot";

export interface DailyRecordReportOptions {
  audience: ReportAudience;
}

/**
 * 1日分の記録から、用途別（audience別）のテキストレポートを生成する。
 * - UIや保存処理に依存しない純粋関数。
 * - 改行コードは "\n" 固定。
 * - 最終行の末尾に余計な改行を追加しない。
 */
export function buildDailyRecordReport(
  record: DailyRecordAggregate,
  _options: DailyRecordReportOptions
): string {
  const sections: string[] = [];

  sections.push(buildHeaderSection(record));

  const weight = buildWeightSection(record);
  if (weight) sections.push(weight);

  const wellness = buildWellnessSection(record);
  if (wellness) sections.push(wellness);

  const meals = buildMealsSection(record);
  if (meals) sections.push(meals);

  const exercise = buildExerciseSection(record);
  if (exercise) sections.push(exercise);

  // セクション間は空行1行、それ以外に余計な改行はつけない
  return sections.filter(Boolean).join("\n\n");
}

/* ========== 共通ユーティリティ ========== */

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function formatHeaderDate(isoDate: string): string {
  // "YYYY-MM-DD" 想定
  const d = new Date(isoDate + "T00:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = WEEKDAY_LABELS[d.getDay()] ?? "";
  return `${m}/${day} ${w}`;
}

function formatTime(iso: ISODateTime | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const h = d.getHours().toString().padStart(1, "0"); // 7:00 のようにゼロ埋めは最低限
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatKcal(total: number | null | undefined): string | null {
  if (total == null || Number.isNaN(total)) return null;
  return `${Math.round(total)}kcal`;
}

/* ========== ヘッダー ========== */

function buildHeaderSection(record: DailyRecordAggregate): string {
  const isoDate = record.daily_record.record_date; // ← ここ修正
  const label = formatHeaderDate(isoDate);
  return `<体重・食事・運動記録 (${label})>`;
}

/* ========== 体重セクション ========== */

function buildWeightSection(record: DailyRecordAggregate): string {
  const weights = record.weights ?? [];

  const morningLine = buildWeightSlotLine("朝", "MORNING", weights);
  const eveningLine = buildWeightSlotLine("夜", "EVENING", weights);

  return ["⚖ 体重", morningLine, eveningLine].join("\n");
}

// measurement_time_slot / measurement_order / measured_at / weight
// は type.ts 由来の想定フィールド名（実際の型に合わせて微調整してOK）
type WeightSlot = "MORNING" | "EVENING";

function buildWeightSlotLine(
  labelJa: "朝" | "夜",
  slot: WeightSlot,
  weights: WeightRecord[]
): string {
  const slotWeights = weights
    .filter((w) => (w as any).measurement_time_slot === slot)
    .sort((a, b) => {
      const ao = (a as any).measurement_order ?? 0;
      const bo = (b as any).measurement_order ?? 0;
      return ao - bo;
    });

  if (slotWeights.length === 0) {
    return `[${labelJa}] （記録なし）`;
  }

  const parts: string[] = [];

  slotWeights.forEach((w, index) => {
    const items: string[] = [];

    items.push(`#${index}`);

    const t = formatTime((w as any).measured_at);
    if (t) items.push(t);

    const value = (w as any).weight as number | undefined;
    if (typeof value === "number") {
      items.push(`${value}kg`);
    }

    parts.push(items.join(" "));
  });

  return `[${labelJa}] ${parts.join(" ")}`;
}

/* ========== コンディションセクション ========== */

function buildWellnessSection(record: DailyRecordAggregate): string {
  const wellness = record.wellness as WellnessRecord | null;
  if (!wellness) return "";

  const lines: string[] = [];

  // 見出し
  lines.push("🧠 コンディション");

  // それぞれ null の場合は行ごと非表示にする
  const sleepDuration = lookupLabel(SLEEP_DURATION_LABEL, wellness.sleep_duration_category ?? null);
  const sleepQuality = lookupLabel(SLEEP_QUALITY_LABEL, wellness.sleep_quality ?? null);
  if (sleepDuration || sleepQuality) {
    const durationPart = sleepDuration ?? "";
    const qualityPart = sleepQuality ? ` / 質：${sleepQuality}` : "";
    lines.push(`🛌 睡眠：${durationPart}${qualityPart}`);
  }

  const water = lookupLabel(WATER_INTAKE_LABEL, wellness.water_intake ?? null);
  if (water) {
    lines.push(`💧 水分：${water}`);
  }

  const physical = lookupLabel(PHYSICAL_CONDITION_LABEL, wellness.physical_condition ?? null);
  if (physical) {
    lines.push(`🔋 身体：${physical}`);
  }

  const mood = lookupLabel(MOOD_LABEL, wellness.mood ?? null);
  if (mood) {
    lines.push(`💭 気分：${mood}`);
  }

  const hunger = lookupLabel(HUNGER_LEVEL_LABEL, wellness.hunger_level ?? null);
  if (hunger) {
    lines.push(`🤤 空腹感：${hunger}`);
  }

  const bowel = lookupLabel(BOWEL_MOVEMENT_LABEL, wellness.bowel_movement ?? null);
  if (bowel) {
    lines.push(`🚽 便通：${bowel}`);
  }

  // 全行が空だった場合はセクションごと非表示
  if (lines.length === 1) {
    // 見出ししかない
    return "";
  }

  return lines.join("\n");
}

/* ========== 食事セクション ========== */

type MealSlotKey = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

const MEAL_SLOT_LABEL: Record<MealSlotKey, string> = {
  BREAKFAST: "朝食",
  LUNCH: "昼食",
  DINNER: "夕食",
  SNACK: "間食",
};

function buildMealsSection(record: DailyRecordAggregate): string {
  const meals = record.meals ?? [];
  const bySlot: Record<MealSlotKey, MealAggregate[]> = {
    BREAKFAST: [],
    LUNCH: [],
    DINNER: [],
    SNACK: [],
  };

  for (const agg of meals) {
    const cat = agg.meal_record.recording_category as MealSlotKey;
    if (cat === "BREAKFAST" || cat === "LUNCH" || cat === "DINNER" || cat === "SNACK") {
      bySlot[cat].push(agg);
    }
  }

  const lines: string[] = [];
  lines.push("🍽️ 食事");

  // 朝・昼・夜・間食の順
  lines.push(buildMealSlotLine("BREAKFAST", bySlot.BREAKFAST, true));
  lines.push(buildMealSlotLine("LUNCH", bySlot.LUNCH, true));
  lines.push(buildMealSlotLine("DINNER", bySlot.DINNER, true));

  const snackLine = buildMealSlotLine("SNACK", bySlot.SNACK, false);
  if (snackLine) {
    lines.push(snackLine);
  }

  return lines.join("\n");
}

function buildMealSlotLine(
  slot: MealSlotKey,
  aggregates: MealAggregate[],
  showNoRecord: boolean
): string {
  const label = MEAL_SLOT_LABEL[slot];

  if (aggregates.length === 0) {
    if (showNoRecord) {
      return `[${label}] （記録なし）`;
    }
    return "";
  }

  // meal_order 昇順でソート
  const sorted = aggregates.slice().sort((a, b) => {
    const ao = a.meal_record.meal_order ?? 0;
    const bo = b.meal_record.meal_order ?? 0;
    return ao - bo;
  });

  const pieces: string[] = [];

  sorted.forEach((agg, index) => {
    const meal = agg.meal_record;
    const time = formatTime(meal.eaten_at ?? null);

    const totalCalorie = calcTotalCalories(agg.food_items);
    const kcalStr = formatKcal(totalCalorie);

    let head = `#${index}`;
    if (time) {
      head += ` ${time}`;
    }
    if (kcalStr) {
      head += time ? `,${kcalStr}` : ` ${kcalStr}`;
    }

    const foodText = buildMealFoodText(agg.food_items);

    pieces.push(`${head}：${foodText}`);
  });

  return `[${label}] ${pieces.join(", ")}`;
}

function calcTotalCalories(items: FoodItem[]): number | null {
  if (!items.length) return null;
  let sum = 0;
  let hasAny = false;
  for (const item of items) {
    if (typeof item.food_calorie === "number" && !Number.isNaN(item.food_calorie)) {
      sum += item.food_calorie;
      hasAny = true;
    }
  }
  return hasAny ? sum : null;
}

function buildMealFoodText(items: FoodItem[]): string {
  if (!items.length) return "";
  const names = items.map((i) => i.food_name).filter(Boolean);
  if (!names.length) return "";

  if (names.length === 1) {
    return names[0];
  }

  const main = names[0];
  const rest = names.slice(1).join("、");
  return `${main}（${rest}）`;
}

/* ========== 運動セクション ========== */

// NOTE: ExerciseItem / SetItem の構造は type.ts の省略部分にある想定。
// プロパティ名は推測ベースなので、実プロジェクトの型に合わせて微調整してほしい。

/* ========== 運動セクション ========== */

function buildExerciseSection(record: DailyRecordAggregate): string {
  const sessions = record.exercise_sessions ?? [];

  // 1. 「中身のあるセッション」だけ残す
  const meaningfulSessions = sessions.filter(
    (sessionAgg) => !isExerciseSessionEmpty(sessionAgg)
  );

  // 2. 1件もなければ「記録なし」
  if (!meaningfulSessions.length) {
    return ["🏋️‍♂️ 運動", "（記録なし）"].join("\n");
  }

  const lines: string[] = [];
  lines.push("🏋️‍♂️ 運動");

  // 3. 以降は「中身のあるセッションだけ」を対象に今まで通り処理
  const sortedSessions: ExerciseSessionAggregate[] = meaningfulSessions
    .slice()
    .sort((a, b) => a.session.session_order - b.session.session_order);

  sortedSessions.forEach((sessionAgg, idx) => {
    const header = buildExerciseSessionHeader(sessionAgg, idx);
    if (!header) return;

    lines.push(header);

    const items = (sessionAgg.items ?? [])
      .slice()
      .sort((a, b) => a.item_order - b.item_order);

    for (const item of items) {
      const itemLine = buildExerciseItemLine(item);
      if (!itemLine) continue;
      // 半角2スペースインデント
      lines.push(`  ${itemLine}`);
    }
  });

  return lines.join("\n");
}

function isExerciseSessionEmpty(sessionAgg: ExerciseSessionAggregate): boolean {
  const session = sessionAgg.session;

  // セッションメモがあれば「中身あり」とみなす
  const hasSessionMemo =
    typeof session.memo === "string" && session.memo.trim().length > 0;

  const items = sessionAgg.items ?? [];

  // TEXTスタイルで free_text が入っている item があるか
  const hasTextItem = items.some((item) => {
    if (item.recording_style !== "TEXT") return false;
    return typeof item.free_text === "string" && item.free_text.trim().length > 0;
  });

  // SETSスタイルで 1セット以上登録されている item があるか
  const hasSetsItem = items.some((item) => {
    if (item.recording_style !== "SETS") return false;
    const sets = item.sets ?? [];
    return sets.length > 0;
  });

  return !hasSessionMemo && !hasTextItem && !hasSetsItem;
}

function buildExerciseSessionHeader(
  sessionAgg: ExerciseSessionAggregate,
  index: number
): string {
  const s = sessionAgg.session;
  let header = `Session #${index}`;

  const start = formatTime(s.started_at ?? null);
  const end = formatTime(s.ended_at ?? null);

  if (start || end) {
    header += " ";
    if (start && end) {
      header += `${start} - ${end}`;
    } else if (start) {
      header += `${start} -`;
    } else {
      header += `- ${end}`;
    }
  }

  return header;
}

function buildExerciseItemLine(item: ExerciseItem): string | null {
  const name = item.exercise_name;
  if (!name) return null;

  if (item.recording_style === "TEXT") {
    // TEXTモード：free_text をそのまま使う
    const memo = item.free_text;
    if (memo) {
      return `${name} ${memo}`;
    }
    return name;
  }

  if (item.recording_style === "SETS") {
    const sets: SetItem[] = item.sets ?? [];
    if (!sets.length) {
      return name;
    }

    // ひとまず「先頭セットの条件 × セット数」でシンプルに表現
    const first = sets[0];
    const load = first.load_value;
    const loadUnit = first.load_unit;
    const reps = first.reps;
    const setCount = sets.length;

    const parts: string[] = [name];

    if (typeof load === "number") {
      const unit = loadUnit === "LBS" ? "lbs" : "kg";
      parts.push(`${load}${unit}`);
    }

    if (typeof reps === "number") {
      parts.push(`x ${reps}rep`);
    }

    parts.push(`x ${setCount}set`);

    return parts.join(" ");
  }

  // 未知のスタイル
  return name;
}