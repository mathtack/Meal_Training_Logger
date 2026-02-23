// src/domain/storage/dailyRecordStorage.ts
import type {
  DailyRecordAggregate,
  ISODate,
  ISODateTime,
  MealAggregate,
  ExerciseSessionAggregate,
  ExerciseItem,
  SetItem,
  WeightRecord,
  WellnessRecord,
  MealRecord as NewMealRecord,
  MealAttachment,
  FoodItem,
  ExerciseSession,
  DailyRecordSummary,
} from "../type";
import type {
  DailyRecord as LegacyDailyRecord,
  MealRecord as LegacyMealRecord,
  ExerciseRecord as LegacyExerciseRecord,
} from "../../legacy/domain/DailyRecord";

// Storage Keys
const KEY_PREFIX = "daily_record:";
const LEGACY_HISTORY_KEY = "meal-training-logger:history";
// const LEGACY_LATEST_KEY = "meal-training-logger:latestRecord"; // 旧形式の latestRecord は日付特定できないので history の方から探す想定

function keyOf(date: ISODate): string {
  return `${KEY_PREFIX}${date}`; // ← KEY_PREFIXは "daily_record:" なのでコロンは足さない
}

const DEBUG_STORAGE = import.meta.env.DEV;

const dlog = (...args: unknown[]) => {
  if (DEBUG_STORAGE) console.log(...args);
};
const dwarn = (...args: unknown[]) => {
  if (DEBUG_STORAGE) console.warn(...args);
};
const derror = (...args: unknown[]) => {
  // errorは本番でも見たいなら無条件。DEV限定にしたいなら if(DEBUG_STORAGE) にしてOK
  console.error(...args);
};

function listDailyRecordSummariesInternal(): DailyRecordSummary[] {
  const summaries: DailyRecordSummary[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(KEY_PREFIX)) continue;

    const json = localStorage.getItem(key);
    if (!json) continue;

    try {
      const aggregate = JSON.parse(json) as DailyRecordAggregate;
      const d = aggregate.daily_record;

      if (!d) continue;

      summaries.push({
        record_date: d.record_date,
        updated_at: d.updated_at,
      });
    } catch (e) {
      dlog("Failed to parse daily record for key:", key, e);
      continue;
    }
  }

  // ここでは昇順（古い→新しい）でOK
  summaries.sort((a, b) => {
    if (a.record_date < b.record_date) return -1;
    if (a.record_date > b.record_date) return 1;
    return 0;
  });

  return summaries;
}

/**
 * UUID v4 生成（簡易版）
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 時刻文字列 (HH:MM) を ISO DateTime に変換
 * @param timeStr "HH:MM" 形式
 * @param date YYYY-MM-DD 形式の日付
 * @returns ISO 8601 形式の文字列
 */
function timeStringToISO(timeStr: string | undefined, date: string): ISODateTime | null {
  if (!timeStr) return null;
  try {
    // "HH:MM" → "${date}T${HH:MM}:00Z"
    const isoStr = `${date}T${timeStr}:00Z`;
    return new Date(isoStr).toISOString();
  } catch {
    return null;
  }
}

/**
 * 旧形式の meal.time を recording_category にマッピング
 */
function mapMealTimeToCategory(
  timeStr: string
): "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" {
  const normalized = timeStr.trim().toLowerCase();
  if (normalized === "朝") return "BREAKFAST";
  if (normalized === "昼") return "LUNCH";
  if (normalized === "夜") return "DINNER";
  if (normalized === "間食") return "SNACK";
  // デフォルト：朝食扱い
  return "BREAKFAST";
}

/**
 * Legacy DailyRecord 判定
 */
function isLegacy(obj: any): obj is LegacyDailyRecord {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.date === "string" &&
    Array.isArray(obj.meals)
  );
}

/**
 * Legacy DailyRecord から DailyRecordAggregate に変換
 * - savedAt が無い場合のみ now を使う
 */
