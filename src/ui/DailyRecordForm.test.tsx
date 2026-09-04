// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyRecordAggregate, ISODate } from "../domain/type";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  fetchRecord: vi.fn(),
  fetchHistory: vi.fn(),
  saveRecord: vi.fn(),
  deleteRecord: vi.fn(),
}));

vi.mock("../features/auth/AuthContext", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../app/dailyRecordSupabaseService", () => ({
  fetchDailyRecordFromSupabase: mocks.fetchRecord,
  fetchDailyRecordHistoryFromSupabase: mocks.fetchHistory,
  saveDailyRecordToSupabase: mocks.saveRecord,
  deleteDailyRecordFromSupabase: mocks.deleteRecord,
}));

vi.mock("./exercise/ExerciseSessionsEditor", () => ({
  ExerciseSessionsEditor: ({
    record,
    onChange,
  }: {
    record: DailyRecordAggregate;
    onChange: (record: DailyRecordAggregate) => void;
  }) => (
    <div>
      <span data-testid="record-id">{record.daily_record.id}</span>
      <span data-testid="record-owner">{record.daily_record.user_id}</span>
      <span data-testid="record-date">{record.daily_record.record_date}</span>
      <button
        type="button"
        onClick={() =>
          onChange({
            ...record,
            daily_record: {
              ...record.daily_record,
              user_id: "client-side-change",
            },
          })
        }
      >
        入力を変更
      </button>
    </div>
  ),
}));

vi.mock("./weights/WeightEditor", () => ({
  WeightEditor: () => <div>weight editor</div>,
}));

vi.mock("./wellness/WellnessEditor", () => ({
  WellnessEditor: () => <div>wellness editor</div>,
}));

vi.mock("./meal/MealEditor", () => ({
  MealEditor: () => <div>meal editor</div>,
}));

vi.mock("../domain/report/DailyRecordReportView", () => ({
  DailyRecordReportView: () => <div>report view</div>,
}));

import { DailyRecordForm } from "./DailyRecordForm";

const USER_ID = "user-1";
const UPDATED_AT = "2026-09-03T09:00:00.000Z";

const createRecord = (
  date: ISODate,
  id = "remote-record",
): DailyRecordAggregate => ({
  daily_record: {
    id,
    user_id: USER_ID,
    record_date: date,
    created_at: UPDATED_AT,
    updated_at: UPDATED_AT,
  },
  weights: [],
  wellness: null,
  meals: [],
  exercise_sessions: [],
});

const today = (): ISODate => {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const openHistory = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "表示・保存" }));
  fireEvent.click(screen.getByRole("tab", { name: "保存・読出" }));
};

