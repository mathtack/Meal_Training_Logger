import { supabase } from "../lib/supabaseClient";
import type {
  DailyRecord,
  DailyRecordAggregate,
  ISODate,
  UUID,
} from "../domain/type";
import { mapDailyRecordToNormalizedSavePayload } from "./dailyRecordNormalizedWriteMapper";

const FUNCTION_NAME = "save_daily_record_normalized";
const INVALID_RESPONSE = "Supabase normalized save returned an invalid identity.";

type NormalizedSaveParams = {
  userId: UUID;
  date: ISODate;
  record: DailyRecordAggregate;
};

type NormalizedSaveError = {
  status: "error";
  message: string;
};

export type NormalizedSaveResult =
  | { status: "saved"; identity: DailyRecord }
  | NormalizedSaveError;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isIdentity = (value: unknown): value is DailyRecord =>
  isObject(value) &&
  typeof value.id === "string" &&
  typeof value.user_id === "string" &&
  typeof value.record_date === "string" &&
  typeof value.created_at === "string" &&
  typeof value.updated_at === "string";

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (isObject(error) && typeof error.message === "string") return error.message;
  return "Unknown Supabase error.";
};

export const saveDailyRecordNormalized = async ({
  userId,
  date,
  record,
}: NormalizedSaveParams): Promise<NormalizedSaveResult> => {
  try {
    const payload = mapDailyRecordToNormalizedSavePayload({ userId, date, record });
    const { data, error } = await supabase.rpc(FUNCTION_NAME, {
      p_record: payload,
    });

    if (error) return { status: "error", message: error.message };

    if (
      !isIdentity(data) ||
      data.id !== payload.daily_record.id ||
      data.user_id !== userId ||
      data.record_date !== date
    ) {
      return { status: "error", message: INVALID_RESPONSE };
    }

    return { status: "saved", identity: data };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
};
