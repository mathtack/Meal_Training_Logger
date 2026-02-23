// src/ui/meal/MealEditor.tsx
import { useMemo } from "react";
import type {
  DailyRecordAggregate,
  MealAggregate,
  MealRecord,
  FoodItem,
} from "../../domain/type";

type MealCategory = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

const CATEGORIES: { key: MealCategory; label: string }[] = [
  { key: "BREAKFAST", label: "朝" },
  { key: "LUNCH", label: "昼" },
  { key: "DINNER", label: "夜" },
  { key: "SNACK", label: "間食" },
];

function uuid(): string {
  // Browser crypto.randomUUID優先、なければfallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = globalThis as any;
  return (
    c.crypto?.randomUUID?.() ??
    `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
}

function formatKcal(value: number): string {
  // 0000 形式にしたければ padStart(4, "0")
  return value.toString().padStart(4, "0");
}

function nowIso(): string {
  return new Date().toISOString();
}

function calcMealCalories(meal: MealAggregate): number {
  const items = meal.food_items ?? [];
  return items.reduce((sum, fi) => sum + (fi.food_calorie ?? 0), 0);
}

function createEmptyMealAggregate(params: {
  dailyRecordId: string;
  category: MealCategory;
  order: number;
}): MealAggregate {
  const t = nowIso();

  const meal_record: MealRecord = {
    id: uuid(),
    daily_record_id: params.dailyRecordId,
    recording_category: params.category,
    meal_order: params.order,
    eaten_at: null,
    meal_memo: "",
    created_at: t,
    updated_at: t,
  };

  return {
    meal_record,
    attachments: [],
    food_items: [],
  };
}

function createEmptyFoodItem(params: {
  mealRecordId: string;
  order: number;
}): FoodItem {
  const t = nowIso();

  return {
    id: uuid(),
    meal_record_id: params.mealRecordId,
    // もしFoodItemに food_item_order を追加済みならこれが効く
    food_item_order: params.order,
    food_name: "",
    food_amount: null,
    food_amount_unit: "",
    food_calorie: null,
    food_protein: null,
    food_fat: null,
    food_carbohydrates: null,
    created_at: t,
    updated_at: t,
  } as unknown as FoodItem; // ← order未定義の型でも一旦ビルド通しやすくする保険
}

export function MealEditor(props: {
  record: DailyRecordAggregate;
  onChange: (next: DailyRecordAggregate) => void;
  firstFocusRef?: (el: HTMLTextAreaElement | null) => void;
}) {
  const { record, onChange, firstFocusRef } = props;

  // 1日合計 kcal
  const dailyTotalKcal = useMemo(() => {
    const meals = record.meals ?? [];
    return meals.reduce((sum, meal) => sum + calcMealCalories(meal), 0);
  }, [record.meals]);

  const mealsByCat = useMemo(() => {
    const grouped: Record<MealCategory, MealAggregate[]> = {
      BREAKFAST: [],
      LUNCH: [],
      DINNER: [],
      SNACK: [],
    };

    for (const m of record.meals ?? []) {
      const cat = m.meal_record.recording_category as MealCategory;
      if (grouped[cat]) grouped[cat].push(m);
    }

    (Object.keys(grouped) as MealCategory[]).forEach((k) => {
      grouped[k].sort((a, b) => {
        const ao = a.meal_record.meal_order ?? 0;
        const bo = b.meal_record.meal_order ?? 0;
        if (ao !== bo) return ao - bo;

        // 安定化（同一order・null多発でも並びがブレない）
        const aid = a.meal_record.id ?? "";
        const bid = b.meal_record.id ?? "";
        return aid.localeCompare(bid);
      });
    });

    return grouped;
  }, [record.meals]);

  const updateMeals = (nextMeals: MealAggregate[]) => {
    onChange({ ...record, meals: nextMeals });
  };

  const setMemo = (mealId: string, memo: string) => {
    const t = nowIso();
    const next = (record.meals ?? []).map((m) =>
      m.meal_record.id === mealId
        ? {
            ...m,
            meal_record: { ...m.meal_record, meal_memo: memo, updated_at: t },
          }
        : m,
    );
    updateMeals(next);
  };

  const addMeal = (cat: MealCategory) => {
    const list = mealsByCat[cat];
    const nextOrder = (list[list.length - 1]?.meal_record.meal_order ?? -1) + 1;

    const added = createEmptyMealAggregate({
      dailyRecordId: record.daily_record.id,
      category: cat,
      order: nextOrder,
    });

    updateMeals([...(record.meals ?? []), added]);
  };

  const removeMeal = (mealId: string) => {
    updateMeals(
      (record.meals ?? []).filter((m) => m.meal_record.id !== mealId),
    );
  };

  const addFoodItem = (mealRecordId: string) => {
    const next = (record.meals ?? []).map((m) => {
      if (m.meal_record.id !== mealRecordId) return m;

      const items = m.food_items ?? [];
      const nextOrder =
        Math.max(
          -1,
          ...items.map((fi: any) => fi.food_item_order ?? -1), // order無しでも動く保険
        ) + 1;

      const added = createEmptyFoodItem({ mealRecordId, order: nextOrder });
      return { ...m, food_items: [...items, added] };
    });

    updateMeals(next);
  };

  const updateFoodItem = (
    mealRecordId: string,
    foodItemId: string,
    patch: Partial<FoodItem>,
  ) => {
    const t = nowIso();
    const next = (record.meals ?? []).map((m) => {
      if (m.meal_record.id !== mealRecordId) return m;

      const items = (m.food_items ?? []).map((fi) =>
        fi.id === foodItemId
          ? ({ ...fi, ...patch, updated_at: t } as FoodItem)
          : fi,
      );

      return { ...m, food_items: items };
    });

    updateMeals(next);
  };

  const removeFoodItem = (mealRecordId: string, foodItemId: string) => {
    const next = (record.meals ?? []).map((m) => {
      if (m.meal_record.id !== mealRecordId) return m;

      return {
        ...m,
        food_items: (m.food_items ?? []).filter((fi) => fi.id !== foodItemId),
      };
    });

    updateMeals(next);
  };

  const moveFoodItem = (
    mealRecordId: string,
    foodItemId: string,
    direction: "up" | "down",
  ) => {
    const next = (record.meals ?? []).map((m) => {
      if (m.meal_record.id !== mealRecordId) return m;

      const items = [...(m.food_items ?? [])];
      const index = items.findIndex((fi) => fi.id === foodItemId);
      if (index === -1) return m;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= items.length) {
        // 端っこ（上で▲ or 下で▼）は何もしない
        return m;
      }

      // swap
      const tmp = items[index];
      items[index] = items[targetIndex];
      items[targetIndex] = tmp;

      // order振り直し（0,1,2,...）
      const withOrder = items.map((fi, idx) => ({
        ...fi,
        food_item_order: idx,
      }));

      return {
        ...m,
        food_items: withOrder,
      };
    });

    updateMeals(next);
  };

  return (
    <div>
      <h3>食事</h3>

      {/* 1日合計 */}
      <div style={{ margin: "4px 0 12px", fontSize: 14 }}>
        1日合計 : <strong>{formatKcal(dailyTotalKcal)}</strong> kcal
      </div>

      {CATEGORIES.map((c, catIdx) => {
        const list = mealsByCat[c.key];

        // このカテゴリ（朝/昼/夜/間食）の合計 kcal
        const categoryTotalKcal = list.reduce(
          (sum, meal) => sum + calcMealCalories(meal),
          0,
        );

        return (
          <section key={c.key} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h4 style={{ margin: 0 }}>{c.label}</h4>
              <button type="button" onClick={() => addMeal(c.key)}>
                追加
              </button>
            </div>

            {/* 朝合計 / 昼合計 / 夜合計 / 間食合計 */}
            <div style={{ marginTop: 4, fontSize: 13 }}>
              {c.label}合計 : <strong>{formatKcal(categoryTotalKcal)}</strong>{" "}
              kcal
            </div>

            {list.length === 0 ? (
              <div style={{ opacity: 0.7, fontSize: 12 }}>未入力</div>
            ) : (
              list.map((m, i) => (
                <div key={m.meal_record.id} style={{ marginTop: 8 }}>
                  <textarea
                    ref={catIdx === 0 && i === 0 ? firstFocusRef : undefined}
                    value={m.meal_record.meal_memo ?? ""}
                    onChange={(e) => setMemo(m.meal_record.id, e.target.value)}
                    placeholder="例）オートミール、プロテイン、味噌汁"
                    rows={2}
                    style={{ width: "100%" }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginTop: 4,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => removeMeal(m.meal_record.id)}
                    >
                      削除
                    </button>
                  </div>

                  {/* Food items */}
                  <div
                    style={{
                      marginTop: 8,
                      padding: 8,
                      border: "1px solid #ddd",
                      borderRadius: 8,
                    }}
                  >
                    {(() => {
                      const items = m.food_items ?? [];
                      const mealTotalKcal = calcMealCalories(m);

                      return (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <div style={{ fontSize: 12, opacity: 0.8 }}>
                            Food items: {items.length}
                            {items.length > 0 && (
                              <span style={{ marginLeft: 8 }}>
                                / 1食合計 :{" "}
                                <strong>{formatKcal(mealTotalKcal)}</strong>{" "}
                                kcal
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => addFoodItem(m.meal_record.id)}
                          >
                            + Food item追加
                          </button>
                        </div>
                      );
                    })()}

                    {(m.food_items ?? [])
                      .slice()
                      .sort((a: any, b: any) => {
                        const ao = a.food_item_order ?? 0;
                        const bo = b.food_item_order ?? 0;
                        if (ao !== bo) return ao - bo;
                        return (a.id ?? "").localeCompare(b.id ?? "");
                      })
                      .map((fi: any, idx: number, arr) => (
                        <div
                          key={fi.id}
                          style={{
                            marginTop: 8,
                            display: "grid",
                            gridTemplateColumns:
                              "0.5fr 1.5fr 0.6fr 0.6fr 0.6fr 1.0fr",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          {/* #番号 */}
                          <div style={{ opacity: 0.7 }}>
                            #{fi.food_item_order ?? idx}
                          </div>
                          {/* 食材名 */}
                          <input
                            value={fi.food_name ?? ""}
                            onChange={(e) =>
                              updateFoodItem(m.meal_record.id, fi.id, {
                                food_name: e.target.value,
                              })
                            }
                            placeholder="食材名"
                            style={{ width: "100%" }}
                          />

                          {/* 食べた量 */}
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            value={
                              fi.food_amount === 0 ? "" : String(fi.food_amount)
                            }
                            onChange={(e) =>
                              updateFoodItem(m.meal_record.id, fi.id, {
                                food_amount:
                                  e.target.value === ""
                                    ? 0
                                    : Number(e.target.value),
                              })
                            }
                            placeholder="食べた量(数字)"
                            style={{ width: "100%" }}
                          />

                          {/* 単位 */}
                          <input
                            value={fi.food_amount_unit ?? ""}
                            onChange={(e) =>
                              updateFoodItem(m.meal_record.id, fi.id, {
                                food_amount_unit: e.target.value,
                              })
                            }
                            placeholder="単位"
                            style={{ width: "100%" }}
                          />

                          {/* kcal */}
                          <input
                            type="number"
                            inputMode="numeric"
                            step="1"
                            value={
                              fi.food_calorie === 0
                                ? ""
                                : String(fi.food_calorie)
                            }
                            onChange={(e) =>
                              updateFoodItem(m.meal_record.id, fi.id, {
                                food_calorie:
                                  e.target.value === ""
                                    ? 0
                                    : Number(e.target.value),
                              })
                            }
                            placeholder="摂取カロリー(数字)"
                            style={{ width: "100%" }}
                          />

                          {/* ▲▼＋削除を1カラムにまとめる */}
                          <div
                            style={{
                              display: "flex",
                              gap: 4,
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                moveFoodItem(m.meal_record.id, fi.id, "up")
                              }
                              disabled={idx === 0}
                              style={{
                                width: 50,
                                height: 40,
                                padding: 0,
                                fontSize: 15,
                                lineHeight: "1",
                              }}
                              title="一つ上へ"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                moveFoodItem(m.meal_record.id, fi.id, "down")
                              }
                              disabled={idx === (arr?.length ?? 0) - 1}
                              style={{
                                width: 50,
                                height: 40,
                                padding: 0,
                                fontSize: 15,
                                lineHeight: "1",
                              }}
                              title="一つ下へ"
                            >
                              ▼
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                removeFoodItem(m.meal_record.id, fi.id)
                              }
                              style={{
                                minWidth: 70,
                                height: 40,
                                padding: "0 6px",
                                fontSize: 15,
                              }}
                            >
                              削除
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
