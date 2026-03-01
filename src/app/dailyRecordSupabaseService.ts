// src/app/dailyRecordSupabaseService.ts
import { supabase } from "../lib/supabaseClient";
import type { DailyRecordAggregate, ISODate } from "../domain/type";

export type SupabaseSaveResult =
  | { success: true }
  | { success: false; message: string };

type SaveParams = {
  userId: string;
  date: ISODate;
  record: DailyRecordAggregate;
};

export const saveDailyRecordToSupabase = async (
  params: SaveParams,
): Promise<SupabaseSaveResult> => {
  const { userId, date, record } = params;

  console.log("Supabase upsert payload:", {
    userId,
    date,
    record,
  }); // ★ 追加

  const { error } = await supabase.from("daily_record_store").upsert(
    {
      user_id: userId,
      record_date: date,    // ← Supabaseの列名と合わせる
      record_json: record,
    },
    {
      onConflict: "user_id,record_date",  // ← UNIQUEに合わせる
    },
  );

  if (error) {
    console.error("Supabase upsert error:", error);
    return { success: false, message: error.message };
  }

  return { success: true };
};

// 追記する型
export type SupabaseReadResult =
  | { found: true; record: DailyRecordAggregate }
  | { found: false };

type ReadParams = {
  userId: string;
  date: ISODate;
};

type DeleteParams = {
  userId: string;
  date: ISODate;
};

// 読み出し（userId + record_date で1件だけ）
export const fetchDailyRecordFromSupabase = async (
  params: ReadParams,
): Promise<SupabaseReadResult> => {
  const { userId, date } = params;

  const { data, error } = await supabase
    .from("daily_record_store")
    .select("record_json")
    .eq("user_id", userId)
    .eq("record_date", date)
    .maybeSingle();

  if (error) {
    console.error("Supabase fetch error:", error);
    return { found: false };
  }

  if (!data || !data.record_json) {
    return { found: false };
  }

  return { found: true, record: data.record_json as DailyRecordAggregate };
};

// 削除（userId + record_date の行を消すだけ）
export const deleteDailyRecordFromSupabase = async (
  params: DeleteParams,
): Promise<void> => {
  const { userId, date } = params;

  const { error } = await supabase
    .from("daily_record_store")
    .delete()
    .eq("user_id", userId)
    .eq("record_date", date);

  if (error) {
    console.error("Supabase delete error:", error);
  }
};