function migrateLegacyToAggregate(
  legacy: LegacyDailyRecord,
  savedAt: string | undefined,
  now: ISODateTime
): DailyRecordAggregate {
  const baseTimestamp = savedAt ?? now;

  // ============ DailyRecord （主エンティティ）==================
  const daily_record = {
    id: generateUUID(),
    user_id: "TODO_USER_ID", // ユーザーID推測不可
    record_date: legacy.date as ISODate,
    created_at: baseTimestamp as ISODateTime,
    updated_at: baseTimestamp as ISODateTime,
  };

  // ============ Weight Records ==================
  const weights: WeightRecord[] = [];

  if (legacy.morningWeight !== undefined) {
    weights.push({
      id: generateUUID(),
      daily_record_id: daily_record.id,
      measurement_time_slot: "MORNING",
      measurement_order: 0,
      weight: legacy.morningWeight,
      measured_at: timeStringToISO(
        legacy.morningWeightTime,
        legacy.date
      ) as ISODateTime | null,
      created_at: baseTimestamp as ISODateTime,
      updated_at: baseTimestamp as ISODateTime,
    });
  }

  if (legacy.nightWeight !== undefined) {
    weights.push({
      id: generateUUID(),
      daily_record_id: daily_record.id,
      measurement_time_slot: "EVENING",
      measurement_order: 1,
      weight: legacy.nightWeight,
      measured_at: timeStringToISO(
        legacy.nightWeightTime,
        legacy.date
      ) as ISODateTime | null,
      created_at: baseTimestamp as ISODateTime,
      updated_at: baseTimestamp as ISODateTime,
    });
  }

  // ============ Wellness Record ==================
  const wellness: WellnessRecord | null = (() => {
    const hasWellnessData =
      legacy.sleepDurationCategory ||
      legacy.sleepQuality ||
      legacy.sleepDurationMinutes ||
      legacy.sleepSource ||
      legacy.waterIntake ||
      legacy.physicalCondition ||
      legacy.mood ||
      legacy.hungerLevel ||
      legacy.bowelMovement;

    if (!hasWellnessData) return null;

    return {
      daily_record_id: daily_record.id,
      sleep_duration_category: legacy.sleepDurationCategory ?? null,
      sleep_quality: legacy.sleepQuality ?? null,
      sleep_duration_minutes: legacy.sleepDurationMinutes ?? null,
      sleep_source: legacy.sleepSource ?? null,
      water_intake: legacy.waterIntake ?? null,
      physical_condition: legacy.physicalCondition ?? null,
      mood: legacy.mood ?? null,
      hunger_level: legacy.hungerLevel ?? null,
      bowel_movement: legacy.bowelMovement ?? null,
      created_at: baseTimestamp as ISODateTime,
      updated_at: baseTimestamp as ISODateTime,
    };
  })();

  // ============ Meals ==================
  const meals: MealAggregate[] = (legacy.meals ?? []).map(
    (m: LegacyMealRecord, idx: number) => {
      const meal_record: NewMealRecord = {
        id: generateUUID(),
        daily_record_id: daily_record.id,
        recording_category: mapMealTimeToCategory(m.time),
        meal_order: idx,
        eaten_at: (timeStringToISO(m.eatenAt, legacy.date) as ISODateTime | null) ?? undefined,
        meal_memo: m.memo ?? undefined,
        created_at: baseTimestamp as ISODateTime,
        updated_at: baseTimestamp as ISODateTime,
      };

      const attachments: MealAttachment[] = (m.photos ?? []).map(
        (photoPath: string, photoIdx: number) => ({
          id: generateUUID(),
          meal_record_id: meal_record.id,
          storage_path: photoPath,
          attachment_order: photoIdx ?? undefined,
          created_at: baseTimestamp as ISODateTime,
          updated_at: baseTimestamp as ISODateTime,
        })
      );

      // food_items は旧形式に無いので空配列
      const food_items: FoodItem[] = [];

      return { meal_record, attachments, food_items };
    }
  );

  // ============ Exercise Sessions ==================
  const exercise_sessions: ExerciseSessionAggregate[] = (
    legacy.exercises ?? []
  ).map((e: LegacyExerciseRecord, idx: number) => {
    const session: ExerciseSession = {
      id: generateUUID(),
      daily_record_id: daily_record.id,
      session_order: idx,
      session_label: e.time ?? null,
      started_at: null, // 旧形式に無い
      ended_at: null, // 旧形式に無い
      memo: e.memo ?? null,
      calories_burned: e.calories ?? null,
      created_at: baseTimestamp as ISODateTime,
      updated_at: baseTimestamp as ISODateTime,
    };

    // 旧形式はセット構造が無いので TEXT モードで free_text を作る
    const items: ExerciseItem[] = [
      {
        id: generateUUID(),
        exercise_session_id: session.id,
        item_order: 0,
        body_part: null, // 旧形式に無い
        exercise_name: e.time ?? "Exercise",
        exercise_type: "AEROBIC", // デフォルト（推測使用）
        recording_style: "TEXT",
        free_text: e.memo ?? "",
        created_at: baseTimestamp as ISODateTime,
        updated_at: baseTimestamp as ISODateTime,
      },
    ];

    return { session, items };
  });

  const aggregate: DailyRecordAggregate = {
    daily_record,
    weights,
    wellness,
    meals,
    exercise_sessions,
  };

  return aggregate;
}

