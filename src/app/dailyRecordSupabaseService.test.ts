import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyRecordAggregate, ISODate } from "../domain/type";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: fromMock,
  },
}));

import {
  deleteDailyRecordFromSupabase,
  fetchDailyRecordFromSupabase,
  fetchDailyRecordHistoryFromSupabase,
  saveDailyRecordToSupabase,
} from "./dailyRecordSupabaseService";

const USER_ID = "user-1";
const DATE_1 = "2026-02-18" as ISODate;
const DATE_2 = "2026-02-19" as ISODate;
const UPDATED_AT_1 = "2026-02-18T12:00:00.000Z";
const UPDATED_AT_2 = "2026-02-19T12:00:00.000Z";

type QueryResponse = {
  data: unknown;
  error: { message: string } | null;
};

const createRecord = (
  date: ISODate,
  updatedAt = UPDATED_AT_2,
): DailyRecordAggregate => ({
  daily_record: {
    id: `record-${date}`,
    user_id: USER_ID,
    record_date: date,
    created_at: updatedAt,
    updated_at: updatedAt,
  },
  weights: [],
  wellness: null,
  meals: [],
  exercise_sessions: [],
});

const useSaveResponse = (response: QueryResponse) => {
  const upsert = vi.fn();
  const select = vi.fn();
  const maybeSingle = vi.fn().mockResolvedValue(response);
  const query = { upsert, select, maybeSingle };

  upsert.mockReturnValue(query);
  select.mockReturnValue(query);
  fromMock.mockReturnValue(query);

  return query;
};

const useReadResponse = (response: QueryResponse) => {
  const select = vi.fn();
  const eq = vi.fn();
  const maybeSingle = vi.fn().mockResolvedValue(response);
  const query = { select, eq, maybeSingle };

  select.mockReturnValue(query);
  eq.mockReturnValue(query);
  fromMock.mockReturnValue(query);

  return query;
};

const useDeleteResponse = (response: QueryResponse) => {
  const deleteRows = vi.fn();
  const eq = vi.fn();
  const select = vi.fn().mockResolvedValue(response);
  const query = { delete: deleteRows, eq, select };

  deleteRows.mockReturnValue(query);
  eq.mockReturnValue(query);
  fromMock.mockReturnValue(query);

  return query;
};

const useHistoryResponse = (response: QueryResponse) => {
  const select = vi.fn();
  const eq = vi.fn();
  const order = vi.fn().mockResolvedValue(response);
  const query = { select, eq, order };

  select.mockReturnValue(query);
  eq.mockReturnValue(query);
  fromMock.mockReturnValue(query);

  return query;
};

