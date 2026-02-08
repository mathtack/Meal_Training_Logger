// src/domain/history.ts
import type { DailyRecord } from "./DailyRecord";

// 履歴1件分：DailyRecord + 保存した瞬間のタイムスタンプ
export type HistoryRecord = DailyRecord & {
  savedAt: string; // ISO文字列 "2026-02-09T12:34:56.789Z" みたいなやつ
};

// エクスポート / インポートでやり取りするJSONの形（v1）
export type ExportPayloadV1 = {
  version: 1;
  exportedAt: string;       // エクスポートした日時（ISO文字列）
  history: HistoryRecord[]; // この時点での履歴一覧
  latestRecord?: DailyRecord | null; // オプション（今後の拡張用）
};

/**
 * history のマージロジック
 * - key は date（"YYYY-MM-DD"）
 * - 同じ date があったら savedAt が新しい方を採用
 * - 戻り値は date 昇順にソートした配列
 */
export function mergeHistory(
  current: HistoryRecord[],
  imported: HistoryRecord[],
): HistoryRecord[] {
  const map = new Map<string, HistoryRecord>();

  // まずは既存を入れる
  for (const h of current) {
    map.set(h.date, h);
  }

  // インポート分で上書き or 追加
  for (const h of imported) {
    const existing = map.get(h.date);

    // date が NaN とかだったら、壊さないためにスキップ
    if (!h.date) continue;

    if (!existing) {
      map.set(h.date, h);
      continue;
    }

    const existingTime = new Date(existing.savedAt).getTime();
    const importedTime = new Date(h.savedAt).getTime();

    // どちらかが変な値なら、とりあえず既存を優先
    if (Number.isNaN(importedTime)) {
      continue;
    }
    if (Number.isNaN(existingTime)) {
      map.set(h.date, h);
      continue;
    }

    // 新しい方を採用
    if (importedTime > existingTime) {
      map.set(h.date, h);
    }
  }

  // 日付昇順にソートして返す
  return Array.from(map.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

/**
 * 現在の履歴 + latestRecord からエクスポート用JSONを組み立てる
 */
export function buildExportPayload(
  history: HistoryRecord[],
  latestRecord?: DailyRecord | null,
): ExportPayloadV1 {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    history,
    latestRecord: latestRecord ?? null,
  };
}

/**
 * JSON文字列をパースして、ExportPayloadV1 として妥当かざっくりチェックする
 * - NGの場合は Error を投げる（呼び出し側で try-catch する想定）
 */
export function parseAndValidateExportPayload(
  jsonText: string,
): ExportPayloadV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error("JSONのパースに失敗しました");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("JSONの形式がオブジェクトではないみたい");
  }

  const payload = parsed as Partial<ExportPayloadV1>;

  if (payload.version !== 1) {
    throw new Error("このJSONは version 1 ではないみたい");
  }

  if (!Array.isArray(payload.history)) {
    throw new Error("history が配列じゃないみたい");
  }

  // history の各要素が最低限の形をしているかをざっくりチェック
  for (const item of payload.history) {
    if (!item || typeof item !== "object") {
      throw new Error("history 内に不正な要素があります");
    }
    const h = item as HistoryRecord;
    if (!h.date || typeof h.date !== "string") {
      throw new Error("history 内の date が不正です");
    }
    if (!h.savedAt || typeof h.savedAt !== "string") {
      throw new Error("history 内の savedAt が不正です");
    }
  }

  return payload as ExportPayloadV1;
}
