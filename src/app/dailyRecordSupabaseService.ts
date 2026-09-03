import { supabase } from "../lib/supabaseClient";
import type {
  DailyRecordAggregate,
  DailyRecordSummary,
  ISODate,
} from "../domain/type";

const TABLE_NAME = "daily_record_store";
const INVALID_SAVE_RESPONSE = "Supabase save did not return the saved record.";
const INVALID_READ_RESPONSE = "Supabase returned an invalid daily record.";
const INVALID_DELETE_RESPONSE = "Supabase delete returned an invalid response.";
const INVALID_HISTORY_RESPONSE = "Supabase returned an invalid history response.";

type SupabaseErrorResult = {
  status: "error";
  message: string;
};

export type SupabaseSaveResult =
  | { status: "saved" }
  | SupabaseErrorResult;

export type SupabaseReadResult =
  | { status: "found"; record: DailyRecordAggregate }
  | { status: "not_found" }
  | SupabaseErrorResult;

export type SupabaseDeleteResult =
  | { status: "deleted" }
  | { status: "not_found" }
  | SupabaseErrorResult;

export type SupabaseHistoryResult =
  | { status: "success"; entries: DailyRecordSummary[] }
  | SupabaseErrorResult;

type SaveParams = {
  userId: string;
  date: ISODate;
  record: DailyRecordAggregate;
};

type ReadParams = {
  userId: string;
  date: ISODate;
};

type DeleteParams = {
  userId: string;
  date: ISODate;
};

type HistoryParams = {
  userId: string;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDailyRecordAggregate = (
  value: unknown,
): value is DailyRecordAggregate => {
  if (!isObject(value) || !isObject(value.daily_record)) return false;

  const dailyRecord = value.daily_record;

  return (
    typeof dailyRecord.id === "string" &&
    typeof dailyRecord.user_id === "string" &&
    typeof dailyRecord.record_date === "string" &&
    typeof dailyRecord.created_at === "string" &&
    typeof dailyRecord.updated_at === "string" &&
    Array.isArray(value.weights) &&
    (value.wellness === null || isObject(value.wellness)) &&
    Array.isArray(value.meals) &&
    Array.isArray(value.exercise_sessions)
  );
};

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (isObject(error) && typeof error.message === "string") {
    return error.message;
  }
  return "Unknown Supabase error.";
};

export const saveDailyRecordToSupabase = async (
  params: SaveParams,
): Promise<SupabaseSaveResult> => {
  const { userId, date, record } = params;

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .upsert(
        {
          user_id: userId,
          record_date: date,
          record_json: record,
        },
        {
          onConflict: "user_id,record_date",
        },
      )
      .select("record_date")
      .maybeSingle();

    if (error) {
      return { status: "error", message: error.message };
    }

    if (!data || data.record_date !== date) {
      return { status: "error", message: INVALID_SAVE_RESPONSE };
    }

    return { status: "saved" };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
};

export const fetchDailyRecordFromSupabase = async (
  params: ReadParams,
): Promise<SupabaseReadResult> => {
  const { userId, date } = params;

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("record_json")
      .eq("user_id", userId)
      .eq("record_date", date)
      .maybeSingle();

    if (error) {
      return { status: "error", message: error.message };
    }

    if (!data) {
      return { status: "not_found" };
    }

    if (
      !isDailyRecordAggregate(data.record_json) ||
      data.record_json.daily_record.record_date !== date
    ) {
      return { status: "error", message: INVALID_READ_RESPONSE };
    }

    return { status: "found", record: data.record_json };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
};

export const deleteDailyRecordFromSupabase = async (
  params: DeleteParams,
): Promise<SupabaseDeleteResult> => {
  const { userId, date } = params;

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq("user_id", userId)
      .eq("record_date", date)
      .select("id");

    if (error) {
      return { status: "error", message: error.message };
    }

    if (!Array.isArray(data)) {
      return { status: "error", message: INVALID_DELETE_RESPONSE };
    }

    if (data.length === 0) {
      return { status: "not_found" };
    }

    return { status: "deleted" };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
};

export const fetchDailyRecordHistoryFromSupabase = async (
  params: HistoryParams,
): Promise<SupabaseHistoryResult> => {
  const { userId } = params;

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("record_date,record_json")
      .eq("user_id", userId)
      .order("record_date", { ascending: false });

    if (error) {
      return { status: "error", message: error.message };
    }

    if (!Array.isArray(data)) {
      return { status: "error", message: INVALID_HISTORY_RESPONSE };
    }

    const entries: DailyRecordSummary[] = [];

    for (const row of data) {
      if (
        !isObject(row) ||
        typeof row.record_date !== "string" ||
        !isDailyRecordAggregate(row.record_json)
      ) {
        return { status: "error", message: INVALID_HISTORY_RESPONSE };
      }

      entries.push({
        record_date: row.record_date,
        updated_at: row.record_json.daily_record.updated_at,
      });
    }

    return { status: "success", entries };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
};
