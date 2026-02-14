// src/domain/normalizers/normalizeExerciseOrders.ts
import type { DailyRecordAggregate, ExerciseItem } from "../type";

const renumberSets = (item: ExerciseItem): ExerciseItem => {
  if (item.recording_style === "TEXT") return item;

  return {
    ...item,
    sets: item.sets.map((s, idx) => ({ ...s, set_order: idx })),
  };
};

export const normalizeExerciseOrders = (agg: DailyRecordAggregate): DailyRecordAggregate => {
  const exercise_sessions = agg.exercise_sessions.map((sAgg, sIdx) => {
    const items = sAgg.items.map((it, iIdx) => {
      const base = { ...it, item_order: iIdx } as ExerciseItem;
      return renumberSets(base);
    });

    return {
      ...sAgg,
      session: { ...sAgg.session, session_order: sIdx },
      items,
    };
  });

  return { ...agg, exercise_sessions };
};
