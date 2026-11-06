import { readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "vite";
import { initializeBackfillTestDatabase, registerBackfillRun, applyAndReconcileBackfillRow } from "./backfill-db.mjs";

// Generates and rehearses private SQL files. This command has no network path.
const [modulePath, capturePath, cloudPath, inventoryPath, decisionPath, restorePath, outputPath, project, sourceSha] = process.argv.slice(2);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const digestPattern = /^[a-f0-9]{64}$/;
const read = async path => {
  const bytes = await readFile(path);
  return { value: JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, "")), sha: sha(bytes) };
};
const literal = value => {
  const data = String(value);
  let tag;
  do { tag = "$q" + randomUUID().replaceAll("-", "") + "$"; } while (data.includes(tag));
  return tag + data + tag;
};
const json = value => literal(JSON.stringify(value)) + "::jsonb";
const expectedSource = `(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(s) order by id),'[]'::jsonb)::text,'UTF8')),'hex') from public.daily_record_store s)`;
const guard = (condition, error) => `if (${condition}) is distinct from true then raise exception '${error}'; end if;`;
function block(body) {
  let tag;
  do { tag = "$block" + randomUUID().replaceAll("-", "") + "$"; } while (body.includes(tag));
  return `do ${tag}\nbegin\nperform set_config('TimeZone','UTC',true);\nperform set_config('lock_timeout','5s',true);\n${body}\nend\n${tag};\n`;
}

// Use stable per-parent ordering so JSONB equality compares every persisted column.
function snapshotSql(owner, date) {
  const list = (table, alias, fk, parent, extra = "") =>
    `coalesce((select jsonb_agg(to_jsonb(${alias}) ${extra} order by ${alias}.id)
      from public.${table} ${alias} where ${alias}.${fk}=${parent}.id and ${alias}.user_id=${parent}.user_id),'[]'::jsonb)`;
  const foods = list("food_item", "f", "meal_record_id", "m");
  const attachments = list("meal_attachment", "a", "meal_record_id", "m");
  const meals = list("meal_record", "m", "daily_record_id", "d",
    `|| jsonb_build_object('food_item',${foods},'meal_attachment',${attachments})`);
  const sets = list("set_item", "st", "exercise_item_id", "i");
  const items = list("exercise_item", "i", "exercise_session_id", "e", `|| jsonb_build_object('set_item',${sets})`);
  const exercise = list("exercise_session", "e", "daily_record_id", "d", `|| jsonb_build_object('exercise_item',${items})`);
  return `(select to_jsonb(d) || jsonb_build_object('weight_record',${list("weight_record", "w", "daily_record_id", "d")},
    'wellness_record',coalesce((select jsonb_agg(to_jsonb(well)) from public.wellness_record well
      where well.daily_record_id=d.id and well.user_id=d.user_id),'[]'::jsonb),
    'meal_record',${meals},'exercise_session',${exercise})
    from public.daily_record d where d.user_id=${literal(owner)}::uuid and d.record_date=${literal(date)}::date)`;
}

