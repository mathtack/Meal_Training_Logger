import { supabase } from "../lib/supabaseClient";
import type { ISODate, DailyRecordSummary } from "../domain/type";
import type {
  SupabaseReadResult, SupabaseDeleteResult, SupabaseHistoryResult,
} from "./dailyRecordSupabaseService";
import {
  mapNormalizedDailyRecord, mapNormalizedHistoryRow, isNormalizedDeletedRow,
} from "./dailyRecordNormalizedReadMapper";

// FK names are the Git-managed schema contract, not inferred column shortcuts.
const AGGREGATE_SELECT = `
  *,
  weight_record!weight_record_daily_record_user_fkey(*),
  wellness_record!wellness_record_daily_record_user_fkey(*),
  meal_record!meal_record_daily_record_user_fkey(
    *, meal_attachment!meal_attachment_meal_record_user_fkey(*),
    food_item!food_item_meal_record_user_fkey(*)
  ),
  exercise_session!exercise_session_daily_record_user_fkey(
    *, exercise_item!exercise_item_exercise_session_user_fkey(
      *, set_item!set_item_exercise_item_user_fkey(*)
    )
  )
`;

type RecordParams = { userId: string; date: ISODate };
const errorResult = (error: unknown): { status: "error"; message: string } => ({
  status: "error",
  message: error instanceof Error ? error.message : "Unknown Supabase error.",
});

export const fetchDailyRecordNormalized = async (
  params: RecordParams,
): Promise<SupabaseReadResult> => {
  try {
    const { data, error } = await supabase.from("daily_record")
      .select(AGGREGATE_SELECT)
      .eq("user_id", params.userId).eq("record_date", params.date).maybeSingle();
    if (error) return { status: "error", message: error.message };
    if (data === null) return { status: "not_found" };
    return { status: "found", record: mapNormalizedDailyRecord(data, params) };
  } catch (error) {
    return errorResult(error);
  }
};

export const fetchDailyRecordHistoryNormalized = async (
  { userId }: { userId: string },
): Promise<SupabaseHistoryResult> => {
  try {
    const entries: DailyRecordSummary[] = [];
    let before: ISODate | undefined;
    // Keyset pagination tolerates a server row cap smaller than the requested
    // page size; only an empty page is terminal. Dates are unique per tenant.
    while (true) {
      let query = supabase.from("daily_record").select("user_id,record_date,updated_at")
        .eq("user_id", userId).order("record_date", { ascending: false }).limit(500);
      if (before) query = query.lt("record_date", before);
      const { data, error } = await query;
      if (error) return { status: "error", message: error.message };
      if (!Array.isArray(data)) throw new Error("Supabase returned an invalid normalized history.");
      if (!data.length) return { status: "success", entries };
      for (const row of data) {
        const entry = mapNormalizedHistoryRow(row, userId);
        if (before && entry.record_date >= before) {
          throw new Error("Supabase returned an invalid normalized history order.");
        }
        entries.push(entry);
        before = entry.record_date;
      }
    }
  } catch (error) {
    return errorResult(error);
  }
};

export const deleteDailyRecordNormalized = async (
  params: RecordParams,
): Promise<SupabaseDeleteResult> => {
  try {
    const { data, error } = await supabase.from("daily_record").delete()
      .eq("user_id", params.userId).eq("record_date", params.date)
      .select("id,user_id,record_date");
    if (error) return { status: "error", message: error.message };
    if (!Array.isArray(data) || data.length > 1
      || data.some((row) => !isNormalizedDeletedRow(row, params))) {
      throw new Error("Supabase returned an invalid normalized delete response.");
    }
    return { status: data.length ? "deleted" : "not_found" };
  } catch (error) {
    return errorResult(error);
  }
};
