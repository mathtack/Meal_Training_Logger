import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "vite";
import { initializeBackfillTestDatabase, readNormalized } from "./backfill-db.mjs";
import { normalizedRecordFixture, normalizedUserId, normalizedDate, fixtureId } from "../20_module/00_common/testing/normalizedRecordFixture.ts";

// Only synthetic data in a local in-memory PostgreSQL instance.
const modulePath = process.argv[2];
if (!modulePath) throw Error("Usage: node scripts/verify-jsonb-retirement.mjs <pglite-module>");
const { PGlite } = await import(pathToFileURL(resolve(modulePath)).href);
const migration = await readFile(new URL("../supabase/migrations/20261125212008_retire_jsonb_runtime.sql", import.meta.url), "utf8");
const owner = normalizedUserId;
const other = "20000000-0000-4000-8000-000000000001";
const date = normalizedDate;
const otherDate = "2026-11-04";
const tables = [
  "daily_record", "weight_record", "wellness_record", "meal_record", "meal_attachment",
  "food_item", "food_material", "exercise_session", "exercise_item", "set_item",
];

async function caller(db, id, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  if (role === "anon") await db.exec("set role anon");
  if (role === "authenticated") await db.exec("set role authenticated");
}

async function save(db, payload) {
  const result = await db.query("select public.save_daily_record_normalized($1::jsonb) as data",
    [JSON.stringify(payload)]);
  return result.rows[0].data;
}

async function remove(db) {
  const result = await db.query("select public.delete_daily_record_normalized($1::date) as data", [date]);
  return result.rows[0].data;
}

async function countOwnerRows(db, table, userId) {
  const result = await db.query(`select count(*)::int as n from public.${table} where user_id = $1`, [userId]);
  return result.rows[0].n;
}

const server = await createServer({
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: false,
  server: { middlewareMode: true, ws: false },
  appType: "custom",
});
try {
  const { mapNormalizedDailyRecord } = await server.ssrLoadModule("/20_module/S-02_daily-record-persistence/src/dailyRecordNormalizedReadMapper.ts");
  const raw = normalizedRecordFixture();
  const record = mapNormalizedDailyRecord(raw, { userId: owner, date });
  // Give the second synthetic tenant a distinct set of primary and foreign keys.
  const otherRaw = JSON.parse(JSON.stringify(raw).replaceAll("10000000-", "20000000-"));
  const otherRecord = mapNormalizedDailyRecord(otherRaw, { userId: other, date });
  await verifyUpgrade(record, otherRecord);
  await verifyFresh(record);
} finally {
  await server.close();
}

async function verifyUpgrade(record, otherRecord) {
  const db = new PGlite();
  try {
    await verifyRetirement(db, record, otherRecord);
  } finally {
    await db.close();
  }
}

