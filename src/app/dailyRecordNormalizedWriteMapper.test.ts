import { describe, expect, it } from "vitest";
import type { DailyRecordAggregate, ISODate, UUID } from "../domain/type";
import { mapDailyRecordToNormalizedSavePayload } from "./dailyRecordNormalizedWriteMapper";

const USER_ID = "00000000-0000-4000-8000-000000000001" as UUID;
const ROOT_ID = "00000000-0000-4000-8000-000000000002" as UUID;
const MEAL_ID = "00000000-0000-4000-8000-000000000003" as UUID;
const FOOD_ID = "00000000-0000-4000-8000-000000000004" as UUID;
const SESSION_ID = "00000000-0000-4000-8000-000000000005" as UUID;
const ITEM_ID = "00000000-0000-4000-8000-000000000006" as UUID;
const SET_ID = "00000000-0000-4000-8000-000000000007" as UUID;
const WEIGHT_ID = "00000000-0000-4000-8000-000000000008" as UUID;
const DATE = "2026-09-11" as ISODate;
const TIME = "2026-09-11T01:00:00.000Z";

const createAggregate = (): DailyRecordAggregate => ({
  daily_record: {
    id: ROOT_ID,
    user_id: "00000000-0000-4000-8000-000000000099",
    record_date: "2026-01-01",
    created_at: TIME,
    updated_at: TIME,
  },
  weights: [
    {
      id: WEIGHT_ID,
      daily_record_id: ROOT_ID,
      measurement_time_slot: "MORNING",
      measurement_order: 9,
      weight: 70.25,
      measured_at: null,
      created_at: TIME,
      updated_at: TIME,
    },
  ],
  wellness: {
    daily_record_id: ROOT_ID,
    sleep_duration_minutes: 420,
    created_at: TIME,
    updated_at: TIME,
  },
  meals: [
    {
      meal_record: {
        id: MEAL_ID,
        daily_record_id: ROOT_ID,
        recording_category: "BREAKFAST",
        meal_order: 4,
        created_at: TIME,
        updated_at: TIME,
      },
      attachments: [],
      food_items: [
        {
          id: FOOD_ID,
          meal_record_id: MEAL_ID,
          food_item_order: 3,
          food_name: "draft",
          food_amount: null,
          food_amount_unit: "g",
          food_calorie: null,
          created_at: TIME,
          updated_at: TIME,
        },
      ],
    },
  ],
  exercise_sessions: [
    {
      session: {
        id: SESSION_ID,
        daily_record_id: ROOT_ID,
        session_order: 7,
        created_at: TIME,
        updated_at: TIME,
      },
      items: [
        {
          id: ITEM_ID,
          exercise_session_id: SESSION_ID,
          item_order: 5,
          exercise_name: "Squat",
          exercise_type: "ANAEROBIC",
          recording_style: "SETS",
          created_at: TIME,
          updated_at: TIME,
          sets: [
            {
              id: SET_ID,
              exercise_item_id: ITEM_ID,
              set_order: 6,
              has_sides: false,
              created_at: TIME,
              updated_at: TIME,
            },
          ],
        },
      ],
    },
  ],
});

describe("mapDailyRecordToNormalizedSavePayload", () => {
  it("applies cloud identity, normalizes orders, and preserves draft nulls", () => {
    const source = createAggregate();
    const payload = mapDailyRecordToNormalizedSavePayload({
      userId: USER_ID,
      date: DATE,
      record: source,
    });

    expect(payload.daily_record.user_id).toBe(USER_ID);
    expect(payload.daily_record.record_date).toBe(DATE);
    expect(payload.weights[0].measurement_order).toBe(0);
    expect(payload.meals[0].meal_record.meal_order).toBe(0);
    expect(payload.meals[0].food_items[0].food_item_order).toBe(0);
    expect(payload.meals[0].food_items[0].food_amount).toBeNull();
    expect(payload.meals[0].food_items[0].food_calorie).toBeNull();
    expect(payload.exercise_sessions[0].session.session_order).toBe(0);
    expect(payload.exercise_sessions[0].items[0].item_order).toBe(0);
    expect(payload.exercise_sessions[0].items[0].recording_style).toBe("SETS");
    expect(source.daily_record.user_id).not.toBe(USER_ID);
    expect(source.weights[0].measurement_order).toBe(9);
  });

  it("rejects a non-UUID aggregate identity", () => {
    const record = createAggregate();
    record.daily_record.id = "not-a-uuid";

    expect(() =>
      mapDailyRecordToNormalizedSavePayload({ userId: USER_ID, date: DATE, record }),
    ).toThrow("daily_record.id must be a UUID");
  });

  it("rejects a nested relationship that does not match its parent", () => {
    const record = createAggregate();
    record.meals[0].food_items[0].meal_record_id = ROOT_ID;

    expect(() =>
      mapDailyRecordToNormalizedSavePayload({ userId: USER_ID, date: DATE, record }),
    ).toThrow("does not match its nesting parent");
  });

  it("rejects non-finite numeric values before calling the database", () => {
    const record = createAggregate();
    record.weights[0].weight = Number.NaN;

    expect(() =>
      mapDailyRecordToNormalizedSavePayload({ userId: USER_ID, date: DATE, record }),
    ).toThrow("must be a finite number or null");
  });
});
