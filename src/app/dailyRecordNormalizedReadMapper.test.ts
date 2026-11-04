import { describe, expect, it } from "vitest";
import { mapNormalizedDailyRecord } from "./dailyRecordNormalizedReadMapper";
import { mapDailyRecordToNormalizedSavePayload } from "./dailyRecordNormalizedWriteMapper";
import {
  normalizedRecordFixture, normalizedUserId, normalizedDate,
} from "./testing/normalizedRecordFixture";

const expected = { userId: normalizedUserId, date: normalizedDate };

describe("mapNormalizedDailyRecord", () => {
  it("restores every hierarchy in persisted order without renumbering or mutation", () => {
    const row = normalizedRecordFixture();
    const source = structuredClone(row);
    const record = mapNormalizedDailyRecord(row, expected);
    expect(record.weights.map((weight) => weight.measurement_order)).toEqual([0, 2]);
    expect(record.meals.map((meal) => meal.meal_record.meal_order)).toEqual([0, 2]);
    expect(record.meals[0].attachments.map((attachment) => attachment.attachment_order)).toEqual([0, 2]);
    expect(record.meals[0].food_items.map((food) => food.food_item_order)).toEqual([0, 2]);
    expect(record.exercise_sessions.map((session) => session.session.session_order)).toEqual([0, 2]);
    const items = record.exercise_sessions[0].items;
    expect(items.map((item) => item.item_order)).toEqual([0, 2]);
    if (items[0].recording_style !== "SETS") throw new Error("Expected SETS");
    expect(items[0].sets.map((set) => set.set_order)).toEqual([0, 2]);
    expect(items[0].sets[0].load_value).toBe(50.5);
    expect(record.meals[0].food_items[0]).toMatchObject({ food_amount: null, food_calorie: null });
    expect(record.wellness?.sleep_duration_minutes).toBe(420);
    expect(record.daily_record.created_at).toBe(row.created_at);
    expect(record.daily_record).not.toHaveProperty("weight_record");
    expect(record.weights[0]).not.toHaveProperty("user_id");
    expect(row).toEqual(source);
    // The restored aggregate can re-enter the approved write boundary.
    const payload = mapDailyRecordToNormalizedSavePayload({ ...expected, record });
    expect(payload.daily_record).toEqual(record.daily_record);
    expect(payload.meals[0].food_items[0].food_amount).toBeNull();
  });

  it("reconstructs a TEXT item without a sets property", () => {
    const row = normalizedRecordFixture();
    Object.assign(row.exercise_session[0].exercise_item[0], {
      recording_style: "TEXT", free_text: "Walked 20 minutes", set_item: [],
    });
    const record = mapNormalizedDailyRecord(row, expected);
    const item = record.exercise_sessions[1].items[1];
    expect(item).toMatchObject({ recording_style: "TEXT", free_text: "Walked 20 minutes" });
    expect(item).not.toHaveProperty("sets");
  });

  it.each([null, []])("maps an absent wellness relation %j to null", (wellness) => {
    const row = { ...normalizedRecordFixture(), wellness_record: wellness };
    expect(mapNormalizedDailyRecord(row, expected).wellness).toBeNull();
  });

  it("supports a to-one wellness embedding", () => {
    const source = normalizedRecordFixture();
    const row = { ...source, wellness_record: source.wellness_record[0] };
    expect(mapNormalizedDailyRecord(row, expected).wellness?.sleep_duration_minutes).toBe(420);
  });

  const corruptions: [string, (row: ReturnType<typeof normalizedRecordFixture>) => void][] = [
    ["root owner", (row) => { row.user_id = "another-user"; }],
    ["root date", (row) => { row.record_date = "2026-11-04"; }],
    ["invalid calendar date", (row) => { row.record_date = "2026-02-30"; }],
    ["missing relation", (row) => { Reflect.deleteProperty(row, "weight_record"); }],
    ["missing required timestamp", (row) => { Reflect.deleteProperty(row, "created_at"); }],
    ["multiple wellness rows", (row) => { row.wellness_record.push(row.wellness_record[0]); }],
    ["foreign child owner", (row) => { row.meal_record[0].food_item[0].user_id = "other"; }],
    ["forged parent", (row) => { row.exercise_session[0].exercise_item[0].set_item[0].exercise_item_id = row.id; }],
    ["non-finite number", (row) => { row.weight_record[0].weight = Infinity; }],
    ["string number", (row) => { Object.assign(row.weight_record[0], { weight: "70" }); }],
    ["negative order", (row) => { row.weight_record[0].measurement_order = -1; }],
    ["unknown style", (row) => { row.exercise_session[0].exercise_item[0].recording_style = "OTHER"; }],
    ["TEXT with sets", (row) => { Object.assign(row.exercise_session[0].exercise_item[0], { recording_style: "TEXT", free_text: "text" }); }],
    ["SETS with text", (row) => { Object.assign(row.exercise_session[0].exercise_item[0], { free_text: "text" }); }],
    ["invalid load unit", (row) => { row.exercise_session[0].exercise_item[0].set_item[0].load_unit = "OTHER"; }],
    ["duplicate entity ID", (row) => { row.weight_record[1].id = row.weight_record[0].id; }],
    ["invalid UUID", (row) => { row.meal_record[0].food_item[0].id = "legacy-id"; }],
  ];
  it.each(corruptions)("rejects %s instead of returning partial data", (_name, corrupt) => {
    const row = normalizedRecordFixture();
    corrupt(row);
    expect(() => mapNormalizedDailyRecord(row, expected)).toThrow("invalid normalized daily record");
  });
});