async function verifyRetirement(db, record, otherRecord) {
  const mode = async value => {
    await caller(db, "", "postgres");
    await db.query("update migration_private.daily_record_write_mode set mode=$1", [value]);
  };
  const archive = async () => {
    await caller(db, "", "postgres");
    return (await db.query("select to_jsonb(s) as data from public.daily_record_store s order by s.id")).rows;
  };
  const rollbackFailure = async sql => {
    try {
      await assert.rejects(db.exec(sql));
    } finally {
      await db.exec("rollback");
    }
  };

  await initializeBackfillTestDatabase(db, "20261106033054_atomic_cutover_mirror.sql");
  await db.query("insert into auth.users(id) values ($1),($2)", [owner, other]);
  await db.query("insert into public.app_user(id) values ($1)", [owner]);
  await db.query("insert into public.daily_record_store(user_id,record_date,record_json) values ($1,$2,'{}')", [owner, date]);
  await rollbackFailure("begin; " + migration + " commit;");
  assert.equal((await db.query("select mode from migration_private.daily_record_write_mode")).rows[0].mode, "jsonb");
  assert.equal((await db.query("select has_table_privilege('authenticated','public.daily_record_store','SELECT') as allowed")).rows[0].allowed, true);
  await db.exec("delete from public.daily_record_store");
  await mode("normalized");
  await caller(db, owner);
  const identity = await save(db, record);
  const initial = await readNormalized(db, { owner, date });
  await mode("frozen");
  // Include legacy column grants so table-level revocation alone cannot pass.
  await db.exec("grant select(record_json) on public.daily_record_store to public;");
  const preserved = await archive();
  await db.exec("begin; " + migration + " commit;");
  assert.equal((await db.query("select mode from migration_private.daily_record_write_mode")).rows[0].mode, "frozen");
  assert.deepEqual(await archive(), preserved);
  await mode("normalized");
  await caller(db, owner);
  assert.deepEqual(await readNormalized(db, { owner, date }), initial);
  for (const routine of [
    "migration_private.write_normalized(jsonb, uuid, boolean)",
    "migration_private.apply_backfill_row(uuid, text, text, jsonb)",
    "migration_private.upsert_daily_record_mirror(uuid, uuid)",
  ]) {
    const { rows } = await db.query("select has_function_privilege('authenticated', $1, 'EXECUTE') as allowed", [routine]);
    assert.equal(rows[0].allowed, false, routine);
  }

  for (const role of ["anon", "authenticated"]) {
    await caller(db, role === "anon" ? "" : owner, role);
    for (const query of [
      "select id from public.daily_record_store",
      "select record_json from public.daily_record_store",
      "insert into public.daily_record_store(user_id,record_date,record_json) values (auth.uid(),current_date,'{}')",
      "update public.daily_record_store set saved_at=now() where false",
      "delete from public.daily_record_store where false",
      "select migration_private.save_daily_record_with_mirror('{}')",
      "select migration_private.delete_daily_record_with_mirror(current_date)",
      "select run_id from migration_private.backfill_run",
      "update migration_private.daily_record_write_mode set mode='frozen' where false",
    ]) await assert.rejects(db.query(query), { code: "42501" });
    for (const table of tables) {
      await assert.rejects(db.query(`delete from public.${table} where false`), { code: "42501" });
      if (role === "anon") {
        await assert.rejects(db.query(`select * from public.${table} where false`), { code: "42501" });
      }
    }
  }
  await caller(db, "", "anon");
  await assert.rejects(db.query("select id from public.app_user"), { code: "42501" });
  await assert.rejects(save(db, record), { code: "42501" });
  await assert.rejects(remove(db), { code: "42501" });
  await caller(db, other);
  assert.equal((await db.query("select id from public.daily_record")).rows.length, 0);
  assert.equal(await remove(db), null);
  await assert.rejects(save(db, record), { code: "42501" });

  await mode("frozen");
  await caller(db, owner);
  await assert.rejects(save(db, record), { code: "55000" });
  await assert.rejects(remove(db), { code: "55000" });
  await mode("normalized");
  await caller(db, owner);
  const invalidParent = structuredClone(record);
  invalidParent.weights[0].daily_record_id = fixtureId(990);
  await assert.rejects(save(db, invalidParent), { code: "22023" });
  assert.deepEqual(await readNormalized(db, { owner, date }), initial);
  const changed = structuredClone(record);
  changed.weights[0].weight = 88;
  const saved = await save(db, changed);
  assert.equal(saved.id, identity.id);
  assert.equal(saved.created_at, identity.created_at);
  const updated = await readNormalized(db, { owner, date });
  assert.equal(updated.weight_record.find(w => w.id === changed.weights[0].id).weight, 88);
  assert.deepEqual(await archive(), preserved);

  // Fail after the normalized writer has started replacing child rows.
  await db.exec(`
    create function public.retirement_fixture_failure() returns trigger language plpgsql as $$
    begin raise exception 'retirement fixture failure' using errcode='P0001'; end $$;
    create trigger retirement_fail_save before insert on public.food_item
      for each row execute function public.retirement_fixture_failure();
    create trigger retirement_fail_delete before delete on public.set_item
      for each row execute function public.retirement_fixture_failure();
  `);
  await caller(db, owner);
  await assert.rejects(save(db, record), { code: "P0001" });
  assert.deepEqual(await readNormalized(db, { owner, date }), updated);
  await assert.rejects(remove(db), { code: "P0001" });
  assert.deepEqual(await readNormalized(db, { owner, date }), updated);
  await caller(db, "", "postgres");
  await db.exec("drop trigger retirement_fail_save on public.food_item; drop trigger retirement_fail_delete on public.set_item;");
  const retainedRecord = { daily_record: { ...record.daily_record, id: fixtureId(991), record_date: otherDate },
    weights: [], wellness: null, meals: [], exercise_sessions: [] };
  await caller(db, owner);
  await save(db, retainedRecord);
  await caller(db, other);
  assert.deepEqual((await db.query("select id from public.app_user")).rows, []);
  await save(db, otherRecord);
  const otherBefore = await readNormalized(db, { owner: other, date });
  assert.deepEqual((await db.query("select id from public.app_user")).rows, [{ id: other }]);
  await assert.rejects(db.query("delete from public.app_user where false"), { code: "42501" });

  // Food materials are not written by the public RPC. Seed real children before
  // testing the RPC deletion and the ownership boundary for this table.
  await caller(db, "", "postgres");
  await db.query(`insert into public.food_material (
    id, food_item_id, user_id, food_material_order, food_material_name,
    food_material_amount, food_material_amount_unit, food_material_calorie
  ) values ($1, $2, $3, 0, 'cascade fixture', 1, 'g', 1),
           ($4, $5, $6, 0, 'retained fixture', 1, 'g', 1)`, [
    fixtureId(992), record.meals[0].food_items[0].id, owner,
    fixtureId(993), otherRecord.meals[0].food_items[0].id, other,
  ]);
  await caller(db, owner);
  assert.deepEqual((await db.query("select id from public.app_user")).rows, [{ id: owner }]);
  const history = await db.query("select record_date::text from public.daily_record order by record_date desc");
  assert.deepEqual(history.rows.map(row => row.record_date), [date, otherDate]);
  assert.equal(await countOwnerRows(db, "food_material", owner), 1);
  const otherCounts = new Map();
  for (const table of tables) {
    assert.equal(await countOwnerRows(db, table, other), 0, `${table}: another owner is hidden`);
    assert.ok(await countOwnerRows(db, table, owner) > 0, `${table}: owner fixture exists`);
  }
  await caller(db, other);
  for (const table of tables) {
    assert.equal(await countOwnerRows(db, table, owner), 0, `${table}: another owner is hidden`);
    const count = await countOwnerRows(db, table, other);
    assert.ok(count > 0, `${table}: another owner fixture exists`);
    otherCounts.set(table, count);
  }
  await caller(db, owner);
  assert.deepEqual(await remove(db), { id: identity.id, user_id: owner, record_date: date });
  assert.equal(await remove(db), null);
  assert.equal(await countOwnerRows(db, "daily_record", owner), 1);
  assert.equal((await readNormalized(db, { owner, date: otherDate })).id, retainedRecord.daily_record.id);
  for (const table of tables.slice(1)) {
    assert.equal(await countOwnerRows(db, table, owner), 0, `${table}: target children removed`);
  }
  await caller(db, other);
  assert.deepEqual(await readNormalized(db, { owner: other, date }), otherBefore);
  for (const table of tables) {
    assert.equal(await countOwnerRows(db, table, other), otherCounts.get(table), `${table}: another owner retained`);
  }
  assert.deepEqual(await archive(), preserved);

  // Removing the retired copy must not remove or recreate current records.
  await mode("frozen");
  await db.exec("delete from public.daily_record_store");
  assert.deepEqual(await archive(), []);
  await mode("normalized");
  await caller(db, other);
  assert.deepEqual(await readNormalized(db, { owner: other, date }), otherBefore);
  assert.equal(await countOwnerRows(db, "food_material", other), 1);
  assert.equal((await save(db, otherRecord)).id, otherRecord.daily_record.id);
  assert.deepEqual(await archive(), []);
  console.log("PASS: upgrade, CRUD, history, cascade, role and ownership boundaries, write freeze and atomicity");
}

async function verifyFresh(record) {
  const fresh = new PGlite();
  try {
    await initializeBackfillTestDatabase(fresh);
    assert.equal((await fresh.query("select mode from migration_private.daily_record_write_mode")).rows[0].mode, "normalized");
    assert.equal((await fresh.query("select has_table_privilege('authenticated','public.daily_record_store','SELECT') as allowed")).rows[0].allowed, false);
    await fresh.query("insert into auth.users(id) values ($1)", [owner]);
    await caller(fresh, owner);
    assert.equal((await save(fresh, record)).id, record.daily_record.id);
    assert.equal((await readNormalized(fresh, { owner, date })).id, record.daily_record.id);
    assert.deepEqual(await remove(fresh), { id: record.daily_record.id, user_id: owner, record_date: date });
    assert.equal(await countOwnerRows(fresh, "daily_record", owner), 0);
    console.log("PASS: fresh migration chain starts normalized and supports save, read and deletion");
  } finally {
    await fresh.close();
  }
}
