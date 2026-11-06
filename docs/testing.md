# Testing

## Purpose

この文書は Meal & Training Logger の現行テスト方針と品質 gate を定義する。
具体的な手動システムテストケースは `docs/system-test.md`、自動テスト実装は `src/**/*.test.ts` を正とする。

過去 version 別 Test Plan は Git history を参照し、現行 Repository に版別コピーを保持しない。

## Automated tests

主な対象:

- legacy `daily_record:*` reader の対象選別・診断・read-only 保証
- offline legacy inventoryの原本digest / owner確認 / canonical比較 / conflict・quarantine境界（手順: `docs/legacy-inventory.md`）
- backfillのowner適用・重複・採用判断・timezone・checksum。PGliteのledger / rollback / retry / idempotency検証は `node scripts/verify-backfill-db.mjs <pglite-module>`。
- JSONB権限収束のfresh / live-like rehearsalは `node scripts/verify-jsonb-preflight.mjs <pglite-module> [private-scoped-snapshot]`。snapshot指定時は既存JSONB・profileのcountとchecksumも照合する。Auth IDは隔離DBのFK検証に使う。
- Supabase persistence service contract / query / error handling
- DailyRecordForm の認証 gate / cloud save・load・history・delete routing / localStorage 非依存
- cloud 保存前の aggregate 正規化 / ownership / timestamp
- normalized query serviceのHTTP request / result contract / history pagination
- normalized read mapperの全階層order / nullable draft / ownership / parent / union検証
- empty aggregate factory
- weight / exercise / aggregate normalizer
- DailyRecord report generation

実行:

```powershell
$env:TZ = "Asia/Tokyo"
npm test -- --run
```

固定 offset 時刻の表示差を避けるため、現在は test 前に `TZ=Asia/Tokyo` を設定する。

### Normalized database verification

`scripts/verify-normalized-query-db.mjs` は外部接続を行わず、PGliteのin-memory PostgreSQLへGit-managed migrationsと架空の2ユーザーデータを構築する。root削除から全10 tableへのcascade、別user / 別dateの保持、RLS、anon拒否、history、再削除、既存JSONBの非変更を検証する。

Node.js 22.18以上を使用する。検証依存を一時フォルダへ入れればapplicationのpackage / lockfileを変更せず実行できる。

```powershell
$dbTestDependencies = Join-Path ([IO.Path]::GetTempPath()) ('meal-logger-db-test-' + [guid]::NewGuid().ToString('N'))
npm install --prefix $dbTestDependencies --no-save --package-lock=false @electric-sql/pglite@0.5.8
node scripts/verify-normalized-query-db.mjs (Join-Path $dbTestDependencies 'node_modules/@electric-sql/pglite/dist/index.js')
node scripts/verify-cutover-mirror.mjs (Join-Path $dbTestDependencies 'node_modules/@electric-sql/pglite/dist/index.js')
```

`verify-cutover-mirror.mjs` は書込モード、所有者境界、正規化から導出したJST mirror、save/delete失敗時に両方の更新が取り消されること、JSONB経路の復旧を隔離DBで検証する。

この検証はDBのRLS / FK semanticsを確認する。PostgREST serverを起動しないため、実環境のrelationship解決・API行数上限・認証付き通信はlive適用時のsystem testで別途確認する。HTTP contract testsは実際のsupabase-js clientと架空のfetch responseを使用する。

## Quality gate

意味のある source 変更では以下を実行する。

```powershell
npm run build
$env:TZ = "Asia/Tokyo"
npm test -- --run
npm run deps:circular
npm run lint
```

最低条件:

- build を壊さない
- tests を壊さない
- circular dependency を発生させない
- lint error を `docs/current-state.md` の baseline から増やさない

## Manual system test

Supabase Auth / CRUD / RLS / multi-device など、browser と実環境を必要とする確認は `docs/system-test.md` を利用する。

特に以下を変更した場合は手動確認を検討する。

- Auth
- Supabase client / persistence
- DailyRecord save / load / delete
- RLS / schema
- localStorage fallback の有無と Supabase cloud SSOT routing

## Rules

- test case を version 別 folder に複製しない。
- 自動テストの SSOT は `src/**/*.test.ts`。
- 手動 E2E / system test の SSOT は `docs/system-test.md`。
- 現在有効な品質 baseline と環境固有の実行制約は `docs/current-state.md` に置く。
- task固有の検証結果・FAIL・再開条件はGitHub Issueへ記録し、この文書へ進捗として蓄積しない。
- 完了済み・廃止済み test plan は Git history に任せる。
