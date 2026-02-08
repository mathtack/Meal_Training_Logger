import React, { useState, useEffect } from "react";
import type { DailyRecord, MealRecord, ExerciseRecord } from "../domain/DailyRecord";
import { formatDailyRecord } from "../domain/formatDailyRecord"; // ← これ追加

import type { HistoryRecord } from "../domain/history";
import {
  buildExportPayload,
  mergeHistory,
  parseAndValidateExportPayload,
} from "../domain/history";
import {
  loadHistory,
  saveHistory,
  loadLatestRecord,
  saveLatestRecord,
} from "../data/localStorageHistory";

// 各セクションコンポーネントで共通して使うProps
export type DailyRecordSectionProps = {
  record: DailyRecord;
  onChange: (patch: Partial<DailyRecord>) => void;
};

export const DateSection: React.FC<DailyRecordSectionProps> = ({
  record,
  onChange,
}) => {
  return (
    <section>
      <h2>日付</h2>
      <div>
        <span style={{ color: "red", marginRight: 4 }}>*</span>
        <input
          type="date"
          value={record.date}
          onChange={(e) => onChange({ date: e.target.value })}
        />
      </div>
    </section>
  );
};

export const WeightSection: React.FC<DailyRecordSectionProps> = ({
  record,
  onChange,
}) => {
  // 体重の値が有効か判定（10～999、またはundefined）
  const isValidWeightValue = (value?: number): boolean => {
    if (value === undefined) return true; // 空は有効
    return value >= 10 && value <= 999;
  };

  // 朝 / 夜 どちらの体重かを渡して使う小さなハンドラ
  const handleWeightInput =
    (field: "morningWeight" | "nightWeight") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value === "" ? undefined : Number(e.target.value);
      onChange({ [field]: value } as Partial<DailyRecord>);
    };

  // 追加：計測時間のハンドラ
  const handleWeightTimeInput =
    (field: "morningWeightTime" | "nightWeightTime") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value === "" ? undefined : e.target.value;
      onChange({ [field]: value } as Partial<DailyRecord>);
    };

  return (
    <>
      {/* 朝 */}
      <div style={{ marginBottom: "8px" }}>
        <div style={{ fontWeight: "bold" }}>朝</div>
        <div>
          <label>
            時間：
            <input
              type="time"
              value={record.morningWeightTime ?? ""}
              onChange={handleWeightTimeInput("morningWeightTime")}
            />
          </label>
        </div>
        <div>
          <label>
            体重(kg)：
            <input
              type="number"
              value={record.morningWeight ?? ""}
              onChange={handleWeightInput("morningWeight")}
            />
            {record.morningWeight !== undefined && !isValidWeightValue(record.morningWeight) && (
              <p style={{ color: "red", fontSize: "0.8rem", marginTop: 4 }}>
                体重は2〜3桁の数値（10〜999）のみ入力できます
              </p>
            )}
          </label>
        </div>
      </div>

      {/* 夜 */}
      <div>
        <div style={{ fontWeight: "bold" }}>夜</div>
        <div>
          <label>
            時間：
            <input
              type="time"
              value={record.nightWeightTime ?? ""}
              onChange={handleWeightTimeInput("nightWeightTime")}
            />
          </label>
        </div>
        <div>
          <label>
            体重(kg)：
            <input
              type="number"
              value={record.nightWeight ?? ""}
              onChange={handleWeightInput("nightWeight")}
            />
            {record.nightWeight !== undefined && !isValidWeightValue(record.nightWeight) && (
              <p style={{ color: "red", fontSize: "0.8rem", marginTop: 4 }}>
                体重は2〜3桁の数値（10〜999）のみ入力できます
              </p>
            )}
          </label>
        </div>
      </div>
    </>
  );
};

