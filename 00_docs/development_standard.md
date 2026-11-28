# 開発標準

Issue は要求・承認・進捗と再開点、Git は成果物と変更履歴の正本。現行機能は [機能索引](function_catalog.md)、本番操作は [本番運用](product_operations.md)、環境と品質 baseline は [現行環境](../docs/current-state.md) を参照する。

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

起票済みの実行 Child は GitHub のサブ Issue に追加し、実行順と依存関係を Parent の計画に記載する。

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

### 主担当・レビュー・引き継ぎ

- 実行 Issue に主担当 Agent を1名記録する。開始・再開時は実行指示、主担当、最新 checkpoint、作業ブランチと未commit差分の有無を照合する。担当が未確定・競合している場合は着手前に確認する。
- 担当を交代するときは、作業ブランチ・commit、未commit差分の有無と所在、検証結果、残件、再開条件を実行 Issue に記録する。後任は実際の Git 状態と照合してから再開する。
- レビュー依頼時は対象差分、受入条件、検証結果を Issue に示す。独立レビューが必要な場合は主担当以外が担当し、再現条件や仕様との不一致を Issue に記録する。レビュー担当の追加は主担当の変更と別に扱う。
- 並行作業は別の作業ツリーと承認されたブランチを使用する。共有設定やファイルへの書き込みは担当と順序を先に合意し、Agent 固有の設定・資格情報を他の担当と共有する必要がある場合は承認された経路を使う。
- 承認は対象 Issue の Scope・STOP GATE と [本番運用](product_operations.md) に従う。既存の動作・公開契約を変える場合は、差分と受入条件を明確にして変更の判断を受ける。

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
- 完了済みIssueの不要branchは、子Issueの成果が親branchに、親Issueの成果が `master` に完全に取り込まれている場合に整理できる。
- 整理前に `git fetch --prune origin` で最新化し、統合先にないcommitが対象branchに残っていないことを確認する。working treeをcleanにし、対象branch以外をcheckoutする。
- 整理は `git branch -d` または取り込みを確認済みのremote branchに対する通常の削除を用いる。条件を満たすremote branchの整理はpush制限の例外とする。取り込みを確認できないbranchは保留する。

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

[現行環境](../docs/current-state.md) は進捗、Current goal、Next action、Backlog、過去checkpointを持たない。
現在も有効な環境、品質baseline、安全制約、作業開始時に必要なSSOT案内だけを保持する。

## Hard-coding / external source policy

- 変更可能な業務ルール、master data、環境依存値、運用で差し替える設定値をsource codeに散在させない。
- 外部化が必要な値は責務に応じてconfig / data source / databaseなど明示的なSSOTに置く。
- 実装上不変の定数まで機械的に外部化しない。
- 同じrule / masterをcodeと外部sourceの双方に重複保持しない。

## Verification

### 作業環境の再現

- 作業開始時に対象リポジトリ、ブランチ、起点 commit、Git・Node.js・npm のバージョンを確認する。Node.js は依存パッケージの要件と [現行環境](../docs/current-state.md) を確認する。
- 対象ツリーが clean であることを確認し、`git fetch origin`、対象ブランチへの切替と `git pull --ff-only` で最新の起点と照合する。新規ブランチは Issue で確定した起点から作成する。
- `npm ci` で lockfile の依存を導入する。実行時に必要な値の名前は [環境設定例](../.env.example) に従い、ローカルの実値は `.env.local` に置く。検証のために本番資格情報やユーザーデータを引き継ぐ必要がある場合は、対象と権限を [本番運用](product_operations.md) で確認する。
- ローカル・リモートとも同じコマンド、時刻条件、baseline で検証する。作業開始時に既知の状態を照合し、差がある場合は環境、バージョン、実行コマンドと実測値を Issue に記録する。

### 変更後の品質ゲート

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
- lint error count: [現行環境](../docs/current-state.md) のbaselineから増やさない

Documentation-only changeではapplication behaviorの再検証は必須としないが、path / link / Issue reference / SSOT / YAML syntaxの整合を確認する。

## 作業フォルダと保全

- 生成したログ、検証出力、レビュー下書きなどの一時成果物はリポジトリ直下の `workspace/Issue-<番号>/` に置く。ルートの [Git 除外設定](../.gitignore) がこの領域を除外する。commit 前にステージ済みファイルを確認し、対象を強制追加しない。
- 恒久仕様・ソース・継続して使うテストや合成 fixture は、対象の責務に従い Git 管理する。共有に必要な一時成果物の所在、保持理由、再開・整理条件は Issue に記録し、作業フォルダを履歴の正本にしない。
- 他の Issue・担当が参照中の成果物は保全する。既存成果物の移動・削除、Git 管理外の正本配置・同期や証跡の処分は、その操作の範囲と保全条件が確認できる実行単位で扱う。

## Skill

再利用可能な Agent 手順の配置と責務は [skills/README.md](../skills/README.md) に従う。仕様・運用条件は担当文書を参照する。