function hasDeletion(prevIds: string[], nextIds: string[]): boolean {
  const nextSet = new Set(nextIds);
  return prevIds.some((id) => !nextSet.has(id));
}

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

/**
 * timestamps（created_at/updated_at）を比較対象から外すための簡易strip
 * - 本体の中に timestamps があっても全部除外
 */
function stripTimestamps<T>(obj: T): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(stripTimestamps);
  if (typeof obj !== "object") return obj;

  const out: any = {};
  for (const [k, v] of Object.entries(obj as any)) {
    if (k === "created_at" || k === "updated_at") continue;
    out[k] = stripTimestamps(v);
  }
  return out;
}

function stableStringify(x: any): string {
  // 今はこれで十分（必要になったらキーソート版に置き換え可）
  return JSON.stringify(x);
}

function isSameIgnoringTimestamps(a: any, b: any): boolean {
  return stableStringify(stripTimestamps(a)) === stableStringify(stripTimestamps(b));
}

function maxISO(values: (string | null | undefined)[]): string | null {
  const xs = values.filter(Boolean) as string[];
  if (xs.length === 0) return null;
  xs.sort();
  return xs[xs.length - 1];
}

type HasId = { id: string; created_at: string; updated_at: string };

function reconcileArray<T extends HasId>(
  next: T[],
  prev: T[] | undefined,
  now: ISODateTime,
  opts?: { touchOnReorder?: boolean }
): T[] {
  const prevById = new Map<string, T>();
  (prev ?? []).forEach((p) => prevById.set(p.id, p));

  // 並び替え検知（id列の順序が変わったら、その配列は「操作された」とみなす）
  const touchAllForReorder =
    opts?.touchOnReorder &&
    prev &&
    (prev.map((x) => x.id).join("|") !== next.map((x) => x.id).join("|"));

  return next.map((n) => {
    const p = prevById.get(n.id);

    // 新規
    if (!p) {
      return {
        ...n,
        created_at: n.created_at ?? now,
        updated_at: now,
      };
    }

    // 既存：変更判定（timestamps除外）
    const changed = touchAllForReorder || !isSameIgnoringTimestamps(n, p);

    return {
      ...n,
      created_at: p.created_at ?? n.created_at ?? now,
      updated_at: changed ? now : p.updated_at,
    };
  });
}

/**
 * ExerciseItem は union（SETS/TEXT）なので、sets も含めて整合させる
 * - item自体の変更 or 並び替え → item.updated_at を更新
 * - setsは item.recording_style==="SETS" のときだけ reconcile
 */
