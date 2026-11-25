import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizedRecordFixture, normalizedUserId, normalizedDate, normalizedTime, fixtureId,
} from "./testing/normalizedRecordFixture";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("../lib/supabaseClient", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    supabase: createClient("https://normalized.invalid", "test-anon-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fetchMock },
    }),
  };
});

import {
  fetchDailyRecordNormalized, fetchDailyRecordHistoryNormalized, deleteDailyRecordNormalized,
} from "./dailyRecordNormalizedQueryService";

const params = { userId: normalizedUserId, date: normalizedDate };
const respond = (data: unknown, status = 200) => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  }));
};
const requestedUrl = (index = 0) => new URL(fetchMock.mock.calls[index][0]);

describe("normalized query service over the real Supabase HTTP client", () => {
  beforeEach(() => { fetchMock.mockReset(); });

  it("reads the complete FK hierarchy in a single tenant/date-filtered request", async () => {
    respond([normalizedRecordFixture()]);
    const result = await fetchDailyRecordNormalized(params);
    expect(result.status).toBe("found");
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = requestedUrl();
    expect(url.pathname).toBe("/rest/v1/daily_record");
    expect(url.searchParams.get("user_id")).toBe(`eq.${params.userId}`);
    expect(url.searchParams.get("record_date")).toBe(`eq.${params.date}`);
    const select = url.searchParams.get("select");
    for (const fk of [
      "weight_record_daily_record_user_fkey", "wellness_record_daily_record_user_fkey",
      "meal_record_daily_record_user_fkey", "meal_attachment_meal_record_user_fkey",
      "food_item_meal_record_user_fkey", "exercise_session_daily_record_user_fkey",
      "exercise_item_exercise_session_user_fkey", "set_item_exercise_item_user_fkey",
    ]) expect(select).toContain(`!${fk}(`);
    expect(select).not.toContain("!inner");
    expect(select).not.toContain("food_material");
  });

  it("returns not_found only for an empty successful read", async () => {
    respond([]);
    expect(await fetchDailyRecordNormalized(params)).toEqual({ status: "not_found" });
  });

  it("returns a database error rather than not_found", async () => {
    respond({ message: "permission denied", code: "42501" }, 403);
    expect(await fetchDailyRecordNormalized(params)).toMatchObject({
      status: "error", message: "permission denied",
    });
  });

  it("rejects multiple roots instead of choosing one", async () => {
    respond([normalizedRecordFixture(), normalizedRecordFixture()]);
    expect((await fetchDailyRecordNormalized(params)).status).toBe("error");
  });

  it("rejects malformed nested data", async () => {
    const row = normalizedRecordFixture();
    Reflect.deleteProperty(row.meal_record[0], "food_item");
    respond([row]);
    expect((await fetchDailyRecordNormalized(params)).status).toBe("error");
  });

  it("preserves an empty date aggregate as found", async () => {
    respond([{ ...normalizedRecordFixture(), weight_record: [], wellness_record: null,
      meal_record: [], exercise_session: [] }]);
    const result = await fetchDailyRecordNormalized(params);
    expect(result).toMatchObject({ status: "found", record: {
      weights: [], wellness: null, meals: [], exercise_sessions: [],
    } });
  });

  it("paginates history even when the server returns fewer rows than the limit", async () => {
    const summary = (date: string) => ({
      user_id: params.userId, record_date: date, updated_at: normalizedTime,
    });
    respond([summary("2026-11-05")]);
    respond([summary("2026-11-04")]);
    respond([]);
    const result = await fetchDailyRecordHistoryNormalized(params);
    expect(result).toEqual({ status: "success", entries: [
      { record_date: "2026-11-05", updated_at: normalizedTime },
      { record_date: "2026-11-04", updated_at: normalizedTime },
    ] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requestedUrl().searchParams.get("select")).toBe("user_id,record_date,updated_at");
    expect(requestedUrl().searchParams.get("order")).toBe("record_date.desc");
    expect(requestedUrl(1).searchParams.get("record_date")).toBe("lt.2026-11-05");
    expect(requestedUrl(2).searchParams.get("record_date")).toBe("lt.2026-11-04");
  });

  it("returns an empty history successfully", async () => {
    respond([]);
    expect(await fetchDailyRecordHistoryNormalized(params)).toEqual({ status: "success", entries: [] });
  });

  it("does not return partial history after a later page fails", async () => {
    respond([{ user_id: params.userId, record_date: params.date, updated_at: normalizedTime }]);
    respond({ message: "history failed", code: "42501" }, 403);
    expect(await fetchDailyRecordHistoryNormalized(params)).toEqual({ status: "error", message: "history failed" });
  });

  it("rejects a history page that does not advance the cursor", async () => {
    const row = { user_id: params.userId, record_date: params.date, updated_at: normalizedTime };
    respond([row]);
    respond([row]);
    expect((await fetchDailyRecordHistoryNormalized(params)).status).toBe("error");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    { user_id: "other", record_date: normalizedDate, updated_at: normalizedTime },
    { user_id: normalizedUserId, record_date: "2026-02-30", updated_at: normalizedTime },
    { user_id: normalizedUserId, record_date: normalizedDate, updated_at: "invalid" },
  ])("rejects an invalid history identity %j", async (row) => {
    respond([row]);
    expect((await fetchDailyRecordHistoryNormalized(params)).status).toBe("error");
  });

  it("deletes through the mirror RPC and confirms the returned owner/date", async () => {
    respond({ id: fixtureId(2), user_id: params.userId, record_date: params.date });
    expect(await deleteDailyRecordNormalized(params)).toEqual({ status: "deleted" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(requestedUrl().pathname).toBe("/rest/v1/rpc/delete_daily_record_normalized");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ p_date: params.date });
  });

  it("returns not_found when no root is deleted", async () => {
    respond(null);
    expect(await deleteDailyRecordNormalized(params)).toEqual({ status: "not_found" });
  });

  it.each([[], {}, { id: fixtureId(2), user_id: "other", record_date: normalizedDate }])(
    "rejects an invalid delete confirmation %j", async (data) => {
      respond(data);
      expect((await deleteDailyRecordNormalized(params)).status).toBe("error");
    },
  );

  it("returns a delete failure as an error", async () => {
    respond({ message: "delete denied", code: "42501" }, 403);
    expect(await deleteDailyRecordNormalized(params)).toEqual({ status: "error", message: "delete denied" });
  });

  it.each([fetchDailyRecordNormalized, fetchDailyRecordHistoryNormalized, deleteDailyRecordNormalized])(
    "handles network failure for %s", async (operation) => {
      fetchMock.mockRejectedValue(new Error("network unavailable"));
      expect((await operation(params)).status).toBe("error");
    },
  );
});
