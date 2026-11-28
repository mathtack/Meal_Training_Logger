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

// These identifiers are fixed schema names. The owner and every row ID are bound values.
export async function readNormalized(tx, row) {
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
