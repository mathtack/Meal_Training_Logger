# Meal & Training Logger

毎日の体重・体調・食事・運動を1日単位で記録し、用途別のテキストレポートを生成する React / TypeScript アプリ。
PC と smartphone の両方から利用し、Supabase Auth と Supabase persistence により同一ユーザーの記録を同期できる。

## Repository entry point

この README は Repository の入口とSSOT案内だけを担う。
詳細な恒久仕様は `docs/`、開発計画・Backlog・進捗・handoffは GitHub Issues に分離する。

作業開始時の基本的な参照順:

1. `README.md`
2. `AGENTS.md`
3. `docs/current-state.md`
4. 指定された GitHub Issue。Parentがある場合はParent Issueも確認
5. Issueに応じて `docs/architecture.md` / `docs/database.md` / `docs/testing.md` / source / tests / migration

過去状態・変更経緯は Git history を参照する。
未実装要求、将来計画、優先順位、Current checkpoint、Next action、task固有handoffは GitHub Issues を正とし、Repository docsへ重複保持しない。

## Source of truth

- アプリ version: `package.json`
- データ契約: `src/domain/type.ts`
- 現行実装: `src/`
- 自動テスト: `src/**/*.test.ts`
- DB DDL / RLS: `supabase/migrations/`
- 現行アーキテクチャ: `docs/architecture.md`
- DB / persistence説明: `docs/database.md`
- テスト方針: `docs/testing.md`
- 手動system test: `docs/system-test.md`
- 現在有効な環境・運用・品質baseline・安全制約: `docs/current-state.md`
- Agent / Codex恒久運用ルール: `AGENTS.md`
- 開発計画 / Backlog / 進捗 / STOP GATE / handoff: GitHub Issues
- 再利用可能なAgent手順: `skills/`

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

`.env.example` を参照して `.env.local` を作成する。`.env.local` はcommitしない。

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

意味のあるsource変更後は以下を実行する。

```powershell
npm run build
$env:TZ = "Asia/Tokyo"
npm test -- --run
npm run deps:circular
npm run lint
```

現在の品質baselineと環境固有注意事項は `docs/current-state.md` を参照する。

## Development workflow

default branchは `master`。`master` を直接編集しない。

Parent / Epicがある開発では、原則としてParent Issue単位のbranchを統合branchとする。
sequentialなChild Issueは同じParent branch上で実行し、Child完了ごとにcommit・Issue handoff・Parent checkpoint更新・Child Closeで停止する。

Child専用branchは並列、高リスク、experimental、独立レビューや個別revertが必要な場合のみ使用する。
Parentを持たない単独Issueは `codex/issue-<number>-<slug>` branchを使用する。

危険なGit操作、live Supabase schema / Auth / dataの無断変更、secretやuser dataのcommitは行わない。
詳細なIssue遂行・branch・STOP・handoffルールは `AGENTS.md` を参照する。
