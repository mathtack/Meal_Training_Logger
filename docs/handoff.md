# Meal & Training Logger - Handoff

更新日: 2026-09-02

## 1. この文書の役割

この文書は、Meal & Training Logger の作業を中断・再開するための最新チェックポイントを記録する。

- 過去バージョンや旧状態の保存は Git 履歴に任せる。
- このファイルは常に最新1枚を維持し、バージョン別 handoff は作らない。
- 再開時はいきなり変更せず、Git 状態と検証結果を確認してから作業する。

## 2. プロジェクト方針

本プロジェクトは、学習目的を主要な設計制約としない。

技術選定・設計・実装では、以下を優先する。

- 実用性
- 保守性
- 品質
- 安定運用
- Agent / Codex が安全に理解・変更・検証できること

バージョン管理の正本は Git とする。
`old/`、`backup/`、`.bak`、バージョン別コピーなどをリポジトリ内に原則残さない。

## 3. 現在の取り組み: ASTRAEA への Repository 構築

現在の主目的は、Meal & Training Logger を SELENA だけで開発する状態から、ASTRAEA を常時稼働可能な Codex 作業ノードとして利用できる状態へ移行することである。

最終的には、以下の流れを安全に実行できる状態を目指す。

```text
User / Chat
  ↓
ASTRAEA
  ↓
Codex CLI
  ↓
Meal_Training_Logger Repository
  ↓
codex/<task-name>
  ↓
edit → test → commit → push / PR
```

### 目的

- ASTRAEA 上に Meal & Training Logger の開発環境を再現可能な形で構築する。
- SELENA と ASTRAEA のどちらからでも Git を正本として安全に作業できるようにする。
- ASTRAEA では `main` を直接編集せず、原則 `codex/<task-name>` branch で作業する。
- Codex が README / AGENTS / current state / spec / tests を読めば、チャット履歴に依存せず作業を開始できる状態にする。
- 将来的に、リモートから小さな改修を指示し、ASTRAEA が変更・検証・commit まで進められる運用を成立させる。

この節は現在の移行作業に対する一時的な進行管理情報である。
ASTRAEA への Repository 構築と Remote E2E が完了したら、この節および実行ステップは handoff から削除する。

### 実行ステップ

#### Step 0: Repository 移設・Baseline 確立 — DONE

SELENA 上の Repository を整理作業しやすい正式配置へ移した。

旧配置:

`C:\automation\Meal_Training_Logger`

現配置:

`D:\05_Application・Game\Project\Meal_Training_Logger`

実施内容:

- Git remote / branch / working tree を確認
- `npm ci` で依存関係を再構築
- build / test / circular dependency / lint の初期 Baseline を取得
- `node_modules` など生成物を Repository 正本として扱わないことを確認

初期 Baseline:

- build PASS
- tests PASS
- circular dependency なし
- lint 33 errors

#### Step 1: Repository Modernization — IN PROGRESS

ASTRAEA に clone する前に、Repository 自体を Agent が扱いやすい現行 SSOT 構成へ整理する。

主な作業:

- `.bak` / 未使用asset / `src/legacy` など不要物の撤去
- legacy migration の死んだ実装・コメント・test の撤去
- version 付きファイル名・フォルダ名の棚卸しと整理
- `docs/` 内の旧仕様・重複仕様・version別資料の整理
- DB設計 Excel / DBML / Markdown の重複整理
- Supabase schema / RLS の Git 管理 migration 化
- root `README.md` の再構築
- `AGENTS.md` の再構築
- `docs/current_state.md` の導入検討
- `.env.example` の追加
- lint 既存エラーの解消
- GitHub Actions CI の導入

進め方:

`参照確認 → 小さい変更 → build/test/circular/lint → commit`

を基本単位とする。

Step 1 の完了条件は、ASTRAEA に clone しても「何を読むべきか」「どう検証すべきか」「何を変更してはいけないか」が Repository 内だけで判断できる状態になること。

#### Step 2: ASTRAEA Bootstrap

Step 1 完了後、ASTRAEA に Repository を構築する。

想定作業:

