// src/ui/DailyRecordFormV110.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DailyRecordAggregate, ISODate } from "../domain/type";
import { createDailyRecordService } from "../app/dailyRecordService";
import { ExerciseSessionsEditor } from "./exercise/ExerciseSessionsEditor";
import { WeightEditor } from "./weights/WeightEditor";
import { WellnessEditor } from "./wellness/WellnessEditor";

const dailyRecordService = createDailyRecordService();

type TabKey = "weight" | "wellness" | "meal" | "exercise";
const TAB_ORDER: TabKey[] = ["weight", "wellness", "meal", "exercise"];
const TAB_LABEL: Record<TabKey, string> = {
  weight: "体重",
  wellness: "健康体調",
  meal: "食事",
  exercise: "運動",
};

function todayISODate(): ISODate {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}` as ISODate;
}

function formatUpdatedAt(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
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
  const toJson = (x: unknown) => JSON.stringify(x);
  const clearLabel = `${TAB_LABEL[tab]}をクリア`;

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

  // タブ切替後にフォーカスを当てたい先頭input
  const firstFocusRefs = useRef<Partial<Record<TabKey, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  const registerFirstFocus =
    (key: TabKey) => (el: HTMLInputElement | HTMLTextAreaElement | null) => {
      firstFocusRefs.current[key] = el;
    };

  // 日付が変わったらロード（同期）
  useEffect(() => {
    try {
      setStatus("loading...");
      const result = dailyRecordService.load(recordDate);
      setRecord(result.record);

      const base = toJson(result.record);
      setBaselineJson(base);
      setIsDirty(false);

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

  const tabs = useMemo(
    () => TAB_ORDER.map((k) => ({ key: k, label: TAB_LABEL[k] })),
    []
  );

  const onSave = () => {
    try {
      setStatus("saving...");
      const normalized = dailyRecordService.save(record); // normalized が返る
      setRecord(normalized);

      setStatus("saved");
      setBaselineJson(toJson(normalized));
      setIsDirty(false);

      setTimeout(() => setStatus(""), 800);
    } catch (e) {
      console.error(e);
      setStatus("save failed (see console)");
    }
  };

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
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>DailyRecordForm v1.1.0</h2>

            {/* ① 記録・表示切替（今は配置だけ） */}
            <button
              type="button"
              onClick={() => console.log("toggle view mode")}
              style={{ padding: "8px 14px", fontWeight: 600 }}
            >
              記録・表示切替
            </button>
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

          {/* タブ（Tabでボタンに移動 → Enter/Spaceで切替） */}
          <div role="tablist" aria-label="Daily record sections" style={{ display: "flex", gap: 8 }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  padding: "6px 10px",
                  border: "1px solid #ccc",
                  borderBottom: tab === t.key ? "2px solid #000" : "1px solid #ccc",
                  background: tab === t.key ? "#f6f6f6" : "white",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        <div style={{ maxWidth: 980 }}>
          {/* 中身 */}
          <div style={{ marginTop: 0, borderTop: "none", paddingTop: 0 }}>
            {tab === "weight" && (
              <WeightSection
                record={record}
                setRecord={setRecord}
                firstFocusRef={registerFirstFocus("weight")}
              />
            )}
            {tab === "wellness" && <WellnessSection record={record} setRecord={setRecord} />}
            {tab === "meal" && <MealSection record={record} firstFocusRef={registerFirstFocus("meal")} />}
            {tab === "exercise" && (
              <ExerciseSection
                record={record}
                setRecord={setRecord}
                firstFocusRef={registerFirstFocus("exercise")}
              />
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

/** ========== セクション（いまは運動以外WIP） ========== */

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
  firstFocusRef: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
}) {
  const { firstFocusRef } = props;
  return (
    <section>
      <h3>食事（WIP）</h3>
      <input ref={firstFocusRef} placeholder="（将来）" />
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

      <ExerciseSessionsEditor
        record={record}
        onChange={(next) => setRecord(next)}
      />
    </section>
  );

}
