// src/domain/factories/createEmptyDailyRecordAggregate.test.ts
import { describe, it, expect } from "vitest";
import { createEmptyDailyRecordAggregate } from "./createEmptyDailyRecordAggregate";

describe("createEmptyDailyRecordAggregate", () => {
  it("指定した日付の空の DailyRecordAggregate を生成する", () => {
    const date = "2026-02-19";

    const aggregate = createEmptyDailyRecordAggregate(date);

    // daily_record の基本プロパティ
    expect(aggregate.daily_record).toBeDefined();
    expect(aggregate.daily_record.record_date).toBe(date);

    // id は空文字じゃない
    expect(aggregate.daily_record.id).toEqual(expect.any(String));
    expect(aggregate.daily_record.id).not.toHaveLength(0);

    // user_id は現状の仕様どおり
    expect(aggregate.daily_record.user_id).toBe("TODO_USER_ID");

    // created_at / updated_at は両方存在し、同じ値になっている
    const { created_at, updated_at } = aggregate.daily_record;
    expect(created_at).toEqual(expect.any(String));
    expect(updated_at).toEqual(expect.any(String));
    expect(created_at).toBe(updated_at);

    // 各セクションの初期状態
    expect(aggregate.weights).toEqual([]);
    expect(aggregate.meals).toEqual([]);
    expect(aggregate.exercise_sessions).toEqual([]);
    expect(aggregate.wellness).toBeNull();
  });
});