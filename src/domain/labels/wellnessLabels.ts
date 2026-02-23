// src/domain/labels/wellnessLabels.ts

// ===== ラベル辞書 =====

// 睡眠時間カテゴリ
export const SLEEP_DURATION_LABEL = {
  LESS_THAN_6H: "6時間未満",
  BETWEEN_6H_AND_8H: "6〜8時間",
  GTE_8H: "8時間以上",
} as const;

// 睡眠の質
export const SLEEP_QUALITY_LABEL = {
  VERY_GOOD: "とても良い",
  GOOD: "良い",
  NORMAL: "普通",
  BAD: "悪い",
} as const;

// 水分
export const WATER_INTAKE_LABEL = {
  LT_1L: "1L未満",
  BETWEEN1L_AND2L: "1〜2L",
  GTE_2L: "2L以上",
} as const;

// 身体コンディション
export const PHYSICAL_CONDITION_LABEL = {
  VERY_GOOD: "とても元気",
  GOOD: "元気",
  NORMAL: "普通",
  SLIGHTLY_TIRED: "少し疲れ",
  TIRED: "疲れている",
} as const;

// 気分
export const MOOD_LABEL = {
  VERY_GOOD: "とても良い",
  GOOD: "良い",
  NORMAL: "普通",
  BAD: "悪い",
} as const;

// 空腹感
export const HUNGER_LEVEL_LABEL = {
  NONE: "なし",
  SLIGHT: "少し",
  STRONG: "強い",
} as const;

// 便通
export const BOWEL_MOVEMENT_LABEL = {
  ZERO: "0回",
  ONCE: "1回",
  TWICE: "2回",
  THREE_OR_MORE: "3回以上",
} as const;

// ===== 共通ヘルパー =====

type LabelMap = Record<string, string>;

/**
 * ラベル辞書から key に対応する日本語ラベルを引く。
 * - key が null/undefined のとき → null
 * - 辞書に存在しないとき → null（その行は非表示扱い）
 */
export function lookupLabel(
  map: LabelMap,
  key: string | null | undefined
): string | null {
  if (!key) return null;
  return map[key] ?? null;
}