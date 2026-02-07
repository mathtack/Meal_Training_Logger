import type { DailyRecord, MealRecord, ExerciseRecord } from "./DailyRecord";

function formatHeaderTitle(dateStr: string): string {
  // dateStr が "2026-02-06" みたいな形式前提
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    // もしパース失敗したら、そのまま出す
    return `<体重・食事・運動記録 (${dateStr})>`;
  }

  const month = d.getMonth() + 1;
  const day = d.getDate();
  const youbiMap = ["日", "月", "火", "水", "木", "金", "土"] as const;
  const youbi = youbiMap[d.getDay()];

  return `<体重・食事・運動記録 (${month}/${day} ${youbi})>`;
}

function formatExercisesForReport(record: DailyRecord): string {
  const exercises: ExerciseRecord[] = record.exercises ?? [];

  if (exercises.length === 0) {
    return "（運動の記録なし）";
  }

  const lines: string[] = [];

  for (const ex of exercises) {
    const memo = ex.memo?.trim();
    const calories = ex.calories;

    if (!memo) continue;

    let calorieNote = "";
    if (typeof calories === "number" && !Number.isNaN(calories)) {
      // 必要なら「（約◯kcal）」を付ける
      calorieNote = `（約${calories}kcal）`;
    }

    // 時間ラベル（朝・夜）は今回の要件では出さない
    // 箇条書きの「・」も削除
    // 例：プランク50（約200kcal）
    lines.push(`${memo}${calorieNote}`);
  }

  if (lines.length === 0) {
    return "（運動の記録なし）";
  }

  return lines.join("\n");
}


function formatMealsForReport(record: DailyRecord): string {
  const meals: MealRecord[] = record.meals ?? [];

  if (meals.length === 0) {
    return "（食事の記録なし）";
  }

  // 表示順
  const order = ["朝", "昼", "夜", "間食"];

  // timeごとにグルーピング
  const grouped: Record<string, MealRecord[]> = {};

  for (const meal of meals) {
    const key = meal.time?.trim() || "その他";

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(meal);
  }

  const lines: string[] = [];

  // ① 朝・昼・夜・間食（メイン）
  for (const label of order) {
    const group = grouped[label];
    if (!group || group.length === 0) continue;

    const memos = group
      .map((m) => m.memo?.trim())
      .filter((m): m is string => !!m && m.length > 0);

    if (memos.length === 0) continue;

    // Step2-Lite を微調整：
    // 「（7:55頃）」ではなく「 7:55頃」にする
    let timeText = "";
    const firstEatenAt = group[0].eatenAt?.trim();

    if (firstEatenAt && /^\d{1,2}:\d{2}$/.test(firstEatenAt)) {
      const noZero = firstEatenAt.replace(/^0/, "");
      // ※半角スペース＋「頃」だけにする
      timeText = ` ${noZero}頃`;
    }

    // 例：朝 7:55頃：エビレタスチャーハン
    lines.push(`${label}${timeText}：${memos.join("、")}`);
  }

  // ② 朝・昼・夜・間食以外（もしあれば）
  for (const [label, group] of Object.entries(grouped)) {
    if (order.includes(label)) continue;

    const memos = group
      .map((m) => m.memo?.trim())
      .filter((m): m is string => !!m && m.length > 0);

    if (memos.length === 0) continue;

    // ここは時間表示ナシでOK
    lines.push(`${label}：${memos.join("、")}`);
  }

  if (lines.length === 0) {
    return "（食事の記録なし）";
  }

  return lines.join("\n");
}

function formatWeightLine(
  label: "朝" | "夜",
  weight?: number,
  time?: string
): string | null {
  if (weight === undefined) return null;

  let trimmedTime = time?.trim();

  if (trimmedTime) {
    // ← ここでフォーマット調整（"07:00" → "7:00"）
    const [hh, mm] = trimmedTime.split(":");
    const hour = String(Number(hh)); // "07" → 7 → "7"
    const formattedTime = `${hour}:${mm}`;

    return `${label} ${formattedTime}頃：${weight}kg`;
  }
  // 時間がないときは今まで通り
  return `${label}：${weight}kg`;
}


export function formatDailyRecord(record: DailyRecord): string {
  const lines: string[] = [];

  // 🧾 タイトル行
  lines.push(formatHeaderTitle(record.date));
  lines.push(""); // 空行

  // ⚖ 体重ブロック
  lines.push("⚖体重");

  const morningLine = formatWeightLine(
    "朝",
    record.morningWeight,
    record.morningWeightTime
  );
  const nightLine = formatWeightLine(
    "夜",
    record.nightWeight,
    record.nightWeightTime
  );

  if (morningLine) {
    lines.push(morningLine);
  }
  if (nightLine) {
    lines.push(nightLine);
  }
// いったん非表示
  // 食事件数
  // lines.push(`食事：${record.meals.length}件`);
  // 運動件数
  // const exerciseCount = ((record.exercises ?? []) as ExerciseRecord[]).length;
  // lines.push(`運動：${exerciseCount}件`);

  // --- 詳細パート ---

  // 👇 ここから Step1 の追加
  lines.push("");           // 区切りの空行
  lines.push("🍽️食事");
  lines.push(formatMealsForReport(record));

    // 運動詳細（Step3で追加）
  lines.push("");
  lines.push("🏋️‍♂️運動");
  lines.push(formatExercisesForReport(record));

  // 行を改行でつなげて1本の文章に
  return lines.join("\n");
}