# AGENTS.md

## Purpose

このファイルは Meal & Training Logger を Agent / Codex が安全に変更するための恒久的な作業規約である。
現在地や変更履歴はここに書かない。

## Read order

Repository を変更する前に以下を読む。

1. `README.md`
2. `docs/current-state.md`
3. task-relevant code and tests
4. 必要に応じて `docs/architecture.md`, `docs/database.md`, `docs/testing.md`, `docs/system-test.md`

Chat history より Repository の現行 SSOT を優先する。

## Repository / documentation rules

- Git を version history の正本とする。
- `old/`, `backup/`, `.bak`, version-suffixed copy を履歴保存目的で作らない。
- 現行 source / docs のファイル名に履歴管理だけを目的とした version を付けない。
- 1ファイル1責務を基本とし、同じ現行情報を複数ファイルへ複製しない。
- 長い変更経緯や調査ログを通常参照する docs に蓄積しない。履歴は原則 Git に任せる。
- 未実装の要求・将来 Backlog は GitHub Issues を正とする。未確定設計を現行仕様として docs に先取りしない。
- Issue を参照する場合、docs 側には現行仕様と Issue 番号だけを必要最小限記載する。
- `node_modules` など生成依存物を commit しない。
- `.env.local`, credentials, tokens, keys, user data を commit しない。

## Git safety

- `main` を直接編集しない。
- 原則 `codex/<task-name>` branch で作業する。
- 新規 task を main から開始する場合、clean working tree と `git pull --ff-only` 成功を必須とする。
- main が dirty、fast-forward 不可、対象 branch が曖昧な場合は変更を開始しない。
- `reset --hard`, force push, history rewrite など破壊的操作は明示指示なしに行わない。
- push / PR は task または user instruction が求める場合だけ行う。

## Change discipline

基本単位:

```text
inspect references
  -> make a small change
  -> verify
  -> inspect diff
  -> commit
```

無関係な refactor を機能変更へ混ぜない。
仕様・実装・tests が食い違う場合は推測で統一せず、どれが現行 SSOT かを確認する。

## Hard-coding / external source policy

- 変更可能な業務ルール、master data、環境依存値、運用で差し替える設定値を source code に散在させない。
- 外部化が必要な値は責務に応じて config / data source / database など明示的な SSOT に置く。
- 一方、実装上不変の定数まで機械的に外部化しない。外部化は変更可能性と責務境界がある場合に行う。
- 同じ rule / master を code と外部 source の双方に重複保持しない。

## Verification

意味のある source 変更では以下を実行する。

```powershell
npm run build
$env:TZ = "Asia/Tokyo"
npm test -- --run
npm run deps:circular
npm run lint
```

最低 gate:

- build: PASS
- tests: PASS
- circular dependency: 0
- lint error count: `docs/current-state.md` の baseline から増やさない

Documentation-only change では application behavior の再検証は必須としないが、path / link / SSOT の矛盾を確認する。

## Architecture / SSOT

- Data contract: `src/domain/type.ts`
- Application use cases: `src/app/`
- Domain rules / normalization / reporting: `src/domain/`
- Auth: `src/features/auth/`
- Main input UI: `src/ui/DailyRecordForm.tsx`
- Supabase persistence: `src/app/dailyRecordSupabaseService.ts`
- Legacy localStorage reader: `src/legacy/localStorage/readLegacyDailyRecords.ts`
- DB DDL / RLS: `supabase/migrations/`
- Architecture explanation: `docs/architecture.md`
- Database explanation: `docs/database.md`
- Automated tests: co-located `*.test.ts`
- Test policy: `docs/testing.md`
- Manual system test: `docs/system-test.md`

## Supabase safety

- 現行 application persistence は `public.daily_record_store` を利用する。
- 未使用の正規化 table 群を現行 persistence とみなさない。
- live Supabase schema, RLS, Auth settings, production-like data を明示指示なしに変更・削除しない。
- schema 変更は Git-managed migration を正とし、実行前後に検証する。
- `supabase/migrations/20260902090014_current_app_baseline.sql` は空の新規 DB 用であり、既存本番 DB に実行しない。

## Skills

- 再利用可能な Agent 手順だけを `skills/<skill-name>/` に置く。
- 各 Skill の入口は原則 `SKILL.md` とする。
- 通常の product / architecture / database / test 仕様を Skill に複製しない。
- Skill は必要な既存 SSOT を参照し、自前コピーを持たない。
- Skill がまだ存在しない段階でも格納規約は `skills/README.md` を正とする。

## Current state

現在地、baseline、既知リスク、次アクションが変わった場合は `docs/current-state.md` を更新する。
過去 checkpoint を追記して肥大化させず、常に最新状態だけを保つ。
