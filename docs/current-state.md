# Current State

更新日: 2026-09-03

## Purpose

この文書は作業再開用の最新 checkpoint だけを保持する。
完了済みの詳細経緯・過去状態は Git history、未実装 Backlog は GitHub Issues を参照する。

## Current goal

Meal & Training Logger の ASTRAEA への移送は完了している。

現在の運用形:

```text
iPhone Remote
  -> ASTRAEA 上の Codex Desktop
  -> repository / Git / tests
```

Codex CLI は doctor・設定診断・将来の Skill / 自動化などの補助用途に使用する。

Repository 内の README / AGENTS / docs / code / tests / migration だけで、安全に作業開始できる状態である。

## Repository state

Repository modernization、Supabase baseline migration、ASTRAEA bootstrap は完了している。
Doc / Agent 構成は 2026-09-03 に簡素化し、Repository 入口を root `README.md` / `AGENTS.md`、詳細仕様を flat な `docs/`、将来の再利用手順を `skills/` に分離した。

ASTRAEA への移送完了時に以下を確認済み:

- `master` は `origin/master` と同期済みで working tree は clean
- `npm ci`: PASS
- tests: 15件 PASS
- production build: PASS
- localhost 起動: PASS
- Supabase Magic Link 認証および既存データの利用: PASS

ASTRAEA では最新 `master` を正とし、通常の変更は直接作業せず `codex/<task-name>` branch で行う。

## Baseline

2026-09-02 確認済み:

- `npm run build`: PASS
- `TZ=Asia/Tokyo npm test -- --run`: PASS
  - 6 test files
  - 15 tests passed
- `npm run deps:circular`: PASS
  - 0 circular
- `npm run lint`: FAIL
  - 30 existing errors

最低条件:

- build を壊さない
- tests を壊さない
- circular dependency を発生させない
- lint error を 30 から増やさない

既知事項:

- UTC のまま test を実行すると、固定 offset 時刻の表示差により report test 2件が失敗する。
- Windows / ASTRAEA では test 前に `$env:TZ = "Asia/Tokyo"` を設定する。

## Supabase status

現行 remote persistence:

- `public.daily_record_store`
- `record_json` に `DailyRecordAggregate` 全体を JSONB 保存
- `user_id + record_date` を upsert key とする

Git-managed baseline:

- `supabase/migrations/20260902090014_current_app_baseline.sql`
- `supabase/config.toml`
- `supabase/.gitignore`

baseline は空の新規 Supabase DB 専用。
**既存本番 DB に baseline migration を実行しない。**

正規化 Supabase persistence の本実装は移送 blocker から外し、GitHub Issue #47 `Implement normalized Supabase persistence` で管理する。

既知の DB 未解決事項:

- 既存本番 DB を baseline 再実行なしで migration history へ接続する方法
- `app_user` 自動 provisioning
- live の未使用正規化10 table は RLS disabled のまま
- Supabase official local stack の `db reset` は Docker 利用可能環境で追加確認が必要

詳細は `docs/database.md` を参照する。

## Next action

ASTRAEA 上で通常の branch / Agent safety rules に従って開発を継続する。

## Non-blocking backlog

ASTRAEA移送の blocker ではない。

- lint 30 existing errors の解消
- GitHub Actions CI 導入
- `npm audit` findings の別タスク化
- normalized Supabase persistence: Issue #47

その他の未実装要求・将来機能は GitHub Issues を正とする。

## Resume commands

既存環境で再開する場合:

```powershell
git status
git switch master
git pull --ff-only

npm run build
$env:TZ = "Asia/Tokyo"
npm test -- --run
npm run deps:circular
npm run lint
```

baseline と差異がなければ通常の開発を再開する。
