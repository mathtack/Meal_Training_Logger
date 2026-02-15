// src/ui/exercise/ExerciseSessionsEditor.tsx
import React from "react";
import type {
  DailyRecordAggregate,
  ExerciseSessionAggregate,
  ExerciseItem,
  ExerciseType,
  LoadUnit,
  RecordingStyle,
  SetItem,
  UUID,
} from "../../domain/type";

type Props = {
  record: DailyRecordAggregate;
  onChange: (next: DailyRecordAggregate) => void;
};

const nowISO = () => new Date().toISOString();
const uuid = (): UUID =>
  (globalThis.crypto?.randomUUID?.() ?? `uuid_${Math.random().toString(16).slice(2)}_${Date.now()}`) as UUID;

function swap<T>(arr: T[], i: number, j: number): T[] {
  const copy = [...arr];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

function createSessionAgg(dailyRecordId: UUID, sessionOrder: number): ExerciseSessionAggregate {
  const id = uuid();
  const now = nowISO();
  return {
    session: {
      id,
      daily_record_id: dailyRecordId,
      session_order: sessionOrder, // 保存前に正規化される想定だけど仮で入れる
      session_label: "Session",
      started_at: null,
      ended_at: null,
      memo: null,
      calories_burned: null,
      created_at: now,
      updated_at: now,
    },
    items: [],
  };
}

function createItemBase(sessionId: UUID, itemOrder: number, style: RecordingStyle): ExerciseItem {
  const id = uuid();
  const now = nowISO();
  const base = {
    id,
    exercise_session_id: sessionId,
    item_order: itemOrder,
    body_part: null,
    exercise_name: "",
    exercise_type: "ANAEROBIC" as ExerciseType,
    recording_style: style,
    created_at: now,
    updated_at: now,
  };

  if (style === "TEXT") {
    return { ...base, recording_style: "TEXT", free_text: "" };
  }

  // SETS
  const setId = uuid();
  const set: SetItem = {
    id: setId,
    exercise_item_id: id,
    set_order: 0,
    load_value: null,
    load_unit: "KG" as LoadUnit,
    reps: null,
    has_sides: false,
    reps_left: null,
    reps_right: null,
    duration_seconds: null,
    memo: null,
    created_at: now,
    updated_at: now,
  };

  return { ...base, recording_style: "SETS", sets: [set] };
}

function createSet(itemId: UUID, setOrder: number): SetItem {
  const now = nowISO();
  return {
    id: uuid(),
    exercise_item_id: itemId,
    set_order: setOrder,
    load_value: null,
    load_unit: "KG",
    reps: null,
    has_sides: false,
    reps_left: null,
    reps_right: null,
    duration_seconds: null,
    memo: null,
    created_at: now,
    updated_at: now,
  };
}

export const ExerciseSessionsEditor: React.FC<Props> = ({ record, onChange }) => {
  const sessions = record.exercise_sessions;

  const updateSessions = (nextSessions: ExerciseSessionAggregate[]) => {
    onChange({ ...record, exercise_sessions: nextSessions });
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>運動（Exercise）</h3>
        <span style={{ opacity: 0.7 }}>sessions: {sessions.length}</span>
        <button
          type="button"
          onClick={() => {
            const next = [...sessions, createSessionAgg(record.daily_record.id, sessions.length)];
            updateSessions(next);
          }}
        >
          ＋ セッション追加
        </button>
      </div>

      {sessions.length === 0 ? (
        <p style={{ opacity: 0.7 }}>まだセッションがありません。</p>
      ) : (
        sessions.map((sAgg, sIdx) => (
          <SessionCard
            key={sAgg.session.id}
            sAgg={sAgg}
            sIdx={sIdx}
            isFirst={sIdx === 0}
            isLast={sIdx === sessions.length - 1}
            onChange={(nextSAgg) => {
              const next = sessions.map((x, i) => (i === sIdx ? nextSAgg : x));
              updateSessions(next);
            }}
            onMoveUp={() => updateSessions(swap(sessions, sIdx, sIdx - 1))}
            onMoveDown={() => updateSessions(swap(sessions, sIdx, sIdx + 1))}
            onDelete={() => updateSessions(sessions.filter((_, i) => i !== sIdx))}
          />
        ))
      )}
    </div>
  );
};

const SessionCard: React.FC<{
  sAgg: ExerciseSessionAggregate;
  sIdx: number;
  isFirst: boolean;
  isLast: boolean;
  onChange: (next: ExerciseSessionAggregate) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}> = ({ sAgg, sIdx, isFirst, isLast, onChange, onMoveUp, onMoveDown, onDelete }) => {
  const session = sAgg.session;
  const items = sAgg.items;

  const updateItems = (nextItems: ExerciseItem[]) => {
    onChange({ ...sAgg, items: nextItems });
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <strong>Session {sIdx + 1}</strong>

        <button type="button" onClick={onMoveUp} disabled={isFirst}>
          ▲
        </button>
        <button type="button" onClick={onMoveDown} disabled={isLast}>
          ▼
        </button>
        <button type="button" onClick={onDelete}>
          削除
        </button>
      </div>

    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 80px 1fr", gap: 8, marginBottom: 8 }}>
      <label>Start</label>
      <input
        type="datetime-local"
        value={session.started_at ?? ""}
        onChange={(e) =>
          onChange({
            ...sAgg,
            session: { ...session, started_at: e.target.value || null },
          })
        }
      />
      <label>End</label>
      <input
        type="datetime-local"
        value={session.ended_at ?? ""}
        onChange={(e) =>
          onChange({
            ...sAgg,
            session: { ...session, ended_at: e.target.value || null },
          })
        }   
      />

      <label>消費カロリー</label>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="number"
          inputMode="numeric"
          value={session.calories_burned ?? ""}
          onChange={(e) =>
            onChange({
              ...sAgg,
              session: {
                ...session,
                calories_burned: e.target.value === "" ? null : Number(e.target.value),
              },
            })
          }
          style={{ width: 120 }}
        />
        <span>kcal</span>
      </div>
    </div>

      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, marginBottom: 8 }}>
        <label>ラベル</label>
        <input
          value={session.session_label ?? ""}
          onChange={(e) =>
            onChange({
              ...sAgg,
              session: { ...session, session_label: e.target.value },
            })
          }
        />

        <label>メモ</label>
        <textarea
          rows={2}
          value={session.memo ?? ""}
          onChange={(e) =>
            onChange({
              ...sAgg,
              session: { ...session, memo: e.target.value },
            })
          }
        />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <span style={{ opacity: 0.7 }}>items: {items.length}</span>

        <button
          type="button"
          onClick={() => updateItems([...items, createItemBase(session.id, items.length, "SETS")])}
        >
          ＋ Item（SETS）
        </button>
        <button
          type="button"
          onClick={() => updateItems([...items, createItemBase(session.id, items.length, "TEXT")])}
        >
          ＋ Item（TEXT）
        </button>
      </div>

      {items.length === 0 ? (
        <p style={{ opacity: 0.7 }}>まだアイテムがありません。</p>
      ) : (
        items.map((item, iIdx) => (
          <ItemCard
            key={item.id}
            item={item}
            iIdx={iIdx}
            isFirst={iIdx === 0}
            isLast={iIdx === items.length - 1}
            onChange={(nextItem) => updateItems(items.map((x, i) => (i === iIdx ? nextItem : x)))}
            onMoveUp={() => updateItems(swap(items, iIdx, iIdx - 1))}
            onMoveDown={() => updateItems(swap(items, iIdx, iIdx + 1))}
            onDelete={() => updateItems(items.filter((_, i) => i !== iIdx))}
          />
        ))
      )}
    </div>
  );
};

