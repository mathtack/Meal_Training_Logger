// src/ui/DailyRecordFormV110.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DailyRecordAggregate, ISODate } from "../domain/type";
import { createDailyRecordService } from "../app/dailyRecordService";
import { ExerciseSessionsEditor } from "./exercise/ExerciseSessionsEditor";
import { WeightEditor } from "./weights/WeightEditor";
import { WellnessEditor } from "./wellness/WellnessEditor";
import { MealEditor } from "./meal/MealEditor";
import { DailyRecordReportView } from "../domain/report/DailyRecordReportView";

const dailyRecordService = createDailyRecordService();

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

// 保存・読出タブの1行分
type HistoryEntry = {
  record_date: ISODate; // 2026-02-19
  updated_at: string;   // ISODateTime
};

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

export const DailyRecordFormV110: React.FC = () => {
  const [recordDate, setRecordDate] = useState<ISODate>(todayISODate());
  const [tab, setTab] = useState<TabKey>("exercise"); // 最優先が運動なのでここから
  const [record, setRecord] = useState<DailyRecordAggregate>(() => dailyRecordService.load(todayISODate()).record);
  const [status, setStatus] = useState<string>("");
  const [baselineJson, setBaselineJson] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);
  const [mode, setMode] = useState<DailyRecordMode>("edit");
  const [reportTab, setReportTab] = useState<ReportTabKey>("reportView");
  const [history, setHistory] = useState<HistoryEntry[]>([]); // 👈 追加
  const toJson = (x: unknown) => JSON.stringify(x);
  const clearLabel = `${TAB_LABEL[tab]}をクリア`;
  
  // 履歴一覧を読み直す
  const reloadHistory = () => {
    const list = dailyRecordService.listHistory();
    setHistory(list);
  };

  const clearCurrentTab = () => {
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

  const onSave = (): boolean => {
    try {
      setStatus("saving...");
      const normalized = dailyRecordService.save(record); // normalized が返る
      setRecord(normalized);

      setStatus("saved");
      setBaselineJson(toJson(normalized));
      setIsDirty(false);

      // 👇 履歴一覧を更新
      reloadHistory();

      setTimeout(() => setStatus(""), 800);
      return true;
    } catch (e) {
      console.error(e);
      setStatus("save failed (see console)");
      return false;
    }
  };

  const handleLoadFromHistory = (date: ISODate) => {
    const result = dailyRecordService.load(date);
    setRecordDate(date);
    setRecord(result.record);
    setBaselineJson(toJson(result.record));
    setIsDirty(false);
    setStatus(`履歴から ${date} の記録を読み込んだよ`);
  };

  const handleDeleteFromHistory = (date: ISODate) => {
    const ok = window.confirm(`${date} の記録を削除する？（元に戻せないよ）`);
    if (!ok) return;

    dailyRecordService.delete(date);
    reloadHistory();
    setStatus(`${date} の記録を削除したよ`);

    // 必要なら、今開いている日付と同じだった場合のケアをここに足してもOK
  };

  // 画面初期表示時に履歴一覧をロード
  useEffect(() => {
    reloadHistory();
  }, []);

  // 日付が変わったらロード（同期）
  useEffect(() => {
    try {
      setStatus("loading...");
      const result = dailyRecordService.load(recordDate);
      setRecord(result.record);

      const base = toJson(result.record);
      setBaselineJson(base);
      setIsDirty(false);
      setMode("edit");

      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus("load failed (see console)");
    }
  }, [recordDate]);

  // タブ切替時：該当セクションの先頭入力にフォーカス
  useEffect(() => {
    const el = firstFocusRefs.current[tab];
    if (el) setTimeout(() => el.focus(), 0);
  }, [tab]);

  useEffect(() => {
    if (!baselineJson) return;
    setIsDirty(toJson(record) !== baselineJson);
  }, [record, baselineJson]);

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
              <h2 style={{ margin: 0 }}>DailyRecordForm v1.1.0</h2>
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
                onChange={(e) => setRecordDate(e.target.value as ISODate)}
                style={{ marginLeft: 8 }}
              />
            </label>

            <button type="button" onClick={onSave}>
              保存
            </button>
            <button type="button" onClick={clearCurrentTab}>
              {clearLabel}
            </button>
            {isDirty && <span style={{ fontSize: 12, opacity: 0.8 }}>未保存</span>}
            <span style={{ opacity: 0.7 }}>{status}</span>
            <span style={{ fontSize: 12, opacity: 0.65 }}>
              {record.daily_record.updated_at ? `最終更新: ${formatUpdatedAt(record.daily_record.updated_at)}` : ""}
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
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
              Tabキーで各セクションに移動できます。各タブ内の最初の入力に自動フォーカスされます。
            </p>
          </div>

          <div>
            {mode === "edit" && (
              <>
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
              </>
            )}

            {mode === "report" && (
              <>
                {reportTab === "reportView" && <ReportViewSection record={record} onSave={onSave} />}
                {reportTab === "io" && (
                  <ReportIOSSection
                    history={history}
                    onLoad={handleLoadFromHistory}
                    onDelete={handleDeleteFromHistory}
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
  onLoad: (date: ISODate) => void;
  onDelete: (date: ISODate) => void;
}) {
  const { history, onLoad, onDelete } = props;

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
              <button type="button" onClick={() => onLoad(h.record_date)}>
                この日の記録を読み込む
              </button>
              <button
                type="button"
                onClick={() => onDelete(h.record_date)}
                style={{ color: "#b00020", borderColor: "#b00020" }}
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
