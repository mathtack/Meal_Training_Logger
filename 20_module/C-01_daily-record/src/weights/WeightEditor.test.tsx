// @vitest-environment jsdom

import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyRecordAggregate, ISODate, WeightRecord } from "../../../00_common/src/domain/type";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  fetchRecord: vi.fn(),
  fetchHistory: vi.fn(),
  saveRecord: vi.fn(),
  deleteRecord: vi.fn(),
}));

vi.mock("../../../S-01_auth/src/useAuth", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../../../S-02_daily-record-persistence/src/dailyRecordNormalizedQueryService", () => ({
  fetchDailyRecordNormalized: mocks.fetchRecord,
  fetchDailyRecordHistoryNormalized: mocks.fetchHistory,
  deleteDailyRecordNormalized: mocks.deleteRecord,
}));

vi.mock("../../../S-02_daily-record-persistence/src/dailyRecordNormalizedWriteService", () => ({
  saveDailyRecordNormalized: mocks.saveRecord,
}));

import { DailyRecordForm } from "../DailyRecordForm";
import { WeightEditor } from "./WeightEditor";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const BASE_TIME = "2026-11-05T00:00:00.000Z";

const createWeight = (overrides: Partial<WeightRecord> = {}): WeightRecord => ({
  id: "00000000-0000-4000-8000-000000000101",
  daily_record_id: "00000000-0000-4000-8000-000000000010",
  measurement_time_slot: "MORNING",
  measurement_order: 0,
  weight: 70,
  measured_at: new Date("2026-11-05T07:30:00").toISOString(),
  created_at: BASE_TIME,
  updated_at: BASE_TIME,
  ...overrides,
});

const createRecord = (
  date: ISODate = "2026-11-05",
  id = "00000000-0000-4000-8000-000000000010",
  weights: WeightRecord[] = [],
  updatedAt = BASE_TIME,
): DailyRecordAggregate => ({
  daily_record: {
    id,
    user_id: USER_ID,
    record_date: date,
    created_at: BASE_TIME,
    updated_at: updatedAt,
  },
  weights,
  wellness: null,
  meals: [],
  exercise_sessions: [],
});

const getWeightInputs = (container: HTMLElement) => {
  const timeInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="time"]'));
  const textInputs = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="text"]'));
  return {
    morningTime: timeInputs[0],
    eveningTime: timeInputs[1],
    morningWeight: textInputs[0],
    eveningWeight: textInputs[1],
  };
};

function WeightEditorHarness({
  initialRecord,
  firstFocusRef,
  onRecordChange,
}: {
  initialRecord: DailyRecordAggregate;
  firstFocusRef?: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
  onRecordChange?: (record: DailyRecordAggregate) => void;
}) {
  const [record, setRecord] = useState<DailyRecordAggregate>(initialRecord);
  const handleSetRecord: React.Dispatch<React.SetStateAction<DailyRecordAggregate>> = (next) => {
    setRecord((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      onRecordChange?.(resolved);
      return resolved;
    });
  };

  return (
    <WeightEditor
      record={record}
      setRecord={handleSetRecord}
      firstFocusRef={firstFocusRef}
    />
  );
}