const ItemCard: React.FC<{
  item: ExerciseItem;
  iIdx: number;
  isFirst: boolean;
  isLast: boolean;
  onChange: (next: ExerciseItem) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}> = ({ item, iIdx, isFirst, isLast, onChange, onMoveUp, onMoveDown, onDelete }) => {
  const changeStyle = (style: RecordingStyle) => {
    // 方針：切替時は破棄（SETS <-> TEXT）
    const now = nowISO();
    const base = {
      ...item,
      recording_style: style,
      updated_at: now,
    } as any;

    if (style === "TEXT") {
      delete base.sets;
      base.free_text = "";
      onChange(base as ExerciseItem);
      return;
    }

    // SETS
    delete base.free_text;
    const set = createSet(item.id, 0);
    base.sets = [set];
    onChange(base as ExerciseItem);
  };

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <strong>Item {iIdx + 1}</strong>
        <button type="button" onClick={onMoveUp} disabled={isFirst}>
          ▲
        </button>
        <button type="button" onClick={onMoveDown} disabled={isLast}>
          ▼
        </button>
        <button type="button" onClick={onDelete}>
          削除
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, marginBottom: 8 }}>
        <label>種目名</label>
        <input value={item.exercise_name} onChange={(e) => onChange({ ...item, exercise_name: e.target.value })} />

        <label>部位</label>
        <input
          value={item.body_part ?? ""}
          onChange={(e) => onChange({ ...item, body_part: e.target.value || null })}
        />

        <label>種別</label>
        <select
          value={item.exercise_type}
          onChange={(e) => onChange({ ...item, exercise_type: e.target.value as ExerciseType })}
        >
          <option value="ANAEROBIC">ANAEROBIC</option>
          <option value="AEROBIC">AEROBIC</option>
        </select>

        <label>記録方式</label>
        <select value={item.recording_style} onChange={(e) => changeStyle(e.target.value as RecordingStyle)}>
          <option value="SETS">SETS</option>
          <option value="TEXT">TEXT</option>
        </select>
      </div>

      {item.recording_style === "TEXT" ? (
        <div>
          <label>フリーテキスト</label>
          <textarea
            rows={3}
            style={{ width: "100%", marginTop: 6 }}
            value={item.free_text}
            onChange={(e) => onChange({ ...item, free_text: e.target.value })}
          />
        </div>
      ) : (
        <SetsEditor item={item} onChange={onChange} />
      )}
    </div>
  );
};

