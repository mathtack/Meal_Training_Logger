import type { DailyRecordAggregate, DailyRecordSummary, ExerciseItem } from "../domain/type";

type Row = Record<string, unknown>;
type Decoder = (value: unknown) => unknown;
type Schema = Record<string, Decoder>;

const invalid = (): never => {
  throw new Error("Supabase returned an invalid normalized daily record.");
};

const object = (value: unknown): Row => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Row;
};

const text = (value: unknown): string =>
  typeof value === "string" ? value : invalid();
const uuid = (value: unknown): string => {
  const result = text(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result)
    ? result : invalid();
};
const timestamp = (value: unknown): string => {
  const result = text(value);
  return /^\d{4}-\d{2}-\d{2}T/.test(result) && Number.isFinite(Date.parse(result))
    ? result : invalid();
};
const date = (value: unknown): string => {
  const result = text(value);
  const parsed = new Date(`${result}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(result) && Number.isFinite(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === result ? result : invalid();
};
const numeric = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : invalid();
const integer = (value: unknown): number => {
  const result = numeric(value);
  return Number.isSafeInteger(result) ? result : invalid();
};
const order = (value: unknown): number => {
  const result = integer(value);
  return result >= 0 ? result : invalid();
};
const boolean = (value: unknown): boolean =>
  typeof value === "boolean" ? value : invalid();
const nullable = <T>(decode: (value: unknown) => T) => (value: unknown): T | null =>
  value === null ? null : decode(value);
const oneOf = <T extends string>(...values: T[]) => (value: unknown): T =>
  typeof value === "string" && values.includes(value as T) ? value as T : invalid();

const decodeRow = <S extends Schema>(row: Row, schema: S) =>
  Object.fromEntries(Object.entries(schema).map(([key, decode]) => [key, decode(row[key])])) as {
    [K in keyof S]: ReturnType<S[K]>;
  };

const timestamps = { created_at: timestamp, updated_at: timestamp };
const rootSchema = { id: uuid, user_id: uuid, record_date: date, ...timestamps };
const weightSchema = {
  id: uuid, daily_record_id: uuid, measurement_time_slot: text,
  measurement_order: order, weight: numeric, measured_at: nullable(timestamp), ...timestamps,
};
const wellnessSchema = {
  daily_record_id: uuid, sleep_duration_category: nullable(text), sleep_quality: nullable(text),
  sleep_duration_minutes: nullable(integer), sleep_source: nullable(text), water_intake: nullable(text),
  physical_condition: nullable(text), mood: nullable(text), hunger_level: nullable(text),
  bowel_movement: nullable(text), ...timestamps,
};
const mealSchema = {
  id: uuid, daily_record_id: uuid, recording_category: text, meal_order: order,
  eaten_at: nullable(timestamp), meal_memo: nullable(text), ...timestamps,
};
const attachmentSchema = {
  id: uuid, meal_record_id: uuid, storage_path: text, attachment_order: nullable(order), ...timestamps,
};
const foodSchema = {
  id: uuid, meal_record_id: uuid, food_item_order: order, food_name: text,
  food_amount: nullable(numeric), food_amount_unit: text, food_calorie: nullable(numeric),
  food_protein: nullable(numeric), food_fat: nullable(numeric), food_carbohydrates: nullable(numeric),
  ...timestamps,
};
const sessionSchema = {
  id: uuid, daily_record_id: uuid, session_order: order, session_label: nullable(text),
  started_at: nullable(timestamp), ended_at: nullable(timestamp), memo: nullable(text),
  calories_burned: nullable(integer), ...timestamps,
};
const itemSchema = {
  id: uuid, exercise_session_id: uuid, item_order: order, body_part: nullable(text),
  exercise_name: text, exercise_type: oneOf("AEROBIC", "ANAEROBIC"), ...timestamps,
};
const setSchema = {
  id: uuid, exercise_item_id: uuid, set_order: order, load_value: nullable(numeric),
  load_unit: nullable(oneOf("KG", "LBS", "BODYWEIGHT")), reps: nullable(integer),
  has_sides: boolean, reps_left: nullable(integer), reps_right: nullable(integer),
  duration_seconds: nullable(integer), memo: nullable(text), ...timestamps,
};

const rows = (value: unknown): Row[] => {
  if (!Array.isArray(value)) return invalid();
  return value.map(object);
};
const ownedChild = (row: Row, userId: string, parentKey: string, parentId: string): Row => {
  if (row.user_id !== userId || row[parentKey] !== parentId) return invalid();
  return row;
};
const sorted = <T extends { id: string }>(values: T[], getOrder: (row: T) => number | null): T[] => {
  if (new Set(values.map((row) => row.id)).size !== values.length) return invalid();
  return values.sort((a, b) =>
    (getOrder(a) ?? Number.MAX_SAFE_INTEGER) - (getOrder(b) ?? Number.MAX_SAFE_INTEGER)
    || a.id.localeCompare(b.id));
};

export const mapNormalizedDailyRecord = (
  value: unknown,
  expected: { userId: string; date: string },
): DailyRecordAggregate => {
  const row = object(value);
  const daily_record = decodeRow(row, rootSchema);
  if (daily_record.user_id !== expected.userId || daily_record.record_date !== expected.date) {
    return invalid();
  }
  const child = (value: Row, parentKey = "daily_record_id", parentId = daily_record.id) =>
    ownedChild(value, expected.userId, parentKey, parentId);

  // PostgREST can expose this reverse composite FK as to-one or to-many.
  const wellnessRows = row.wellness_record === null ? []
    : Array.isArray(row.wellness_record) ? rows(row.wellness_record)
      : [object(row.wellness_record)];
  if (wellnessRows.length > 1) return invalid();

  const weights = sorted(rows(row.weight_record).map((weight) =>
    decodeRow(child(weight), weightSchema)), (weight) => weight.measurement_order);
  const meals = rows(row.meal_record).map((meal) => {
    const meal_record = decodeRow(child(meal), mealSchema);
    return {
      meal_record,
      attachments: sorted(rows(meal.meal_attachment).map((attachment) =>
        decodeRow(child(attachment, "meal_record_id", meal_record.id), attachmentSchema)),
      (attachment) => attachment.attachment_order),
      food_items: sorted(rows(meal.food_item).map((food) =>
        decodeRow(child(food, "meal_record_id", meal_record.id), foodSchema)),
      (food) => food.food_item_order),
    };
  });
  // Category labels remain open strings; preserve them rather than normalizing data on read.
  meals.sort((a, b) => a.meal_record.recording_category.localeCompare(b.meal_record.recording_category)
    || a.meal_record.meal_order - b.meal_record.meal_order
    || a.meal_record.id.localeCompare(b.meal_record.id));

  const exercise_sessions = rows(row.exercise_session).map((sessionRow) => {
    const session = decodeRow(child(sessionRow), sessionSchema);
    const items = sorted(rows(sessionRow.exercise_item).map((itemRow): ExerciseItem => {
      const item = decodeRow(child(itemRow, "exercise_session_id", session.id), itemSchema);
      const sets = sorted(rows(itemRow.set_item).map((set) =>
        decodeRow(child(set, "exercise_item_id", item.id), setSchema)), (set) => set.set_order);
      if (itemRow.recording_style === "TEXT") {
        if (sets.length) return invalid();
        return { ...item, recording_style: "TEXT", free_text: text(itemRow.free_text) };
      }
      if (itemRow.recording_style !== "SETS" || itemRow.free_text !== null) return invalid();
      return { ...item, recording_style: "SETS", sets };
    }), (item) => item.item_order);
    return { session, items };
  });
  exercise_sessions.sort((a, b) => a.session.session_order - b.session.session_order
    || a.session.id.localeCompare(b.session.id));

  return {
    daily_record, weights,
    wellness: wellnessRows.length ? decodeRow(child(wellnessRows[0]), wellnessSchema) : null,
    meals, exercise_sessions,
  };
};

export const mapNormalizedHistoryRow = (value: unknown, userId: string): DailyRecordSummary => {
  const row = object(value);
  if (row.user_id !== userId) return invalid();
  return decodeRow(row, { record_date: date, updated_at: timestamp });
};

export const isNormalizedDeletedRow = (
  value: unknown, expected: { userId: string; date: string },
): boolean => {
  const row = object(value);
  uuid(row.id);
  return row.user_id === expected.userId && row.record_date === expected.date;
};
