📘 Meal & Training Logger — Handoff (v1.1.0)
🎯 目的

本ファイルは、チャット引っ越し時／将来再開時に
この1ファイルだけで即開発再開できる状態を保証するための引き継ぎ書である。

1️⃣ 開発環境（Environment）
フロントエンド

Vite + React + TypeScript

プレーンCSS（Tailwind等未使用）

IDE

VSCode

実行
npm run dev


→ http://localhost:5173

デプロイ

GitHub → Vercel自動デプロイ

現在、本番は旧UI稼働中

DEV環境のみ v1.1.0 UI を使用

データ保存

localStorage（端末別保存）

将来的に Supabase へ移行予定（v2.0想定）

2️⃣ 現在のアーキテクチャ（疎結合構成）
UI → App(Service) → Ports(IF) → Data(Adapter) → Domain

ディレクトリ構成
src/
  ui/        ← v1.1.0 新UI
  components/ ← 旧UI
  app/       ← Public API / UseCase
  ports/     ← Repository Interface
  data/      ← localStorage Adapter
  domain/    ← 型 / 正規化 / Factory / Storage

3️⃣ v1.1.0 現在地
✅ 設計フェーズ：完了

Entity定義

Column定義

DBML作成（docs/schema.dbml）

Mermaid作成（docs/schema.mmd）

TS型定義完了

1日=1JSON（DailyRecordAggregate）方針確定

✅ Domain/Data実装：完了

dailyRecordStorage 実装

旧(v1.0.x) → 新(v1.1.0) migration実装済

created_at / updated_at 方針統一

削除時親touch対応

並び替えも更新扱い

保存前normalize方針確立

✅ 疎結合化

Repository Interface導入

App層(Service)導入

UIはAppのみ依存

madgeで循環依存ゼロ確認済

npm run deps:circular
✔ No circular dependency found!


依存図：

docs/deps.svg

4️⃣ 重要仕様（固定）
日付

日付セレクタあり

過去日付も編集可能

order採番

0始まり

保存前に normalizeExerciseOrders() 実行

recording_style切替

現時点は切替時にデータ破棄

将来改修余地あり

user_id

当面 "TODO_USER_ID"

5️⃣ localStorageキー
v1.1.0
daily_record:${YYYY-MM-DD}

旧v1.0.x
meal-training-logger:history
meal-training-logger:latestRecord

6️⃣ DEV/本番切替

App.tsx にて：

const useV110 = import.meta.env.DEV;


DEV → v1.1.0 UI

Production → 旧UI

7️⃣ 次やること（最優先）
Issue: Exercise（v1.1.0-1）

ExerciseSessionAggregate構造にUI更新

recording_style分岐（SETS / TEXT）

SETS：

set_item配列追加/削除/順序/入力

TEXT：

free_text入力

保存→復元で同一表示（最低1ケース）

8️⃣ v1.1.0完了前にやること

結合テスト（Service + Repository + Domain）

システムテスト（UI保存→復元）

新旧不要ファイル整理

本番移行チェック

依存図更新（deps.svg）

9️⃣ 今後の方針（v2以降）

Supabase移行

HealthKit連携構想

DB正規化前提のAPI設計

🔟 再開手順（チャット引っ越し時）

npm run dev

docs/handoff_v110.md を読む

docs/deps.svg を見る

次Issueを確認

実装再開

🧠 現在の品質状態

アーキテクチャ健全

循環依存なし

migration設計済

テスト未整備（v1.1.0終盤で実施予定）