describe("DailyRecordForm cloud persistence routing", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());

    mocks.useAuth.mockReturnValue({
      user: { id: USER_ID },
      isLoading: false,
    });
    mocks.fetchRecord.mockImplementation(async ({ date }: { date: ISODate }) => ({
      status: "found",
      record: createRecord(date),
    }));
    mocks.fetchHistory.mockResolvedValue({ status: "success", entries: [] });
    mocks.saveRecord.mockResolvedValue({ status: "saved" });
    mocks.deleteRecord.mockResolvedValue({ status: "deleted" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("waits for authentication before reading cloud data", () => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: true });

    render(<DailyRecordForm />);

    expect(screen.getByText("認証状態を確認しています…")).toBeDefined();
    expect(mocks.fetchRecord).not.toHaveBeenCalled();
    expect(mocks.fetchHistory).not.toHaveBeenCalled();
  });

  it("requires authentication instead of exposing local persistence", () => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: false });

    render(<DailyRecordForm />);

    expect(
      screen.getByText("記録を保存・読込するにはログインしてください。"),
    ).toBeDefined();
    expect(mocks.fetchRecord).not.toHaveBeenCalled();
    expect(mocks.fetchHistory).not.toHaveBeenCalled();
  });

  it("treats not_found as a new cloud record for the authenticated user", async () => {
    mocks.fetchRecord.mockResolvedValue({ status: "not_found" });

    render(<DailyRecordForm />);

    expect(
      await screen.findByText(/のクラウド記録はありません。新規記録として入力できます。/),
    ).toBeDefined();
    expect(screen.getByTestId("record-owner").textContent).toBe(USER_ID);
    expect(screen.getByTestId("record-date").textContent).toBe(today());
  });

  it("shows a read error and never adopts localStorage as formal data", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    localStorage.setItem(
      `daily_record:${today()}`,
      JSON.stringify(createRecord(today(), "local-record")),
    );
    mocks.fetchRecord.mockResolvedValue({
      status: "error",
      message: "read unavailable",
    });

    render(<DailyRecordForm />);

    expect(
      await screen.findByText("クラウド記録の読込に失敗しました: read unavailable"),
    ).toBeDefined();
    expect(screen.queryByTestId("record-id")).toBeNull();
    expect(getItem).not.toHaveBeenCalled();
  });

  it("DailyRecordForm never directly reads or mutates localStorage during logged-in cloud CRUD", async () => {
    const historyDate = "2026-09-02" as ISODate;
    mocks.fetchHistory.mockResolvedValue({
      status: "success",
      entries: [{ record_date: historyDate, updated_at: UPDATED_AT }],
    });
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    const clear = vi.spyOn(Storage.prototype, "clear");

    render(<DailyRecordForm />);
    fireEvent.click(await screen.findByRole("button", { name: "入力を変更" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await screen.findByText("クラウドへ保存しました。");

    await openHistory();
    await screen.findByText(historyDate);
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    await screen.findByText(`${historyDate} のクラウド記録を削除しました。`);

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it("keeps changes unsaved when the cloud save fails", async () => {
    mocks.saveRecord.mockResolvedValue({
      status: "error",
      message: "save unavailable",
    });

    render(<DailyRecordForm />);
    fireEvent.click(await screen.findByRole("button", { name: "入力を変更" }));
    expect(screen.getByText("未保存")).toBeDefined();

    await waitFor(() => expect(mocks.fetchHistory).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(
      await screen.findByText("クラウド保存に失敗しました: save unavailable"),
    ).toBeDefined();
    expect(screen.getByText("未保存")).toBeDefined();
    expect(mocks.fetchHistory).toHaveBeenCalledTimes(1);
  });

  it("marks saved only after cloud confirmation and refreshes remote history", async () => {
    render(<DailyRecordForm />);
    fireEvent.click(await screen.findByRole("button", { name: "入力を変更" }));
    await waitFor(() => expect(mocks.fetchHistory).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("クラウドへ保存しました。")).toBeDefined();
    expect(screen.queryByText("未保存")).toBeNull();
    await waitFor(() => expect(mocks.fetchHistory).toHaveBeenCalledTimes(2));

    const saveParams = mocks.saveRecord.mock.calls[0][0];
    expect(saveParams.userId).toBe(USER_ID);
    expect(saveParams.record.daily_record.user_id).toBe(USER_ID);
    expect(saveParams.record.daily_record.record_date).toBe(saveParams.date);
    expect(
      Number.isNaN(Date.parse(saveParams.record.daily_record.updated_at)),
    ).toBe(false);
  });

  it("renders history from Supabase and reports history errors separately", async () => {
    const date = "2026-09-02" as ISODate;
    mocks.fetchHistory.mockResolvedValue({
      status: "success",
      entries: [{ record_date: date, updated_at: UPDATED_AT }],
    });

    const { unmount } = render(<DailyRecordForm />);
    await openHistory();
    expect(await screen.findByText(date)).toBeDefined();
    expect(mocks.fetchHistory).toHaveBeenCalledWith({ userId: USER_ID });

    unmount();
    mocks.fetchHistory.mockReset();
    mocks.fetchHistory.mockResolvedValue({
      status: "error",
      message: "history unavailable",
    });

    render(<DailyRecordForm />);
    await openHistory();
    expect(
      await screen.findByText("クラウド履歴の読込に失敗しました: history unavailable"),
    ).toBeDefined();
  });

  it("refreshes cloud history when the save/load tab is opened", async () => {
    const date = "2099-12-31" as ISODate;
    mocks.fetchHistory
      .mockResolvedValueOnce({ status: "success", entries: [] })
      .mockResolvedValue({
        status: "success",
        entries: [{ record_date: date, updated_at: UPDATED_AT }],
      });

    render(<DailyRecordForm />);
    await waitFor(() => expect(mocks.fetchHistory).toHaveBeenCalledTimes(1));

    await openHistory();

    expect(await screen.findByText(date)).toBeDefined();
    expect(mocks.fetchHistory).toHaveBeenCalledTimes(2);
  });

  it("keeps history intact on delete failure and updates it after confirmed delete", async () => {
    const date = "2026-09-02" as ISODate;
    const entry = { record_date: date, updated_at: UPDATED_AT };
    mocks.fetchHistory.mockResolvedValue({ status: "success", entries: [entry] });
    mocks.deleteRecord.mockResolvedValue({
      status: "error",
      message: "delete unavailable",
    });

    const firstRender = render(<DailyRecordForm />);
    await openHistory();
    await screen.findByText(date);
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    expect(
      await screen.findByText("クラウド削除に失敗しました: delete unavailable"),
    ).toBeDefined();
    expect(screen.getByText(date)).toBeDefined();
    expect(mocks.fetchHistory).toHaveBeenCalledTimes(2);

    firstRender.unmount();
    mocks.fetchHistory.mockReset();
    mocks.fetchHistory
      .mockResolvedValueOnce({ status: "success", entries: [entry] })
      .mockResolvedValueOnce({ status: "success", entries: [entry] })
      .mockResolvedValue({ status: "success", entries: [] });
    mocks.deleteRecord.mockResolvedValue({ status: "deleted" });

    render(<DailyRecordForm />);
    await openHistory();
    await screen.findByText(date);
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    expect(
      await screen.findByText(`${date} のクラウド記録を削除しました。`),
    ).toBeDefined();
    expect(
      await screen.findByText(/まだ保存された記録はないみたい。/),
    ).toBeDefined();
    await waitFor(() => expect(mocks.fetchHistory).toHaveBeenCalledTimes(3));
  });

  it("treats delete not_found as an idempotent success", async () => {
    const date = "2026-09-02" as ISODate;
    mocks.fetchHistory
      .mockResolvedValueOnce({
        status: "success",
        entries: [{ record_date: date, updated_at: UPDATED_AT }],
      })
      .mockResolvedValueOnce({
        status: "success",
        entries: [{ record_date: date, updated_at: UPDATED_AT }],
      })
      .mockResolvedValue({ status: "success", entries: [] });
    mocks.deleteRecord.mockResolvedValue({ status: "not_found" });

    render(<DailyRecordForm />);
    await openHistory();
    await screen.findByText(date);
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    expect(
      await screen.findByText(`${date} のクラウド記録は既に削除されています。`),
    ).toBeDefined();
    expect(
      await screen.findByText(/まだ保存された記録はないみたい。/),
    ).toBeDefined();
  });
});
