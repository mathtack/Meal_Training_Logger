1) DB → TS（Base types）
| Entity (DB)      | TS type         | Key             | Relation                   | Notes                       |
| ---------------- | --------------- | --------------- | -------------------------- | --------------------------- |
| daily_record     | DailyRecord     | id              | 1                          | header                      |
| weight_record    | WeightRecord    | id              | daily_record 1:N           |                             |
| wellness_record  | WellnessRecord  | daily_record_id | daily_record 1:1           | PK=FK                       |
| meal_record      | MealRecord      | id              | daily_record 1:N           |                             |
| meal_attachment  | MealAttachment  | id              | meal_record 1:N            |                             |
| food_item        | FoodItem        | id              | meal_record 1:N           | 料理 or 単一食材（PFC直接） |
| food_material    | FoodMaterial    | id              | food_item 0:N              | 食品に紐づく材料（PFC）     |
| exercise_session | ExerciseSession | id              | daily_record 1:N           |                             |
| exercise_item    | ExerciseItem    | id              | exercise_session 1:N       | recording_style             |
| set_item         | SetItem         | id              | exercise_item 0:N          | SETSのみ                    |

2) Aggregate types（画面・保存の主役）

### DailyRecordAggregate : used by 画面、保存
- daily_record: DailyRecord
- weights: WeightRecord[]
- wellness: WellnessRecord | null
- meals: MealAggregate[]
- exercise_sessions: ExerciseSessionAggregate[]

### MealAggregate
- meal_record: MealRecord
- attachments: MealAttachment[]
- food_items: FoodItemAggregate[]

### FoodItemAggregate
- food_item: FoodItem
- materials: FoodMaterial[]

### ExerciseSessionAggregate
- session: ExerciseSession
- items: ExerciseItem[]
  - when recording_style = "SETS"
    - sets: SetItem[]
  - when recording_style = "TEXT"
    - free_text: string

3) localStorage への保存方針（v1.1.0 → v1.2.0）

- 保存単位：1日 = 1 JSON（DailyRecordAggregate）
- キー：`daily_record:{record_date}`（例：daily_record:2026-02-15）
- value：DailyRecordAggregate（JSON）
- record_date 形式：YYYY-MM-DD

※ v1.2.0 以降：MealAggregate.food_items は FoodItemAggregate[] となり、
  食品1件に対して 0..N 件の FoodMaterial を持てる。
  PFC 集計ロジックは下記ルールで実装する想定：
  - materials.length === 0 の場合：FoodItem の PFC をそのまま採用
  - materials.length >= 1 の場合：FoodMaterial 群の PFC 合計を食品の値として扱う
