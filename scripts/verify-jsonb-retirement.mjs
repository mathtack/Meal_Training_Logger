import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "vite";
import { initializeBackfillTestDatabase, readNormalized } from "./backfill-db.mjs";
import { normalizedRecordFixture, normalizedUserId, normalizedDate, fixtureId } from "../src/app/testing/normalizedRecordFixture.ts";

const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const migration = await readFile(new URL("../supabase/migrations/20261125212008_retire_jsonb_runtime.sql", import.meta.url), "utf8");
const recovery = await readFile(new URL("../supabase/operations/restore_jsonb_runtime.sql", import.meta.url), "utf8");
const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false }, appType: "custom" });
const db = new PGlite();
try {
  const { mapNormalizedDailyRecord } = await server.ssrLoadModule("/src/app/dailyRecordNormalizedReadMapper.ts");
  const owner = normalizedUserId;
  const other = "20000000-0000-4000-8000-000000000001";
  const date = normalizedDate;
  const record = mapNormalizedDailyRecord(normalizedRecordFixture(), { userId: owner, date });
  const caller = async (id, role = "authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    if (role !== "postgres") await db.exec(role === "anon" ? "set role anon" : "set role authenticated");
  };
  const mode = async value => {
    await caller("", "postgres");
    await db.query("update migration_private.daily_record_write_mode set mode=$1", [value]);
  };
  const save = async payload => (await db.query("select public.save_daily_record_normalized($1::jsonb) as data",
    [JSON.stringify(payload)])).rows[0].data;
  const remove = async () => (await db.query("select public.delete_daily_record_normalized($1::date) as data", [date])).rows[0].data;
  const archive = async () => {
    await caller("", "postgres");
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
  await caller(owner);
  const identity = await save(record);
  const initial = await readNormalized(db, { owner, date });
  await mode("frozen");
  // Include legacy column grants so table-level revocation alone cannot pass.
  await db.exec("grant select(record_json) on public.daily_record_store to public;");
  const preserved = await archive();
  await db.exec("begin; " + migration + " commit;");
  assert.equal((await db.query("select mode from migration_private.daily_record_write_mode")).rows[0].mode, "frozen");
  assert.deepEqual(await archive(), preserved);
  await mode("normalized");
  await caller(owner);
  assert.deepEqual(await readNormalized(db, { owner, date }), initial);

  for (const role of ["anon", "authenticated"]) {
    await caller(owner, role);
    for (const query of [
      "select id from public.daily_record_store",
      "select record_json from public.daily_record_store",
      "insert into public.daily_record_store(user_id,record_date,record_json) values (auth.uid(),current_date,'{}')",
      "update public.daily_record_store set saved_at=now() where false",
      "delete from public.daily_record_store where false",
      "select migration_private.save_daily_record_with_mirror('{}')",
      "select migration_private.delete_daily_record_with_mirror(current_date)",
    ]) await assert.rejects(db.query(query), { code: "42501" });
  }
  await caller("", "anon");
  await assert.rejects(save(record), { code: "42501" });
  await assert.rejects(remove(), { code: "42501" });
  await caller(other);
  assert.equal((await db.query("select id from public.daily_record")).rows.length, 0);
  assert.equal(await remove(), null);
  await assert.rejects(save(record), { code: "42501" });

  await mode("frozen");
  await caller(owner);
  await assert.rejects(save(record), { code: "55000" });
  await assert.rejects(remove(), { code: "55000" });
  await mode("normalized");
  await caller(owner);
  const changed = structuredClone(record);
  changed.weights[0].weight = 88;
  const saved = await save(changed);
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
  await caller(owner);
  await assert.rejects(save(record), { code: "P0001" });
  assert.deepEqual(await readNormalized(db, { owner, date }), updated);
  await assert.rejects(remove(), { code: "P0001" });
  assert.deepEqual(await readNormalized(db, { owner, date }), updated);
  await caller("", "postgres");
  await db.exec("drop trigger retirement_fail_save on public.food_item; drop trigger retirement_fail_delete on public.set_item;");
  await caller(owner);
  assert.equal((await remove()).id, identity.id);
  assert.equal(await remove(), null);
  for (const table of ["weight_record", "wellness_record", "meal_record", "meal_attachment",
    "food_item", "food_material", "exercise_session", "exercise_item", "set_item"]) {
    assert.equal((await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n, 0);
  }
  assert.deepEqual(await archive(), preserved);

  // A first save after retirement provisions the profile without creating a mirror.
  const newRecord = { daily_record: { ...record.daily_record, id: fixtureId(999), user_id: other },
    weights: [], wellness: null, meals: [], exercise_sessions: [] };
  await caller(other);
  await save(newRecord);
  assert.equal((await db.query("select id from public.app_user")).rows.length, 1);
  assert.deepEqual(await archive(), preserved);

  // Recovery is refused while normal writes are enabled.
  await rollbackFailure(recovery);
  await mode("frozen");
  await db.exec(`
    create trigger retirement_fail_recovery before insert on public.daily_record_store
      for each row execute function public.retirement_fixture_failure();
  `);
  await rollbackFailure(recovery);
  assert.deepEqual(await archive(), preserved);
  assert.equal((await db.query("select has_table_privilege('authenticated','public.daily_record_store','SELECT') as allowed")).rows[0].allowed, false);
  await db.exec("drop trigger retirement_fail_recovery on public.daily_record_store;");
  await db.exec(recovery);
  const reconstructed = await archive();
  assert.equal(reconstructed.length, 1);
  assert.equal(reconstructed[0].data.user_id, other);
  assert.equal(reconstructed[0].data.record_json.daily_record.id, newRecord.daily_record.id);
  await db.exec(recovery);
  assert.equal((await archive()).length, 1);
  await caller(other);
  assert.equal((await db.query("select id from public.daily_record_store")).rows.length, 1);
  await assert.rejects(save(newRecord), { code: "55000" });
  await assert.rejects(db.query("delete from public.daily_record_store where false"), { code: "55000" });
  await mode("jsonb");
  await caller(owner);
  assert.equal((await db.query("select id from public.daily_record_store")).rows.length, 0);
  await caller(other);
  await db.query("update public.daily_record_store set saved_at=now() where user_id=auth.uid()");
  await assert.rejects(save(newRecord), { code: "55000" });
  console.log("PASS: retirement preserves data; normalized CRUD/cascade/owner/freeze/failure atomicity; JSONB denied and static; recovery refreshes new rows, removes stale rows, rolls back on failure and keeps writes frozen");
} finally {
  await db.close();
  await server.close();
}

const fresh = new PGlite();
try {
  await initializeBackfillTestDatabase(fresh);
  assert.equal((await fresh.query("select mode from migration_private.daily_record_write_mode")).rows[0].mode, "normalized");
  assert.equal((await fresh.query("select has_table_privilege('authenticated','public.daily_record_store','SELECT') as allowed")).rows[0].allowed, false);
  console.log("PASS: fresh migration chain starts with normalized persistence");
} finally {
  await fresh.close();
}