function reconcileExerciseItems(
  next: ExerciseItem[],
  prev: ExerciseItem[] | undefined,
  now: ISODateTime
): ExerciseItem[] {
  const prevById = new Map<string, ExerciseItem>();
  (prev ?? []).forEach((p) => prevById.set(p.id, p));

  const touchAllForReorder =
    prev && (prev.map((x) => x.id).join("|") !== next.map((x) => x.id).join("|"));

  return next.map((n) => {
    const p = prevById.get(n.id);

    // 新規
    if (!p) {
      if (n.recording_style === "SETS") {
        const sets = reconcileArray(n.sets as SetItem[], undefined, now, { touchOnReorder: true });
        return {
          ...n,
          created_at: n.created_at ?? now,
          updated_at: now,
          sets,
        };
      }
      return {
        ...n,
        created_at: n.created_at ?? now,
        updated_at: now,
      };
    }

    // 既存：item本体（timestamps除外で比較。setsは一旦除外して別で比較）
    const nBase = { ...n, sets: undefined };
    const pBase = { ...(p as any), sets: undefined };

    const itemChanged = touchAllForReorder || !isSameIgnoringTimestamps(nBase, pBase);

    if (n.recording_style === "SETS") {
      const prevSets = (p as any).recording_style === "SETS" ? (p as any).sets : undefined;
      const sets = reconcileArray(n.sets as SetItem[], prevSets, now, { touchOnReorder: true });

      // setsのどれかが更新されたら itemも更新扱いにする（親max思想）
      const setsMax = maxISO(sets.map((s) => s.updated_at));
      const pItemUpdated = (p as any).updated_at;
      const shouldTouchItem = itemChanged || (setsMax && setsMax !== pItemUpdated);

      return {
        ...n,
        created_at: (p as any).created_at ?? n.created_at ?? now,
        updated_at: shouldTouchItem ? now : (p as any).updated_at,
        sets,
      };
    }

    // TEXT
    return {
      ...n,
      created_at: (p as any).created_at ?? n.created_at ?? now,
      updated_at: itemChanged ? now : (p as any).updated_at,
    };
  });
}

function reconcileMeals(next: MealAggregate[], prev: MealAggregate[] | undefined, now: ISODateTime): MealAggregate[] {
  const prevByMealId = new Map<string, MealAggregate>();
  (prev ?? []).forEach((p) => prevByMealId.set(p.meal_record.id, p));

  // meals配列の並び替えも操作扱いにするなら、meal_orderを必ず更新する想定でOK
  // ここでは「順序が変わったらmeal_record.updated_atを更新」する
  const touchAllForReorder =
    prev && (prev.map((x) => x.meal_record.id).join("|") !== next.map((x) => x.meal_record.id).join("|"));

  return next.map((n) => {
    const p = prevByMealId.get(n.meal_record.id);

    const meal_record = (() => {
      if (!p) {
        return { ...n.meal_record, created_at: n.meal_record.created_at ?? now, updated_at: now };
      }
      const changed = touchAllForReorder || !isSameIgnoringTimestamps(n.meal_record, p.meal_record);
      return {
        ...n.meal_record,
        created_at: p.meal_record.created_at ?? n.meal_record.created_at ?? now,
        updated_at: changed ? now : p.meal_record.updated_at,
      };
    })();

    const attachments = reconcileArray(
      n.attachments as any,
      p?.attachments as any,
      now,
      { touchOnReorder: true }
    ) as MealAttachment[];
    const food_items = reconcileArray(
      n.food_items as any,
      p?.food_items as any,
      now,
      { touchOnReorder: true }
    ) as FoodItem[];

    return { ...n, meal_record, attachments, food_items };
  });
}

function reconcileExerciseSessions(
  next: ExerciseSessionAggregate[],
  prev: ExerciseSessionAggregate[] | undefined,
  now: ISODateTime
): ExerciseSessionAggregate[] {
  const prevById = new Map<string, ExerciseSessionAggregate>();
  (prev ?? []).forEach((p) => prevById.set(p.session.id, p));

  const touchAllForReorder =
    prev && (prev.map((x) => x.session.id).join("|") !== next.map((x) => x.session.id).join("|"));

  return next.map((n) => {
    const p = prevById.get(n.session.id);

    const session = (() => {
      if (!p) return { ...n.session, created_at: n.session.created_at ?? now, updated_at: now };
      const changed = touchAllForReorder || !isSameIgnoringTimestamps(n.session, p.session);
      return {
        ...n.session,
        created_at: p.session.created_at ?? n.session.created_at ?? now,
        updated_at: changed ? now : p.session.updated_at,
      };
    })();

    const items = reconcileExerciseItems(n.items, p?.items, now);

    // itemsの更新があれば sessionも更新扱いにする（max連動）
    const itemsMax = maxISO(items.map((i) => i.updated_at));
    const shouldTouchSession = itemsMax && itemsMax !== session.updated_at;

    return {
      ...n,
      session: shouldTouchSession ? { ...session, updated_at: now } : session,
      items,
    };
  });
}