async function main() {
  if (!/^[a-z0-9]{20}$/.test(project ?? "") || !digestPattern.test(sourceSha ?? "")) throw Error("invalid target or source fingerprint");
  const output = resolve(outputPath);
  const rel = relative(await realpath(root), resolve(await realpath(dirname(output)), output.slice(dirname(output).length + 1)));
  if (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel)) throw Error("output must be outside Git");
  const inputs = [capturePath, cloudPath, inventoryPath, decisionPath, restorePath];
  const data = await Promise.all(inputs.map(read));
  const [capture, cloud, inventory, decisions, backup] = data.map(d => d.value);
  if (backup.source_sha256 !== sourceSha) throw Error("source fingerprint changed");
  const { PGlite } = await import(pathToFileURL(resolve(modulePath)).href);
  const server = await createServer({ root, configFile: false, server: { middlewareMode: true, ws: false }, appType: "custom" });
  const db = new PGlite();
  try {
    const { canonicalJSON } = await server.ssrLoadModule("/src/legacy/localStorage/legacyInventory.ts");
    const archiveRows = backup.records.map(({ id, user_id, record_date, record_json }) => ({ store_id:id, user_id, record_date, record_json }));
    if (canonicalJSON(archiveRows.sort((a,b) => a.store_id.localeCompare(b.store_id))) !==
        canonicalJSON([...cloud.rows].sort((a,b) => a.store_id.localeCompare(b.store_id)))) throw Error("cloud and restore inputs differ");
    const { prepareBackfill, backfillChecksums, tableNames } = await server.ssrLoadModule("/src/legacy/localStorage/backfillPlan.ts");
    const { mapNormalizedDailyRecord } = await server.ssrLoadModule("/src/app/dailyRecordNormalizedReadMapper.ts");
    const sessionOffset = "+09:00";
    const { rows, excluded } = await prepareBackfill(cloud, capture, inventory, Array.isArray(decisions) ? decisions : [decisions], sessionOffset);
    if (!rows.length || rows.some(r => r.reason)) throw Error("quarantine must be empty");
    const run = { id: randomUUID(), target: project, scope: sha(canonicalJSON({ project, sourceSha, sessionOffset, inputs:data.map(d=>d.sha), rows:rows.map(r=>[r.id,r.sourceChecksum,r.checksums]) })) };
    const start = guard(`current_user='postgres' and ${expectedSource}=${literal(sourceSha)}`, "operator_or_source_drift");
    const files = [];
    const add = (name, sql) => files.push({ name, sql, sha256:sha(sql) });
    const counts = Object.fromEntries(tableNames.map(name=>[name,rows.reduce((n,r)=>n+r.counts[name],0)]));
    const ledgerRun = `run_id=${literal(run.id)}::uuid`;
    const seed = `insert into migration_private.backfill_run(run_id, scope_checksum, target_label)
      values (${literal(run.id)}::uuid,${literal(run.scope)},${literal(project)});`;
    const registrations = rows.map(r=>`insert into migration_private.backfill_row
      (run_id,source_id,source_kind,owner_id,record_date,record_id,source_checksum,payload_checksum)
      values (${literal(run.id)}::uuid,${literal(r.id)},${literal(r.kind)},${literal(r.owner)}::uuid,${literal(r.date)}::date,
       ${literal(r.record.daily_record.id)}::uuid,${literal(r.sourceChecksum)},encode(sha256(convert_to((${json(r.record)})::text,'UTF8')),'hex'));`);
    const empty = [...tableNames.map(t=>`not exists(select 1 from public.${t})`),"not exists(select 1 from migration_private.backfill_run)"].join(" and ");
    add("00-register.sql",block([start,guard(empty,"target_not_empty"),seed,...registrations].join("\n")));
    await initializeBackfillTestDatabase(db);
    await db.exec("set timezone='UTC'");
    await db.query("insert into auth.users(id) select value::uuid from jsonb_array_elements_text($1::jsonb)",[JSON.stringify(backup.auth_ids)]);
    await db.query("insert into public.app_user select * from jsonb_populate_recordset(null::public.app_user,$1::jsonb)",[JSON.stringify(backup.profiles)]);
    await db.query("insert into public.daily_record_store select * from jsonb_populate_recordset(null::public.daily_record_store,$1::jsonb)",[JSON.stringify(backup.records)]);
    const preview = { ...run, id: randomUUID() };
    await registerBackfillRun(db, preview, rows);
    const verification = [start];
    for (const [index,row] of rows.entries()) {
      const applied = await applyAndReconcileBackfillRow(db,preview,row,mapNormalizedDailyRecord,backfillChecksums);
      if (applied.status !== "applied") throw Error("isolated reconciliation failed");
      const select = snapshotSql(row.owner,row.date);
      const expected = (await db.query(`select ${select} as record`)).rows[0]?.record;
      if (!expected || (await backfillChecksums(mapNormalizedDailyRecord(expected,{userId:row.owner,date:row.date}))).full !== row.checksums.full) throw Error("shadow rehearsal mismatch");
      const check = guard(`${select} = ${json(expected)}`,"normalized_shadow_mismatch");
      verification.push(check);
      const apply = `perform migration_private.apply_backfill_row(${literal(run.id)}::uuid,${literal(row.id)},${literal(run.scope)},${json(row.record)});`;
      add(String(index+1).padStart(2,"0")+"-apply.sql",block([start,apply,check].join("\n")));
    }
    verification.push(guard(`(select count(*) from migration_private.backfill_row where ${ledgerRun} and status='applied')=${rows.length}`,"ledger_count_mismatch"));
    for (const [name,count] of Object.entries(counts)) verification.push(guard(`(select count(*) from public.${name})=${count}`,"entity_count_mismatch"));
    add("99-verify.sql",block(verification.join("\n")));
    // Replay the exact artifacts in the same disposable database from an empty target.
    await db.exec("delete from public.daily_record; delete from migration_private.backfill_row; delete from migration_private.backfill_run;");
    await db.exec(files[0].sql);
    const first = files[1].sql;
    const broken = first.replace("raise exception 'normalized_shadow_mismatch'; end if;", "raise exception 'normalized_shadow_mismatch'; end if; raise exception 'injected_failure';");
    try { await db.exec(broken); throw Error("failure not detected"); }
    catch (error) { if (error.message !== "injected_failure") throw error; }
    if ((await db.query("select count(*)::int as n from public.daily_record")).rows[0].n !== 0) throw Error("partial aggregate persisted");
    for (const file of files.slice(1)) await db.exec(file.sql);
    await db.exec(files[1].sql);
    await db.exec(files.at(-1).sql);
    const current = await Promise.all(inputs.map(read));
    if (current.some((d,i)=>d.sha!==data[i].sha)) throw Error("inputs changed");
    await mkdir(output);
    for (const file of files) await writeFile(resolve(output,file.name),file.sql,{flag:"wx"});
    const manifest = { run, sourceSha, cloud:cloud.rows.length, legacy:rows.filter(r=>r.kind==="legacy").length,
      records:rows.length, excluded:excluded.length, counts, rehearsed:true,
      files:files.map(({name,sha256})=>({name,sha256})) };
    const content = JSON.stringify(manifest,null,2);
    await writeFile(resolve(output,"manifest.json"),content,{flag:"wx"});
    console.log(JSON.stringify({ ...manifest, files:files.length, manifestSha256:sha(content) }));
  } finally {
    await db.close();
    await server.close();
  }
}

try { await main(); } catch {
  // Database errors can quote private SQL statements and values.
  console.error("Private bundle preparation or rehearsal failed.");
  process.exitCode = 1;
}
