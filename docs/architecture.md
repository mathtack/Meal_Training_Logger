# Architecture

## Purpose

この文書は Meal & Training Logger の現行アーキテクチャと責務境界を説明する。
変更履歴、Backlog、DB DDL、詳細テストケースは扱わない。

## Application structure

```text
src/
  app/        application service / Supabase persistence
  domain/     data contract, factory, normalizer, report
  features/   cross-cutting feature such as auth
  legacy/     explicit read-only input for future migration
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
      -> dailyRecordCloud
      -> dailyRecordSupabaseService
```

## Responsibility boundaries

### Domain

`src/domain/type.ts` の `DailyRecordAggregate` をアプリ内の1日分データ契約の基準とする。
Domain layer は factory、normalization、report generation などアプリ固有のルールを担う。

### Application

`src/app/` は use case と外部 persistence の呼出境界を担う。
Supabase remote persistence は `src/app/dailyRecordSupabaseService.ts` が担当する。

### UI

`src/ui/` は入力・表示・ユーザー操作を担う。Domain rule や persistence rule を UI に重複実装しない。

### Auth / external client

Auth は `src/features/auth/`、Supabase client 初期化は `src/lib/` が担当する。

### Legacy input

`src/legacy/localStorage/readLegacyDailyRecords.ts` は、将来の明示的な migration 処理が
`daily_record:<ISODate>` を調査するための読み取り専用入口である。通常の application runtime
から import せず、書込・削除・clear・正規化・クラウドへの自動昇格は行わない。
Supabase Auth の session storage は別責務であり、この reader の対象にも変更対象にも含めない。

## Persistence routing

保存先は development / production で切り替えない。`DailyRecordForm` の永続化は
ログイン済みユーザーの Supabase に限定する。

- Auth 確認中は DailyRecord の入力・永続化 UI を表示しない。
- 未ログイン時はログインを要求し、保存・読込・履歴・削除を提供しない。
- ログイン中の保存・読込・履歴・削除は `dailyRecordSupabaseService` を利用する。
- read の `not_found` はその日付の新規レコード、`error` は読込失敗として扱う。
- read error 時に localStorage を正式データとして自動採用しない。
- save / delete の成功結果を受け取った後だけ、画面の保存済み状態・履歴を更新する。

クラウド保存前の aggregate 正規化、認証ユーザー・対象日付の適用、最終保存時刻の付与は
`src/app/dailyRecordCloud.ts` が担当する。

旧 localStorage repository / service / write storage は廃止済み。browser に存在する
`daily_record:<ISODate>` は削除せず、明示的な legacy reader に渡した場合だけ読み取れる。
この reader は `DailyRecordForm` を含む通常 runtime route から参照しない。

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
- Legacy migration input: `src/legacy/localStorage/readLegacyDailyRecords.ts`
- DB DDL / RLS: `supabase/migrations/`
- Database explanation: `docs/database.md`
- Test policy: `docs/testing.md`
- Current work state: `docs/current-state.md`
