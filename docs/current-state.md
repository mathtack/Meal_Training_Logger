# Current State

更新日: 2026-09-04

## Purpose

この文書は、Agent / Codexが安全に作業開始するために必要な「現在も有効な環境・運用上の事実」だけを保持する。

進捗、Current goal、Next action、Backlog、task固有handoff、過去checkpointはここに置かない。
それらは GitHub Issues と Git history を正とする。

## Development environment

- Repository default branchは `master`。
- `master` を直接編集しない。
- 開発計画・進捗・handoffは GitHub Issues をSSOTとする。
- Parent / Epicがある場合はParent Issue単位のbranchを統合branchとする。
- Parentを持たない単独Issueは `codex/issue-<number>-<slug>` branchを使用する。
- ASTRAEAはremote development hostとして利用できる。
- Codex CLIはdoctor・設定診断・Skill / 自動化などの補助用途に利用できる。
- 作業PCやchat sessionに依存せず、Repository + GitHub Issuesから再開できる状態を維持する。

作業開始時は、対象Issueとbase / working branchを明示してから変更する。
working treeがdirty、fast-forward不可、base branchが曖昧な場合は変更開始前に停止する。

## Quality baseline

現在のbaseline:

- `npm run build`: PASS
- `TZ=Asia/Tokyo npm test -- --run`: PASS
  - 9 test files
  - 48 tests passed
- `npm run deps:circular`: PASS
  - 0 circular
- `npm run lint`: FAIL
  - 8 existing errors

最低条件:

- buildを壊さない
- testsを壊さない
- circular dependencyを発生させない
- lint errorを8から増やさない

環境固有注意:

- UTCのままtestを実行すると、固定offset時刻の表示差によりreport testが失敗することがある。
- Windows / ASTRAEAではtest前に `$env:TZ = "Asia/Tokyo"` を設定する。

## Current runtime facts

- DailyRecordの正式remote persistenceは Supabase `public.daily_record_store`。
- ログイン済みユーザーの save / load / history / delete は Supabase基準。
- read error時にlegacy localStorageを正式データとして自動fallbackしない。
- 通常runtimeは `daily_record:*` localStorageを読書きしない。
- `src/legacy/localStorage/readLegacyDailyRecords.ts` は将来migration調査用のread-only入口であり、通常runtimeから利用しない。
- 未使用の正規化10 table群は現行application persistenceではない。

詳細な現行仕様は `docs/architecture.md` と `docs/database.md` を正とする。

## Supabase safety constraints

- live Supabase schema / RLS / Auth settings / production-like dataを明示指示なしに変更・削除しない。
- schema変更はGit-managed migrationを正とする。
- `supabase/migrations/20260902090014_current_app_baseline.sql` は空の新規DB用。
- **既存本番DBにbaseline migrationを実行しない。**
- 未使用正規化tableを安全確認なしにruntime persistenceへcutoverしない。

## SSOT map

- Repository入口 / SSOT案内: `README.md`
- Agent / Codex恒久運用ルール: `AGENTS.md`
- 開発計画 / Backlog / 進捗 / STOP GATE / handoff: GitHub Issues
- Architecture: `docs/architecture.md`
- Database / persistence: `docs/database.md`
- Test policy: `docs/testing.md`
- Manual system test: `docs/system-test.md`
- Data contract: `src/domain/type.ts`
- Application source: `src/`
- DB DDL / RLS: `supabase/migrations/`
- 再利用可能なAgent手順: `skills/`
- 過去状態 / 変更履歴: Git history

## Startup checks

既存環境で作業を再開する場合:

```powershell
git status
git fetch origin
git switch <issue-or-parent-branch>
git pull --ff-only

npm run build
$env:TZ = "Asia/Tokyo"
npm test -- --run
npm run deps:circular
npm run lint
```

対象branchとGitHub Issueのcheckpointが一致していることを確認してから変更を開始する。
