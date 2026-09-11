import { normalizeCloudDailyRecord } from "./dailyRecordCloud";
import type {
  DailyRecordAggregate,
  ISODate,
  ISODateTime,
  UUID,
} from "../domain/type";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type MapNormalizedSaveParams = {
  userId: UUID;
  date: ISODate;
  record: DailyRecordAggregate;
};

const invalidPayload = (message: string): never => {
  throw new Error(`Invalid normalized save payload: ${message}`);
};

const requireUUID = (value: string, path: string): void => {
  if (!UUID_PATTERN.test(value)) invalidPayload(`${path} must be a UUID.`);
};

const requireDate = (value: string, path: string): void => {
  if (!ISO_DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    invalidPayload(`${path} must be an ISO date.`);
  }
};

const requireDateTime = (value: ISODateTime | null | undefined, path: string): void => {
  if (value !== null && value !== undefined && Number.isNaN(Date.parse(value))) {
    invalidPayload(`${path} must be an ISO date-time or null.`);
  }
};

const requireFinite = (value: number | null | undefined, path: string): void => {
  if (value !== null && value !== undefined && !Number.isFinite(value)) {
    invalidPayload(`${path} must be a finite number or null.`);
  }
};

const requireParent = (value: string, expected: string, path: string): void => {
  if (value !== expected) invalidPayload(`${path} does not match its nesting parent.`);
};

const validatePayload = (record: DailyRecordAggregate): void => {
  const root = record.daily_record;
  requireUUID(root.id, "daily_record.id");
  requireUUID(root.user_id, "daily_record.user_id");
  requireDate(root.record_date, "daily_record.record_date");
  requireDateTime(root.created_at, "daily_record.created_at");
  requireDateTime(root.updated_at, "daily_record.updated_at");

  record.weights.forEach((weight, index) => {
    const path = `weights[${index}]`;
    requireUUID(weight.id, `${path}.id`);
    requireParent(weight.daily_record_id, root.id, `${path}.daily_record_id`);
    requireDateTime(weight.measured_at, `${path}.measured_at`);
    requireDateTime(weight.created_at, `${path}.created_at`);
    requireDateTime(weight.updated_at, `${path}.updated_at`);
    requireFinite(weight.weight, `${path}.weight`);
  });

  if (record.wellness) {
    requireParent(
      record.wellness.daily_record_id,
      root.id,
      "wellness.daily_record_id",
    );
    requireDateTime(record.wellness.created_at, "wellness.created_at");
    requireDateTime(record.wellness.updated_at, "wellness.updated_at");
    requireFinite(
      record.wellness.sleep_duration_minutes,
      "wellness.sleep_duration_minutes",
    );
  }

  record.meals.forEach((meal, mealIndex) => {
    const path = `meals[${mealIndex}]`;
    const mealRecord = meal.meal_record;
    requireUUID(mealRecord.id, `${path}.meal_record.id`);
    requireParent(
      mealRecord.daily_record_id,
      root.id,
      `${path}.meal_record.daily_record_id`,
    );
    requireDateTime(mealRecord.eaten_at, `${path}.meal_record.eaten_at`);
    requireDateTime(mealRecord.created_at, `${path}.meal_record.created_at`);
    requireDateTime(mealRecord.updated_at, `${path}.meal_record.updated_at`);

    meal.attachments.forEach((attachment, attachmentIndex) => {
      const attachmentPath = `${path}.attachments[${attachmentIndex}]`;
      requireUUID(attachment.id, `${attachmentPath}.id`);
      requireParent(
        attachment.meal_record_id,
        mealRecord.id,
        `${attachmentPath}.meal_record_id`,
      );
      requireDateTime(attachment.created_at, `${attachmentPath}.created_at`);
      requireDateTime(attachment.updated_at, `${attachmentPath}.updated_at`);
    });

    meal.food_items.forEach((food, foodIndex) => {
      const foodPath = `${path}.food_items[${foodIndex}]`;
      requireUUID(food.id, `${foodPath}.id`);
      requireParent(food.meal_record_id, mealRecord.id, `${foodPath}.meal_record_id`);
      requireFinite(food.food_amount, `${foodPath}.food_amount`);
      requireFinite(food.food_calorie, `${foodPath}.food_calorie`);
      requireFinite(food.food_protein, `${foodPath}.food_protein`);
      requireFinite(food.food_fat, `${foodPath}.food_fat`);
      requireFinite(food.food_carbohydrates, `${foodPath}.food_carbohydrates`);
      requireDateTime(food.created_at, `${foodPath}.created_at`);
      requireDateTime(food.updated_at, `${foodPath}.updated_at`);
    });
  });

  record.exercise_sessions.forEach((aggregate, sessionIndex) => {
    const path = `exercise_sessions[${sessionIndex}]`;
    const session = aggregate.session;
    requireUUID(session.id, `${path}.session.id`);
    requireParent(
      session.daily_record_id,
      root.id,
      `${path}.session.daily_record_id`,
    );
    requireDateTime(session.started_at, `${path}.session.started_at`);
    requireDateTime(session.ended_at, `${path}.session.ended_at`);
    requireFinite(session.calories_burned, `${path}.session.calories_burned`);
    requireDateTime(session.created_at, `${path}.session.created_at`);
    requireDateTime(session.updated_at, `${path}.session.updated_at`);

    aggregate.items.forEach((item, itemIndex) => {
      const itemPath = `${path}.items[${itemIndex}]`;
      requireUUID(item.id, `${itemPath}.id`);
      requireParent(
        item.exercise_session_id,
        session.id,
        `${itemPath}.exercise_session_id`,
      );
      requireDateTime(item.created_at, `${itemPath}.created_at`);
      requireDateTime(item.updated_at, `${itemPath}.updated_at`);

      if (item.recording_style === "SETS") {
        item.sets.forEach((set, setIndex) => {
          const setPath = `${itemPath}.sets[${setIndex}]`;
          requireUUID(set.id, `${setPath}.id`);
          requireParent(set.exercise_item_id, item.id, `${setPath}.exercise_item_id`);
          requireFinite(set.load_value, `${setPath}.load_value`);
          requireFinite(set.reps, `${setPath}.reps`);
          requireFinite(set.reps_left, `${setPath}.reps_left`);
          requireFinite(set.reps_right, `${setPath}.reps_right`);
          requireFinite(set.duration_seconds, `${setPath}.duration_seconds`);
          requireDateTime(set.created_at, `${setPath}.created_at`);
          requireDateTime(set.updated_at, `${setPath}.updated_at`);
        });
      }
    });
  });
};

export const mapDailyRecordToNormalizedSavePayload = ({
  userId,
  date,
  record,
}: MapNormalizedSaveParams): DailyRecordAggregate => {
  const payload = normalizeCloudDailyRecord({ record, userId, date });
  validatePayload(payload);
  return payload;
};
