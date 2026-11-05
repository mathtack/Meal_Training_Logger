import { readFile, readdir } from "node:fs/promises";

// Build only in a caller-created, isolated PGlite database.
export async function initializeBackfillTestDatabase(db, through) {
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
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(migrations)).filter(file => file.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(file, migrations), "utf8"));
    if (file === through) break;
  }
}

export async function registerBackfillRun(db, run, rows) {
  await db.transaction(async tx => {
    await tx.query(`insert into migration_private.backfill_run(run_id, scope_checksum, target_label)
      values ($1, $2, $3)`, [run.id, run.scope, run.target]);
    for (const row of rows) {
      await tx.query(`insert into migration_private.backfill_row
        (run_id, source_id, source_kind, owner_id, record_date, record_id, source_checksum, payload_checksum)
        values ($1, $2, $3, $4, $5, $6, $7,
          encode(sha256(convert_to(($8::jsonb)::text, 'UTF8')), 'hex'))`,
      [run.id, row.id, row.kind, row.owner, row.date, row.record.daily_record.id, row.sourceChecksum, JSON.stringify(row.record)]);
    }
  });
}

// These identifiers are fixed schema names. The owner and every row ID are bound values.
async function readNormalized(tx, row) {
  const root = (await tx.query(`select to_jsonb(d) as data from public.daily_record d
    where user_id = $1 and record_date = $2`, [row.owner, row.date])).rows[0]?.data;
  if (!root) throw Error("missing_normalized_root");
  const children = async (table, parentKey, parentId) => (await tx.query(
    `select to_jsonb(r) as data from public.${table} r where user_id = $1 and ${parentKey} = $2`,
    [row.owner, parentId],
  )).rows.map(result => result.data);
  root.weight_record = await children("weight_record", "daily_record_id", root.id);
  root.wellness_record = await children("wellness_record", "daily_record_id", root.id);
  root.meal_record = await children("meal_record", "daily_record_id", root.id);
  for (const meal of root.meal_record) {
    meal.meal_attachment = await children("meal_attachment", "meal_record_id", meal.id);
    meal.food_item = await children("food_item", "meal_record_id", meal.id);
  }
  root.exercise_session = await children("exercise_session", "daily_record_id", root.id);
  for (const session of root.exercise_session) {
    session.exercise_item = await children("exercise_item", "exercise_session_id", session.id);
    for (const item of session.exercise_item) item.set_item = await children("set_item", "exercise_item_id", item.id);
  }
  return root;
}

export async function applyAndReconcileBackfillRow(db, run, row, mapRecord, checksums) {
  try {
    return await db.transaction(async tx => {
      const result = await tx.query(`select migration_private.apply_backfill_row($1,$2,$3,$4::jsonb) as status`,
        [run.id, row.id, run.scope, JSON.stringify(row.record)]);
      const actual = mapRecord(await readNormalized(tx, row), { userId: row.owner, date: row.date });
      const hash = await checksums(actual);
      if (hash.full !== row.checksums.full || hash.content !== row.checksums.content) {
        throw Error("round_trip_checksum_mismatch");
      }
      return { status: result.rows[0].status, checksum: hash.full };
    });
  } catch (error) {
    // PostgreSQL messages can include private record values. Persist a safe code only.
    const reason = error.message === "round_trip_checksum_mismatch" ? error.message
      : /^[0-9A-Z]{5}$/.test(error.code ?? "") ? "sqlstate_" + error.code : "reconciliation_failed";
    await db.query(`update migration_private.backfill_row r
      set status = 'failed', reason = $3, attempts = attempts + 1, updated_at = transaction_timestamp()
      from migration_private.backfill_run b
      where r.run_id = b.run_id and r.run_id = $1 and r.source_id = $2 and r.status <> 'applied'
        and b.scope_checksum = $4 and r.source_checksum = $5`, [run.id, row.id, reason, run.scope, row.sourceChecksum]);
    return { status: "failed", reason };
  }
}

export async function retryFailedBackfillRows(db, run, approvedRows, mapRecord, checksums) {
  const { rows } = await db.query(`select r.source_id, r.source_checksum
    from migration_private.backfill_row r join migration_private.backfill_run b using (run_id)
    where r.run_id = $1 and b.scope_checksum = $2 and b.target_label = $3 and r.status = 'failed'
    order by r.source_id`, [run.id, run.scope, run.target]);
  const retry = rows.map(failed => {
    const row = approvedRows.find(candidate => candidate.id === failed.source_id && candidate.sourceChecksum === failed.source_checksum);
    if (!row) throw Error("retry_source_mismatch");
    return row;
  });
  const results = [];
  for (const row of retry) {
    results.push(await applyAndReconcileBackfillRow(db, run, row, mapRecord, checksums));
  }
  return results;
}
