# Testing

## Purpose

この文書は Meal & Training Logger の現行テスト方針と品質 gate を定義する。
具体的な手動システムテストケースは `docs/system-test.md` を参照する。自動テストは `20_module/` の実装に隣接する `*.test.ts`・`*.test.tsx` を使用する。

過去 version 別 Test Plan は Git history を参照し、現行 Repository に版別コピーを保持しない。

## Automated tests

主な対象:

- legacy `daily_record:*` reader の対象選別・診断・read-only 保証
- offline legacy inventoryの原本digest / owner確認 / canonical比較 / conflict・quarantine境界（手順: `docs/legacy-inventory.md`）
- Supabase persistence service contract / query / error handling
- AuthProvider / useAuth のセッション復元・認証状態更新・購読解除
- DailyRecordForm の認証 gate / cloud save・load・history・delete routing / localStorage 非依存
- WeightEditor の確定値・下書き分離 / 正規化・IME・時刻往復・クリア／再読込／保存競合の境界
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

`scripts/verify-jsonb-retirement.mjs` は PGlite の in-memory PostgreSQL に Git 管理の migration と合成データを適用し、空 DB の初期化と旧構成からの更新を検証する。外部 DB への接続は行わない。

Node.js 22.18以上を使用する。検証依存を一時フォルダへ入れればapplicationのpackage / lockfileを変更せず実行できる。

```powershell
$dbTestDependencies = Join-Path ([IO.Path]::GetTempPath()) ('meal-logger-db-test-' + [guid]::NewGuid().ToString('N'))
npm install --prefix $dbTestDependencies --no-save --package-lock=false @electric-sql/pglite@0.5.8
node scripts/verify-jsonb-retirement.mjs (Join-Path $dbTestDependencies 'node_modules/@electric-sql/pglite/dist/index.js')
```

正規化の保存・読込・削除、履歴降順、`food_material` を含む関連行のカスケード、同じ所有者の別日と別所有者の同日の保持を検証する。正規化10表の所有者分離と匿名アクセス拒否、直接 DELETE・モード操作・内部処理の権限、profile と不正 payload の境界、凍結・失敗時の原子性も確認する。

旧 JSONB の table／column 権限の拒否と、自動更新が停止し、旧コピーを削除しても正規化の読込・保存が機能することを確認する。

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
- 自動テストは対応する実装のそばに置く。
- 手動 E2E / system test の SSOT は `docs/system-test.md`。
- 現在有効な品質 baseline と環境固有の実行制約は `docs/current-state.md` に置く。
- task固有の検証結果・FAIL・再開条件はGitHub Issueへ記録し、この文書へ進捗として蓄積しない。
- 完了済み・廃止済み test plan は Git history に任せる。
