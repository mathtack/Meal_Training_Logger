import React from "react";
import type { DailyRecordAggregate, WellnessRecord } from "../../domain/type";

type Props = {
  record: DailyRecordAggregate;
  setRecord: React.Dispatch<React.SetStateAction<DailyRecordAggregate>>;
};

const SLEEP_DURATION_CATEGORY = [
  { value: "", label: "未選択" },
  { value: "lt6h", label: "6時間未満" },
  { value: "h6to7", label: "6〜7時間" },
  { value: "gte7h", label: "7時間以上" },
] as const;

const SLEEP_QUALITY = [
  { value: "", label: "未選択" },
  { value: "bad", label: "悪い" },
  { value: "normal", label: "普通" },
  { value: "good", label: "良い" },
] as const;

const WATER_INTAKE = [
  { value: "", label: "未選択" },
  { value: "lt1l", label: "1L未満" },
  { value: "l1to1_5", label: "1〜1.5L" },
  { value: "l1_5to2", label: "1.5〜2L" },
  { value: "gte2l", label: "2L以上" },
] as const;

const PHYSICAL_CONDITION = [
  { value: "", label: "未選択" },
  { value: "fine", label: "元気" },
  { value: "slightly_tired", label: "少し疲れ" },
  { value: "tired", label: "かなり疲れ" },
  { value: "exhausted", label: "強い疲労" },
] as const;

const MOOD = [
  { value: "", label: "未選択" },
  { value: "good", label: "良い" },
  { value: "normal", label: "普通" },
  { value: "bad", label: "悪い" },
  { value: "worst", label: "最悪" },
] as const;

const HUNGER_LEVEL = [
  { value: "", label: "未選択" },
  { value: "none", label: "なし" },
  { value: "slight", label: "多少あり" },
  { value: "strong", label: "強くあり" },
] as const;

const BOWEL_MOVEMENT = [
  { value: "", label: "未選択" },
  { value: "none", label: "出ない" },
  { value: "once", label: "1回" },
  { value: "twice", label: "2回" },
  { value: "three_or_more", label: "3回以上" },
] as const;

const nowISO = () => new Date().toISOString();
const toNullable = (v: string) => (v === "" ? null : v);

const ensureWellness = (record: DailyRecordAggregate): WellnessRecord => {
  const now = nowISO();
  return (
    record.wellness ?? {
      daily_record_id: record.daily_record.id,
      sleep_duration_category: null,
      sleep_quality: null,
      sleep_duration_minutes: null,
      sleep_source: null,
      water_intake: null,
      physical_condition: null,
      mood: null,
      hunger_level: null,
      bowel_movement: null,
      created_at: now,
      updated_at: now,
    }
  );
};

export const WellnessEditor: React.FC<Props> = ({ record, setRecord }) => {
  const setWellnessField = <K extends keyof WellnessRecord>(key: K, value: WellnessRecord[K]) => {
    setRecord((prev) => {
      const w = ensureWellness(prev);
      return { ...prev, wellness: { ...w, [key]: value, updated_at: nowISO() } };
    });
  };

  const selectStyle: React.CSSProperties = { width: 220 };
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "160px 1fr",
    gap: 10,
    maxWidth: 520,
    alignItems: "center",
  };

  const w = record.wellness;

  return (
    <section>
      <h3>健康体調</h3>

      <div style={gridStyle}>
        <label>睡眠時間</label>
        <select
          style={selectStyle}
          value={w?.sleep_duration_category ?? ""}
          onChange={(e) => setWellnessField("sleep_duration_category", toNullable(e.target.value))}
        >
          {SLEEP_DURATION_CATEGORY.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label>睡眠の質</label>
        <select
          style={selectStyle}
          value={w?.sleep_quality ?? ""}
          onChange={(e) => setWellnessField("sleep_quality", toNullable(e.target.value))}
        >
          {SLEEP_QUALITY.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* TODO: 将来の実装でIFする
        <label>推定睡眠時間（分）</label>
        <input
          style={{ width: 140 }}
          type="number"
          inputMode="numeric"
          value={w?.sleep_duration_minutes ?? ""}
          onChange={(e) => {
            const s = e.target.value;
            const n = s === "" ? null : Number(s);
            setWellnessField("sleep_duration_minutes", Number.isFinite(n as number) ? (n as number) : null);
          }}
          placeholder="例: 360"
        />

        <label>睡眠データソース</label>
        <input
          style={{ width: 220 }}
          type="text"
          value={w?.sleep_source ?? ""}
          onChange={(e) => setWellnessField("sleep_source", e.target.value === "" ? null : e.target.value)}
          placeholder="例: 手入力 / アプリ / etc"
        />
        */}

        <label>水分摂取</label>
        <select
          style={selectStyle}
          value={w?.water_intake ?? ""}
          onChange={(e) => setWellnessField("water_intake", toNullable(e.target.value))}
        >
          {WATER_INTAKE.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label>身体の調子</label>
        <select
          style={selectStyle}
          value={w?.physical_condition ?? ""}
          onChange={(e) => setWellnessField("physical_condition", toNullable(e.target.value))}
        >
          {PHYSICAL_CONDITION.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label>気分</label>
        <select
          style={selectStyle}
          value={w?.mood ?? ""}
          onChange={(e) => setWellnessField("mood", toNullable(e.target.value))}
        >
          {MOOD.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label>空腹感</label>
        <select
          style={selectStyle}
          value={w?.hunger_level ?? ""}
          onChange={(e) => setWellnessField("hunger_level", toNullable(e.target.value))}
        >
          {HUNGER_LEVEL.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label>便通</label>
        <select
          style={selectStyle}
          value={w?.bowel_movement ?? ""}
          onChange={(e) => setWellnessField("bowel_movement", toNullable(e.target.value))}
        >
          {BOWEL_MOVEMENT.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
};