function computeDailyUpdatedAt(r: DailyRecordAggregate, touchNow?: ISODateTime): ISODateTime {
  const times: string[] = [];
  if (touchNow) times.push(touchNow);

  times.push(r.daily_record.updated_at);
  r.weights.forEach(w => times.push(w.updated_at));
  r.meals.forEach(m => times.push(m.meal_record.updated_at));
  r.exercise_sessions.forEach((s) => {
    times.push(s.session.updated_at);

    s.items.forEach((i) => {
      // i.item ではなく i 自体
      times.push(i.updated_at);

      // SETS のときだけ sets を見る
      if (i.recording_style === "SETS") {
        i.sets.forEach((set) => times.push(set.updated_at));
      }
    });
  });

  if (r.wellness) times.push(r.wellness.updated_at);

  // ISO文字列ならソートで最大取れる
  return times.sort().at(-1)!;
}

function applyTimestamps(next: DailyRecordAggregate, prev: DailyRecordAggregate | null, now: ISODateTime): DailyRecordAggregate {
  // daily_record（created固定、updatedは後でmax）
  const daily_record = (() => {
    const created_at = prev?.daily_record.created_at ?? next.daily_record.created_at ?? now;
    const updated_at = prev?.daily_record.updated_at ?? next.daily_record.updated_at ?? now;
    return { ...next.daily_record, created_at, updated_at };
  })();

  const weights = reconcileArray(next.weights, prev?.weights, now, { touchOnReorder: true }) as WeightRecord[];

  const wellness = (() => {
    if (!next.wellness) return null;
    if (!prev?.wellness) return { ...next.wellness, created_at: next.wellness.created_at ?? now, updated_at: now };
    const changed = !isSameIgnoringTimestamps(next.wellness, prev.wellness);
    return {
      ...next.wellness,
      created_at: prev.wellness.created_at ?? next.wellness.created_at ?? now,
      updated_at: changed ? now : prev.wellness.updated_at,
    };
  })();

  const meals = reconcileMeals(next.meals, prev?.meals, now);
  const exercise_sessions = reconcileExerciseSessions(next.exercise_sessions, prev?.exercise_sessions, now);

  const tmp: DailyRecordAggregate = { ...next, daily_record, weights, wellness, meals, exercise_sessions };

    // 削除検知（削除があったら親updated_atをtouch）
  const hasAnyDeletion =
    !!prev &&
    (
      hasDeletion(prev.weights.map(w => w.id), tmp.weights.map(w => w.id)) ||
      hasDeletion(prev.meals.map(m => m.meal_record.id), tmp.meals.map(m => m.meal_record.id)) ||
      hasDeletion(prev.exercise_sessions.map(s => s.session.id), tmp.exercise_sessions.map(s => s.session.id)) ||
      (!!prev.wellness && !tmp.wellness)
    );

  // 親 updated_at は子のmaxを反映（子→親）、ただし削除があれば now も候補に混ぜる
  const dailyUpdated = computeDailyUpdatedAt(tmp, hasAnyDeletion ? now : undefined);

  return {
    ...tmp,
    daily_record: {
      ...tmp.daily_record,
      updated_at: dailyUpdated,
    },
  };
}

function loadV110(date: ISODate): DailyRecordAggregate | null {
  const k = keyOf(date);
  const raw = localStorage.getItem(k);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as DailyRecordAggregate;
  } catch (e) {
    dwarn(`Failed to parse v1.1.0 record at key ${k}. Falling back to legacy.`);
    return null; // パース失敗でも legacy に落とす
  }
}

