import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { createServer } from "vite";
import { initializeBackfillTestDatabase, registerBackfillRun, applyAndReconcileBackfillRow, retryFailedBackfillRows } from "./backfill-db.mjs";
import { normalizedRecordFixture, normalizedUserId, normalizedDate, fixtureId } from "../src/app/testing/normalizedRecordFixture.ts";

const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false }, appType: "custom" });
const db = new PGlite();
try {
  const { backfillChecksums, tableNames } = await server.ssrLoadModule("/src/legacy/localStorage/backfillPlan.ts");
  const { mapNormalizedDailyRecord } = await server.ssrLoadModule("/src/app/dailyRecordNormalizedReadMapper.ts");
  const owner = normalizedUserId;
  const foreign = "20000000-0000-4000-8000-000000000001";
  const aggregate = mapNormalizedDailyRecord(normalizedRecordFixture(), { userId: owner, date: normalizedDate });
  const run = { id: randomUUID(), scope: "a".repeat(64), target: "isolated-pglite" };
  const makeRow = async (id, record) => ({
    id, owner, kind: "cloud", date: record.daily_record.record_date, record,
    sourceChecksum: "b".repeat(64), checksums: await backfillChecksums(record),
  });
  const row = await makeRow(fixtureId(888), aggregate);
  const apply = input => applyAndReconcileBackfillRow(db, run, input, mapNormalizedDailyRecord, backfillChecksums);
  const counts = async () => Promise.all(tableNames.map(async table =>
    (await db.query(`select count(*)::integer as n from public.${table}`)).rows[0].n));
  await initializeBackfillTestDatabase(db);
  await db.query("insert into auth.users(id) values ($1), ($2)", [owner, foreign]);
  await db.query("insert into public.app_user(id) values ($1)", [owner]);
  await db.query("insert into public.daily_record_store(id,user_id,record_date,record_json) values ($1,$2,$3,$4::jsonb)",
    [row.id, owner, row.date, JSON.stringify(aggregate)]);
  const source = (await db.query("select to_jsonb(s) as source from public.daily_record_store s")).rows;
  await registerBackfillRun(db, run, [row]);
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
  await assert.rejects(db.query("select * from migration_private.backfill_row"), { code: "42501" });
  await assert.rejects(db.query("select migration_private.apply_backfill_row($1,$2,$3,$4::jsonb)",
    [run.id, row.id, run.scope, JSON.stringify(aggregate)]), { code: "42501" });
  await assert.rejects(db.query("select migration_private.write_normalized($1::jsonb,$2,true)",
    [JSON.stringify(aggregate), owner]), { code: "42501" });
  const rpc = record => db.query("select public.save_daily_record_normalized($1::jsonb)", [JSON.stringify(record)]);
  const missingOwner = structuredClone(aggregate);
  delete missingOwner.daily_record.user_id;
  await assert.rejects(rpc(missingOwner), { code: "42501" });
  const forgedOwner = structuredClone(aggregate);
  forgedOwner.daily_record.user_id = foreign;
  await assert.rejects(rpc(forgedOwner), { code: "42501" });
  const missingParent = structuredClone(aggregate);
  delete missingParent.meals[0].food_items[0].meal_record_id;
  await assert.rejects(rpc(missingParent), { code: "22023" });
  await db.exec("reset role");
  assert.ok((await counts()).every(n => n === 0));

  const tampered = structuredClone(row);
  tampered.record.weights[0].weight = 12;
  assert.equal((await apply(tampered)).reason, "sqlstate_22023");
  assert.ok((await counts()).every(n => n === 0));

  await db.exec(`
    create function public.inject_backfill_failure() returns trigger language plpgsql as $$
    begin raise exception 'fixture failure' using errcode = 'P0001'; end $$;
    create trigger fail_child before insert on public.set_item
      for each row execute function public.inject_backfill_failure();
  `);
  assert.deepEqual(await apply(row), { status: "failed", reason: "sqlstate_P0001" });
  assert.ok((await counts()).every(n => n === 0));
  assert.equal((await db.query("select status from migration_private.backfill_row")).rows[0].status, "failed");
  await db.exec("drop trigger fail_child on public.set_item");

  await assert.rejects(retryFailedBackfillRows(db, run, [], mapNormalizedDailyRecord, backfillChecksums), /retry_source_mismatch/);
  assert.equal((await retryFailedBackfillRows(db, run, [row], mapNormalizedDailyRecord, backfillChecksums))[0].status, "applied");
  assert.deepEqual(await retryFailedBackfillRows(db, run, [row], mapNormalizedDailyRecord, backfillChecksums), []);
  const after = await counts();
  assert.deepEqual(after, [1, 2, 1, 2, 4, 4, 0, 2, 4, 8]);
  assert.equal((await apply(row)).status, "already_applied");
  assert.deepEqual(await counts(), after);
  const ledger = (await db.query("select status, attempts, reason from migration_private.backfill_row")).rows[0];
  assert.deepEqual(ledger, { status: "applied", attempts: 3, reason: null });
  assert.equal((await db.query("select count(*)::integer as n from public.food_item where food_amount is null and food_calorie is null")).rows[0].n, 4);

  // A real database precision conversion must fail reconciliation and roll back.
  const other = {
    ...aggregate, daily_record: { ...aggregate.daily_record, id: fixtureId(999), record_date: "2026-11-04" },
    meals: [], wellness: null, exercise_sessions: [],
    weights: [{ ...aggregate.weights[0], id: fixtureId(998), daily_record_id: fixtureId(999), weight: 70.123 }],
  };
  const otherRow = await makeRow(fixtureId(997), other);
  const otherRun = { ...run, id: randomUUID() };
  await registerBackfillRun(db, otherRun, [otherRow]);
  assert.equal((await applyAndReconcileBackfillRow(db, otherRun, otherRow, mapNormalizedDailyRecord, backfillChecksums)).reason, "round_trip_checksum_mismatch");
  assert.deepEqual(await counts(), after);
  assert.deepEqual((await db.query("select to_jsonb(s) as source from public.daily_record_store s")).rows, source);

  await db.exec("set role authenticated");
  const saved = (await rpc(aggregate)).rows[0].save_daily_record_normalized;
  assert.equal(saved.id, aggregate.daily_record.id);
  assert.equal(Date.parse(saved.created_at), Date.parse(aggregate.daily_record.created_at));
  assert.notEqual(Date.parse(saved.updated_at), Date.parse(aggregate.daily_record.updated_at));
  await db.exec("reset role");
  console.log("PASS: private ledger, owner/parent, tampering, atomic failure, retry, idempotency, null drafts, precision loss, source preservation");
} finally {
  await db.close();
  await server.close();
}
