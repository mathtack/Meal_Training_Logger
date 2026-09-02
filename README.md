# Meal & Training Logger

毎日の体重・体調・食事・運動を1日単位で記録し、用途別のテキストレポートを生成する React / TypeScript アプリ。
PC と smartphone の両方から利用し、Supabase Auth と Supabase persistence により同一ユーザーの記録を同期できる。

## Repository entry point

この README は Repository の入口だけを担う。詳細仕様や現在地は `docs/` に分離する。

作業開始時の基本的な参照順:

1. `README.md`
2. `AGENTS.md`
3. `docs/current-state.md`
4. タスクに応じて `docs/architecture.md` / `docs/database.md` / `docs/testing.md`
5. 対象 code / tests / migration

過去状態・変更経緯は Git history を参照する。未実装の要求・将来 Backlog は GitHub Issues を正とし、現行仕様へ先取りして複製しない。

## Source of truth

- アプリ version: `package.json`
- データ契約: `src/domain/type.ts`
- 現行実装: `src/`
- 自動テスト: `src/**/*.test.ts`
- DB DDL / RLS: `supabase/migrations/`
- 現行アーキテクチャ: `docs/architecture.md`
- DB / persistence 説明: `docs/database.md`
- テスト方針: `docs/testing.md`
- 手動 system test: `docs/system-test.md`
- 現在地・次アクション: `docs/current-state.md`
- Agent 運用ルール: `AGENTS.md`
- 再利用可能な Agent 手順: `skills/`

## Tech stack

- React 19
- TypeScript
- Vite
- Vitest
- Supabase Auth / Database
- Madge
- ESLint
- Vercel

## Setup

Requirements:

- Node.js
- npm
- Git

Install:

```powershell
npm ci
```

`.env.example` を参照して `.env.local` を作成する。`.env.local` は commit しない。

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

意味のある source 変更後は以下を実行する。

```powershell
npm run build
$env:TZ = "Asia/Tokyo"
npm test -- --run
npm run deps:circular
npm run lint
```

現在の baseline と既知事項は `docs/current-state.md` を参照する。

## Development workflow

`main` を直接編集しない。

新規 task は clean な最新 `main` から `codex/<task-name>` branch を作成する。既存 task を再開する場合は対象 branch を明示して `git pull --ff-only` する。

危険な Git 操作、live Supabase schema / Auth / data の無断変更、secret や user data の commit は行わない。詳細は `AGENTS.md` を参照する。
