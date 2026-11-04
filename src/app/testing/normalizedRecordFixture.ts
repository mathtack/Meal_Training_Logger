export const normalizedUserId = "10000000-0000-4000-8000-000000000001";
export const normalizedDate = "2026-11-05";
export const normalizedTime = "2026-11-05T00:00:00+00:00";
export const fixtureId = (number: number) =>
  `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const stamps = { created_at: normalizedTime, updated_at: normalizedTime };
const tenant = { user_id: normalizedUserId };

export const normalizedRecordFixture = () => ({
  id: fixtureId(2), ...tenant, record_date: normalizedDate, ...stamps,
  weight_record: [2, 0].map((measurement_order) => ({
    id: fixtureId(10 + measurement_order), ...tenant, daily_record_id: fixtureId(2),
    measurement_time_slot: "OTHER", measurement_order, weight: 70.25,
    measured_at: null, ...stamps,
  })),
  wellness_record: [{
    ...tenant, daily_record_id: fixtureId(2), sleep_duration_category: null,
    sleep_quality: "GOOD", sleep_duration_minutes: 420, sleep_source: null,
    water_intake: null, physical_condition: null, mood: null, hunger_level: null,
    bowel_movement: null, ...stamps,
  }],
  meal_record: [2, 0].map((meal_order) => ({
    id: fixtureId(20 + meal_order), ...tenant, daily_record_id: fixtureId(2),
    recording_category: "BREAKFAST", meal_order, eaten_at: null, meal_memo: "memo", ...stamps,
    meal_attachment: [2, 0].map((attachment_order) => ({
      id: fixtureId(100 + meal_order * 10 + attachment_order), ...tenant,
      meal_record_id: fixtureId(20 + meal_order), storage_path: "private/test.jpg",
      attachment_order, ...stamps,
    })),
    food_item: [2, 0].map((food_item_order) => ({
      id: fixtureId(200 + meal_order * 10 + food_item_order), ...tenant,
      meal_record_id: fixtureId(20 + meal_order), food_item_order, food_name: "",
      food_amount: null, food_amount_unit: "", food_calorie: null,
      food_protein: 1.25, food_fat: null, food_carbohydrates: null, ...stamps,
    })),
  })),
  exercise_session: [2, 0].map((session_order) => ({
    id: fixtureId(30 + session_order), ...tenant, daily_record_id: fixtureId(2),
    session_order, session_label: null, started_at: null, ended_at: null, memo: null,
    calories_burned: 100, ...stamps,
    exercise_item: [2, 0].map((item_order) => ({
      id: fixtureId(300 + session_order * 10 + item_order), ...tenant,
      exercise_session_id: fixtureId(30 + session_order), item_order, body_part: null,
      exercise_name: "Squat", exercise_type: "ANAEROBIC", recording_style: "SETS",
      free_text: null, ...stamps,
      set_item: [2, 0].map((set_order) => ({
        id: fixtureId(400 + session_order * 100 + item_order * 10 + set_order), ...tenant,
        exercise_item_id: fixtureId(300 + session_order * 10 + item_order), set_order,
        load_value: 50.5, load_unit: "KG", reps: 10, has_sides: false,
        reps_left: null, reps_right: null, duration_seconds: null, memo: null, ...stamps,
      })),
    })),
  })),
});
