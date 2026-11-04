// In-memory PostgreSQL only. Node >=22.18 (native TypeScript fixture loading).
// Pass the PGlite module path to keep verification dependencies outside the app.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  normalizedRecordFixture, normalizedUserId, normalizedDate, fixtureId,
} from "../src/app/testing/normalizedRecordFixture.ts";

const modulePath = process.argv[2];
const { PGlite } = await import(modulePath
  ? pathToFileURL(resolve(modulePath)).href : "@electric-sql/pglite");
const db = new PGlite();
const otherUser = normalizedUserId.replace("10000000", "20000000");
const tables = [
  "daily_record", "weight_record", "wellness_record", "meal_record", "meal_attachment",
  "food_item", "food_material", "exercise_session", "exercise_item", "set_item",
];

const payload = (row) => ({
  daily_record: {
    id: row.id, user_id: row.user_id, record_date: row.record_date,
    created_at: row.created_at, updated_at: row.updated_at,
  },
  weights: row.weight_record,
  wellness: row.wellness_record[0] ?? null,
  meals: row.meal_record.map(({ meal_attachment, food_item, ...meal_record }) => ({
    meal_record, attachments: meal_attachment, food_items: food_item,
  })),
  exercise_sessions: row.exercise_session.map(({ exercise_item, ...session }) => ({
    session,
    items: exercise_item.map(({ set_item, ...item }) => ({ ...item, sets: set_item })),
  })),
});
const caller = async (role, user = "") => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
  // Roles are fixed test constants, never externally supplied identifiers.
  assert(["authenticated", "anon", "postgres"].includes(role));
  if (role !== "postgres") await db.exec(`set role ${role}`);
};
const save = (value) => db.query("select public.save_daily_record_normalized($1::jsonb)", [JSON.stringify(value)]);
const counts = async () => Object.fromEntries(await Promise.all(tables.map(async (table) => {
  const result = await db.query(`select count(*)::integer as n from public.${table}`);
  return [table, result.rows[0].n];
})));

try {
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create role anon;
    create role authenticated;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  for (const name of [
    "20260902090014_current_app_baseline.sql",
    "20260907121742_harden_dormant_normalized_tables.sql",
    "20260911085026_normalized_schema_contract.sql",
    "20260911091026_normalized_atomic_write_rpc.sql",
  ]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
  }
  await db.query("insert into auth.users(id) values ($1), ($2)", [normalizedUserId, otherUser]);
  const raw = normalizedRecordFixture();
  await caller("authenticated", normalizedUserId);
  await save(payload(raw));
  await db.query(`insert into public.food_material (
    id, food_item_id, user_id, food_material_order, food_material_name,
    food_material_amount, food_material_amount_unit, food_material_calorie
  ) values ($1, $2, $3, 0, 'cascade test', 1, 'g', 1)`, [
    fixtureId(900), raw.meal_record[0].food_item[0].id, normalizedUserId,
  ]);
  // A same-owner different date must survive the target delete.
  await save({ daily_record: { ...payload(raw).daily_record,
    id: fixtureId(901), record_date: "2026-11-04" },
  weights: [], wellness: null, meals: [], exercise_sessions: [] });
  // An independent second tenant owns a full aggregate on the same date.
  const otherRaw = JSON.parse(JSON.stringify(raw).replaceAll("10000000", "20000000"));
  await caller("authenticated", otherUser);
  await save(payload(otherRaw));
  const otherCounts = await counts();
  assert.equal(otherCounts.daily_record, 1);
  assert.equal(otherCounts.set_item, 8);
  const forbiddenDelete = await db.query(
    "delete from public.daily_record where user_id = $1 and record_date = $2 returning id",
    [normalizedUserId, normalizedDate],
  );
  assert.deepEqual(forbiddenDelete.rows, []);
  assert.deepEqual(await counts(), otherCounts);
  // RLS independently hides every child table, including food_material.
  for (const table of tables) {
    const leaked = await db.query(`select count(*)::int as n from public.${table} where user_id = $1`, [normalizedUserId]);
    assert.equal(leaked.rows[0].n, 0, `${table} cross-tenant read`);
  }

  await caller("authenticated", normalizedUserId);
  await db.query(`insert into public.daily_record_store(user_id, record_date, record_json)
    values ($1, $2, '{"sentinel":"JSONB unchanged"}'::jsonb)`, [normalizedUserId, normalizedDate]);
  const beforeStore = (await db.query("select * from public.daily_record_store")).rows;
  const history = await db.query(`select record_date::text, updated_at from public.daily_record
    where user_id = $1 order by record_date desc`, [normalizedUserId]);
  assert.deepEqual(history.rows.map((row) => row.record_date), [normalizedDate, "2026-11-04"]);
  const before = await counts();
  assert.equal(before.food_material, 1);
  const deleted = await db.query(`delete from public.daily_record
    where user_id = $1 and record_date = $2 returning id, user_id, record_date::text`,
  [normalizedUserId, normalizedDate]);
  assert.deepEqual(deleted.rows, [{ id: raw.id, user_id: normalizedUserId, record_date: normalizedDate }]);
  const after = await counts();
  assert.equal(after.daily_record, 1, "different date retained");
  for (const table of tables.slice(1)) assert.equal(after[table], 0, `${table} cascade`);
  assert.deepEqual((await db.query("select * from public.daily_record_store")).rows, beforeStore);
  const repeatedDelete = await db.query(`delete from public.daily_record
    where user_id = $1 and record_date = $2 returning id`, [normalizedUserId, normalizedDate]);
  assert.deepEqual(repeatedDelete.rows, []);
  await caller("authenticated", otherUser);
  assert.deepEqual(await counts(), otherCounts, "second tenant retained");

  await caller("anon");
  for (const table of tables) {
    await assert.rejects(() => db.query(`select * from public.${table}`), /permission denied/);
    await assert.rejects(() => db.query(`delete from public.${table}`), /permission denied/);
  }
  console.log("PASS: migration chain, tenant SELECT/DELETE isolation, history, all 10-table cascade, different-date retention, repeat delete, JSONB unchanged, anon denied");
} finally {
  await db.close();
}
