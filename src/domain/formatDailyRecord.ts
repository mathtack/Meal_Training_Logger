import type { DailyRecord, ExerciseRecord } from "./DailyRecord";

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

// --- 食事フォーマットここから ---
// --- 食事フォーマット ---
function formatMealsForReport(record: DailyRecord): string {
  const mealLines: string[] = [];

  const mealByTime = (time: string) => record.meals.find((m) => m.time === time);

  // 朝・昼・夜は必ず出す
  (['朝', '昼', '夜'] as const).forEach((time) => {
    const meal = mealByTime(time);
    const memo = meal?.memo?.trim();
    const eatenAt = meal?.eatenAt?.trim(); // 例: "05:20" or "5:20"

    let timePart = '';
    if (eatenAt) {
      const [hh, mm] = eatenAt.split(":");
      if (hh !== undefined && mm !== undefined && !Number.isNaN(Number(hh))) {
        const hour = String(Number(hh));
        timePart = `${hour}:${mm}頃：`;
      } else {
        timePart = `${eatenAt}頃：`;
      }
    }

    if (memo && memo.length > 0) {
      mealLines.push(`[${time}] ${timePart}${memo}`);
    } else {
      mealLines.push(`[${time}] （記録なし）`);
    }
  });

  // 間食はメモがあれば出す
  const snack = mealByTime('間食');
  const snackMemo = snack?.memo?.trim();
  const snackAt = snack?.eatenAt?.trim();
  let snackTimePart = '';
  if (snackAt) {
    const [hh, mm] = snackAt.split(":");
    if (hh !== undefined && mm !== undefined && !Number.isNaN(Number(hh))) {
      const hour = String(Number(hh));
      snackTimePart = `${hour}:${mm}頃：`;
    } else {
      snackTimePart = `${snackAt}頃：`;
    }
  }
  if (snackMemo && snackMemo.length > 0) {
    mealLines.push(`[間食] ${snackTimePart}${snackMemo}`);
  }

  if (mealLines.length === 0) {
    return '（記録なし）';
  }
  return mealLines.join('\n');
}
// --- 食事フォーマットここまで ---

function formatWeightLine(
  label: "朝" | "夜",
  weight?: number,
  time?: string
): string {
  const prefix = `[${label}] `;

  // weight が未入力 or 変な値 → （記録なし）
  if (typeof weight !== "number" || Number.isNaN(weight)) {
    return `${prefix}（記録なし）`;
  }

  let trimmedTime = time?.trim();

  if (trimmedTime) {
    // "07:00" → "7:00" みたいに整形
    const [hh, mm] = trimmedTime.split(":");
    const hour = String(Number(hh)); // "07" → 7 → "7"
    const formattedTime = `${hour}:${mm}`;

    return `${prefix}${formattedTime}頃：${weight}kg`;
  }

  // 時間がないときは「[朝] 72.5kg」だけ
  return `${prefix}${weight}kg`;
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

 // ここは常に2行とも出す
lines.push(morningLine);
lines.push(nightLine);

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