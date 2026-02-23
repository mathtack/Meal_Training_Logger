// src/data/localStorageHistory.ts
import type { DailyRecord } from "../domain/DailyRecord";
import type { HistoryRecord } from "../domain/history";

const STORAGE_KEY = "meal-training-logger:latestRecord";
export const HISTORY_KEY = "meal-training-logger:history";

/**
 * latestRecord を localStorage から読み込む
 * - 保存されていなければ null
 * - 壊れてたら null を返してコンソールにエラーを出す
 */
export function loadLatestRecord(): DailyRecord | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved) as DailyRecord;
    return parsed;
  } catch (e) {
    console.error("Failed to load latestRecord from localStorage", e);
    return null;
  }
}

/**
 * latestRecord を localStorage に保存する
 */
export function saveLatestRecord(record: DailyRecord): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (e) {
    console.error("Failed to save latestRecord to localStorage", e);
  }
}

/**
 * history を localStorage から読み込む
 * - 保存されていなければ空配列
 * - 壊れてたら空配列を返してエラーを出す
 */
export function loadHistory(): HistoryRecord[] {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as HistoryRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.error("Failed to load history from localStorage", e);
    return [];
  }
}

/**
 * history を localStorage に保存する
 */
export function saveHistory(history: HistoryRecord[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save history to localStorage", e);
  }
}
