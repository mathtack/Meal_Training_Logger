import React, { useMemo, useState } from "react";
import type { DailyRecordAggregate, WeightRecord, ISODateTime } from "../../../00_common/src/domain/type";
import { generateUUID } from "../../../00_common/src/domain/generateUUID";

type Props = {
  record: DailyRecordAggregate;
  setRecord: React.Dispatch<React.SetStateAction<DailyRecordAggregate>>;
  firstFocusRef?: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
};

type ScopedText = {
  baseKey: string;
  value: string;
};

const SLOT_MORNING = "MORNING";
const SLOT_EVENING = "EVENING";

const nowISO = (): ISODateTime => new Date().toISOString();

function findBySlot(weights: WeightRecord[], slot: string): WeightRecord | undefined {
  return weights.find((w) => w.measurement_time_slot === slot);
}

function formatWeight(w?: number | null): string {
  if (w === null || w === undefined) return "";
  return String(w);
}

function toHHmm(iso: string | null): string {
  if (!iso) return "";
  // UTC ISOをローカル時刻に直して表示する（再blur時の時刻ドリフト防止）
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

const toHalfWidthNumber = (s: string) =>
  s
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/[．。]/g, "."); // 全角ドット系 → 半角

/**
 * 旧思想：入力は素通し、確定時（blur）にだけ正規化＆検証
 * - 空欄：null（=削除）
 * - OK：number
 * - NG："invalid"（入力は残すが record は更新しない）
 */
function parseWeightOnCommit(raw: string): number | null | "invalid" {
  // スペース（半角/全角）を除去
  const compact = raw.replace(/[\s\u3000]+/g, "");
  const s = toHalfWidthNumber(compact.trim());

  if (s === "") return null;

  // 小数点2桁まで、最大3桁整数
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return "invalid";

  const n = Number(s);
  if (!Number.isFinite(n)) return "invalid";
  if (n < 10 || n > 999.99) return "invalid";

  return n;
}

