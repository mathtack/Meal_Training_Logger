// ==============================
// Common
// ==============================

export type UUID = string;          // uuid
export type ISODate = string;       // YYYY-MM-DD
export type ISODateTime = string;   // ISO timestamp


// ==============================
// Base Types (DB対応)
// ==============================

export interface DailyRecord {
  id: UUID;
  user_id: UUID;
  record_date: ISODate;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface WeightRecord {
  id: UUID;
  daily_record_id: UUID;
  measurement_time_slot: string; // enum想定（MORNING / EVENING / OTHER）
  measurement_order: number;     // ← 追加（UIで並び替えに応じて採番）
  weight: number;                // decimal(5,2) 体重
  measured_at?: ISODateTime | null; // ← 任意化（未入力を許容）
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface WellnessRecord {
  daily_record_id: UUID; // PK=FK (1:1)
  sleep_duration_category?: string | null;
  sleep_quality?: string | null;
  sleep_duration_minutes?: number | null;
  sleep_source?: string | null;
  water_intake?: string | null;
  physical_condition?: string | null;
  mood?: string | null;
  hunger_level?: string | null;
  bowel_movement?: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface MealRecord {
  id: UUID;
  daily_record_id: UUID;
  recording_category: string;   // enum想定（BREAKFAST/LUNCH/DINNER/SNACK）
  meal_order: number;           // UI並び順
  eaten_at?: ISODateTime | null; // timestamptz 実際に食べた時間（任意）
  meal_memo?: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface MealAttachment {
  id: UUID;
  meal_record_id: UUID;
  storage_path: string;
  attachment_order?: number | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface FoodItem {
  id: UUID;
  meal_record_id: UUID;
  food_name: string;
  food_amount: number;            // decimal → number
  food_amount_unit: string;
  food_calorie: number;           // decimal → number
  food_protein?: number | null;   // decimal → number
  food_fat?: number | null;
  food_carbohydrates?: number | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}


// ==============================
// Exercise Base Types
// ==============================

export type ExerciseType = "AEROBIC" | "ANAEROBIC";
export type RecordingStyle = "SETS" | "TEXT";
export type LoadUnit = "KG" | "LBS" | "BODYWEIGHT";

export interface ExerciseSession {
  id: UUID;
  daily_record_id: UUID;
  session_order: number;
  session_label?: string | null;
  started_at?: ISODateTime | null;
  ended_at?: ISODateTime | null;
  memo?: string | null;
  calories_burned?: number | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface ExerciseItemBase {
  id: UUID;
  exercise_session_id: UUID;
  item_order: number;
  body_part?: string | null;
  exercise_name: string;
  exercise_type: ExerciseType;
  recording_style: RecordingStyle;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface SetItem {
  id: UUID;
  exercise_item_id: UUID;
  set_order: number;
  load_value?: number | null;
  load_unit?: LoadUnit | null;
  reps?: number | null;
  has_sides: boolean;
  reps_left?: number | null;
  reps_right?: number | null;
  duration_seconds?: number | null;
  memo?: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}


// ==============================
// Exercise Union Type
// ==============================

export type ExerciseItem =
  | (ExerciseItemBase & {
      recording_style: "SETS";
      sets: SetItem[];
    })
  | (ExerciseItemBase & {
      recording_style: "TEXT";
      free_text: string;
    });


// ==============================
// Aggregate Types（画面・保存単位）
// ==============================

export interface MealAggregate {
  meal_record: MealRecord;
  attachments: MealAttachment[];
  food_items: FoodItem[];
}

export interface ExerciseSessionAggregate {
  session: ExerciseSession;
  items: ExerciseItem[];
}

export interface DailyRecordAggregate {
  daily_record: DailyRecord;
  weights: WeightRecord[];
  wellness: WellnessRecord | null;
  meals: MealAggregate[];
  exercise_sessions: ExerciseSessionAggregate[];
}
