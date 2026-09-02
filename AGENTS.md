# AGENTS.md

## Read order

Before changing the Repository, read:

1. `README.md`
2. `docs/handoff.md`
3. task-relevant code and tests
4. `docs/db/README.md` or `docs/test/README.md` when relevant

Do not rely on chat history as the source of truth when Repository state is available.

## Repository rules

- Git is the version-history source of truth.
- Do not create `old/`, `backup/`, `.bak`, version-suffixed copies, or duplicated current specifications.
- Do not add version numbers to current source filenames or directory names only for history management.
- Keep one current SSOT per responsibility.
- Do not commit generated dependencies such as `node_modules`.
- Do not commit `.env.local`, credentials, tokens, keys, or user data.

## Git safety

- Do not edit `main` directly.
- Work on `codex/<task-name>` unless the user explicitly chooses another branch.
- Before starting a new task from main, require a clean working tree and `git pull --ff-only` success.
- Stop if main is dirty, cannot fast-forward, or the intended branch is ambiguous.
- Do not use destructive Git commands (`reset --hard`, force push, history rewrite) without explicit user instruction.
- Push / PR only when the task or user instruction calls for it.

## Change discipline

Use this cycle:

```text
inspect references
  -> make a small change
  -> verify
  -> inspect diff
  -> commit
```

Do not mix unrelated refactors into a functional change.

When specification, implementation, and tests disagree, do not guess silently. Determine which artifact is current before aligning them.

## Verification

For meaningful source changes run:

```powershell
npm run build
npm test -- --run
npm run deps:circular
npm run lint
```

Minimum modernization gate:

- build must remain PASS
- tests must remain PASS
- no circular dependency may be introduced
- lint error count must not increase from the baseline recorded in `docs/handoff.md`

Documentation-only changes do not require application behavior changes, but links and referenced paths must still be checked.

## Architecture / SSOT

- Data contract: `src/domain/type.ts`
- Application use cases: `src/app/`
- Domain rules / normalization / reporting / local persistence: `src/domain/`
- Auth: `src/features/auth/`
- Main input UI: `src/ui/DailyRecordForm.tsx`
- Supabase persistence: `src/app/dailyRecordSupabaseService.ts`
- DB overview: `docs/db/README.md`
- Automated tests: co-located `*.test.ts`
- Manual system test: `docs/test/system-test.md`

## Supabase safety

- Current application persistence uses `public.daily_record_store`.
- Do not treat unused normalized tables as the current application persistence SSOT.
- Do not modify or drop live Supabase schema, RLS, Auth settings, or production-like data without explicit user instruction.
- Schema changes should ultimately be represented by Git-managed migrations and verified after execution.

## Handoff

Update `docs/handoff.md` when a task materially changes current state, baseline, known risks, or the next action.
Keep it as the latest checkpoint rather than creating versioned handoff files.
