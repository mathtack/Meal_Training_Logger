import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "vite";
import { initializeBackfillTestDatabase, readNormalized } from "./backfill-db.mjs";
import { normalizedRecordFixture, normalizedUserId, normalizedDate, fixtureId } from "../src/app/testing/normalizedRecordFixture.ts";

const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false }, appType: "custom" });
const db = new PGlite();
try {
  const { mapNormalizedDailyRecord } = await server.ssrLoadModule("/src/app/dailyRecordNormalizedReadMapper.ts");
  const { backfillChecksums } = await server.ssrLoadModule("/src/legacy/localStorage/backfillPlan.ts");
  const owner = normalizedUserId, date = normalizedDate;
  const other = "20000000-0000-4000-8000-000000000001";
  const record = mapNormalizedDailyRecord(normalizedRecordFixture(), { userId: owner, date });
  record.exercise_sessions[0].session.started_at = date + "T07:45:00+09:00";
  record.weights[0].weight = 70.123;
  const save = async payload => (await db.query("select public.save_daily_record_normalized($1::jsonb) as result",
    [JSON.stringify(payload)])).rows[0].result;
  const remove = async () => (await db.query("select public.delete_daily_record_normalized($1::date) as result", [date])).rows[0].result;
  const legacyWrite = () => db.query(`insert into public.daily_record_store(user_id,record_date,record_json)
    values ($1,$2,'{}') on conflict (user_id,record_date) do update set record_json=excluded.record_json`, [owner,date]);
  const legacyDelete = () => db.query("delete from public.daily_record_store where user_id=$1 and record_date=$2", [owner,date]);
  const caller = async (id, role = "authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    if (role !== "postgres") await db.exec(role === "anon" ? "set role anon" : "set role authenticated");
  };
  const mode = async value => {
    await caller("", "postgres");
    await db.query("update migration_private.daily_record_write_mode set mode=$1", [value]);
  };
  const pair = async () => {
    const row = await readNormalized(db, { owner, date });
    const stored = (await db.query("select record_json from public.daily_record_store where user_id=$1 and record_date=$2", [owner,date])).rows[0].record_json;
    return { row, stored };
  };
  await initializeBackfillTestDatabase(db);
  await db.query("insert into auth.users(id) values ($1),($2)", [owner,other]);
  await db.query("insert into public.app_user(id) values ($1)", [owner]);
  await caller(owner);
  await legacyWrite();
  await assert.rejects(save(record), { code: "55000" });
  await mode("frozen");
  await caller(owner);
  await assert.rejects(legacyWrite(), { code: "55000" });
  await assert.rejects(legacyDelete(), { code: "55000" });
  await assert.rejects(save(record), { code: "55000" });
  await assert.rejects(remove(), { code: "55000" });
  await assert.rejects(db.query("update migration_private.daily_record_write_mode set mode='normalized'"), { code: "42501" });
  await mode("normalized");
  await caller("", "anon");
  await assert.rejects(save(record), { code: "42501" });
  await assert.rejects(remove(), { code: "42501" });
  await caller(owner);
  await assert.rejects(legacyWrite(), { code: "55000" });
  await assert.rejects(db.query("delete from public.daily_record where record_date=$1", [date]), { code: "42501" });
  await assert.rejects(db.query("select migration_private.upsert_daily_record_mirror($1,$2)",
    [owner, record.daily_record.id]), { code: "42501" });
  const identity = await save(record);
  assert.equal(identity.id, record.daily_record.id);
  const initial = await pair();
  assert.equal(Date.parse(initial.stored.daily_record.updated_at), Date.parse(identity.updated_at));
  assert.equal(initial.stored.weights[0].weight, 70.12);
  assert.equal(initial.stored.meals[0].food_items[0].food_amount, null);
  assert.match(initial.stored.exercise_sessions[0].session.started_at, /T07:45:00\.000000\+09:00$/);
  assert.deepEqual(await backfillChecksums(initial.stored),
    await backfillChecksums(mapNormalizedDailyRecord(initial.row, { userId: owner, date })));
  await caller(other);
  assert.equal((await db.query("select id from public.daily_record")).rows.length, 0);
  assert.equal(await remove(), null);
  await assert.rejects(save(record), { code: "42501" });

  // A mirror failure must roll back the preceding normalized save or cascade.
  await caller("", "postgres");
  await db.exec(`
    create function public.inject_mirror_failure() returns trigger language plpgsql as $$
    begin raise exception 'fixture mirror failure' using errcode = 'P0001'; end $$;
    create trigger fail_mirror before insert or update or delete on public.daily_record_store
      for each row execute function public.inject_mirror_failure();
  `);
  await caller(owner);
  const changed = structuredClone(record);
  changed.weights[0].weight = 88;
  await assert.rejects(save(changed), { code: "P0001" });
  assert.deepEqual(await pair(), initial);
  await assert.rejects(remove(), { code: "P0001" });
  assert.deepEqual(await pair(), initial);
  await caller("", "postgres");
  await db.exec("drop trigger fail_mirror on public.daily_record_store");
  await caller(owner);
  await save(changed);
  assert.equal((await pair()).stored.weights[0].weight, 88);
  // Rehearse the rollback route before allowing legacy writes again.
  await mode("frozen");
  await caller(owner);
  assert.equal((await pair()).stored.weights[0].weight, 88);
  await mode("jsonb");
  await caller(owner);
  await assert.rejects(save(changed), { code: "55000" });
  await legacyWrite();
  await mode("normalized");
  await caller(owner);
  assert.equal((await remove()).id, record.daily_record.id);
  assert.equal(await remove(), null);
  assert.equal((await db.query("select id from public.daily_record_store")).rows.length, 0);
  assert.equal((await db.query("select id from public.set_item")).rows.length, 0);
  await caller(other);
  const firstSave = { daily_record: { ...record.daily_record, id: fixtureId(990), user_id: other },
    weights: [], wellness: null, meals: [], exercise_sessions: [] };
  assert.equal((await save(firstSave)).user_id, other);
  assert.equal((await db.query("select id from public.app_user")).rows.length, 1);
  await caller(owner);
  assert.equal(await remove(), null);
  await caller(other);
  assert.equal((await remove()).id, firstSave.daily_record.id);
  console.log("PASS: JSONB/frozen/normalized gates, owner/RLS, atomic save/delete and failure rollback, JST mirror, numeric/null/identity, rollback route");
} finally {
  await db.close();
  await server.close();
}
