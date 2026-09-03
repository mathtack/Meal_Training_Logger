// src/ui/DailyRecordForm.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  DailyRecordAggregate,
  DailyRecordSummary,
  ISODate,
} from "../domain/type";
import {
  createEmptyCloudDailyRecord,
  normalizeCloudDailyRecord,
  prepareDailyRecordForCloudSave,
} from "../app/dailyRecordCloud";
import { ExerciseSessionsEditor } from "./exercise/ExerciseSessionsEditor";
import { WeightEditor } from "./weights/WeightEditor";
import { WellnessEditor } from "./wellness/WellnessEditor";
import { MealEditor } from "./meal/MealEditor";
import { DailyRecordReportView } from "../domain/report/DailyRecordReportView";
import { useAuth } from "../features/auth/AuthContext";
import {
  saveDailyRecordToSupabase,
  fetchDailyRecordFromSupabase,
  deleteDailyRecordFromSupabase,
  fetchDailyRecordHistoryFromSupabase,
} from "../app/dailyRecordSupabaseService";

type TabKey = "weight" | "wellness" | "meal" | "exercise";
const TAB_ORDER: TabKey[] = ["weight", "wellness", "meal", "exercise"];
const TAB_LABEL: Record<TabKey, string> = {
  weight: "体重",
  wellness: "健康体調",
  meal: "食事",
  exercise: "運動",
};

type ReportTabKey = "reportView" | "io";

const REPORT_TAB_LABEL: Record<ReportTabKey, string> = {
  reportView: "レポート表示",
  io: "保存・読出",
};

type DailyRecordMode = "edit" | "report";

type HistoryEntry = DailyRecordSummary;
type RecordLoadState = "loading" | "ready" | "error";
type HistoryLoadState = "loading" | "ready" | "error";

type DailyRecordModeToggleProps = {
  mode: DailyRecordMode;
  onChange: (mode: DailyRecordMode) => void;
};