- Git / Node.js / Codex CLI など必要ランタイム確認
- Meal_Training_Logger を ASTRAEA に clone
- `npm ci`
- `.env.local` を ASTRAEA 側へ安全に設定
- `npm run build`
- `npm test -- --run`
- `npm run deps:circular`
- `npm run lint`
- Vite 起動
- Supabase Auth / 現行画面の動作確認

ASTRAEA の想定 role:

- Codex 作業ノード
- `main` 直接編集は禁止
- task 開始時は最新 `main` から `codex/<task-name>` branch を作成
- `main` が dirty、または fast-forward できない場合は作業を止める

必要に応じて、SELENA / ASTRAEA を識別する `Get-ExecutionNode.ps1` 等の仕組みを追加する。

#### Step 3: Branch / Agent Safety E2E

ASTRAEA 上で Codex が Repository の運用ルールを正しく守れることを確認する。

最低限確認すること:

- `main` を最新化できる
- `codex/test-*` branch を安全に作成できる
- README / AGENTS / current state を起点に作業内容を理解できる
- 小さな変更を実施できる
- build / test / lint 等の指定検証を実行できる
- commit できる
- push / PR が意図した branch に対して行われる
- `main` への直接変更や危険な Git 操作を行わない

#### Step 4: Remote Instruction E2E

最終段階として、ユーザーが SELENA を直接操作せず、リモート指示から ASTRAEA / Codex に小規模タスクを実行させる一連の流れを確認する。

想定フロー:

```text
リモート指示
  ↓
ASTRAEA が対象 Repository / task を特定
  ↓
main 更新
  ↓
codex/<task-name> 作成
  ↓
Codex が実装
  ↓
自動検証
  ↓
commit
  ↓
push / PR
  ↓
結果報告
```

この E2E が成立したら、ASTRAEA への Repository 構築は完了とみなす。

その後は、この handoff から ASTRAEA 移行作業固有のステップ記述を削除し、通常の開発状態・次アクションだけを記録する。

## 4. 現在のフェーズ

### Phase 0: Repository Modernization

現在は上記 Step 1 を実施中。

目的:

- ASTRAEA に開発環境を移せる状態にする。
- Git をコード・仕様・履歴の正本にする。
- 現行実装、現行仕様、検証に必要なものだけをリポジトリへ残す。
- バージョン別フォルダ、バックアップ、旧実装、重複仕様を整理する。
- Agent が安全に作業できる README / AGENTS / current state / CI 構成へ寄せる。

Phase 0 完了後は ASTRAEA Bootstrap、Remote E2E へ進む。

## 5. 開発環境

SELENA ローカル Repository:

`D:\05_Application・Game\Project\Meal_Training_Logger`

Git:

- default branch: `main`
- remote: `origin`
- 2026-09-01 の整理コミット群は `main` へ push 済み。

handoff 更新は GitHub 側から行われることがあるため、SELENA 側で再開するときは最初に `git pull --ff-only` を行うこと。

## 6. Phase 0 で完了した整理

### 6.1 不要ファイル削除

削除済み:

- `src/ui/exercise/ExerciseSessionsEditor.tsx.bak`
- `src/assets/react.svg`

`public/vite.svg` は `index.html` の favicon として参照されているため現時点では残している。

### 6.2 `src/legacy` 撤去

以下を削除済み:

- `src/legacy/components/DailyRecordForm.tsx`
- `src/legacy/data/localStorageHistory.ts`
- `src/legacy/domain/DailyRecord.ts`
- `src/legacy/domain/formatDailyRecord.ts`
- `src/legacy/domain/history.ts`

削除前に現行 `src` から生きた import がないことを確認した。

削除後に以下を確認済み:

- build PASS
- unit test PASS
- circular dependency なし
- 実画面起動
- Supabase Magic Link ログイン
- 通常画面操作

### 6.3 legacy 前提設定の撤去

`package.json` の Madge 設定から `--exclude legacy` を削除済み。

現在:

- `deps:graph`: `madge src --image docs/deps.svg --extensions ts,tsx`
- `deps:circular`: `madge src --circular --extensions ts,tsx`

