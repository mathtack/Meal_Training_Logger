# Architecture

## Purpose

この文書は Meal & Training Logger の現行アーキテクチャと責務境界を説明する。
変更履歴、Backlog、DB DDL、詳細テストケースは扱わない。

## Application structure

```text
src/
  app/        application service / Supabase persistence
  domain/     data contract, factory, normalizer, report, local storage
  features/   cross-cutting feature such as auth
  lib/        external client setup
  ui/         DailyRecord input UI and editors
  App.tsx     application composition
  main.tsx    application entry
```

主要フロー:

```text
main.tsx
  -> App.tsx
    -> AuthPanel
    -> DailyRecordForm
      -> dailyRecordService
        -> repository / localStorage
      -> dailyRecordSupabaseService
```

## Responsibility boundaries

### Domain

`src/domain/type.ts` の `DailyRecordAggregate` をアプリ内の1日分データ契約の基準とする。
Domain layer は factory、normalization、report generation、local persistence などアプリ固有のルールを担う。

### Application

`src/app/` は use case と外部 persistence の呼出境界を担う。
Supabase remote persistence は `src/app/dailyRecordSupabaseService.ts` が担当する。

### UI

`src/ui/` は入力・表示・ユーザー操作を担う。Domain rule や persistence rule を UI に重複実装しない。

### Auth / external client

Auth は `src/features/auth/`、Supabase client 初期化は `src/lib/` が担当する。

## Persistence routing

保存先は development / production で切り替えない。主にログイン状態で分岐する。

- 未ログイン: localStorage のみ保存・読込
- ログイン中の保存: localStorage 保存後、Supabase に remote 保存
- ログイン中の読込: Supabase 優先、対象データが無い場合や取得できない場合は localStorage fallback
- Supabase 保存失敗時も、先に完了した localStorage 保存は残る

現行 remote persistence は `public.daily_record_store.record_json` へ `DailyRecordAggregate` 全体を JSONB 保存する方式。
DB構成・安全条件は `docs/database.md` を参照する。

## Design principles

- 1責務につき1つの現行 SSOT を持つ。
- UI / application / domain / persistence の責務を混在させない。
- 変更可能な業務ルールや master / configuration を source に散在させず、必要に応じて明示的な外部 SSOT へ分離する。
- 履歴管理目的の version copy を current source / docs に作らない。
- 将来設計や未実装要求は GitHub Issues で管理し、現行 architecture と混ぜない。

## Related SSOT

- Data contract: `src/domain/type.ts`
- Current source: `src/`
- DB DDL / RLS: `supabase/migrations/`
- Database explanation: `docs/database.md`
- Test policy: `docs/testing.md`
- Current work state: `docs/current-state.md`