export const MealsSection: React.FC<DailyRecordSectionProps> = ({
  record,
  onChange,
}) => {
  // index番目の食事だけを更新する共通ハンドラ
  const updateMeal = (
    index: number,
    patch: Partial<MealRecord>
  ) => {
    const newMeals = [...record.meals];
    newMeals[index] = { ...newMeals[index], ...patch };
    onChange({ meals: newMeals });
  };

  return (
    <section style={{ marginBottom: "16px" }}>
      <h2>食事</h2>

      {record.meals.map((meal, index) => (
        <div
          key={meal.time ?? index}
          style={{ marginBottom: "12px", paddingLeft: "4px" }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
            {meal.time}
          </div>

          <div style={{ marginBottom: "4px" }}>
            <label>
              時間：
              <input
                type="time"
                value={meal.eatenAt ?? ""}
                onChange={(e) =>
                  updateMeal(index, { eatenAt: e.target.value })
                }
              />
            </label>
          </div>

          <div>
            <label>
              メモ：
              <br />
              <textarea
                rows={2}
                style={{ width: "100%" }}
                value={meal.memo}
                onChange={(e) =>
                  updateMeal(index, { memo: e.target.value })
                }
                placeholder="食べた内容は、で区切る。改行はしない"
              />
            </label>
          </div>
        </div>
      ))}
    </section>
  );
};

export const ExercisesSection: React.FC<DailyRecordSectionProps> = ({
  record,
  onChange,
}) => {
  // いまは運動メモを1件だけ扱う想定（index 0）
  const currentMemo = record.exercises && record.exercises.length > 0
    ? record.exercises[0].memo
    : "";

  const handleExerciseMemoChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const value = e.target.value;

    let newExercises: ExerciseRecord[];

    if (!record.exercises || record.exercises.length === 0) {
      // まだ何もなければ1件目を新規作成
      newExercises = [
        {
          time: "メイン",
          memo: value,
        },
      ];
    } else {
      // すでに配列があれば0番目だけ更新
      newExercises = [...record.exercises];
      newExercises[0] = { ...newExercises[0], memo: value };
    }

    onChange({ exercises: newExercises });
  };

  return (
    <section style={{ marginBottom: "16px" }}>
      <h2>運動</h2>
      <div>
        <label>
          運動メモ：
          <br />
          <textarea
            rows={6}
            style={{ width: "100%" }}
            value={currentMemo}
            onChange={handleExerciseMemoChange}
            placeholder="ジムでやったメニューなどをメモ"
          />
        </label>
      </div>
    </section>
  );
};

export const ConditionSection: React.FC<DailyRecordSectionProps> = () => {
  return (
    <section style={{ marginBottom: "16px", opacity: 0.8 }}>
      <h2>コンディション（準備中）</h2>
      <p style={{ fontSize: "0.9rem" }}>
        睡眠 / 水分 / 疲労感 / 便通 / 気分 などの入力欄を
        今後ここに追加していく予定だよ。
      </p>
    </section>
  );
};

const createInitialMeals = (): MealRecord[] => [
  { time: "朝", memo: "" },
  { time: "昼", memo: "" },
  { time: "夜", memo: "" },
  { time: "間食", memo: "" }, // ← 追加
];

const createInitialRecord = (): DailyRecord => ({
  date: new Date().toISOString().slice(0, 10),
  morningWeight: undefined,
  nightWeight: undefined,
  morningWeightTime: undefined,
  nightWeightTime: undefined,
  meals: createInitialMeals(),
  exercises: [],
});

