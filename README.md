# Meal & Training Logger

毎日の体重・体調・食事・運動を1日単位で記録し、用途別のテキストレポートを生成する React / TypeScript アプリ。

PC と smartphone の両方から利用し、Supabase Auth と Supabase persistence により同一ユーザーの記録を同期できる。

## Source of truth

- アプリ version: `package.json`
- アプリのデータ契約: `src/domain/type.ts`
- 現行実装: `src/`
- 自動テスト: `src/**/*.test.ts`
- DB / persistence 概要: `docs/db/README.md`
- 手動 system test: `docs/test/system-test.md`
- 作業中の状態・次アクション: `docs/handoff.md`
- Agent 運用ルール: `AGENTS.md`

過去状態は Git history を参照する。`old/`, `backup/`, `.bak`, version 別コピーを Repository 内に原則作らない。

## Tech stack

- React 19
- TypeScript
- Vite
- Vitest
- Supabase Auth / Database
- Madge
- ESLint
- Vercel

## Current persistence

1日分のデータは `DailyRecordAggregate` として扱う。

保存先は development / production で切り替えていない。Vite の開発環境と Vercel 本番環境では同じ persistence logic が動き、実際の保存・読込経路は主にログイン状態で分岐する。

- 未ログイン: localStorage のみ保存・読込する。
- ログイン中の保存: localStorage に保存した後、Supabase `daily_record_store.record_json` にも remote 保存する。
- ログイン中の読込: Supabase を優先し、対象データが無い場合や取得できない場合は localStorage を利用する。
- Supabase 保存失敗時も、先に完了した localStorage の保存は残る。

Local:

- `src/domain/storage/dailyRecordStorage.ts`
- localStorage key: `daily_record:<ISODate>`

Supabase:

- `src/app/dailyRecordSupabaseService.ts`
- current table: `public.daily_record_store`
- `user_id + record_date` 単位で `record_json` を upsert

現行の remote persistence は正規化 RDB への行単位保存ではなく、1日分の `DailyRecordAggregate` を JSONB として保存する方式。

Supabase client は development / production を問わず初期化されるため、ローカル開発でも `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` が必要。

詳細は `docs/db/README.md` を参照する。

## Main structure

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

## Setup

Requirements:

- Node.js
- npm
- Git

Install:

```powershell
npm ci
```

Create `.env.local` locally. Do not commit it.

Required variables:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Start development server:

```powershell
npm run dev
```

## Verification

Run after meaningful changes:

```powershell
npm run build
npm test -- --run
npm run deps:circular
npm run lint
```

Repository modernization 中は既知 lint error を増やさないことを最低条件とする。現在の baseline は `docs/handoff.md` を参照する。

Dependency graph が必要な場合のみ以下を実行する。

```powershell
npm run deps:graph
```

生成された graph は設計 SSOT として扱わない。

## Development workflow

`main` を作業場所にしない。

Task 開始時:

```powershell
git status
git switch main
git pull --ff-only
git switch -c codex/<task-name>
```

既存 task branch を再開する場合:

```powershell
git switch codex/<task-name>
git pull --ff-only
```

変更は小さい単位で行い、参照確認と検証をしてから commit する。

危険な Git 操作、live Supabase schema の破壊的変更、secret の commit は行わない。

## Repository modernization

現在は ASTRAEA を常時利用可能な Codex 作業ノードにするため Repository を整理中。

目標は、chat history に依存せず README / AGENTS / handoff / code / tests だけで Agent が安全に作業開始できる状態にすること。

現在地と残タスクは `docs/handoff.md` を参照する。