describe("WeightEditor", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps raw draft during typing, normalizes full-width input on blur, and deletes on empty blur", () => {
    let latest = createRecord("2026-11-05");
    const { container } = render(
      <WeightEditorHarness
        initialRecord={latest}
        onRecordChange={(next) => {
          latest = next;
        }}
      />,
    );

    const { morningWeight } = getWeightInputs(container);
    fireEvent.change(morningWeight, { target: { value: " ６８．５０ " } });
    // Before blur, draft stays unnormalized and record is not updated yet.
    expect(morningWeight.value).toBe(" ６８．５０ ");
    expect(latest.weights).toHaveLength(0);

    fireEvent.blur(morningWeight);
    expect(morningWeight.value).toBe("68.5");
    expect(latest.weights).toHaveLength(1);
    expect(latest.weights[0].measurement_time_slot).toBe("MORNING");
    expect(latest.weights[0].weight).toBe(68.5);

    // Clearing the weight input removes the slot on blur.
    fireEvent.change(morningWeight, { target: { value: "   " } });
    fireEvent.blur(morningWeight);
    expect(morningWeight.value).toBe("");
    expect(latest.weights).toHaveLength(0);
  });

  it("retains invalid input and error message without mutating record, then recovers on valid blur", () => {
    const initialWeight = createWeight({ weight: 70 });
    let latest = createRecord("2026-11-05", initialWeight.daily_record_id, [initialWeight]);
    const { container } = render(
      <WeightEditorHarness
        initialRecord={latest}
        onRecordChange={(next) => {
          latest = next;
        }}
      />,
    );

    const { morningWeight } = getWeightInputs(container);
    expect(morningWeight.value).toBe("70");

    fireEvent.change(morningWeight, { target: { value: "abc" } });
    fireEvent.blur(morningWeight);
    expect(morningWeight.value).toBe("abc");
    expect(screen.getByText("10〜999.99、小数2桁まで")).toBeDefined();
    expect(latest.weights[0].weight).toBe(70);

    fireEvent.change(morningWeight, { target: { value: "69.25" } });
    fireEvent.blur(morningWeight);
    expect(morningWeight.value).toBe("69.25");
    expect(screen.queryByText("10〜999.99、小数2桁まで")).toBeNull();
    expect(latest.weights[0].weight).toBe(69.25);
  });

  it("commits on non-composing Enter and ignores Enter during IME composition for morning and evening", () => {
    let latest = createRecord("2026-11-05");
    const { container } = render(
      <WeightEditorHarness
        initialRecord={latest}
        onRecordChange={(next) => {
          latest = next;
        }}
      />,
    );

    const { morningWeight, eveningWeight } = getWeightInputs(container);

    // Morning: composing Enter must not blur or commit.
    morningWeight.focus();
    fireEvent.change(morningWeight, { target: { value: "71.2" } });
    const morningBlurSpy = vi.spyOn(morningWeight, "blur");
    fireEvent.keyDown(morningWeight, { key: "Enter", isComposing: true });
    expect(morningBlurSpy).not.toHaveBeenCalled();
    expect(latest.weights).toHaveLength(0);

    fireEvent.keyDown(morningWeight, { key: "Enter", isComposing: false });
    expect(morningBlurSpy).toHaveBeenCalledTimes(1);

    // Evening: composing Enter must not blur or commit, normal Enter blurs.
    eveningWeight.focus();
    fireEvent.change(eveningWeight, { target: { value: "72.4" } });
    const eveningBlurSpy = vi.spyOn(eveningWeight, "blur");
    fireEvent.keyDown(eveningWeight, { key: "Enter", isComposing: true });
    expect(eveningBlurSpy).not.toHaveBeenCalled();

    fireEvent.keyDown(eveningWeight, { key: "Enter", isComposing: false });
    expect(eveningBlurSpy).toHaveBeenCalledTimes(1);
  });

  it("round-trips local HH:mm and ISO without time drift on repeated blur, and supports time-before-weight entry", () => {
    let latest = createRecord("2026-11-05");
    const { container } = render(
      <WeightEditorHarness
        initialRecord={latest}
        onRecordChange={(next) => {
          latest = next;
        }}
      />,
    );

    const { morningTime, morningWeight } = getWeightInputs(container);

    // Enter time first while weight is empty, blur time input, then enter weight.
    fireEvent.change(morningTime, { target: { value: "07:30" } });
    fireEvent.blur(morningTime);
    expect(morningTime.value).toBe("07:30");
    expect(latest.weights).toHaveLength(0);

    fireEvent.change(morningWeight, { target: { value: "68.5" } });
    fireEvent.blur(morningWeight);
    const expectedIso = new Date("2026-11-05T07:30:00").toISOString();
    expect(latest.weights).toHaveLength(1);
    expect(latest.weights[0].measured_at).toBe(expectedIso);
    expect(morningTime.value).toBe("07:30");

    // Repeated blur on both inputs must keep the exact same local time and ISO instant.
    fireEvent.blur(morningTime);
    fireEvent.blur(morningWeight);
    expect(morningTime.value).toBe("07:30");
    expect(latest.weights[0].measured_at).toBe(expectedIso);

    // Clearing weight removes the slot and clears its displayed time.
    fireEvent.change(morningWeight, { target: { value: "" } });
    fireEvent.blur(morningWeight);
    expect(latest.weights).toHaveLength(0);
    expect(morningWeight.value).toBe("");
    expect(morningTime.value).toBe("");
  });

  it("keeps morning and evening inputs independent and wires firstFocusRef to morning weight input", () => {
    let focusedElement: HTMLInputElement | HTMLTextAreaElement | null = null;
    const morning = createWeight({
      id: "00000000-0000-4000-8000-000000000101",
      measurement_time_slot: "MORNING",
      weight: 69.5,
      measured_at: new Date("2026-11-05T06:45:00").toISOString(),
    });
    const evening = createWeight({
      id: "00000000-0000-4000-8000-000000000102",
      measurement_time_slot: "EVENING",
      weight: 70.8,
      measured_at: new Date("2026-11-05T21:15:00").toISOString(),
    });
    const initial = createRecord("2026-11-05", morning.daily_record_id, [morning, evening]);

    const { container } = render(
      <WeightEditorHarness
        initialRecord={initial}
        firstFocusRef={(el) => {
          focusedElement = el;
        }}
      />,
    );

    const { morningTime, morningWeight, eveningTime, eveningWeight } = getWeightInputs(container);
    expect(focusedElement).toBe(morningWeight);
    expect(morningTime.value).toBe("06:45");
    expect(morningWeight.value).toBe("69.5");
    expect(eveningTime.value).toBe("21:15");
    expect(eveningWeight.value).toBe("70.8");

    // Start editing evening draft, then commit morning change: evening draft stays untouched.
    fireEvent.change(eveningWeight, { target: { value: "71.9" } });
    fireEvent.change(eveningTime, { target: { value: "22:00" } });
    fireEvent.change(morningWeight, { target: { value: "69.0" } });
    fireEvent.blur(morningWeight);

    expect(morningWeight.value).toBe("69");
    expect(eveningWeight.value).toBe("71.9");
    expect(eveningTime.value).toBe("22:00");
  });

  it("resets draft when moving to another date with the same weight, and keeps draft across same-value save response", () => {
    const day1Weight = createWeight({
      id: "00000000-0000-4000-8000-000000000201",
      daily_record_id: "00000000-0000-4000-8000-000000000021",
      weight: 70,
      measurement_order: 999,
      measured_at: new Date("2026-11-05T07:00:00").toISOString(),
    });
    const day1 = createRecord("2026-11-05", day1Weight.daily_record_id, [day1Weight]);
    const setRecord = vi.fn();

    const { container, rerender } = render(
      <WeightEditor record={day1} setRecord={setRecord} />,
    );

    const { morningWeight } = getWeightInputs(container);
    expect(morningWeight.value).toBe("70");

    // Start typing a new draft while a save response arrives with updated_at / normalized order.
    fireEvent.change(morningWeight, { target: { value: "71.5" } });
    expect(morningWeight.value).toBe("71.5");

    const saveResponseRecord = createRecord(
      "2026-11-05",
      day1Weight.daily_record_id,
      [{ ...day1Weight, measurement_order: 0 }],
      "2026-11-05T00:05:00.000Z",
    );
    rerender(<WeightEditor record={saveResponseRecord} setRecord={setRecord} />);
    expect(morningWeight.value).toBe("71.5");

    // Moving to a different date with the exact same committed weight clears the draft.
    const day2Weight = createWeight({
      id: "00000000-0000-4000-8000-000000000202",
      daily_record_id: "00000000-0000-4000-8000-000000000022",
      weight: 70,
      measured_at: new Date("2026-11-06T07:00:00").toISOString(),
    });
    const day2 = createRecord("2026-11-06", day2Weight.daily_record_id, [day2Weight]);
    rerender(<WeightEditor record={day2} setRecord={setRecord} />);
    expect(morningWeight.value).toBe("70");
  });
});