const SetsEditor: React.FC<{
  item: Extract<ExerciseItem, { recording_style: "SETS" }>;
  onChange: (next: ExerciseItem) => void;
}> = ({ item, onChange }) => {
  const sets = item.sets;

  const updateSets = (nextSets: SetItem[]) => {
    onChange({ ...item, sets: nextSets });
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
        <strong>SETS</strong>
        <span style={{ opacity: 0.7 }}>rows: {sets.length}</span>
        <button type="button" onClick={() => updateSets([...sets, createSet(item.id, sets.length)])}>
          ＋ Set追加
        </button>
      </div>

      {sets.map((s, idx) => {
        const cols = s.has_sides
          ? "50px 90px 70px 70px 70px 80px 1fr auto"
          : "50px 90px 70px 110px 80px 1fr auto";
        return (
        <div key={s.id} style={{ display: "grid", gridTemplateColumns: cols, gap: 6, alignItems: "center", marginBottom: 6 }}>
          <div style={{ opacity: 0.7 }}>#{idx + 1}</div>

          <input
            inputMode="decimal"
            placeholder="kg"
            value={s.load_value ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              const next = sets.map((x, i) => (i === idx ? { ...x, load_value: Number.isFinite(v as any) ? v : null } : x));
              updateSets(next);
            }}
          />

          <select
            value={(s.load_unit ?? "KG") as LoadUnit}
            onChange={(e) => {
              const next = sets.map((x, i) => (i === idx ? { ...x, load_unit: e.target.value as LoadUnit } : x));
              updateSets(next);
            }}
          >
            <option value="KG">KG</option>
            <option value="LBS">LBS</option>
            <option value="BODYWEIGHT">BW</option>
          </select>

          {/* reps or sides */}
          {s.has_sides ? (
            <>
              <input
                inputMode="numeric"
                placeholder="L"
                value={s.reps_left ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  const next = sets.map((x, i) => (i === idx ? { ...x, reps_left: Number.isFinite(v as any) ? v : null } : x));
                  updateSets(next);
                }}
              />
              <input
                inputMode="numeric"
                placeholder="R"
                value={s.reps_right ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  const next = sets.map((x, i) => (i === idx ? { ...x, reps_right: Number.isFinite(v as any) ? v : null } : x));
                  updateSets(next);
                }}
              />
            </>
          ) : (
            <input
              inputMode="numeric"
              placeholder="reps"
              value={s.reps ?? ""}
              onChange={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                const next = sets.map((x, i) => (i === idx ? { ...x, reps: Number.isFinite(v as any) ? v : null } : x));
                updateSets(next);
              }}
            />
          )}

          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={s.has_sides}
              onChange={(e) => {
                const checked = e.target.checked;
                const next = sets.map((x, i) =>
                  i === idx
                    ? {
                        ...x,
                        has_sides: checked,
                        reps: checked ? null : x.reps,
                        reps_left: checked ? x.reps_left : null,
                        reps_right: checked ? x.reps_right : null,
                      }
                    : x
                );
                updateSets(next);
              }}
            />
            左右
          </label>

          <input
            placeholder="memo"
            value={s.memo ?? ""}
            onChange={(e) => {
              const next = sets.map((x, i) => (i === idx ? { ...x, memo: e.target.value } : x));
              updateSets(next);
            }}
          />

          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
            <button type="button" disabled={idx === 0} onClick={() => updateSets(swap(sets, idx, idx - 1))}>
              ▲
            </button>
            <button type="button" disabled={idx === sets.length - 1} onClick={() => updateSets(swap(sets, idx, idx + 1))}>
              ▼
            </button>
            <button type="button" onClick={() => updateSets(sets.filter((_, i) => i !== idx))}>
              ✕
            </button>
          </div>
        </div>
        );
      })}
    </div>
  );
};
