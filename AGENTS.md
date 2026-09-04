# AGENTS.md

## Purpose

このファイルは Meal & Training Logger を Agent / Codex が安全に変更するための恒久的な作業規約である。
進捗、次アクション、変更履歴、task固有handoffはここに書かない。

## Read order

Repository を変更する前に以下を確認する。

1. `README.md`
2. `AGENTS.md`
3. `docs/current-state.md`
4. ユーザーから指定された GitHub Issue。Parentがある場合は Parent Issue も読む
5. Issueが参照する現行 docs / source / tests / migration

Chat historyより Repositoryの現行SSOTとGitHub Issueを優先する。
過去sessionや別PCの状態を推測で補完しない。

## Repository / documentation rules

- Gitをversion historyの正本とする。
- GitHub Issuesを開発計画、Backlog、進捗、STOP GATE、task固有handoffの正本とする。
- Repository docsは現在実装されている恒久仕様、設計、test方針、現在有効な環境・安全制約だけを持つ。
- `old/`, `backup/`, `.bak`, version-suffixed copyを履歴保存目的で作らない。
- 1ファイル1責務を基本とし、同じ現行情報を複数ファイルへ複製しない。
- 長い変更経緯やcheckpointを通常参照するdocsへ蓄積しない。
- 未実装要求や未確定設計を現行仕様としてdocsへ先取りしない。
- `node_modules`など生成依存物をcommitしない。
- `.env.local`, credentials, tokens, keys, user dataをcommitしない。

## Issue execution standard

### Issue sizing

以下に該当するIssueは、着手前にParent / Childへ分割することを原則とする。

- 独立した複数成果物・工程がある
- 複数のSTOP GATEまたはユーザー判断点が必要
- DB / UI / migrationなど複数責務を含む
- 1回の実行で安全に完結しない
- 長期間または複数sessionにまたがる可能性が高い
- 並列実行や高リスク操作を含む

既存Backlogを一括再構成しない。着手候補になった時点で規模を判定し、大規模ならJust-in-timeでParent / Child化する。

### Parent / Epic Issue

Parentは全体工程と再開点のSSOTとする。詳細な作業ログをChildから複製しない。

最低限、以下を維持する。

- Goal / Scope
- Child Issue一覧と完了状況
- 依存関係 / 実行順
- Current checkpoint
- Next action
- Blockers / Decisions
- 全体Done条件

前回のchat、Codex session、作業PCを知らなくても、Repository + Parent Issue + 次Child Issueだけで安全に再開できる状態を維持する。

### Child / Execution Issue

Childは単なる機能分類ではなく、完了時にRepositoryを安全な状態で停止できる実行単位とする。

原則として以下を持つ。

- Parent
- Objective
- Preconditions
- Scope / Scope外
- Deliverables
- Verification
- Done
- STOP GATE

1回の依頼では指定されたExecution Issueだけを実行する。
Child完了後、ユーザーの明示指示なしに次Childへ自動で進まない。

### Child completion / handoff

予定どおりChildを完了した場合は、原則として以下の順で処理する。

```text
Scope / Done確認
  -> Verification
  -> 必要な恒久docs更新
  -> commit / push
  -> Child IssueへCompletion / Handoff
  -> ParentのProgress / Current checkpoint / Next action / Blockers更新
  -> Child Issue Close
  -> STOP
```

Completion / Handoffには最低限以下を残す。

- 実施内容
- 変更ファイル
- commit / branch
- build / test / circular / lint等の検証結果
- 未実施事項
- 残課題 / リスク
- 恒久docs更新有無
- 次工程へ進める状態か

### Abnormal stop

障害、未解決事項、Scope矛盾、前提不足などで予定完了せず停止する場合:

- Child IssueはCloseしない
- Childへ停止理由、現在地、未実施事項、再開条件を残す
- ParentのCurrent checkpoint / Blockersも更新する
- 次Childへ進まない

## Git safety / branch strategy

- default branchは `master`。`master` を直接編集しない。
- destructive operation (`reset --hard`, force push, history rewrite等) は明示指示なしに行わない。
- push / PR / mergeはIssueまたはユーザー指示の範囲だけで行う。
- working treeがdirty、fast-forward不可、base branchが曖昧な場合は変更開始前に停止する。

### Parent / Epicがある場合