export const DailyRecordForm: React.FC = () => {
  const [record, setRecord] = useState<DailyRecord>(() => {
    const base = createInitialRecord();
    const latest = loadLatestRecord();

    if (!latest) {
      return base;
    }

    // base で不足項目を補完しつつ、latest を優先
    return {
      ...base,
      ...latest,
      // meals が空配列だったりしたときの保険
      meals: latest.meals && latest.meals.length > 0 ? latest.meals : base.meals,
    };
  });

  // フォーム内に追加（コンポーネントの外じゃなくて中にね！）
  const isValidWeightValue = (weight?: number): boolean => {
    if (weight === undefined || weight === null) {
      // 未入力はOK（「記録なし」扱いにするため）
      return true;
    }
    // 2〜3桁のみ許容 → 10〜999
    return weight >= 10 && weight <= 999;
  };

  const isDateFilled = record.date.trim() !== "";

  const areWeightsValid =
    isValidWeightValue(record.morningWeight) &&
    isValidWeightValue(record.nightWeight);

  // 「保存・コピーしてもいい状態か？」
  const canSaveOrCopy = isDateFilled && areWeightsValid;

  const [history, setHistory] = useState<HistoryRecord[]>(() => {
    return loadHistory();
  });

  const [exportJson, setExportJson] = useState<string>("");
  const [importJson, setImportJson] = useState<string>("");
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    saveLatestRecord(record);
  }, [record]);

  const handleRecordChange = (patch: Partial<DailyRecord>) => {
    setRecord((prev) => ({
      ...prev,
      ...patch,
    }));
  };
  
  // 入力内容を初期状態に戻す（latestRecord も useEffect 経由で更新される）
  const handleClearForm = () => {
    const initial = createInitialRecord();
    setRecord(initial);
    // history は触らない（履歴はそのまま残す）
  };
  // 生成されるメッセージ（毎回最新の record から生成）
  const previewText = formatDailyRecord(record);

  // 現在の record を履歴に保存する共通関数
  const saveCurrentToHistory = () => {
    const entry: HistoryRecord = {
      ...record,
      savedAt: new Date().toISOString(),
    };

    setHistory((prev) => {
      // 同じ日付(date)の履歴は消してから、新しいのを先頭に入れる
      const filtered = prev.filter((h) => h.date !== record.date);
      const next = [entry, ...filtered];

      // localStorage 保存は専用関数経由
      saveHistory(next);

      return next;
    });
  };

  // エクスポートJSONを生成する
  const handleGenerateExportJson = () => {
    const payload = buildExportPayload(history, record);
    const json = JSON.stringify(payload, null, 2);
    setExportJson(json);
  };

  // エクスポートJSONをクリップボードにコピー
  const handleCopyExportJson = async () => {
    if (!exportJson.trim()) {
      alert("先にエクスポートJSONを生成してね");
      return;
    }

    try {
      await navigator.clipboard.writeText(exportJson);
      alert("エクスポートJSONをクリップボードにコピーしたよ👌");
    } catch (e) {
      console.error("Failed to copy export JSON", e);
      alert("コピーに失敗しちゃった…ごめん🥲 手動で選択してコピーしてね");
    }
  };

  // インポート処理
  const handleImportJson = () => {
    setImportError(null);

    if (!importJson.trim()) {
      setImportError("JSONが空みたい…まずはエクスポートしたJSONを貼り付けてね");
      return;
    }

    try {
      const payload = parseAndValidateExportPayload(importJson);
      const merged = mergeHistory(history, payload.history);

      setHistory(merged);
      saveHistory(merged);

      alert("インポートして履歴にマージしたよ🙆‍♀️");
    } catch (e) {
      console.error(e);
      setImportError(
        "JSONの形式が正しくないか、このアプリのエクスポートデータじゃないかも…",
      );
    }
  };

  // クリップボードにコピーするハンドラ
  // ＋ 履歴保存も同時にやる
  const handleCopyToClipboard = async () => {
    const text = previewText.trim();
    if (!text) return;

    // ① 先に履歴保存だけは必ずやる
    saveCurrentToHistory();

    // ② そのうえでコピーを試みる
    try {
      await navigator.clipboard.writeText(text);
      alert("クリップボードにコピーしたよ👌\n今日の記録も履歴に保存しておいたよ📒");
    } catch (err) {
      console.error("コピーに失敗しました", err);
      alert("今日の記録は履歴に保存したけど、クリップボードコピーは失敗しちゃった…🥲");
    }
  };

  const handleLoadFromHistory = (entry: HistoryRecord) => {
    // フォームに選択した履歴を反映
    setRecord(entry);
    // latestRecord は record useEffect が自動で保存してくれるので、
    // ここでは setRecord だけでOK
  };

  return (
    <div style={{ padding: "16px", maxWidth: 600 }}>
      {/* ① 入力エリア */}
      <section style={{ marginBottom: "16px" }}>
        <h2>入力エリア</h2>

        {/* 入力クリアボタン（一番上に配置） */}
        <div style={{ margin: "8px 0 16px" }}>
          <button type="button" onClick={handleClearForm}>
            入力内容をクリア
          </button>
        </div>

        {/* 日付 */}
        <DateSection record={record} onChange={handleRecordChange} />
        {/* 体重 */}
        <WeightSection record={record} onChange={handleRecordChange} />
      </section>

      {/* 食事 */}
      <MealsSection record={record} onChange={handleRecordChange} />

      {/* 運動 */}
      <ExercisesSection record={record} onChange={handleRecordChange} />

      {/* コンディション（準備中） */}
      <ConditionSection record={record} onChange={handleRecordChange} />

      {/* ② データ操作エリア（コピー＋履歴） */}
      <section style={{ margin: "16px 0" }}>
        <h2>データ操作エリア</h2>

        {/* クリップボードにコピー */}
        <div style={{ margin: "8px 0 16px" }}>
          <button
            type="button"
            onClick={handleCopyToClipboard}
            disabled={!canSaveOrCopy}
          >
            クリップボードにコピー
          </button>

        </div>

        {/* 履歴セクション */}
        <div>
          <h3>履歴</h3>

          <div style={{ marginBottom: "8px" }}>
            <button
              type="button"
              onClick={saveCurrentToHistory}
              disabled={!canSaveOrCopy}
            >
              今日の記録を履歴に保存
            </button>
          </div>

          {history.length === 0 ? (
            <p style={{ fontSize: "0.9rem" }}>まだ履歴はありません。</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {history.map((item) => {
                const dateLabel = item.date;

                // savedAt から "hh:mm" を作る
                let timeLabel = "";
                try {
                  const d = new Date(item.savedAt);
                  const hh = String(d.getHours()).padStart(2, "0");
                  const mm = String(d.getMinutes()).padStart(2, "0");
                  timeLabel = `${hh}:${mm}`;
                } catch {
                  timeLabel = "";
                }

                return (
                  <li
                    key={`${item.date}-${item.savedAt}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                      gap: "8px",
                    }}
                  >
                    <div style={{ fontSize: "0.9rem" }}>
                      <div>{dateLabel}</div>
                      {timeLabel && (
                        <div style={{ opacity: 0.8 }}>
                          最終保存：{timeLabel}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLoadFromHistory(item)}
                    >
                      この日の記録を読み込む
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ③ データのエクスポート / インポート */}
      <section style={{ marginBottom: "24px" }}>
        <h2>データのエクスポート / インポート</h2>

        {/* エクスポート */}
        <div style={{ marginBottom: "16px" }}>
          <h3>エクスポート（スマホ → PCなど）</h3>
          <p style={{ fontSize: "0.9rem" }}>
            いまこの端末が持っている履歴（history）をJSONとして書き出すよ。<br />
            スマホで生成して、メモアプリ経由でPCに送る、みたいな使い方を想定してる。
          </p>
          <button type="button" onClick={handleGenerateExportJson}>
            エクスポートJSONを生成
          </button>
          <button
            type="button"
            onClick={handleCopyExportJson}
            style={{ marginLeft: "8px" }}
          >
            JSONをコピー
          </button>
          <div style={{ marginTop: "8px" }}>
            <textarea
              rows={8}
              style={{ width: "100%", fontFamily: "monospace" }}
              value={exportJson}
              readOnly
              placeholder="ここにエクスポートJSONが表示されるよ"
            />
          </div>
        </div>

        {/* インポート */}
        <div>
          <h3>インポート（別端末の履歴を取り込む）</h3>
          <p style={{ fontSize: "0.9rem" }}>
            スマホ側でエクスポートしたJSONをここに貼り付けて、「インポート」を押すと、
            この端末の履歴にマージされるよ。<br />
            同じ日付がある場合は、保存日時（savedAt）が新しい方を自動採用する。
          </p>
          <textarea
            rows={8}
            style={{ width: "100%", fontFamily: "monospace" }}
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder="ここにエクスポートJSONを貼り付けてね"
          />
          <div style={{ marginTop: "8px" }}>
            <button type="button" onClick={handleImportJson}>
              インポートして履歴にマージ
            </button>
          </div>
          {importError && (
            <p style={{ color: "red", marginTop: "4px", fontSize: "0.9rem" }}>
              {importError}
            </p>
          )}
        </div>
      </section>

      {/* ③ メッセージプレビューエリア */}
      <section>
        <h2>メッセージプレビューエリア</h2>
        <pre>{previewText}</pre>
      </section>

      {/* ④ デバッグエリア */}
      <section>
        <h2>デバッグエリア</h2>
        <pre>{JSON.stringify(record, null, 2)}</pre>
      </section>
    </div>
  );


};
