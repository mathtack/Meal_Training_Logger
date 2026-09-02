# Test Strategy

## Purpose

このディレクトリは、Meal & Training Logger の現行テスト方針と手動システムテストを管理する。

過去バージョン別の Test Plan は Git 履歴を参照し、現行 Repository には版別コピーを保持しない。

## Automated tests

自動テストは実装と同じ `src/` 配下の `*.test.ts` を正とする。

主な対象:

- DailyRecord service / localStorage I/O
- empty aggregate factory
- weight / exercise / aggregate normalizer
- DailyRecord report generation

実行:

```powershell
npm test -- --run
```

Repository modernization 中は、変更前後で以下も確認する。

```powershell
npm run build
npm test -- --run
npm run deps:circular
npm run lint
```

既知の lint baseline や一時的な品質課題は `docs/handoff.md` に記録する。

## Manual system test

Supabase Auth / CRUD / RLS / マルチデバイスなど、ブラウザと実環境を必要とする確認は `system-test.md` を利用する。

特に以下を変更した場合は手動確認を行う。

- Auth
- Supabase client / persistence
- DailyRecord save / load / delete
- RLS / schema
- localStorage と Supabase の優先順位

## Rule

- テストケースをバージョン別フォルダに複製しない。
- 現行の自動テストは `*.test.ts`、現行の手動E2Eは `system-test.md` を SSOT とする。
- 完了済み・廃止済みテスト計画は Git history に任せる。