describe("dailyRecordSupabaseService", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  describe("saveDailyRecordToSupabase", () => {
    it("returns saved only after Supabase returns the saved date", async () => {
      const record = createRecord(DATE_2);
      const query = useSaveResponse({
        data: { record_date: DATE_2 },
        error: null,
      });

      const result = await saveDailyRecordToSupabase({
        userId: USER_ID,
        date: DATE_2,
        record,
      });

      expect(result).toEqual({ status: "saved" });
      expect(fromMock).toHaveBeenCalledWith("daily_record_store");
      expect(query.upsert).toHaveBeenCalledWith(
        {
          user_id: USER_ID,
          record_date: DATE_2,
          record_json: record,
        },
        { onConflict: "user_id,record_date" },
      );
      expect(query.select).toHaveBeenCalledWith("record_date");
      expect(query.maybeSingle).toHaveBeenCalledOnce();
    });

    it("returns a database error to the caller", async () => {
      useSaveResponse({
        data: null,
        error: { message: "upsert failed" },
      });

      const result = await saveDailyRecordToSupabase({
        userId: USER_ID,
        date: DATE_2,
        record: createRecord(DATE_2),
      });

      expect(result).toEqual({ status: "error", message: "upsert failed" });
    });

    it("does not report success when the saved row is not returned", async () => {
      useSaveResponse({ data: null, error: null });

      const result = await saveDailyRecordToSupabase({
        userId: USER_ID,
        date: DATE_2,
        record: createRecord(DATE_2),
      });

      expect(result).toEqual({
        status: "error",
        message: "Supabase save did not return the saved record.",
      });
    });

    it("converts a thrown network failure into an error result", async () => {
      fromMock.mockImplementation(() => {
        throw new Error("network unavailable");
      });

      const result = await saveDailyRecordToSupabase({
        userId: USER_ID,
        date: DATE_2,
        record: createRecord(DATE_2),
      });

      expect(result).toEqual({
        status: "error",
        message: "network unavailable",
      });
    });
  });

  describe("fetchDailyRecordFromSupabase", () => {
    it("returns found for a valid record", async () => {
      const record = createRecord(DATE_2);
      const query = useReadResponse({
        data: { record_json: record },
        error: null,
      });

      const result = await fetchDailyRecordFromSupabase({
        userId: USER_ID,
        date: DATE_2,
      });

      expect(result).toEqual({ status: "found", record });
      expect(query.select).toHaveBeenCalledWith("record_json");
      expect(query.eq).toHaveBeenNthCalledWith(1, "user_id", USER_ID);
      expect(query.eq).toHaveBeenNthCalledWith(2, "record_date", DATE_2);
    });

    it("returns not_found only when Supabase returns no row without an error", async () => {
      useReadResponse({ data: null, error: null });

      const result = await fetchDailyRecordFromSupabase({
        userId: USER_ID,
        date: DATE_2,
      });

      expect(result).toEqual({ status: "not_found" });
    });

    it("keeps a database error distinct from not_found", async () => {
      useReadResponse({
        data: null,
        error: { message: "read failed" },
      });

      const result = await fetchDailyRecordFromSupabase({
        userId: USER_ID,
        date: DATE_2,
      });

      expect(result).toEqual({ status: "error", message: "read failed" });
    });

    it("keeps a thrown network failure distinct from not_found", async () => {
      fromMock.mockImplementation(() => {
        throw new Error("read network unavailable");
      });

      const result = await fetchDailyRecordFromSupabase({
        userId: USER_ID,
        date: DATE_2,
      });

      expect(result).toEqual({
        status: "error",
        message: "read network unavailable",
      });
    });

    it("returns an error for an invalid aggregate", async () => {
      useReadResponse({
        data: { record_json: { daily_record: null } },
        error: null,
      });

      const result = await fetchDailyRecordFromSupabase({
        userId: USER_ID,
        date: DATE_2,
      });

      expect(result).toEqual({
        status: "error",
        message: "Supabase returned an invalid daily record.",
      });
    });

    it("returns an error when the aggregate date differs from the requested date", async () => {
      useReadResponse({
        data: { record_json: createRecord(DATE_1, UPDATED_AT_1) },
        error: null,
      });

      const result = await fetchDailyRecordFromSupabase({
        userId: USER_ID,
        date: DATE_2,
      });

      expect(result).toEqual({
        status: "error",
        message: "Supabase returned an invalid daily record.",
      });
    });
  });

  describe("deleteDailyRecordFromSupabase", () => {
    it("returns deleted when Supabase confirms a deleted row", async () => {
      const query = useDeleteResponse({
        data: [{ id: "row-1" }],
        error: null,
      });

      const result = await deleteDailyRecordFromSupabase({
        userId: USER_ID,
        date: DATE_2,
      });

      expect(result).toEqual({ status: "deleted" });
      expect(query.delete).toHaveBeenCalledOnce();
      expect(query.eq).toHaveBeenNthCalledWith(1, "user_id", USER_ID);
      expect(query.eq).toHaveBeenNthCalledWith(2, "record_date", DATE_2);
      expect(query.select).toHaveBeenCalledWith("id");
    });

    it("returns not_found when no row needed deletion", async () => {
      useDeleteResponse({ data: [], error: null });

      const result = await deleteDailyRecordFromSupabase({
        userId: USER_ID,
        date: DATE_2,
      });

      expect(result).toEqual({ status: "not_found" });
    });

    it("returns a database error to the caller", async () => {
      useDeleteResponse({
        data: null,
        error: { message: "delete failed" },
      });

      const result = await deleteDailyRecordFromSupabase({
        userId: USER_ID,
        date: DATE_2,
      });

      expect(result).toEqual({ status: "error", message: "delete failed" });
    });

    it("does not report success for an invalid delete response", async () => {
      useDeleteResponse({ data: null, error: null });

      const result = await deleteDailyRecordFromSupabase({
        userId: USER_ID,
        date: DATE_2,
      });

      expect(result).toEqual({
        status: "error",
        message: "Supabase delete returned an invalid response.",
      });
    });

    it("converts a thrown network failure into an error result", async () => {
      fromMock.mockImplementation(() => {
        throw new Error("delete network unavailable");
      });

      const result = await deleteDailyRecordFromSupabase({
        userId: USER_ID,
        date: DATE_2,
      });

      expect(result).toEqual({
        status: "error",
        message: "delete network unavailable",
      });
    });
  });

  describe("fetchDailyRecordHistoryFromSupabase", () => {
    it("returns Supabase history using canonical aggregate timestamps", async () => {
      const query = useHistoryResponse({
        data: [
          {
            record_date: DATE_2,
            record_json: createRecord(DATE_2, UPDATED_AT_2),
          },
          {
            record_date: DATE_1,
            record_json: createRecord(DATE_1, UPDATED_AT_1),
          },
        ],
        error: null,
      });

      const result = await fetchDailyRecordHistoryFromSupabase({
        userId: USER_ID,
      });

      expect(result).toEqual({
        status: "success",
        entries: [
          { record_date: DATE_2, updated_at: UPDATED_AT_2 },
          { record_date: DATE_1, updated_at: UPDATED_AT_1 },
        ],
      });
      expect(query.select).toHaveBeenCalledWith("record_date,record_json");
      expect(query.eq).toHaveBeenCalledWith("user_id", USER_ID);
      expect(query.order).toHaveBeenCalledWith("record_date", {
        ascending: false,
      });
    });

    it("returns an empty successful history", async () => {
      useHistoryResponse({ data: [], error: null });

      const result = await fetchDailyRecordHistoryFromSupabase({
        userId: USER_ID,
      });

      expect(result).toEqual({ status: "success", entries: [] });
    });

    it("returns a database error to the caller", async () => {
      useHistoryResponse({
        data: null,
        error: { message: "history failed" },
      });

      const result = await fetchDailyRecordHistoryFromSupabase({
        userId: USER_ID,
      });

      expect(result).toEqual({ status: "error", message: "history failed" });
    });

    it("returns an error rather than silently omitting an invalid row", async () => {
      useHistoryResponse({
        data: [{ record_date: DATE_2, record_json: null }],
        error: null,
      });

      const result = await fetchDailyRecordHistoryFromSupabase({
        userId: USER_ID,
      });

      expect(result).toEqual({
        status: "error",
        message: "Supabase returned an invalid history response.",
      });
    });

    it("converts a thrown network failure into an error result", async () => {
      fromMock.mockImplementation(() => {
        throw new Error("history network unavailable");
      });

      const result = await fetchDailyRecordHistoryFromSupabase({
        userId: USER_ID,
      });

      expect(result).toEqual({
        status: "error",
        message: "history network unavailable",
      });
    });
  });
});