- Parent Issue単位のbranchを統合branchとする。
- sequentialなChild Issueは原則Parent branch上で実行し、Childごとにbranchを増やさない。
- Child完了は1つ以上のcohesive commitとIssue checkpointで表現する。
- Parent完了後にのみ、ユーザー指示に従ってdefault branchへ統合する。

命名例:

```text
codex/issue-47-cloud-ssot
```

### Standalone Issue

Parentを持たない単独Issueは `codex/issue-<number>-<slug>` を使用する。
baseは通常 `master` だが、ユーザーが明示したintegration branchがある場合はそのbranchをbaseとする。

### Child branch exceptions

以下の場合のみChild専用branchを使用してよい。

- 並列作業
- 高リスク / experimental / PoC
- 独立レビューが必要
- 個別にrevert / 採否判断したい

Child branchはParent branchをbaseとし、完了時はParent branchへ統合する。

## Change discipline

基本単位:

```text
inspect references
  -> make a small change
  -> verify
  -> inspect diff
  -> commit
```

無関係なrefactorを機能変更へ混ぜない。
仕様・実装・testsが食い違う場合は推測で統一せず、どれが現行SSOTかを確認する。
Scope外の変更が必要になった場合は理由・影響・推奨次アクションをIssueへ報告して停止する。

## Documentation update rule

恒久docsを更新するかは次で判断する。

```text
IssueをCloseした後も、現行systemを理解・安全に変更するため必要か？

YES -> README / AGENTS / docs/*.md等の適切なSSOT
NO  -> GitHub Issue / Git history
```

`docs/current-state.md` は進捗、Current goal、Next action、Backlog、過去checkpointを持たない。
現在も有効な環境、品質baseline、安全制約、作業開始時に必要なSSOT案内だけを保持する。

## Hard-coding / external source policy

- 変更可能な業務ルール、master data、環境依存値、運用で差し替える設定値をsource codeに散在させない。
- 外部化が必要な値は責務に応じてconfig / data source / databaseなど明示的なSSOTに置く。
- 実装上不変の定数まで機械的に外部化しない。
- 同じrule / masterをcodeと外部sourceの双方に重複保持しない。

## Verification

意味のあるsource変更では以下を実行する。

```powershell
npm run build
$env:TZ = "Asia/Tokyo"
npm test -- --run
npm run deps:circular
npm run lint
```

最低gate:

- build: PASS
- tests: PASS
- circular dependency: 0
- lint error count: `docs/current-state.md` のbaselineから増やさない

Documentation-only changeではapplication behaviorの再検証は必須としないが、path / link / Issue reference / SSOT / YAML syntaxの整合を確認する。

## Architecture / SSOT

- Data contract: `src/domain/type.ts`
- Application use cases: `src/app/`
- Domain rules / normalization / reporting: `src/domain/`
- Auth: `src/features/auth/`
- Main input UI: `src/ui/DailyRecordForm.tsx`
- Supabase persistence: `src/app/dailyRecordSupabaseService.ts`
- Legacy localStorage reader: `src/legacy/localStorage/readLegacyDailyRecords.ts`
- DB DDL / RLS: `supabase/migrations/`
- Architecture explanation: `docs/architecture.md`
- Database explanation: `docs/database.md`
- Automated tests: co-located `*.test.ts`
- Test policy: `docs/testing.md`
- Manual system test: `docs/system-test.md`
- Current environment / operational facts: `docs/current-state.md`
- Development plan / progress / handoff: GitHub Issues

## Supabase safety

- 現行application persistenceは `public.daily_record_store` を利用する。
- 未使用の正規化table群を現行persistenceとみなさない。
- live Supabase schema, RLS, Auth settings, production-like dataを明示指示なしに変更・削除しない。
- schema変更はGit-managed migrationを正とし、実行前後に検証する。
- `supabase/migrations/20260902090014_current_app_baseline.sql` は空の新規DB用であり、既存本番DBに実行しない。

## Skills

- 再利用可能なAgent手順だけを `skills/<skill-name>/` に置く。
- 各Skillの入口は原則 `SKILL.md` とする。
- 通常のproduct / architecture / database / test仕様をSkillへ複製しない。
- Skillは必要な既存SSOTを参照し、自前コピーを持たない。
- Skillの格納規約は `skills/README.md` を正とする。