const timeToMeasuredAtIso = (recordDate: string, hhmm: string): string | null => {
  const t = hhmm.trim();
  if (!t) return null;
  // HH:mm 形式チェック
  if (!/^\d{2}:\d{2}$/.test(t)) return null;

  // ローカル日時として Date を作って ISO 化（Zになる）
  const d = new Date(`${recordDate}T${t}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

function upsertWeight(
  record: DailyRecordAggregate,
  slot: string,
  weight: number | null,
  measuredAtIso: string | null
): DailyRecordAggregate {
  const now = nowISO();
  const existing = findBySlot(record.weights, slot);

  if (weight === null) {
    // 空欄削除（時間だけ入ってる場合も削除扱いにしたいならここで削除）
    const filtered = record.weights.filter((w) => w.measurement_time_slot !== slot);
    return { ...record, weights: filtered };
  }

  if (existing) {
    const updated: WeightRecord = {
      ...existing,
      weight,
      measured_at: measuredAtIso,
      updated_at: now,
    };
    const next = record.weights.map((w) => (w.id === existing.id ? updated : w));
    return { ...record, weights: next };
  }

  const created: WeightRecord = {
    id: generateUUID(),
    daily_record_id: record.daily_record.id,
    measurement_time_slot: slot,
    measurement_order: 999,
    weight,
    measured_at: measuredAtIso,
    created_at: now,
    updated_at: now,
  };

  return { ...record, weights: [...record.weights, created] };
}

export const WeightEditor: React.FC<Props> = ({ record, setRecord, firstFocusRef }) => {
  const morning = useMemo(() => findBySlot(record.weights, SLOT_MORNING), [record.weights]);
  const evening = useMemo(() => findBySlot(record.weights, SLOT_EVENING), [record.weights]);

  const recordBaseKey = `${record.daily_record.id}|${record.daily_record.record_date}`;

  const committedMorningText = formatWeight(morning?.weight);
  const committedEveningText = formatWeight(evening?.weight);
  const committedMorningTime = toHHmm(morning?.measured_at ?? null);
  const committedEveningTime = toHHmm(evening?.measured_at ?? null);

  const morningWeightBaseKey = `${recordBaseKey}|${morning?.id ?? ""}|${committedMorningText}`;
  const eveningWeightBaseKey = `${recordBaseKey}|${evening?.id ?? ""}|${committedEveningText}`;
  const morningTimeBaseKey = `${recordBaseKey}|${morning?.id ?? ""}|${committedMorningTime}`;
  const eveningTimeBaseKey = `${recordBaseKey}|${evening?.id ?? ""}|${committedEveningTime}`;
  const morningErrorBaseKey = `${morningWeightBaseKey}|${committedMorningTime}`;
  const eveningErrorBaseKey = `${eveningWeightBaseKey}|${committedEveningTime}`;

  // 入力中は素通し（IMEを邪魔しない）。未編集時や確定値の外部切替時は確定済み値を表示する。
  const [morningTextDraft, setMorningTextDraft] = useState<ScopedText | null>(null);
  const [eveningTextDraft, setEveningTextDraft] = useState<ScopedText | null>(null);
  const [morningTimeDraft, setMorningTimeDraft] = useState<ScopedText | null>(null);
  const [eveningTimeDraft, setEveningTimeDraft] = useState<ScopedText | null>(null);

  // エラーメッセージ（入力は残す）
  const [morningErrorState, setMorningErrorState] = useState<ScopedText | null>(null);
  const [eveningErrorState, setEveningErrorState] = useState<ScopedText | null>(null);

  const morningText =
    morningTextDraft && morningTextDraft.baseKey === morningWeightBaseKey
      ? morningTextDraft.value
      : committedMorningText;
  const eveningText =
    eveningTextDraft && eveningTextDraft.baseKey === eveningWeightBaseKey
      ? eveningTextDraft.value
      : committedEveningText;
  const morningTime =
    morningTimeDraft && morningTimeDraft.baseKey === morningTimeBaseKey
      ? morningTimeDraft.value
      : committedMorningTime;
  const eveningTime =
    eveningTimeDraft && eveningTimeDraft.baseKey === eveningTimeBaseKey
      ? eveningTimeDraft.value
      : committedEveningTime;
  const morningError =
    morningErrorState && morningErrorState.baseKey === morningErrorBaseKey
      ? morningErrorState.value
      : null;
  const eveningError =
    eveningErrorState && eveningErrorState.baseKey === eveningErrorBaseKey
      ? eveningErrorState.value
      : null;

  const commit = (slot: string, rawWeight: string, rawTime: string) => {
    const parsed = parseWeightOnCommit(rawWeight);
    const measuredAtIso = timeToMeasuredAtIso(record.daily_record.record_date, rawTime);
    const timeInvalid = rawTime.trim() !== "" && measuredAtIso === null;
    const errorMessage =
      parsed === "invalid"
        ? "10〜999.99、小数2桁まで"
        : timeInvalid
          ? "時刻形式が不正です（HH:mm）"
          : null;

    // エラーをセット
    if (slot === SLOT_MORNING) {
      setMorningErrorState(
        errorMessage ? { baseKey: morningErrorBaseKey, value: errorMessage } : null,
      );
    }
    if (slot === SLOT_EVENING) {
      setEveningErrorState(
        errorMessage ? { baseKey: eveningErrorBaseKey, value: errorMessage } : null,
      );
    }

    // NGなら record は更新しない（旧挙動寄せ）
    if (parsed === "invalid" || timeInvalid) return;

    const existing = findBySlot(record.weights, slot);

    // OK or 空欄は record 更新
    setRecord((prev) => upsertWeight(prev, slot, parsed, measuredAtIso));

    // 表示も確定済み値へ戻す（体重未登録のまま時刻だけ先に入力したケースは時刻下書きを維持）
    if (slot === SLOT_MORNING) {
      setMorningTextDraft(null);
      if (parsed !== null || existing) {
        setMorningTimeDraft(null);
      }
    }
    if (slot === SLOT_EVENING) {
      setEveningTextDraft(null);
      if (parsed !== null || existing) {
        setEveningTimeDraft(null);
      }
    }
  };

  const errorStyle: React.CSSProperties = {
    color: "#c00",
    fontSize: 12,
    marginTop: 4,
  };


  // 👇 ここで宣言（returnの前）
  const rowLineStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "nowrap",
  };

  const timeStyle: React.CSSProperties = {
    width: 120,
  };

  const weightStyle: React.CSSProperties = {
    width: 140,
  };

  return (
    <section>
      <h3>体重</h3>

      <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 12, maxWidth: 680 }}>
        <label style={{ alignSelf: "center" }}>朝</label>
        <div style={rowLineStyle}>
          <span>測定時刻</span>
          <input
            type="time"
            style={timeStyle}
            value={morningTime}
            onChange={(e) => setMorningTimeDraft({ baseKey: morningTimeBaseKey, value: e.target.value })}
            onBlur={(e) => commit(SLOT_MORNING, morningText, e.currentTarget.value)}
          />

          <span>体重</span>
          <input
            ref={firstFocusRef}
            type="text"
            inputMode="decimal"
            style={weightStyle}
            value={morningText}
            onChange={(e) => setMorningTextDraft({ baseKey: morningWeightBaseKey, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (e.nativeEvent.isComposing) return;
              e.currentTarget.blur();
            }}
            onBlur={(e) => commit(SLOT_MORNING, e.currentTarget.value, morningTime)}
          />
          <span>(kg)</span>
        </div>
        {morningError && <div style={errorStyle}>{morningError}</div>}

        <label style={{ alignSelf: "center" }}>夜</label>
        <div style={rowLineStyle}>
          <span>測定時刻</span>
          <input
            type="time"
            style={timeStyle}
            value={eveningTime}
            onChange={(e) => setEveningTimeDraft({ baseKey: eveningTimeBaseKey, value: e.target.value })}
            onBlur={(e) => commit(SLOT_EVENING, eveningText, e.currentTarget.value)}
          />

          <span>体重</span>
          <input
            type="text"
            inputMode="decimal"
            style={weightStyle}
            value={eveningText}
            onChange={(e) => setEveningTextDraft({ baseKey: eveningWeightBaseKey, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (e.nativeEvent.isComposing) return;
              e.currentTarget.blur();
            }}
            onBlur={(e) => commit(SLOT_EVENING, e.currentTarget.value, eveningTime)}
          />
          <span>(kg)</span>
        </div>
        {eveningError && <div style={errorStyle}>{eveningError}</div>}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        空欄にするとその枠の記録は削除（保存までは反映されない）
      </div>
    </section>
  );
};
