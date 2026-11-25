import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyRecordAggregate, ISODate, UUID } from "../domain/type";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("../lib/supabaseClient", () => ({
  supabase: { rpc: rpcMock },
}));

import { saveDailyRecordNormalized } from "./dailyRecordNormalizedWriteService";

const USER_ID = "00000000-0000-4000-8000-000000000001" as UUID;
const ROOT_ID = "00000000-0000-4000-8000-000000000002" as UUID;
const DATE = "2026-09-11" as ISODate;
const CREATED_AT = "2026-09-11T01:00:00.000Z";
const UPDATED_AT = "2026-09-11T02:00:00.000Z";

const createAggregate = (): DailyRecordAggregate => ({
  daily_record: {
    id: ROOT_ID,
    user_id: USER_ID,
    record_date: DATE,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
  },
  weights: [],
  wellness: null,
  meals: [],
  exercise_sessions: [],
});

describe("saveDailyRecordNormalized", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("returns the database-owned identity after one RPC succeeds", async () => {
    const identity = {
      id: ROOT_ID,
      user_id: USER_ID,
      record_date: DATE,
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    };
    rpcMock.mockResolvedValue({ data: identity, error: null });
    const record = createAggregate();

    const result = await saveDailyRecordNormalized({
      userId: USER_ID,
      date: DATE,
      record,
    });

    expect(result).toEqual({ status: "saved", identity });
    expect(rpcMock).toHaveBeenCalledWith("save_daily_record_normalized", {
      p_record: record,
    });
  });

  it("returns a database error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "write failed" } });

    await expect(
      saveDailyRecordNormalized({ userId: USER_ID, date: DATE, record: createAggregate() }),
    ).resolves.toEqual({ status: "error", message: "write failed" });
  });

  it("rejects a mismatched database identity", async () => {
    rpcMock.mockResolvedValue({
      data: {
        id: ROOT_ID,
        user_id: USER_ID,
        record_date: "2026-09-12",
        created_at: CREATED_AT,
        updated_at: UPDATED_AT,
      },
      error: null,
    });

    const result = await saveDailyRecordNormalized({
      userId: USER_ID,
      date: DATE,
      record: createAggregate(),
    });

    expect(result).toEqual({
      status: "error",
      message: "Supabase normalized save returned an invalid identity.",
    });
  });

  it("does not call Supabase when mapper validation fails", async () => {
    const record = createAggregate();
    record.daily_record.id = "invalid";

    const result = await saveDailyRecordNormalized({
      userId: USER_ID,
      date: DATE,
      record,
    });

    expect(result.status).toBe("error");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("converts a thrown network failure into an error result", async () => {
    rpcMock.mockImplementation(() => {
      throw new Error("network unavailable");
    });

    const result = await saveDailyRecordNormalized({
      userId: USER_ID,
      date: DATE,
      record: createAggregate(),
    });

    expect(result).toEqual({ status: "error", message: "network unavailable" });
  });
});
