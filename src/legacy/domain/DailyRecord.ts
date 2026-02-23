export type MealRecord = {
  time: string;      // "朝", "昼", "夜", "間食" などのラベル
  memo: string;      // 食事内容のメモ
  photos?: string[]; // 将来用：写真のパスなど
  eatenAt?: string;  // ← 追加："07:45" みたいな実際に食べた時間（任意）
};

export type ExerciseRecord = {
  time: string;
  memo: string;
  calories?: number;
};

// 🛌 睡眠まわり
export type SleepDurationCategory = "lt6h" | "h6to7" | "gte7h";
//   表示イメージ：
//   - "lt6h"  → "6時間未満"
//   - "h6to7" → "6〜7時間"
//   - "gte7h" → "7時間以上"

export type SleepQuality = "bad" | "normal" | "good";
//   表示イメージ：悪い / 普通 / 良い

export type SleepSource = "manual" | "healthkit";
//   将来用："manual" = 手入力, "healthkit" = HealthKit連携

// 💧 水分
export type WaterIntakeCategory =
  | "lt1l"      // 1L未満
  | "l1to1_5"   // 1〜1.5L
  | "l1_5to2"   // 1.5〜2L
  | "gte2l";    // 2L以上

// 🔋 身体のコンディション
export type PhysicalCondition =
  | "fine"            // 元気
  | "slightly_tired"  // 少し疲れ
  | "tired"           // かなり疲れ
  | "exhausted";      // 強い疲労

// 💭 気分
export type Mood =
  | "good"    // 良い
  | "normal"  // 普通
  | "bad"     // 悪い
  | "worst";  // 最悪

// 🚽 便通
export type BowelMovement =
  | "none"          // 出ない
  | "once"          // 1回
  | "twice"         // 2回
  | "three_or_more" // 3回以上
  ;

export type HungerLevel = "none" | "slight" | "strong";
// 表示イメージ：
// - "none"   → 「なし」
// - "slight" → 「多少あり」
// - "strong" → 「強くあり」

export type DailyRecord = {
  date: string;

  morningWeight?: number;
  nightWeight?: number;
  morningWeightTime?: string;  // 追加：計測した時間（"07:30" みたいな値）
  nightWeightTime?: string;  // 追加：計測した時間（"07:30" みたいな値）

  meals: MealRecord[];
  exercises?: ExerciseRecord[];

  // 🧠 コンディション系（すべて任意）
  // UIで選ぶのは区分（enum）。埋まっている項目だけメッセージに出す。
  sleepDurationCategory?: SleepDurationCategory;
  sleepQuality?: SleepQuality;

  // 将来のHealthKit連携用の余白
  sleepDurationMinutes?: number | null; // 例: 410 (分)
  sleepSource?: SleepSource;           // "manual" | "healthkit"

  waterIntake?: WaterIntakeCategory;

  physicalCondition?: PhysicalCondition;
  mood?: Mood;
      // 🤤 空腹感（任意）
  hungerLevel?: HungerLevel;

  bowelMovement?: BowelMovement;



};
