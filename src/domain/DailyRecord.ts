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

export type DailyRecord = {
  date: string;
  morningWeight?: number;
  nightWeight?: number;
  morningWeightTime?: string;  // 追加：計測した時間（"07:30" みたいな値）
  nightWeightTime?: string;  // 追加：計測した時間（"07:30" みたいな値）
  meals: MealRecord[];
  exercises?: ExerciseRecord[];
};
