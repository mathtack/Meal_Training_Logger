import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { initializeBackfillTestDatabase } from "./backfill-db.mjs";

const [modulePath, privateSnapshot] = process.argv.slice(2);
const { PGlite } = await import(pathToFileURL(resolve(modulePath)).href);
const migrations = new URL("../supabase/migrations/", import.meta.url);
const hardening = "20260907121742_harden_dormant_normalized_tables.sql";
const fixtureOwner = "10000000-0000-4000-8000-000000000001";
const fixtureOther = "20000000-0000-4000-8000-000000000001";
const fixture = {
  auth_ids: [fixtureOwner, fixtureOther],
  profiles: [{ id: fixtureOwner, display_name: null, created_at: "2026-01-01T00:00:00+00:00" }],
  records: [{ id: fixtureOther, user_id: fixtureOwner, record_date: "2026-01-01",
    record_json: { fixture: true }, saved_at: "2026-01-01T00:00:00+00:00" }],
};

async function loadSnapshot(db, snapshot) {
  await db.query("insert into auth.users(id) select value::uuid from jsonb_array_elements_text($1::jsonb)",
    [JSON.stringify(snapshot.auth_ids)]);
  await db.query("insert into public.app_user select * from jsonb_populate_recordset(null::public.app_user, $1::jsonb)",
    [JSON.stringify(snapshot.profiles)]);
  await db.query("insert into public.daily_record_store select * from jsonb_populate_recordset(null::public.daily_record_store, $1::jsonb)",
    [JSON.stringify(snapshot.records)]);
  const result = (await db.query(`
    select
      (select count(*)::integer from auth.users) as auth_count,
      (select count(*)::integer from public.app_user) as profile_count,
      (select count(*)::integer from public.daily_record_store) as record_count,
      (select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(s) order by id),'[]'::jsonb)::text,'UTF8')),'hex')
        from public.daily_record_store s) as source_sha256,
      (select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(a) order by id),'[]'::jsonb)::text,'UTF8')),'hex')
        from public.app_user a) as profiles_sha256`)).rows[0];
  assert.equal(result.auth_count, snapshot.auth_ids.length);
  assert.equal(result.profile_count, snapshot.profiles.length);
  assert.equal(result.record_count, snapshot.records.length);
  if (snapshot.source_sha256) assert.equal(result.source_sha256, snapshot.source_sha256, "JSONB snapshot hash mismatch");
  if (snapshot.profiles_sha256) assert.equal(result.profiles_sha256, snapshot.profiles_sha256, "Profile snapshot hash mismatch");
  return result;
}

async function verify(liveLike, snapshot) {
  const db = new PGlite();
  try {
    await initializeBackfillTestDatabase(db, hardening);
    await db.exec("set timezone = 'UTC'");
    if (liveLike) await db.exec(`
      create role service_role bypassrls;
      grant all privileges on public.app_user, public.daily_record_store to anon, authenticated, service_role;
      alter policy "Users can manage their own profile" on public.app_user to public
        using (auth.uid() = id) with check (auth.uid() = id);
      alter policy "Users can manage their own daily records" on public.daily_record_store to public
        using (auth.uid() = user_id) with check (auth.uid() = user_id);
      alter table public.daily_record_store add constraint daily_record_store_user_date_uniq unique (user_id, record_date);
    `);
    const before = await loadSnapshot(db, snapshot);
    for (const file of (await readdir(migrations)).filter(name => name.endsWith(".sql") && name > hardening).sort()) {
      await db.exec(await readFile(new URL(file, migrations), "utf8"));
    }
    const after = (await db.query(`
      select (select count(*)::integer from public.daily_record_store) as records,
        (select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(s) order by id),'[]'::jsonb)::text,'UTF8')),'hex')
          from public.daily_record_store s) as source_sha256,
        (select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(a) order by id),'[]'::jsonb)::text,'UTF8')),'hex')
          from public.app_user a) as profiles_sha256
    `)).rows[0];
    assert.equal(after.records, before.record_count);
    assert.equal(after.source_sha256, before.source_sha256);
    assert.equal(after.profiles_sha256, before.profiles_sha256);

    const permissions = (await db.query(`select
      has_table_privilege('authenticated','public.app_user','DELETE') as profile_delete,
      has_table_privilege('authenticated','public.daily_record_store','TRUNCATE') as store_truncate,
      has_table_privilege('authenticated','public.daily_record_store','REFERENCES') as store_references,
      has_table_privilege('authenticated','public.daily_record_store','TRIGGER') as store_trigger`)).rows[0];
    assert.ok(Object.values(permissions).every(allowed => !allowed));
    if (liveLike) assert.equal((await db.query(`select has_table_privilege('service_role','public.daily_record_store','SELECT') as ok`)).rows[0].ok, true);
    await db.exec("set role anon");
    await assert.rejects(db.query("select id from public.daily_record_store"), { code: "42501" });
    await assert.rejects(db.query("select id from public.app_user"), { code: "42501" });
    await db.exec("reset role");

    const owner = snapshot.records[0].user_id;
    const other = snapshot.auth_ids.find(id => id !== owner);
    assert.ok(other, "A second Auth identity is required for the isolation test");
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [other]);
    assert.equal((await db.query("select id from public.daily_record_store where user_id = $1", [owner])).rows.length, 0);
    await assert.rejects(db.query(`insert into public.daily_record_store(user_id,record_date,record_json)
      values ($1,'2099-01-01','{}')`, [owner]), { code: "42501" });
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
    assert.equal((await db.query("select id from public.daily_record_store")).rows.length, snapshot.records.filter(r => r.user_id === owner).length);
    await assert.rejects(db.query("delete from public.app_user where id = $1", [owner]), { code: "42501" });
    await db.transaction(async tx => {
      await tx.query(`insert into public.daily_record_store(user_id,record_date,record_json) values ($1,'2099-01-01','{}')
        on conflict(user_id,record_date) do update set record_json = excluded.record_json`, [owner]);
      assert.equal((await tx.query(`update public.daily_record_store set record_json = '{"test":true}'
        where user_id = $1 and record_date = '2099-01-01' returning id`, [owner])).rows.length, 1);
      assert.equal((await tx.query(`delete from public.daily_record_store
        where user_id = $1 and record_date = '2099-01-01' returning id`, [owner])).rows.length, 1);
    });
    await db.exec("reset role");
    const final = (await db.query(`select encode(sha256(convert_to(
      jsonb_agg(to_jsonb(s) order by id)::text,'UTF8')),'hex') as hash from public.daily_record_store s`)).rows[0];
    assert.equal(final.hash, before.source_sha256);
    return { mode: liveLike ? "live-like" : "fresh", ...before };
  } finally {
    await db.close();
  }
}

try {
  const snapshot = privateSnapshot ? JSON.parse(await readFile(privateSnapshot, "utf8")) : fixture;
  const fresh = await verify(false, fixture);
  const live = await verify(true, snapshot);
  console.log(JSON.stringify({ fresh, live, privateSnapshotVerified: Boolean(privateSnapshot) }));
} catch (error) {
  // SQL errors from private inputs may contain raw record values.
  if (privateSnapshot) {
    console.error("Scoped restore or migration rehearsal failed.");
    process.exitCode = 1;
  } else {
    throw error;
  }
}