function loadLegacyHistory(): any[] | null {
  const raw = localStorage.getItem(LEGACY_HISTORY_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch (e) {
    derror(`Failed to parse legacy history at key ${LEGACY_HISTORY_KEY}:`, e);
    return null;
  }
}

function findUniqueLegacyByDate(history: any[], date: ISODate): LegacyDailyRecord | null {
  const matches = history.filter((r) => isLegacy(r) && r.date === date);
  if (matches.length !== 1) {
    dwarn(`Legacy record count for date ${date} is ${matches.length}. Skipping migration.`);
    return null;
  }
  return matches[0] as LegacyDailyRecord;
}

function migrateAndPersist(date: ISODate, legacy: LegacyDailyRecord): DailyRecordAggregate {
  const now = nowISO();
  const savedAt = (legacy as any).savedAt as string | undefined;

  const migrated = migrateLegacyToAggregate(legacy, savedAt, now);

  localStorage.setItem(keyOf(date), JSON.stringify(migrated));
  dlog(`Successfully migrated legacy record for date ${date} to v1.1.0`);

  return migrated;
}

// 既存：migrateAndPersist のすぐ下あたりに追加すると分かりやすい
export type LegacyMigrationResultV110 = {
  migratedDates: ISODate[];
  alreadyMigratedDates: ISODate[];
  skippedDates: ISODate[];
};

/**
 * legacy history 全体を v1.1.0 形式に一括移行する。
 *
 * - 既に daily_record:YYYY-MM-DD がある日は上書きしない（idempotent）
 * - legacy 側で同一日付が 0 件 or 複数件のものはスキップ
 * - JSON 壊れているなどの異常は skippedDates に積む
 */
export function migrateAllLegacyHistoryToV110(): LegacyMigrationResultV110 {
  const result: LegacyMigrationResultV110 = {
    migratedDates: [],
    alreadyMigratedDates: [],
    skippedDates: [],
  };

  const history = loadLegacyHistory();
  if (!history) {
    dlog("[migration] no legacy history found.");
    return result;
  }

  // legacy history 内の「日付の一覧」をユニークに集める
  const dateSet = new Set<ISODate>();
  for (const entry of history) {
    if (!isLegacy(entry)) continue;
    if (typeof entry.date !== "string") continue;
    dateSet.add(entry.date as ISODate);
  }

  for (const date of dateSet) {
    const key = keyOf(date);

    // 既に v1.1.0 形式がある日は上書きしない
    if (localStorage.getItem(key)) {
      result.alreadyMigratedDates.push(date);
      continue;
    }

    const legacy = findUniqueLegacyByDate(history, date);
    if (!legacy) {
      // 件数 0 or 複数件など、findUniqueLegacyByDate が null を返したケース
      result.skippedDates.push(date);
      continue;
    }

    try {
      migrateAndPersist(date, legacy);
      result.migratedDates.push(date);
    } catch (e) {
      derror("[migration] failed to migrate legacy record", { date, error: e });
      result.skippedDates.push(date);
    }
  }

  dlog("[migration] done migrateAllLegacyHistoryToV110", result);
  return result;
}


// ------------------------------
// Public API
// ------------------------------

export const DailyRecordStorage = {

  get(date: ISODate): DailyRecordAggregate | null {
    // 1) v1.1.0 で取れたらそれを返す
    const v110 = loadV110(date);
    if (v110) return v110;

    // 2) legacy history がなければ終了
    const history = loadLegacyHistory();
    if (!history) return null;

    // 3) ちょうど1件なら migrate して保存→返す
    const legacy = findUniqueLegacyByDate(history, date);
    if (!legacy) return null;

    return migrateAndPersist(date, legacy);
  },

  listSummaries(): DailyRecordSummary[] {
    return listDailyRecordSummariesInternal();
  },

  save(record: DailyRecordAggregate): void {
    const now = nowISO();
    const prev = DailyRecordStorage.get(record.daily_record.record_date);
    const stamped = applyTimestamps(record, prev, now);

    localStorage.setItem(
      keyOf(record.daily_record.record_date),
      JSON.stringify(stamped)
    );
  },

  delete(date: ISODate): void {
    localStorage.removeItem(keyOf(date));
  },
};
