# Current State

更新日: 2026-11-28

## Purpose

この文書は、Agent / Codexが安全に作業開始するために必要な「現在も有効な環境・運用上の事実」だけを保持する。

進捗、Current goal、Next action、Backlog、task固有handoff、過去checkpointはここに置かない。
それらは GitHub Issues と Git history を正とする。

## Development environment

- GitHub の既定ブランチは `master`。作業ブランチと開始手順は [開発標準](../00_docs/development_standard.md) を参照する。
- ASTRAEA は利用可能なリモート開発ホストの一つ。
- Codex CLI は設定診断や Skill などの補助用途に利用できる。
- Vercel プロジェクトの Node.js 設定は 24.x。ローカル検証でも同じメジャーバージョンを利用できる。

## Quality baseline

現在のbaseline:

- `npm run build`: PASS
- `TZ=Asia/Tokyo npm test -- --run`: PASS
  - 17 test files
  - 115 tests passed
- `npm run deps:circular`: PASS
  - 0 circular
- `npm run lint`: PASS
  - 0 errors

最低条件:

- buildを壊さない
- testsを壊さない
- circular dependencyを発生させない
- lint errorを0に維持する

環境固有注意:

- UTCのままtestを実行すると、固定offset時刻の表示差によりreport testが失敗することがある。
- Windows / ASTRAEAではtest前に `$env:TZ = "Asia/Tokyo"` を設定する。

## Current runtime facts

- Vercel 本番は正規化版を使用する。以前の世代を再ビルドする際の設定は [本番運用](../00_docs/product_operations.md#アプリ切り戻しと-db-異常) を参照する。
- Supabase本番は `20261125212008_retire_jsonb_runtime.sql` を適用済みで、DB書込モードは `normalized`。DailyRecordは正規化テーブルに保存する。旧JSONBの自動更新とブラウザ向けAPI権限は退役済み。
- 本番の `public.daily_record_store` は空の旧テーブル。運用は正規化版を対象とする。
- ログイン済みユーザーの save / load / history / delete は Supabase基準。
- read error時にlegacy localStorageを正式データとして自動fallbackしない。
- 通常runtimeは `daily_record:*` localStorageを読書きしない。
- `20_module/00_common/src/legacy/localStorage/readLegacyDailyRecords.ts` は将来migration調査用のread-only入口であり、通常runtimeから利用しない。

詳細な現行仕様は `docs/architecture.md` と `docs/database.md` を正とする。

## Supabase safety constraints

- 既存本番 DB の migration history には `20260902090014` を履歴だけ接続し、`20260907121742` の deny-by-default migration を適用済み。空の新規 DB 用の baseline SQL 自体は既存本番 DB で実行していない。
- 本番の配信、Supabase の変更、書込モードの変更、切り戻しは [本番運用](../00_docs/product_operations.md) の承認・安全条件に従う。

作業の参照先一覧は [README](../README.md) を参照する。
