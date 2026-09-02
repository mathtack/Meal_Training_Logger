# Testing

## Purpose

この文書は Meal & Training Logger の現行テスト方針と品質 gate を定義する。
具体的な手動システムテストケースは `docs/system-test.md`、自動テスト実装は `src/**/*.test.ts` を正とする。

過去 version 別 Test Plan は Git history を参照し、現行 Repository に版別コピーを保持しない。

## Automated tests

主な対象:

- DailyRecord service / localStorage I/O
- empty aggregate factory
- weight / exercise / aggregate normalizer
- DailyRecord report generation

実行:

```powershell
$env:TZ = "Asia/Tokyo"
npm test -- --run
```

固定 offset 時刻の表示差を避けるため、現在は test 前に `TZ=Asia/Tokyo` を設定する。

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
- localStorage と Supabase の優先順位

## Rules

- test case を version 別 folder に複製しない。
- 自動テストの SSOT は `src/**/*.test.ts`。
- 手動 E2E / system test の SSOT は `docs/system-test.md`。
- 現在の baseline や一時的な既知問題は `docs/current-state.md` に置く。
- 完了済み・廃止済み test plan は Git history に任せる。
