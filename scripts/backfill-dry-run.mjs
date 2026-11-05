import { readFile, writeFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "vite";
import { initializeBackfillTestDatabase, registerBackfillRun, applyAndReconcileBackfillRow } from "./backfill-db.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [modulePath, capturePath, cloudPath, inventoryPath, decisionPath, reportPath, ...mode] = process.argv.slice(2);
const sessionOffset = mode[0] === "--session-offset" ? mode.splice(0, 2)[1] : undefined;
const localExecute = mode[0] === "--execute-local" && mode.length === 3;
if (!reportPath || (mode.length && !localExecute) || process.argv.includes("--session-offset") && !sessionOffset) {
  console.error("Usage: node scripts/backfill-dry-run.mjs <PGlite module> <capture> <cloud> <inventory> <decisions> <private report> [--session-offset <approved offset>] [--execute-local <run UUID> <approved scope SHA-256>]");
  process.exit(1);
}

const sha = data => createHash("sha256").update(data).digest("hex");
const raw = await Promise.all([capturePath, cloudPath, inventoryPath, decisionPath].map(file => readFile(file)));
const [capture, cloud, inventory, decisions] = raw.map(data => JSON.parse(data.toString("utf8").replace(/^\uFEFF/, "")));
const output = resolve(reportPath);
const rel = relative(await realpath(root), resolve(await realpath(dirname(output)), output.slice(dirname(output).length + 1)));
if (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel)) throw Error("Report must be outside the repository");

const { PGlite } = await import(pathToFileURL(resolve(modulePath)).href);
const server = await createServer({ root, configFile: false, server: { middlewareMode: true, ws: false }, appType: "custom" });
const db = new PGlite();
try {
  const { prepareBackfill, backfillChecksums, emptyCounts, tableNames } = await server.ssrLoadModule("/src/legacy/localStorage/backfillPlan.ts");
  const { mapNormalizedDailyRecord } = await server.ssrLoadModule("/src/app/dailyRecordNormalizedReadMapper.ts");
  const { rows, excluded } = await prepareBackfill(cloud, capture, inventory, Array.isArray(decisions) ? decisions : [decisions], sessionOffset);
  const sourceDigest = raw.map(sha);
  const scope = sha(JSON.stringify({ target: "isolated-pglite", sourceDigest, sessionOffset, eligible: rows.filter(r => !r.reason).map(r => r.checksums.full) }));
  if (localExecute && (mode[2] !== scope || rows.some(row => row.reason))) throw Error("Local execution requires matching approved scope without unresolved sources");
  const run = { id: localExecute ? mode[1] : randomUUID(), scope, target: "isolated-pglite" };
  const eligible = rows.filter(row => !row.reason);
  await initializeBackfillTestDatabase(db);
  for (const owner of new Set(eligible.map(row => row.owner))) {
    await db.query("insert into auth.users(id) values ($1)", [owner]);
  }
  await registerBackfillRun(db, run, eligible);
  const expected = emptyCounts();
  const entries = [];
  for (const { record, ...row } of rows) {
    if (!row.reason) {
      const result = await applyAndReconcileBackfillRow(db, run, { ...row, record }, mapNormalizedDailyRecord, backfillChecksums);
      if (result.status === "applied") {
        for (const table of tableNames) expected[table] += row.counts[table];
        entries.push({ ...row, status: "verified", targetChecksum: result.checksum });
        continue;
      }
      row.reason = result.reason ?? "unexpected_ledger_status";
    }
    entries.push({ ...row, status: "quarantine" });
  }
  const actual = emptyCounts();
  for (const table of tableNames) actual[table] = (await db.query(`select count(*)::integer as n from public.${table}`)).rows[0].n;
  if (tableNames.some(table => expected[table] !== actual[table])) throw Error("Normalized table counts do not reconcile");
  const finalDigests = await Promise.all([capturePath, cloudPath, inventoryPath, decisionPath].map(async file => sha(await readFile(file))));
  if (finalDigests.some((value, index) => value !== sourceDigest[index])) throw Error("Source files changed during dry-run");
  const totals = {
    cloud: cloud.rows.length, legacy: capture.entries.length, excluded: excluded.length,
    verified: entries.filter(row => row.status === "verified").length,
    quarantine: entries.filter(row => row.status === "quarantine").length,
    legacyOwnerReplaced: entries.filter(row => row.status === "verified" && row.replacedLegacyOwner).length,
    sessionTimesAssignedOffset: entries.filter(row => row.status === "verified").reduce((sum, row) => sum + (row.sessionTimesAssignedOffset ?? 0), 0),
  };
  const report = { version: 1, mode: localExecute ? "execute-local" : "dry-run", run, capturedAt: cloud.capturedAt,
    sessionOffset: sessionOffset ?? null, sourceUnchanged: true, sourceDigest, totals, expected, actual, excluded, entries };
  await writeFile(output, JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ totals, expected, scope, reasons: entries.filter(row => row.reason).map(row => row.reason) }));
  if (totals.quarantine) process.exitCode = 3;
} catch {
  // Query errors may contain health data. Never print raw database errors.
  console.error("Backfill verification failed; check input shape, output path and the local migration chain.");
  process.exitCode = 1;
} finally {
  await db.close();
  await server.close();
}
