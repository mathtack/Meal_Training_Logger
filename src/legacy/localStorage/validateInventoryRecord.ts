// Inventory accepts unknown JSON; never trust the legacy reader's shallow type guard.
type Row = Record<string, unknown>;
const fail = (): never => { throw new Error("invalid_contract"); };
const row = (v: unknown): Row => v && typeof v === "object" && !Array.isArray(v) ? v as Row : fail();
const array = (v: unknown): unknown[] => Array.isArray(v) ? v : fail();
const text = (v: unknown) => typeof v === "string" || fail();
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) || fail();
const number = (v: unknown) => typeof v === "number" && Number.isFinite(v) || fail();
const order = (v: unknown) => number(v) && Number.isSafeInteger(v) && (v as number) >= 0 || fail();
const time = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v)) || fail();
const optional = (check: (v: unknown) => unknown) => (v: unknown) => v == null || check(v);
const nullable = (check: (v: unknown) => unknown) => (v: unknown) => v === null || check(v);
const enumeration = (...values: string[]) => (v: unknown) => typeof v === "string" && values.includes(v) || fail();
const stamps = { created_at: time, updated_at: time };
type Schema = Record<string, (v: unknown) => unknown>;
const fields = (r: Row, schema: Schema) => {
  if (Object.keys(r).some(k => !Object.hasOwn(schema, k))) fail();
  for (const [k, check] of Object.entries(schema)) check(r[k]);
};

export function validateInventoryRecord(value: unknown, date: string): void {
  const a = row(value);
  if (Object.keys(a).some(k => !["daily_record", "weights", "wellness", "meals", "exercise_sessions"].includes(k))) fail();
  const root = row(a.daily_record);
  fields(root, { id: uuid, user_id: text, record_date: text, ...stamps });
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || root.record_date !== date) fail();
  const ids = new Map<string, Set<unknown>>();
  const child = (v: unknown, table: string, parentKey: string, parentId: unknown, schema: Schema) => {
    const r = row(v);
    fields(r, { ...schema, [parentKey]: uuid, ...stamps });
    if (r[parentKey] !== parentId) fail();
    if ("id" in schema) {
      const seen = ids.get(table) ?? new Set();
      if (seen.has(r.id)) fail();
      seen.add(r.id); ids.set(table, seen);
    }
    return r;
  };
  for (const w of array(a.weights)) child(w, "weight", "daily_record_id", root.id, {
    id: uuid, measurement_time_slot: text, measurement_order: order, weight: number, measured_at: optional(time),
  });
  if (a.wellness !== null) child(a.wellness, "wellness", "daily_record_id", root.id, {
    ...Object.fromEntries(["sleep_duration_category", "sleep_quality", "sleep_source", "water_intake", "physical_condition", "mood", "hunger_level", "bowel_movement"].map(k => [k, optional(text)])),
    sleep_duration_minutes: optional(number),
  });
  for (const m of array(a.meals)) {
    const meal = row(m);
    fields(meal, { meal_record: row, attachments: array, food_items: array });
    const mr = child(meal.meal_record, "meal", "daily_record_id", root.id, {
      id: uuid, recording_category: text, meal_order: order, eaten_at: optional(time), meal_memo: optional(text),
    });
    for (const v of array(meal.attachments)) child(v, "attachment", "meal_record_id", mr.id, {
      id: uuid, storage_path: text, attachment_order: optional(order),
    });
    for (const v of array(meal.food_items)) child(v, "food", "meal_record_id", mr.id, {
      id: uuid, food_item_order: order, food_name: text, food_amount: nullable(number), food_amount_unit: text,
      food_calorie: nullable(number), food_protein: optional(number), food_fat: optional(number), food_carbohydrates: optional(number),
    });
  }
  for (const s of array(a.exercise_sessions)) {
    const session = row(s);
    fields(session, { session: row, items: array });
    const sr = child(session.session, "session", "daily_record_id", root.id, {
      id: uuid, session_order: order, session_label: optional(text), started_at: optional(time), ended_at: optional(time), memo: optional(text), calories_burned: optional(number),
    });
    for (const v of array(session.items)) {
      const item = row(v);
      const ir = child(item, "item", "exercise_session_id", sr.id, {
        id: uuid, item_order: order, body_part: optional(text), exercise_name: text,
        exercise_type: enumeration("AEROBIC", "ANAEROBIC"), recording_style: enumeration("TEXT", "SETS"),
        ...(item.recording_style === "TEXT" ? { free_text: text } : { sets: array }),
      });
      if (ir.recording_style === "SETS") for (const set of array(ir.sets)) child(set, "set", "exercise_item_id", ir.id, {
        id: uuid, set_order: order, load_value: optional(number), load_unit: optional(enumeration("KG", "LBS", "BODYWEIGHT")),
        reps: optional(number), has_sides: v => typeof v === "boolean" || fail(), reps_left: optional(number), reps_right: optional(number), duration_seconds: optional(number), memo: optional(text),
      });
    }
  }
}
