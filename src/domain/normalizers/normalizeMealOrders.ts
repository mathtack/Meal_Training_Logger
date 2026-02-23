// src/domain/normalizers/normalizeMealOrders.ts
import type { DailyRecordAggregate, MealAggregate, FoodItem } from "../type";

const CATEGORY_ORDER = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
type MealCategory = (typeof CATEGORY_ORDER)[number];

const normalizeFoodItemOrdersForMeal = (meal: MealAggregate): MealAggregate => {
  const items = meal.food_items ?? [];
  if (items.length === 0) return meal;

  // food_item_order + id で安定ソート
  const sortedItems = [...items].sort((a, b) => {
    const ao = (a as FoodItem).food_item_order ?? 0;
    const bo = (b as FoodItem).food_item_order ?? 0;
    if (ao !== bo) return ao - bo;

    const aid = a.id ?? "";
    const bid = b.id ?? "";
    return aid.localeCompare(bid);
  });

  const normalizedItems: FoodItem[] = sortedItems.map((fi, idx) => ({
    ...fi,
    food_item_order: idx, // 0,1,2,…に詰め直し
  }));

  return {
    ...meal,
    food_items: normalizedItems,
  };
};

const isMealCategory = (v: string): v is MealCategory =>
  (CATEGORY_ORDER as readonly string[]).includes(v);

export const normalizeMealOrders = (
  agg: DailyRecordAggregate
): DailyRecordAggregate => {
  // カテゴリごとに集める（未知カテゴリは末尾へ）
  const meals = agg.meals ?? [];

  const grouped: Record<string, MealAggregate[]> = {};
  for (const m of meals) {
    const raw = m.meal_record.recording_category ?? "UNKNOWN";
    const cat = String(raw).trim().toUpperCase(); // e.g. " breakfast " -> "BREAKFAST"
    (grouped[cat] ??= []).push(m);
  }

  // 各カテゴリ内で meal_order でソートし、0..N に詰め直す
  const normalizedMeals: MealAggregate[] = [];

  const catsInOrder = [
    ...CATEGORY_ORDER,
    ...Object.keys(grouped).filter((c) => !isMealCategory(c)),
  ];

  for (const cat of catsInOrder) {
    const list = grouped[cat] ?? [];
    if (list.length === 0) continue;

    const sorted = [...list].sort((a, b) => {
      const ao = a.meal_record.meal_order ?? 0;
      const bo = b.meal_record.meal_order ?? 0;
      if (ao !== bo) return ao - bo;

      // tie-breaker（同じorderのときも安定させる）
      const aid = a.meal_record.id ?? "";
      const bid = b.meal_record.id ?? "";

      return aid.localeCompare(bid);
    });

    sorted.forEach((m, idx) => {
      normalizedMeals.push({
        ...m,
        meal_record: { ...m.meal_record, meal_order: idx },
      });
    });
  }

  // meal_orderを整えたあとに、各mealのfood_itemsも整える
  const mealsWithFoodItemsNormalized = normalizedMeals.map((meal) =>
    normalizeFoodItemOrdersForMeal(meal)
  );

  return { ...agg, meals: mealsWithFoodItemsNormalized };
};
