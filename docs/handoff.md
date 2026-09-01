# Meal & Training Logger - Handoff

更新日: 2026-09-01

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

## 3. 現在のフェーズ

### Phase 0: Repository Modernization

目的:

- ASTRAEA に開発環境を移せる状態にする。
- Git をコード・仕様・履歴の正本にする。
- 現行実装、現行仕様、検証に必要なものだけをリポジトリへ残す。
- バージョン別フォルダ、バックアップ、旧実装、重複仕様を整理する。
- Agent が安全に作業できる README / AGENTS / current state / CI 構成へ寄せる。

Phase 0 完了後は ASTRAEA Bootstrap、Remote E2E へ進む予定。

## 4. 開発環境

SELENA ローカル Repository:

`D:\05_Application・Game\Project\Meal_Training_Logger`

Git:

- default branch: `main`
- remote: `origin`
- 2026-09-01 の整理コミット群は `main` へ push 済み。

この handoff は push 後に GitHub 側で追加しているため、SELENA 側で再開するときは最初に `git pull --ff-only` を行うこと。

## 5. Phase 0 で完了した整理

### 5.1 不要ファイル削除

削除済み:

- `src/ui/exercise/ExerciseSessionsEditor.tsx.bak`
- `src/assets/react.svg`

`public/vite.svg` は `index.html` の favicon として参照されているため現時点では残している。

### 5.2 `src/legacy` 撤去

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

### 5.3 legacy 前提設定の撤去

`package.json` の Madge 設定から `--exclude legacy` を削除済み。

現在:

- `deps:graph`: `madge src --image docs/deps.svg --extensions ts,tsx`
- `deps:circular`: `madge src --circular --extensions ts,tsx`

### 5.4 legacy migration 痕跡の撤去

`src/domain/storage/dailyRecordStorage.ts` から以下を削除済み:

- コメントアウトされた legacy import
- legacy storage key のコメントアウト定義
- legacy migration helper の履歴コメント
- legacy migration API の履歴コメント

### 5.5 obsolete legacy migration test の撤去

`src/app/dailyRecordService.test.ts` から以下を削除済み:

- `meal-training-logger:history` を使う旧 migration test
- 同テスト専用の定数

結果、skip されていた旧テストはなくなった。

## 6. 現在の検証 Baseline

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

## 7. Supabase 関連の確認事項

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

## 8. 次回の再開候補

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

## 9. 今後の Phase 0 主要候補

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

## 10. 再開時の最初の手順

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

## 11. 運用原則

- Git をバージョン履歴の正本とする。
- 過去状態は Git history を参照する。
- 現行仕様は責務ごとに1つの SSOT へ寄せる。
- README / AGENTS / current state / 詳細仕様の役割を重複させない。
- 不要物整理は `参照確認 → 変更 → build/test/lint 検証 → commit` の小さい単位で行う。
- push は明示的に判断する。
- 仕様・実装・テストが矛盾する場合は、推測でどれかを正とせず、意図を確認してから揃える。