const DailyRecordModeToggle: React.FC<DailyRecordModeToggleProps> = ({ mode, onChange }) => {
  return (
    <div style={{ display: "inline-flex", borderRadius: 9999, border: "1px solid #ddd", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => onChange("edit")}
        style={{
          padding: "4px 10px",
          fontSize: 13,
          fontWeight: 600,
          border: "none",
          background: mode === "edit" ? "#333" : "#fff",
          color: mode === "edit" ? "#fff" : "#333",
          cursor: "pointer",
        }}
      >
        編集
      </button>
      <button
        type="button"
        onClick={() => onChange("report")}
        style={{
          padding: "4px 10px",
          fontSize: 13,
          fontWeight: 600,
          border: "none",
          borderLeft: "1px solid #ddd",
          background: mode === "report" ? "#333" : "#fff",
          color: mode === "report" ? "#fff" : "#333",
          cursor: "pointer",
        }}
      >
        表示・保存
      </button>
    </div>
  );
};

function todayISODate(): ISODate {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatUpdatedAt(isoString: string): string {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}:${ss}`;
}

export const DailyRecordForm: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <CloudPersistenceNotice message="認証状態を確認しています…" />;
  }

  if (!user) {
    return (
      <CloudPersistenceNotice message="記録を保存・読込するにはログインしてください。" />
    );
  }

  return <AuthenticatedDailyRecordForm key={user.id} userId={user.id} />;
};

function CloudPersistenceNotice({ message }: { message: string }) {
  return (
    <section style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <h2>DailyRecordForm</h2>
      <p role="status">{message}</p>
    </section>
  );
}

function AuthenticatedDailyRecordForm({ userId }: { userId: string }) {
  const initialDate = useRef<ISODate>(todayISODate()).current;
  const [recordDate, setRecordDate] = useState<ISODate>(initialDate);
  const [tab, setTab] = useState<TabKey>("exercise"); // 最優先が運動なのでここから
  const [record, setRecord] = useState<DailyRecordAggregate>(() =>
    createEmptyCloudDailyRecord({ userId, date: initialDate }),
  );
  const [status, setStatus] = useState<string>("");
  const [baselineJson, setBaselineJson] = useState<string>("");
  const [recordLoadState, setRecordLoadState] = useState<RecordLoadState>("loading");
  const [recordLoadError, setRecordLoadError] = useState<string>("");
  const [loadedRecordDate, setLoadedRecordDate] = useState<ISODate | null>(null);
  const [recordReloadVersion, setRecordReloadVersion] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setMode] = useState<DailyRecordMode>("edit");
  const [reportTab, setReportTab] = useState<ReportTabKey>("reportView");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoadState, setHistoryLoadState] = useState<HistoryLoadState>("loading");
  const [historyLoadError, setHistoryLoadError] = useState<string>("");
  const [historyReloadVersion, setHistoryReloadVersion] = useState(0);
  const [deletingDate, setDeletingDate] = useState<ISODate | null>(null);

  const toJson = (value: unknown) => JSON.stringify(value);
  const isRecordReady = recordLoadState === "ready" && loadedRecordDate === recordDate;
  const isDirty = isRecordReady && baselineJson !== "" && toJson(record) !== baselineJson;
  const isMutationInProgress = isSaving || deletingDate !== null;
  const clearLabel = `${TAB_LABEL[tab]}をクリア`;

  const clearCurrentTab = () => {
    if (!isRecordReady || isMutationInProgress) return;

    const ok = window.confirm(`${TAB_LABEL[tab]} をクリアする？（保存するまで反映されない）`);
    if (!ok) return;

    setRecord((prev) => {
      if (!prev) return prev;

      switch (tab) {
        case "weight":
          return { ...prev, weights: [] };

        case "wellness":
          return { ...prev, wellness: null };

        case "meal":
          return { ...prev, meals: [] };

        case "exercise":
          return { ...prev, exercise_sessions: [] };

        default:
          return prev;
      }
    });
  };

  const firstFocusRefs = useRef<Record<TabKey, HTMLInputElement | HTMLTextAreaElement | null>>({
    weight: null,
    wellness: null,
    meal: null,
    exercise: null,
  });

  const registerFirstFocus = (key: TabKey) => (el: HTMLInputElement | HTMLTextAreaElement | null) => {
    firstFocusRefs.current[key] = el;
  };

  const tabs = useMemo(() => TAB_ORDER.map((k) => ({ key: k, label: TAB_LABEL[k] })), []);

  const reportTabs = useMemo(
    () =>
      (["reportView", "io"] as ReportTabKey[]).map((k) => ({
        key: k,
        label: REPORT_TAB_LABEL[k],
      })),
    []
  );

  const onSave = async (): Promise<boolean> => {
    if (!isRecordReady || isMutationInProgress) {
      setStatus("クラウド記録の読込完了後に保存してください。");
      return false;
    }

    const sourceRecord = record;
    const sourceJson = toJson(sourceRecord);
    const prepared = prepareDailyRecordForCloudSave({
      record: sourceRecord,
      userId,
      date: recordDate,
    });

    setIsSaving(true);
    setStatus("クラウドへ保存しています…");

    try {
      const result = await saveDailyRecordToSupabase({
        userId,
        date: recordDate,
        record: prepared,
      });

      if (result.status === "error") {
        setStatus(`クラウド保存に失敗しました: ${result.message}`);
        return false;
      }

      setRecord((current) => (toJson(current) === sourceJson ? prepared : current));
      setBaselineJson(toJson(prepared));
      setHistoryReloadVersion((version) => version + 1);
      setStatus("クラウドへ保存しました。");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "予期しないエラー";
      setStatus(`クラウド保存に失敗しました: ${message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadFromHistory = (date: ISODate) => {
    if (isMutationInProgress) return;

    setRecordLoadState("loading");
    setRecordLoadError("");
    setStatus(`クラウドから ${date} の記録を読み込んでいます…`);
    setMode("edit");

    if (date === recordDate) {
      setRecordReloadVersion((version) => version + 1);
    } else {
      setRecordDate(date);
    }
  };

  const handleDeleteFromHistory = async (date: ISODate) => {
    if (isMutationInProgress) return;

    const ok = window.confirm(`${date} の記録を削除する？（元に戻せないよ）`);
    if (!ok) return;

    setDeletingDate(date);
    setStatus(`クラウドから ${date} の記録を削除しています…`);

    try {
      const result = await deleteDailyRecordFromSupabase({
        userId,
        date,
      });

      if (result.status === "error") {
        setStatus(`クラウド削除に失敗しました: ${result.message}`);
        return;
      }

      setHistory((current) => current.filter((entry) => entry.record_date !== date));
      setHistoryReloadVersion((version) => version + 1);

      if (date === recordDate) {
        const empty = createEmptyCloudDailyRecord({ userId, date });
        setRecord(empty);
        setBaselineJson(toJson(empty));
        setLoadedRecordDate(date);
        setRecordLoadState("ready");
        setRecordLoadError("");
      }

      setStatus(
        result.status === "deleted"
          ? `${date} のクラウド記録を削除しました。`
          : `${date} のクラウド記録は既に削除されています。`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "予期しないエラー";
      setStatus(`クラウド削除に失敗しました: ${message}`);
    } finally {
      setDeletingDate(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setHistoryLoadState("loading");
      setHistoryLoadError("");

      try {
        const result = await fetchDailyRecordHistoryFromSupabase({ userId });
        if (cancelled) return;

        if (result.status === "success") {
          setHistory(result.entries);
          setHistoryLoadState("ready");
          return;
        }

        setHistoryLoadError(result.message);
        setHistoryLoadState("error");
      } catch (error) {
        if (cancelled) return;
        setHistoryLoadError(error instanceof Error ? error.message : "予期しないエラー");
        setHistoryLoadState("error");
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [historyReloadVersion, userId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setRecordLoadState("loading");
      setRecordLoadError("");
      setStatus("クラウドから記録を読み込んでいます…");

      try {
        const result = await fetchDailyRecordFromSupabase({ userId, date: recordDate });
        if (cancelled) return;

        if (result.status === "error") {
          setRecordLoadError(result.message);
          setRecordLoadState("error");
          setLoadedRecordDate(null);
          setStatus("");
          return;
        }

        const loadedRecord =
          result.status === "found"
            ? normalizeCloudDailyRecord({ record: result.record, userId, date: recordDate })
            : createEmptyCloudDailyRecord({ userId, date: recordDate });

        setRecord(loadedRecord);
        setBaselineJson(toJson(loadedRecord));
        setLoadedRecordDate(recordDate);
        setRecordLoadState("ready");
        setMode("edit");
        setStatus(
          result.status === "not_found"
            ? `${recordDate} のクラウド記録はありません。新規記録として入力できます。`
            : "",
        );
      } catch (error) {
        if (cancelled) return;
        setRecordLoadError(error instanceof Error ? error.message : "予期しないエラー");
        setRecordLoadState("error");
        setLoadedRecordDate(null);
        setStatus("");
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [recordDate, recordReloadVersion, userId]);

  // タブ切替時：該当セクションの先頭入力にフォーカス
  useEffect(() => {
    const el = firstFocusRefs.current[tab];
    if (el) setTimeout(() => el.focus(), 0);
  }, [tab]);

  const retryRecordLoad = () => {
    setRecordLoadState("loading");
    setRecordLoadError("");
    setRecordReloadVersion((version) => version + 1);
  };

  const retryHistoryLoad = () => {
    setHistoryLoadState("loading");
    setHistoryLoadError("");
    setHistoryReloadVersion((version) => version + 1);
  };

  const recordUnavailableContent =
    recordLoadState === "error" ? (
      <section role="alert">
        <p>クラウド記録の読込に失敗しました: {recordLoadError}</p>
        <button type="button" onClick={retryRecordLoad}>
          再読込
        </button>
      </section>
    ) : (
      <p role="status">クラウドから記録を読み込んでいます…</p>
    );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* sticky header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "white",
          padding: 12,
          borderBottom: "1px solid #eee",
        }}
      >
        <div style={{ maxWidth: 980 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between", // ← 追加
              marginBottom: 8,
            }}
          >
            {/* 左側：タイトル＆説明 */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 style={{ margin: 0 }}>DailyRecordForm</h2>
              <span style={{ fontSize: 12, color: "#666" }}>（運動・食事・体重・体調の1日記録）</span>
            </div>

            {/* 右側：編集 / レポート トグル */}
            <DailyRecordModeToggle mode={mode} onChange={setMode} />
          </div>

          {/* 日付＋保存 */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <label>
              対象日付：
              <input
                type="date"
                value={recordDate}
                disabled={isMutationInProgress}
                onChange={(event) => {
                  if (event.target.value) {
                    handleLoadFromHistory(event.target.value as ISODate);
                  }
                }}
                style={{ marginLeft: 8 }}
              />
            </label>

            <button
              type="button"
              disabled={!isRecordReady || isMutationInProgress}
              onClick={onSave}
            >
              保存
            </button>
            <button
              type="button"
              disabled={!isRecordReady || isMutationInProgress}
              onClick={clearCurrentTab}
            >
              {clearLabel}
            </button>
            {isDirty && <span style={{ fontSize: 12, opacity: 0.8 }}>未保存</span>}
            <span aria-live="polite" style={{ opacity: 0.7 }}>{status}</span>
            <span style={{ fontSize: 12, opacity: 0.65 }}>
              {isRecordReady && record.daily_record.updated_at
                ? `最終更新: ${formatUpdatedAt(record.daily_record.updated_at)}`
                : ""}
            </span>
          </div>

          <div role="tablist" aria-label="Daily record sections" style={{ display: "flex", gap: 8 }}>
            {mode === "edit"
              ? tabs.map((t) => (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={tab === t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 4,
                      border: "1px solid #ccc",
                      background: tab === t.key ? "#333" : "#fff",
                      color: tab === t.key ? "#fff" : "#333",
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </button>
                ))
              : reportTabs.map((t) => (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={reportTab === t.key}
                    type="button"
                    onClick={() => setReportTab(t.key)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 4,
                      border: "1px solid #ccc",
                      background: reportTab === t.key ? "#333" : "#fff",
                      color: reportTab === t.key ? "#fff" : "#333",
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
          </div>
        </div>
      </div>

      {/* 本文 */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ maxWidth: 980, padding: 16, margin: "0 auto" }}>
          {isRecordReady && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
                Tabキーで各セクションに移動できます。各タブ内の最初の入力に自動フォーカスされます。
              </p>
            </div>
          )}

          <div>
            {mode === "edit" && (
              isRecordReady ? <>
                {tab === "weight" && (
                  <WeightSection
                    record={record}
                    setRecord={setRecord}
                    firstFocusRef={registerFirstFocus("weight")}
                  />
                )}
                {tab === "wellness" && <WellnessSection record={record} setRecord={setRecord} />}
                {tab === "meal" && (
                  <MealSection
                    record={record}
                    setRecord={setRecord}
                    firstFocusRef={registerFirstFocus("meal")}
                  />
                )}
                {tab === "exercise" && (
                  <ExerciseSection
                    record={record}
                    setRecord={setRecord}
                    firstFocusRef={registerFirstFocus("exercise")}
                  />
                )}
              </> : recordUnavailableContent
            )}

            {mode === "report" && (
              <>
                {reportTab === "reportView" &&
                  (isRecordReady
                    ? <ReportViewSection record={record} onSave={onSave} />
                    : recordUnavailableContent)}
                {reportTab === "io" && (
                  <ReportIOSSection
                    history={history}
                    loadState={historyLoadState}
                    errorMessage={historyLoadError}
                    deletingDate={deletingDate}
                    actionsDisabled={isMutationInProgress}
                    onLoad={handleLoadFromHistory}
                    onDelete={handleDeleteFromHistory}
                    onRetry={retryHistoryLoad}
                  />
                )}
              </>
            )}
          </div>

          {/* 下にも保存（残すならここ） */}
          <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
            {/* ←ここも元のまま */}
          </div>
        </div>
      </div>
    </div>
  );
};

/** ========== セクション ========== */

function WeightSection(props: {
  record: DailyRecordAggregate;
  setRecord: React.Dispatch<React.SetStateAction<DailyRecordAggregate>>;
  firstFocusRef: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
}) {
  const { record, setRecord, firstFocusRef } = props;
  return <WeightEditor record={record} setRecord={setRecord} firstFocusRef={firstFocusRef} />;
}

function WellnessSection(props: {
  record: DailyRecordAggregate;
  setRecord: React.Dispatch<React.SetStateAction<DailyRecordAggregate>>;
}) {
  const { record, setRecord } = props;
  return <WellnessEditor record={record} setRecord={setRecord} />;
}

function MealSection(props: {
  record: DailyRecordAggregate;
  setRecord: React.Dispatch<React.SetStateAction<DailyRecordAggregate>>;
  firstFocusRef: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
}) {
  const { record, setRecord, firstFocusRef } = props;

  return (
    <section>
      <MealEditor record={record} onChange={setRecord} firstFocusRef={firstFocusRef} />
    </section>
  );
}

function ExerciseSection(props: {
  record: DailyRecordAggregate;
  setRecord: React.Dispatch<React.SetStateAction<DailyRecordAggregate>>;
  firstFocusRef: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
}) {
  const { record, setRecord, firstFocusRef } = props;
  return (
    <section>
      {/* タブ切替後の先頭フォーカス用（見た目は邪魔しない） */}
      <input
        ref={firstFocusRef}
        style={{ position: "absolute", opacity: 0, height: 0, width: 0, pointerEvents: "none" }}
        aria-hidden="true"
        tabIndex={-1}
      />

      <ExerciseSessionsEditor record={record} onChange={setRecord} />
    </section>
  );
}

/** ========== Report セクション（プレースホルダ） ========== */

function ReportViewSection(props: {
  record: DailyRecordAggregate;
  onSave: () => boolean | Promise<boolean>;
}) {
  const { record, onSave } = props;

  return (
    <section>
      <h3>レポート表示</h3>
      <DailyRecordReportView record={record} onSave={onSave} />
    </section>
  );
}

function ReportIOSSection(props: {
  history: HistoryEntry[];
  loadState: HistoryLoadState;
  errorMessage: string;
  deletingDate: ISODate | null;
  actionsDisabled: boolean;
  onLoad: (date: ISODate) => void;
  onDelete: (date: ISODate) => void;
  onRetry: () => void;
}) {
  const {
    history,
    loadState,
    errorMessage,
    deletingDate,
    actionsDisabled,
    onLoad,
    onDelete,
    onRetry,
  } = props;

  const formatUpdatedAt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  };

  if (loadState === "loading") {
    return (
      <section>
        <h3>保存・読出</h3>
        <p role="status">クラウド履歴を読み込んでいます…</p>
      </section>
    );
  }

  if (loadState === "error") {
    return (
      <section role="alert">
        <h3>保存・読出</h3>
        <p>クラウド履歴の読込に失敗しました: {errorMessage}</p>
        <button type="button" onClick={onRetry}>
          履歴を再読込
        </button>
      </section>
    );
  }

  if (history.length === 0) {
    return (
      <section>
        <h3>保存・読出</h3>
        <p style={{ fontSize: 13, color: "#666" }}>
          まだ保存された記録はないみたい。
          上の「保存」ボタンで記録を保存すると、ここに履歴が表示されるよ。
        </p>
      </section>
    );
  }

  return (
    <section>
      <h3>保存・読出</h3>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {history.map((h) => (
          <div
            key={h.record_date}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "4px 0",
              borderBottom: "1px solid #eee",
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{h.record_date}</div>
              <div style={{ fontSize: 12, color: "#666" }}>
                最終保存: {formatUpdatedAt(h.updated_at)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={() => onLoad(h.record_date)}
              >
                この日の記録を読み込む
              </button>
              <button
                type="button"
                disabled={actionsDisabled}
                onClick={() => onDelete(h.record_date)}
                style={{ color: "#b00020", borderColor: "#b00020" }}
              >
                {deletingDate === h.record_date ? "削除中…" : "削除"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
