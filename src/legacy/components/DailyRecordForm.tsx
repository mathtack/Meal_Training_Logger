import React, { useState, useEffect } from "react";
import type {
  DailyRecord,
  MealRecord,
  ExerciseRecord,
} from "../domain/DailyRecord";
import { formatDailyRecord, type ExportTarget } from "../domain/formatDailyRecord";

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

export const ConditionSection: React.FC<DailyRecordSectionProps> = ({
  record,
  onChange,
}) => {
  // セレクト共通ハンドラ：空文字なら undefined にする
  const handleSelectChange =
    <K extends keyof DailyRecord>(key: K) =>
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      onChange({
        [key]: (value === "" ? undefined : value) as DailyRecord[K],
      });
    };

  return (
    <section style={{ marginBottom: "16px" }}>
      <h2>🧠 コンディション（任意）</h2>
      <p style={{ fontSize: "0.9rem", marginBottom: 8 }}>
        夜にその日の状態をざっくり振り返る用だよ。入力しなかった項目はプレビューにも表示されないよ。
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* 🛌 睡眠 */}
        <label>
          🛌 睡眠：
          <select
            value={record.sleepDurationCategory ?? ""}
            onChange={handleSelectChange("sleepDurationCategory")}
            style={{ marginRight: 8 }}
          >
            <option value="">（時間を選択）</option>
            <option value="lt6h">6時間未満</option>
            <option value="h6to7">6〜7時間</option>
            <option value="gte7h">7時間以上</option>
          </select>
          <select
            value={record.sleepQuality ?? ""}
            onChange={handleSelectChange("sleepQuality")}
          >
            <option value="">（質を選択）</option>
            <option value="bad">悪い</option>
            <option value="normal">普通</option>
            <option value="good">良い</option>
          </select>
        </label>

        {/* 💧 水分 */}
        <label>
          💧 水分：
          <select
            value={record.waterIntake ?? ""}
            onChange={handleSelectChange("waterIntake")}
          >
            <option value="">（選択）</option>
            <option value="lt1l">1L未満</option>
            <option value="l1to1_5">1〜1.5L</option>
            <option value="l1_5to2">1.5〜2L</option>
            <option value="gte2l">2L以上</option>
          </select>
        </label>

        {/* 🔋 身体 */}
        <label>
          🔋 身体：
          <select
            value={record.physicalCondition ?? ""}
            onChange={handleSelectChange("physicalCondition")}
          >
            <option value="">（選択）</option>
            <option value="fine">元気</option>
            <option value="slightly_tired">少し疲れ</option>
            <option value="tired">かなり疲れ</option>
            <option value="exhausted">強い疲労</option>
          </select>
        </label>

        {/* 💭 気分 */}
        <label>
          💭 気分：
          <select
            value={record.mood ?? ""}
            onChange={handleSelectChange("mood")}
          >
            <option value="">（選択）</option>
            <option value="good">良い</option>
            <option value="normal">普通</option>
            <option value="bad">悪い</option>
            <option value="worst">最悪</option>
          </select>
        </label>

        {/* 🤤 空腹感 */}
        <label>
          🤤 空腹感：
          <select
            value={record.hungerLevel ?? ""}
            onChange={handleSelectChange("hungerLevel")}
          >
            <option value="">（選択）</option>
            <option value="none">なし</option>
            <option value="slight">多少あり</option>
            <option value="strong">強くあり</option>
          </select>
        </label>

        {/* 🚽 便通 */}
        <label>
          🚽 便通：
          <select
            value={record.bowelMovement ?? ""}
            onChange={handleSelectChange("bowelMovement")}
          >
            <option value="">（選択）</option>
            <option value="none">出ない</option>
            <option value="once">1回</option>
            <option value="twice">2回</option>
            <option value="three_or_more">3回以上</option>
          </select>
        </label>

      </div>
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

  // 追加：出力先の選択状態
  const [exportTarget, setExportTarget] = useState<ExportTarget>("chatgpt");

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
  const previewText = formatDailyRecord(record, exportTarget);

  // 今日の日付を "YYYY-MM-DD" 形式で取るヘルパー
  const getTodayDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // 日付が「今日」とズレている場合に確認ダイアログを出す
  const ensureDateIsSafeForSave = () => {
    if (!record.date) {
      alert("日付が空欄のままだと、履歴に保存できないよ。日付を入力してね。");
      return false;
    }

    const today = getTodayDateString();

    if (record.date !== today) {
      const ok = window.confirm(
        `日付が今日 (${today}) ではなく ${record.date} のままになっているよ。\n\n` +
          `このまま「${record.date}」の記録として履歴に保存してもいい？\n\n` +
          `※ 間違いの場合は「キャンセル」を押して、日付を修正してからもう一度保存してね。`
      );

      if (!ok) {
        return false;
      }
    }

    return true;
  };

  // 現在の record を履歴に保存する共通関数
  const saveCurrentToHistory = () => {
      // 日付チェック。問題あればここで中断。
    if (!ensureDateIsSafeForSave()) {
      return false;
    }

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

    return true;
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

  // ① まず履歴保存を試みる（true: 保存成功 / false: 日付チェック等で中断）
  const saved = saveCurrentToHistory();

  // ② クリップボードコピーを試みる
  let copySucceeded = false;
  try {
    await navigator.clipboard.writeText(text);
    copySucceeded = true;
  } catch (err) {
    console.error("コピーに失敗しました", err);
  }

  // ③ 結果に応じてメッセージを出し分け
  if (copySucceeded && saved) {
    // 両方成功
    alert(
      "クリップボードにコピーしたよ👌\n今日の記録も履歴に保存しておいたよ📒"
    );
  } else if (copySucceeded && !saved) {
    // コピーだけ成功
    alert("メッセージをクリップボードにコピーしたよ👌");
  } else if (!copySucceeded && saved) {
    // 履歴だけ成功
    alert(
      "今日の記録は履歴に保存したけど、クリップボードコピーは失敗しちゃった…🥲"
    );
  } else {
    // どちらも成功しなかったパターン
    alert(
      "クリップボードコピーも履歴保存も完了しなかったよ…🥲\n" +
        "日付の設定やブラウザのクリップボード権限を確認して、もう一度試してみてね。"
    );
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

        <div style={{ marginBottom: "8px" }}>
          <label>
            送信先：
            <select
              value={exportTarget}
              onChange={(e) => setExportTarget(e.target.value as ExportTarget)}
              style={{ marginLeft: 8 }}
            >
              <option value="chatgpt">ChatGPT（完全版）</option>
              <option value="line">LINE（栄養管理士向け）</option>
              <option value="copilot">Copilot（運動のみ）</option>
            </select>
          </label>
        </div>

        <pre>{previewText}</pre>
      </section>
    </div>
  );


};
