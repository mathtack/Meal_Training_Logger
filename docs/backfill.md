# Normalized backfill runbook

The current application stores its records in `public.daily_record_store`. This procedure stages a copy in the normalized schema. It preserves the JSONB and browser originals. It does not enable the normalized application routes.

## Inputs and dry-run

- Obtain one complete, owner-scoped cloud snapshot in a single read-only statement. Export `capturedAt`, `complete`, and rows with `store_id` (the store primary key), `user_id`, `record_date`, and `record_json`. Verify the returned array length against the count from the same statement.
- Use the verified legacy capture, its comparison report and the resolved decision list from [legacy inventory](legacy-inventory.md). Keep these files and any new report outside Git. For each run, confirm device/profile/origin, exact cloud project and account, and any excluded source.
- The outer store owner is authoritative. Replace `TODO_USER_ID` and record that fact. A different owner, an invalid date or UUID, inconsistent parent, invalid value, duplicate identity, changed conflict hash, or unknown decision blocks the affected records.
- Normalize order using the existing aggregate rules. Hash complete and content records separately. Reconcile timestamp instants with microseconds, preserve required food nulls, and treat omitted optional fields and their SQL null equivalent the same. Verify both hashes and row counts against the actual reconstructed aggregate.
- The legacy exercise editor stored start/end as clock times without an offset. These records require a confirmed source offset. Supply `--session-offset +09:00` only for a scope where the user has confirmed JST, or to produce a clearly labelled hypothetical report. Keep the original string in the source archive. Other timestamp fields still require an explicit offset. Check exercise clock-time display during shadow comparison and cutover testing.

Install PGlite outside the repository as described in [testing](testing.md), then run from the repository root:

```powershell
node scripts/backfill-dry-run.mjs <pglite-module> <legacy-capture> <cloud-snapshot> <inventory-report> <decision-file> <private-report>
```

The command uses an in-memory database without a remote connection. Each verified row is staged and read back in the disposable database. Reports are new files, containing the input and scope SHA-256 hashes, source status and reasons, expected and actual entity counts, and reconciliation checksums. The command verifies input files are unchanged. Exit 0 means all selected rows verified, exit 3 means the report has quarantine rows, and exit 1 means a verification or execution error.

`--execute-local <run-uuid> <approved-scope-sha256>` runs the same registered flow in isolation with the explicitly approved scope and run ID. The optional offset flag precedes execute mode. The CLI has no production connection path. `scripts/backfill-db.mjs` exposes transaction, ledger registration and failed-row retry operations for local validation. A separate production invocation with approved connection, scope, target identity and backup evidence must be reviewed before use.

## Prepare an operator run

Use the source SHA-256 from a fresh live read and the scoped restore snapshot for the same contents. This generator is for scopes with the approved JST exercise time decision.

```powershell
node scripts/prepare-backfill-run.mjs <pglite-module> <legacy-capture> <cloud-snapshot> <inventory-report> <decision-file> <restore-snapshot> <new-private-directory> <project-ref> <live-source-sha256>
```

The generator reconciles each aggregate in PGlite, then replays the exact SQL files and tests rollback and idempotency. Keep the resulting directory outside the repository because its SQL contains record values. The manifest binds the project, input hashes, source fingerprint, eligible row checksums, expected counts and exact SQL file hashes.

After live approval, check the CLI's linked project ref, migration history, source fingerprint, manifest digest and all file digests. Use the approved directory with `supabase db query --linked --workdir <verified-workdir> --file <approved-file>`. Execute `00-register.sql` once, then each numbered apply file in order, and finish with `99-verify.sql`. Each apply file runs the existing operator routine and compares its full normalized projection in one database transaction. The last file reads the target again and checks every projection and entity count. Stop on any failure. Keep CLI error details private because they can contain SQL and record values. Inspect the registered run and preserve applied rows before deciding whether to retry a pending row.

## Ledger and reconciliation

`migration_private.backfill_run` identifies the approved run, target label and scope SHA-256. `migration_private.backfill_row` registers a stable source ID, source kind, target owner/date/root ID, source and payload checksums, status, attempt count and safe failure reason. Register the exact approved manifest before applying rows. Store logs and reports privately. Record quarantine in the dry-run report and exclude it from the executable manifest.

The public RPC and backfill use one normalized writer. The public RPC authenticates through `auth.uid()` with RLS. The operator path uses an invoker routine in the private schema, a direct `postgres` connection and an explicit owner from the approved manifest. It preserves source timestamps. Keep `migration_private` out of Data API exposed schemas. Verify browser roles cannot execute the operator routine or access ledger tables.

For each row, lock its ledger entry and check scope, identity and payload checksum. Apply the aggregate and compare the read mapper's reconstruction within the same short transaction. On mismatch or error, roll back the transaction and record a safe code separately. Retry only ledger rows marked `failed` against the same approved source and checksum. If an applied row is submitted again, reconcile it against the recorded source. The operator path refuses to overwrite a pre-existing normalized root. A changed source needs a new reviewed plan and separate delta or repair procedure.

## Live preflight and recovery

1. Confirm the target project, migration SHA, source and target scope, accepted quarantine dispositions and exact report checksum. Check migration history, normalized row counts, owners, constraints, RLS, grants and current JSONB runtime. Verify that every owner exists in Auth and the application's user table. Re-export the cloud snapshot near execution and re-run the offline plan if source content changed.
2. Before writing, capture the backup ID or timestamp and record its restore point and retention. Verify restoration in an isolated database, including Auth-to-app ownership, source row counts and checksums. Keep a separately protected JSONB export. Require explicit approval of target project, migration list, eligible manifest, backup and rollback conditions.
3. On an existing database verify the baseline history entry and hardening migration. Apply the normalized schema contract, atomic write RPC, private ledger, then the JSONB runtime access migration before exposing any normalized UI path. Do not run the new-database baseline on an existing project. Verify empty target, nullability, foreign keys, RPC and ledger grants, unauthorized caller denial, JSONB CRUD and the source checksum again.
4. Apply only the approved run with one row per transaction. Pause on source drift, failed reconciliation, unexpected roots or permission differences. Compare total and per-owner root and entity counts, check foreign keys and compare full and content hashes for every applied row. Verify the JSONB source snapshot is unchanged for that run or record concurrent runtime writes as a new delta scope.
5. Shadow-compare normalized reads with the JSONB reference and review any deltas before switching reads or writes. Freeze writes during the final delta and reconcile again. Review shadow failures, time display, rollback mirror behavior and the recovery decision before enabling cutover.
6. On failed validation, keep the application on the JSONB path and stop the run. Preserve ledger and evidence. Use an approved, run-scoped repair or restore into an isolated project for comparison. A live point-in-time restore affects all data, including JSONB writes made after the restore point. Review those writes and obtain explicit approval before a live restore. After cutover, follow the separately verified rollback plan and reconcile the JSONB mirror before changing the application route.
