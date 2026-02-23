import type { DailyRecord, ExerciseRecord } from "./DailyRecord";
export type ExportTarget = "chatgpt" | "line" | "copilot";

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

  const trimmedTime = time?.trim();

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

function formatConditionForReport(record: DailyRecord): string | null {
  const lines: string[] = [];

  const {
    sleepDurationCategory,
    sleepQuality,
    waterIntake,
    physicalCondition,
    mood,
    bowelMovement,
  } = record as any; // ← 型名やプロパティ名はごうけんの定義に合わせてあとで直してOK

  // どれも未入力ならコンディションセクション自体を出さない
  if (
    !sleepDurationCategory &&
    !sleepQuality &&
    !waterIntake &&
    !physicalCondition &&
    !mood &&
    !bowelMovement
  ) {
    return null;
  }

  // 🧠 見出し
  lines.push("🧠 コンディション");

  // 🛌 睡眠
  if (sleepDurationCategory || sleepQuality) {
    const durationLabelMap: Record<string, string> = {
      lt6h: "6時間未満",
      h6to7: "6〜7時間",
      gte7h: "7時間以上",
    };

    const qualityLabelMap: Record<string, string> = {
      bad: "悪い",
      normal: "普通",
      good: "良い",
    };

    const parts: string[] = [];

    if (sleepDurationCategory && durationLabelMap[sleepDurationCategory]) {
      parts.push(durationLabelMap[sleepDurationCategory]);
    }
    if (sleepQuality && qualityLabelMap[sleepQuality]) {
      parts.push(`質：${qualityLabelMap[sleepQuality]}`);
    }

    if (parts.length > 0) {
      lines.push(`🛌睡眠：${parts.join(" / ")}`);
    }
  }

  // 💧 水分
  if (waterIntake) {
    const waterLabelMap: Record<string, string> = {
      lt1l: "1L未満",
      l1to1_5: "1〜1.5L",
      l1_5to2: "1.5〜2L",
      gte2l: "2L以上",
    };

    const label = waterLabelMap[waterIntake];
    if (label) {
      lines.push(`💧水分：${label}`);
    }
  }

  // 🔋 身体
  if (physicalCondition) {
    const physicalLabelMap: Record<string, string> = {
      fine: "元気",
      slightly_tired: "少し疲れ",
      tired: "かなり疲れ",
      exhausted: "強い疲労",
    };

    const label = physicalLabelMap[physicalCondition];
    if (label) {
      lines.push(`🔋身体：${label}`);
    }
  }

  // 💭 気分
  if (mood) {
    const moodLabelMap: Record<string, string> = {
      good: "良い",
      normal: "普通",
      bad: "悪い",
      worst: "最悪",
    };

    const label = moodLabelMap[mood];
    if (label) {
      lines.push(`💭気分：${label}`);
    }
  }
  // 🤤 空腹感
  if (record.hungerLevel) {
    const hungerLabelMap: Record<string, string> = {
      none: "なし",
      slight: "多少あり",
      strong: "強くあり",
    };

    const label = hungerLabelMap[record.hungerLevel];
    if (label) {
      lines.push(`🤤空腹感：${label}`);
    }
  }

  // 🚽 便通
  if (bowelMovement) {
    const bowelLabelMap: Record<string, string> = {
      none: "出ない",
      once: "1回",
      twice: "2回",
      three_or_more: "3回以上",
    };

    const label = bowelLabelMap[bowelMovement];
    if (label) {
      lines.push(`🚽便通：${label}`);
    }
  }

  return lines.join("\n");
}

function formatDailyRecordForChatGPT(record: DailyRecord): string {
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

  // ここに 🧠 コンディション を挿入
  const conditionBlock = formatConditionForReport(record);
  if (conditionBlock) {
    lines.push("");             // 空行で区切る
    lines.push(conditionBlock); // 複数行まとまったテキスト
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

function formatDailyRecordForLINE(record: DailyRecord): string {
  const lines: string[] = [];

  // タイトル行（角カッコ＋日付は現行のロジックそのまま）
  lines.push(formatHeaderTitle(record.date));

  // 注記
  lines.push("※食事は写真に無いものも全量記載");
  lines.push(""); // 空行

  // 体重ブロック（見出しのみプレーンに）
  lines.push("体重");

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

  lines.push(morningLine);
  lines.push(nightLine);

  // コンディションは出さない（formatConditionForReportは呼ばない）

  // 食事ブロック
  lines.push("");
  lines.push("食事");
  lines.push(formatMealsForReport(record));

  // 運動ブロック（メモのみ：formatExercisesForReportを流用）
  lines.push("");
  lines.push("運動");
  lines.push(formatExercisesForReport(record));

  return lines.join("\n");
}
function formatDailyRecordForCopilot(record: DailyRecord): string {
  const lines: string[] = [];

  // 日付ヘッダー
  lines.push(formatHeaderTitle(record.date));
  lines.push(""); // 空行

  // 運動だけ
  lines.push("🏋️‍♂️運動");
  lines.push(formatExercisesForReport(record));

  return lines.join("\n");
}
export function formatDailyRecord(
  record: DailyRecord,
  target: ExportTarget = "chatgpt"
): string {
  switch (target) {
    case "line":
      return formatDailyRecordForLINE(record);
    case "copilot":
      return formatDailyRecordForCopilot(record);
    case "chatgpt":
    default:
      return formatDailyRecordForChatGPT(record);
  }
}