### 6.4 legacy migration 痕跡の撤去

`src/domain/storage/dailyRecordStorage.ts` から以下を削除済み:

- コメントアウトされた legacy import
- legacy storage key のコメントアウト定義
- legacy migration helper の履歴コメント
- legacy migration API の履歴コメント

### 6.5 obsolete legacy migration test の撤去

`src/app/dailyRecordService.test.ts` から以下を削除済み:

- `meal-training-logger:history` を使う旧 migration test
- 同テスト専用の定数

結果、skip されていた旧テストはなくなった。

## 7. 現在の検証 Baseline

直近確認結果:

- `npm run build`: PASS
- `npm test -- --run`: PASS
  - 6 test files
  - 15 tests passed
  - skipped 0
- `npm run deps:circular`: PASS
  - circular dependency なし
- `npm run lint`: FAIL
  - 30 existing errors

Lint 30件は既存技術負債として認識している。

主な種類:

- `@typescript-eslint/no-explicit-any`
- `prefer-const`
- `react-refresh/only-export-components`
- `react-hooks/set-state-in-effect`

Phase 0 中の最低条件:

- build を壊さない
- tests を壊さない
- circular dependency を発生させない
- lint error を増やさない

将来的には lint 0 件を品質ゲートにする。

## 8. Supabase 関連の確認事項

ローカル実画面テスト中、Magic Link 送信が `Failed to fetch` になった。

原因:

1. `.env.local` の `VITE_SUPABASE_URL` に誤記があった。
2. Supabase の `meal-training-logger` project が INACTIVE だった。

対応済み:

- `.env.local` の Supabase URL 修正
- Supabase project restore
- Vite 再起動

その後:

- Magic Link 送信成功
- ログイン成功
- 現行画面表示・操作成功

`.env.local` は Git 管理しない。
`.env.example` の追加は今後の候補。

なお、このセッションではローカル環境から Supabase へのデータ保存そのものを改めて E2E 確認したわけではない。保存済みデータの動作は Web 環境で確認済み。

## 9. 次回の再開候補

次は変更せず、まず「バージョン表現」の棚卸しから始める。

確認済みの例:

- `DailyRecordFormV110.tsx`
- `DailyRecordFormV110`
- `loadV110()`
- `v1.1.0 only`
- `Failed to parse v1.1.0 record`
- `docs/db/v1.1.0/`
- `docs/db/v1.2.0/`
- version 付きテスト資料
- version 付き DB 設計資料

基本方針:

> バージョン管理は Git で行う。現行 SSOT のファイル名・フォルダ名にバージョンを保持しない。

ただし rename / refactor は単純削除よりリスクが高いため、参照関係を棚卸ししてから小さく実施する。

## 10. 今後の Phase 0 主要候補

順序は再開時に再確認する。

- version 付き名称の棚卸し・整理
- `docs/` の現行 SSOT 整理
- DB 設計 Excel / DBML / Markdown の重複整理
- Supabase schema / RLS を Git 管理可能な migration へ移行
- root `README.md` 再構築
- `AGENTS.md` 再構築
- `docs/current_state.md` への移行検討
- `.env.example` 追加
- GitHub Actions CI 導入
- lint 既存30件の解消
- `npm audit` で検出された依存脆弱性の別タスク化

## 11. 再開時の最初の手順

```powershell
git status
git pull --ff-only
git log --oneline --decorate -10
git diff

npm ci
npm run build
npm test -- --run
npm run deps:circular
npm run lint
```

Baseline と差異がないことを確認してから作業を再開する。

## 12. 運用原則

- Git をバージョン履歴の正本とする。
- 過去状態は Git history を参照する。
- 現行仕様は責務ごとに1つの SSOT へ寄せる。
- README / AGENTS / current state / 詳細仕様の役割を重複させない。
- 不要物整理は `参照確認 → 変更 → build/test/lint 検証 → commit` の小さい単位で行う。
- push は明示的に判断する。
- 仕様・実装・テストが矛盾する場合は、推測でどれかを正とせず、意図を確認してから揃える。
