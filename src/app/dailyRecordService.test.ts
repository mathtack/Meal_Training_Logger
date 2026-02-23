// src/app/dailyRecordService.test.ts
import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { createDailyRecordService } from "./dailyRecordService";
import type { ISODate } from "../domain/type";

const DATE_1 = "2026-02-18" as ISODate;
const DATE_2 = "2026-02-19" as ISODate;
const DATE_3 = "2026-02-20" as ISODate;

// 旧形式 history の localStorage キー（dailyRecordStorage.ts と合わせる）
const LEGACY_HISTORY_KEY = "meal-training-logger:history";

// v1.1.0 の保存キー prefix（dailyRecordStorage.ts と合わせる）
const KEY_PREFIX = "daily_record:";

describe("dailyRecordService (localStorage backend)", () => {
  const createMockLocalStorage = () => {
    let store: Record<string, string> = {};

    return {
      getItem(key: string) {
        return Object.prototype.hasOwnProperty.call(store, key)
          ? store[key]
          : null;
      },
      setItem(key: string, value: string) {
        store[key] = value;
      },
      removeItem(key: string) {
        delete store[key];
      },
      clear() {
        store = {};
      },
      key(index: number) {
        return Object.keys(store)[index] ?? null;
      },
      get length() {
        return Object.keys(store).length;
      },
    };
  };

  // テスト全体で一度だけ、グローバルに localStorage を挿す
  beforeAll(() => {
    vi.stubGlobal("localStorage", createMockLocalStorage());
  });

  // 各テストの前に中身だけクリアする
  beforeEach(() => {
    (globalThis as any).localStorage.clear();
  });

  it("DR-SVC-001: 保存データがない日付は、空レコード(normalized)として load され、source = 'empty' が返る", () => {
    const service = createDailyRecordService();
    const date = DATE_2;

    const result = service.load(date);

    expect(result.source).toBe("empty");
    expect(result.record.daily_record.record_date).toBe(date);

    // 基本的な初期状態の sanity check
    expect(Array.isArray(result.record.weights)).toBe(true);
    expect(Array.isArray(result.record.meals)).toBe(true);
    expect(Array.isArray(result.record.exercise_sessions)).toBe(true);
  });

  it("DR-SVC-002: save したレコードは、次回 load で source = 'saved' として取得できる（normalize されたもの）", () => {
    const service = createDailyRecordService();
    const date = DATE_2;

    // まず空レコードを取得
    const { record: empty } = service.load(date);

    // ちょっとだけ中身を盛ったレコードを作る（型は厳密でなくてOK）
    const recordWithWeight = {
      ...empty,
      weights: [
        ...empty.weights,
        {
          id: "w-1",
          daily_record_id: empty.daily_record.id,
          measurement_time_slot: "MORNING",
          measurement_order: 99, // わざと 99 にして normalize の効き目を見る
          measured_at: `${date}T07:00:00.000Z`,
          weight: 100,
          created_at: empty.daily_record.created_at,
          updated_at: empty.daily_record.updated_at,
        },
      ],
    };

    // save は normalize 後のレコードを返す
    const savedNormalized = service.save(recordWithWeight);

    // 再度 load
    const loaded = service.load(date);

    expect(loaded.source).toBe("saved");

    // 重量レコードが 1 件あること
    expect(loaded.record.weights.length).toBe(1);

    // measurement_order は 0 から振り直されているはず（normalizeWeightOrders の効果）
    expect(loaded.record.weights[0].measurement_order).toBe(0);

    // record_date は変わっていない
    expect(loaded.record.daily_record.record_date).toBe(date);

    // save が返した normalized レコードと load 結果は同じ構造になっているはず、くらいは見ておく
    expect(loaded.record.daily_record.record_date).toBe(
      savedNormalized.daily_record.record_date
    );
  });

  it("DR-SVC-003: listHistory は record_date の降順（新しい日付が上）で返す", () => {
    const service = createDailyRecordService();

    // 3 日分のレコードを保存（順不同で save）
    [DATE_2, DATE_1, DATE_3].forEach((date) => {
      const { record } = service.load(date); // empty 生成
      service.save(record); // normalize + 保存
    });

    const history = service.listHistory();

    // record_date の並びが DESC になっていること
    const dates = history.map((h) => h.record_date);
    expect(dates).toEqual([DATE_3, DATE_2, DATE_1]);
  });

  it("DR-SVC-004: delete した日付は、次回 load で空レコードとして扱われる（source = 'empty'）", () => {
    const service = createDailyRecordService();
    const date = DATE_2;

    // 1 回保存してから
    const { record } = service.load(date);
    service.save(record);

    // 念のため存在していることを確認
    let before = service.load(date);
    expect(before.source).toBe("saved");

    // delete 実行
    service.delete(date);

    // 再度 load すると空レコード扱いになる
    const after = service.load(date);
    expect(after.source).toBe("empty");
    expect(after.record.daily_record.record_date).toBe(date);
  });

  it.skip("DR-SVC-005: 旧形式 history (meal-training-logger:history) のみ存在する場合、初回 load で migrate されて source='saved' になる", () => {
    const service = createDailyRecordService();
    const date = DATE_2;

    // 念のため v1.1.0 側のキーは消しておく
    localStorage.removeItem(`${KEY_PREFIX}${date}`);

    // 旧形式の history を minimal shape で投入
    // dailyRecordStorage.ts の isLegacy 判定は
    //   - typeof obj.date === "string"
    //   - Array.isArray(obj.meals)
    // を見ているので、ここだけ満たせばよい。
    const legacyHistory = [
      {
        date,
        meals: [], // meals が Array であることが重要
        // 他のフィールドは undefined で OK（migrateLegacyToAggregate 側で安全に扱われる）
      },
    ];

    (globalThis as any).localStorage.setItem(
      LEGACY_HISTORY_KEY,
      JSON.stringify(legacyHistory),
    );

    const result = service.load(date);

    // 旧 history から migrate された結果として扱われるので、source は "saved"
    expect(result.source).toBe("saved");
    expect(result.record.daily_record.record_date).toBe(date);

    // かつ v1.1.0 のストレージキーに保存されているはず
    const rawV110 = localStorage.getItem(`${KEY_PREFIX}${date}`);
    expect(rawV110).not.toBeNull();
  });
});