describe("DailyRecordForm and WeightEditor integration", () => {
  const today = (): ISODate => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.useAuth.mockReturnValue({
      user: { id: USER_ID },
      isLoading: false,
    });
    mocks.fetchHistory.mockResolvedValue({ status: "success", entries: [] });
    mocks.deleteRecord.mockResolvedValue({ status: "deleted" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("resets weight draft on same-value date switch, same-day reload, clear (including empty invalid draft), and delete", async () => {
    const todayDate = today();
    const otherDate = "2026-11-01" as ISODate;
    const todayRecord = createRecord(todayDate, "00000000-0000-4000-8000-000000000031", [
      createWeight({
        id: "00000000-0000-4000-8000-000000000301",
        daily_record_id: "00000000-0000-4000-8000-000000000031",
        weight: 70,
        measured_at: new Date(`${todayDate}T07:00:00`).toISOString(),
      }),
    ]);
    const otherRecord = createRecord(otherDate, "00000000-0000-4000-8000-000000000032", [
      createWeight({
        id: "00000000-0000-4000-8000-000000000302",
        daily_record_id: "00000000-0000-4000-8000-000000000032",
        weight: 70,
        measured_at: new Date(`${otherDate}T07:00:00`).toISOString(),
      }),
    ]);

    mocks.fetchRecord.mockImplementation(async ({ date }: { date: ISODate }) => ({
      status: "found",
      record: date === otherDate ? otherRecord : todayRecord,
    }));
    mocks.fetchHistory.mockResolvedValue({
      status: "success",
      entries: [
        { record_date: todayDate, updated_at: BASE_TIME },
        { record_date: otherDate, updated_at: BASE_TIME },
      ],
    });

    const { container } = render(<DailyRecordForm />);
    await screen.findByRole("button", { name: "保存" });
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled).toBe(false),
    );

    // Switch to Weight tab and verify first focus lands on morning weight input.
    fireEvent.click(screen.getByRole("tab", { name: "体重" }));
    let inputs = getWeightInputs(container);
    expect(inputs.morningWeight.value).toBe("70");
    await waitFor(() => expect(document.activeElement).toBe(inputs.morningWeight));

    // Type an uncommitted draft, then switch to another date that also has 70kg.
    fireEvent.change(inputs.morningWeight, { target: { value: "74.5" } });
    expect(inputs.morningWeight.value).toBe("74.5");
    const dateInput = container.querySelector<HTMLInputElement>('input[type="date"]')!;
    fireEvent.change(dateInput, { target: { value: otherDate } });

    await waitFor(() => {
      inputs = getWeightInputs(container);
      expect(inputs.morningWeight.value).toBe("70");
    });

    // Type an uncommitted draft on otherDate, then reload the same date via history.
    fireEvent.change(inputs.morningWeight, { target: { value: "invalid" } });
    fireEvent.blur(inputs.morningWeight);
    expect(screen.getByText("10〜999.99、小数2桁まで")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "表示・保存" }));
    fireEvent.click(screen.getByRole("tab", { name: "保存・読出" }));
    const loadButtons = await screen.findAllByRole("button", { name: "この日の記録を読み込む" });
    fireEvent.click(loadButtons[1]);

    await waitFor(() => {
      inputs = getWeightInputs(container);
      expect(inputs.morningWeight.value).toBe("70");
    });
    expect(screen.queryByText("10〜999.99、小数2桁まで")).toBeNull();

    // Clear weight tab while editing draft -> empties both value and error.
    fireEvent.change(inputs.morningWeight, { target: { value: "bad-value" } });
    fireEvent.blur(inputs.morningWeight);
    expect(screen.getByText("10〜999.99、小数2桁まで")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "体重をクリア" }));
    inputs = getWeightInputs(container);
    expect(inputs.morningWeight.value).toBe("");
    expect(inputs.morningTime.value).toBe("");
    expect(screen.queryByText("10〜999.99、小数2桁まで")).toBeNull();

    // Clear weight tab even when committed weights are already empty and an invalid draft + time exist.
    fireEvent.change(inputs.morningTime, { target: { value: "08:15" } });
    fireEvent.change(inputs.morningWeight, { target: { value: "xxx" } });
    fireEvent.blur(inputs.morningWeight);
    expect(inputs.morningTime.value).toBe("08:15");
    expect(inputs.morningWeight.value).toBe("xxx");
    expect(screen.getByText("10〜999.99、小数2桁まで")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "体重をクリア" }));
    inputs = getWeightInputs(container);
    expect(inputs.morningTime.value).toBe("");
    expect(inputs.morningWeight.value).toBe("");
    expect(screen.queryByText("10〜999.99、小数2桁まで")).toBeNull();

    // Commit a value, delete the same date from history, then return to edit mode -> empty.
    fireEvent.change(inputs.morningWeight, { target: { value: "72" } });
    fireEvent.blur(inputs.morningWeight);
    expect(inputs.morningWeight.value).toBe("72");

    fireEvent.click(screen.getByRole("button", { name: "表示・保存" }));
    fireEvent.click(screen.getByRole("tab", { name: "保存・読出" }));
    const deleteButtons = await screen.findAllByRole("button", { name: "削除" });
    fireEvent.click(deleteButtons[1]);
    await screen.findByText(`${otherDate} のクラウド記録を削除しました。`);

    fireEvent.click(screen.getByRole("button", { name: "編集" }));
    inputs = getWeightInputs(container);
    expect(inputs.morningWeight.value).toBe("");
    expect(inputs.morningTime.value).toBe("");
  });

  it("does not overwrite a new draft started during an in-flight save when the older save response resolves", async () => {
    const todayDate = today();
    const initialRecord = createRecord(todayDate, "00000000-0000-4000-8000-000000000041", [
      createWeight({
        id: "00000000-0000-4000-8000-000000000401",
        daily_record_id: "00000000-0000-4000-8000-000000000041",
        weight: 70,
        measurement_order: 999,
        measured_at: new Date(`${todayDate}T07:00:00`).toISOString(),
      }),
    ]);

    mocks.fetchRecord.mockResolvedValue({ status: "found", record: initialRecord });
    let resolveSave: (value: { status: "saved"; identity: DailyRecordAggregate["daily_record"] }) => void = () => {};
    mocks.saveRecord.mockImplementation(
      () =>
        new Promise<{ status: "saved"; identity: DailyRecordAggregate["daily_record"] }>((resolve) => {
          resolveSave = resolve;
        }),
    );

    const { container } = render(<DailyRecordForm />);
    const saveButton = await screen.findByRole("button", { name: "保存" });
    await waitFor(() => expect((saveButton as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(screen.getByRole("tab", { name: "体重" }));
    const { morningWeight } = getWeightInputs(container);
    expect(morningWeight.value).toBe("70");

    // Start save.
    fireEvent.click(saveButton);
    await screen.findByText("クラウドへ保存しています…");

    // While save is in flight, start typing a new uncommitted draft.
    fireEvent.change(morningWeight, { target: { value: "71.8" } });
    expect(morningWeight.value).toBe("71.8");

    // Older save response resolves with new DB updated_at.
    await act(async () => {
      resolveSave({
        status: "saved",
        identity: {
          ...initialRecord.daily_record,
          updated_at: "2026-11-28T06:00:00.000Z",
        },
      });
    });

    await screen.findByText("クラウドへ保存しました。");
    // The new draft started during save must remain intact.
    expect(morningWeight.value).toBe("71.8");
  });

  it("restores saved values after save response without stale drafts and keeps edits committed during in-flight save", async () => {
    const todayDate = today();
    const initialRecord = createRecord(todayDate, "00000000-0000-4000-8000-000000000051", [
      createWeight({
        id: "00000000-0000-4000-8000-000000000501",
        daily_record_id: "00000000-0000-4000-8000-000000000051",
        weight: 70,
        measured_at: new Date(`${todayDate}T07:00:00`).toISOString(),
      }),
    ]);

    mocks.fetchRecord.mockResolvedValue({ status: "found", record: initialRecord });
    let resolveSave: (value: { status: "saved"; identity: DailyRecordAggregate["daily_record"] }) => void = () => {};
    mocks.saveRecord
      .mockResolvedValueOnce({
        status: "saved",
        identity: {
          ...initialRecord.daily_record,
          updated_at: "2026-11-28T06:01:00.000Z",
        },
      })
      .mockImplementationOnce(
        () =>
          new Promise<{ status: "saved"; identity: DailyRecordAggregate["daily_record"] }>((resolve) => {
            resolveSave = resolve;
          }),
      );

    const { container } = render(<DailyRecordForm />);
    const saveButton = await screen.findByRole("button", { name: "保存" });
    await waitFor(() => expect((saveButton as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(screen.getByRole("tab", { name: "体重" }));
    const { morningWeight } = getWeightInputs(container);

    // Commit normalized value, save, and confirm saved value is shown without stale draft.
    fireEvent.change(morningWeight, { target: { value: " ７０．２０ " } });
    fireEvent.blur(morningWeight);
    expect(morningWeight.value).toBe("70.2");
    fireEvent.click(saveButton);
    await screen.findByText("クラウドへ保存しました。");
    expect(morningWeight.value).toBe("70.2");

    // Start another save, commit a newer weight before the save resolves -> newer committed value survives.
    fireEvent.click(saveButton);
    await screen.findByText("クラウドへ保存しています…");
    fireEvent.change(morningWeight, { target: { value: "70.9" } });
    fireEvent.blur(morningWeight);
    expect(morningWeight.value).toBe("70.9");

    await act(async () => {
      resolveSave({
        status: "saved",
        identity: {
          ...initialRecord.daily_record,
          updated_at: "2026-11-28T06:02:00.000Z",
        },
      });
    });

    await screen.findByText("クラウドへ保存しました。");
    expect(morningWeight.value).toBe("70.9");
  });
});
