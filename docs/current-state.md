# Current State

更新日: 2026-09-03

## Purpose

この文書は作業再開用の最新 checkpoint だけを保持する。
完了済みの詳細経緯・過去状態は Git history、未実装 Backlog は GitHub Issues を参照する。

## Current goal

Meal & Training Logger を SELENA だけで開発する状態から、ASTRAEA を常時利用可能な Codex 作業ノードとして使える状態へ移行する。

最終形:

```text
Remote instruction
  -> ASTRAEA
  -> Codex CLI
  -> latest main
  -> codex/<task-name>
  -> edit / verify / commit / push or PR
```

Repository 内の README / AGENTS / docs / code / tests / migration だけで、安全に作業開始できる状態を目標とする。

## Current branch

`codex/version-name-cleanup`

`main` を直接編集しない。

Repository modernization と Supabase baseline migration は ASTRAEA bootstrap を開始できる水準まで完了している。
Doc / Agent 構成は 2026-09-03 に簡素化し、Repository 入口を root `README.md` / `AGENTS.md`、詳細仕様を flat な `docs/`、将来の再利用手順を `skills/` に分離した。

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

## Next action: ASTRAEA Bootstrap

1. ASTRAEA で Git / Node.js / Codex CLI を確認
2. Repository clone
3. `npm ci`
4. `.env.example` を基に `.env.local` を安全に設定
5. Supabase 環境変数を設定
6. build / tests / circular / lint baseline を確認
7. Vite 起動
8. Supabase Auth / save / load の実画面 smoke test

その後:

### Branch / Agent Safety E2E

- latest main 取得
- `codex/test-*` branch 作成
- Agent が README / AGENTS / current-state と task-relevant docs を読んで作業
- edit / verify / commit / push or PR
- main を直接変更しないことを確認

### Remote Instruction E2E

リモート指示から ASTRAEA / Codex が小規模 task を完了できれば移行完了。

## Non-blocking backlog

ASTRAEA移送の blocker ではない。

- lint 30 existing errors の解消
- GitHub Actions CI 導入
- `npm audit` findings の別タスク化
- normalized Supabase persistence: Issue #47

その他の未実装要求・将来機能は GitHub Issues を正とする。

## Resume commands

```powershell
git status
git switch codex/version-name-cleanup
git pull --ff-only

npm run build
$env:TZ = "Asia/Tokyo"
npm test -- --run
npm run deps:circular
npm run lint
```

baseline と差異がなければ ASTRAEA Bootstrap から再開する。
