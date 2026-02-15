# 🌈 Meal & Training Logger – Handoff (v1.1.0 現在地)

---

## 1. 🎯 プロジェクト目的（VibeCodingの前提）

Meal & Training Logger は、

- 食事
- トレーニング
- 体重
- 健康体調

を 1日単位で記録し、LINEレポ形式などの文章生成/コピペを省力化するアプリ。

設計思想は以下：

- 1日 = 1 DailyRecordAggregate(JSON)
- UI / App / Domain / Data を分離（レイヤード）
- 保存先は localStorage（MVP）→ 将来的に DB（Supabase等）へ移行可能
- 正規化（normalize）は入口を一本化し、UIに波及させない
- 保存と下書きは将来分離の可能性あり（現時点では未実装）

---

## 2. 🧱 アーキテクチャ概要

### レイヤ構成

```
src/
  ui/           ← 画面（Editor単位で疎結合）
  app/          ← Application Service（正規化入口の一本化）
  domain/       ← 型 / 正規化 / Factory
  data/         ← localStorage 実装
  ports/        ← Repository Interface
```

### 依存関係の方針

- UI → App
- App → Ports
- Ports → Data
- Domainは純粋ロジック（型・正規化・Factory）
- 循環依存なし（madge確認済）

---

## 3. 🖥 開発環境

- Vite + React + TypeScript
- VSCode
- npm run dev → http://localhost:5173
- npm run build → 本番ビルド確認
- GitHub → Vercel自動デプロイ
- データ保存：localStorage（端末別）

---

## 4. 📦 現在の実装状況（v1.1.0）

### ✅ 完了

#### Domain
- DailyRecordAggregate 型運用中（domain/type.ts）
- createEmptyDailyRecordAggregate 運用中
- 正規化
   - normalizeDailyRecordAggregate.ts（入口）
   - normalizeExerciseOrders.ts
   - normalizeWeightOrders.ts

#### Data
- dailyRecordRepository.localStorage 運用中
- 旧v1.0.x → v1.1.0 migration 実装済
- ttimestamp方針（created_at/updated_at）運用中

#### App
- app/dailyRecordService.ts 運用中
- UIからの更新・保存は service経由に寄せる（正規化入口一本化のため）

#### UI（v1.1.0）
- タブ構成：体重 / 健康体調 / 食事 / 運動
   - ※ 「基礎」タブは撤去（ヘッダーに統合する方針）
- Header強化：
   - 「記録・表示切替」ボタン（配置のみ、処理は後回し）
   - daily_record.updated_at を 最終更新日時として表示（yyyy/m/d hh:mm:ss）

#### 体重（Weight）
- WeightEditor.tsx 実装済
   - 朝/夜：体重(kg) + 測定時刻（measured_at）
   - IME（全角入力）考慮：入力中は素通し、確定はblur中心
   - バリデーション：10〜999.99 / 小数0〜2桁（実装準拠）
   - measured_at は record_date + HH:mm → ISOに変換して保存
- 保存 → F5復元 OK

#### 健康体調（Wellness）
- WellnessEditor.tsx 実装済（暫定仕様）
   - select項目：睡眠時間/睡眠の質/水分摂取/身体の調子/気分/空腹感/便通
   - 将来用の sleep_duration_minutes / sleep_source は UI非表示
- 保存 → F5復元 OK

#### 運動（Exercise）
- ExerciseSessionsEditor.tsx 実装ほぼ完了
   - Session追加/削除/並び替え
   - Item(SETS/TEXT)
   - Set追加/削除/並び替え
   - 左右ON/OFF切替
   - Start / End / 消費カロリー / ラベル / メモ
   - 保存→F5復元OK

#### 食事（Meal）
- 未着手（重いので後回し）
   - 明日以降、細切れで進める方針

---

## 5. 🔁 保存仕様

### 保存
- 「保存」ボタン押下時のみ localStorage 更新
- baselineJson を保存後に更新（dirty判定の基準）

### 未保存判定
- JSON.stringify(record) 比較でdirty判定
- record変更で「未保存」表示
- 保存で消える

### クリア
- セクション単位で state のみ初期化
- 保存しない限りStorageは更新されない
- F5で元の保存値に戻る

---

## 6. 🧠 設計メモ（将来検討）

### 🔸 表示モード切替（未実装）
- Headerに「記録・表示切替」ボタン配置済
- 実処理（view-only表示や画面切替）は後回し

### 🔸 下書き保存（未実装）
- daily_record_draft:YYYY-MM-DD の導入可能性
- 本保存と下書き保存の2系統UIを将来検討
- 現時点では実装しない（バックログ管理）

### 🔸 左右負荷拡張(WeightRecord)
- 将来的に has_sides=true の場合
  - load_value_left/right
  - load_unit_left/right
  を持つ可能性
- 型・DB定義変更が必要

---

## 7. 🗂 現在の安定状態

- build通過
- 循環依存なし
- 体重（IME含む）・健康体調・運動の保存/復元が安定
- ヘッダー整理（最終更新日時/切替ボタン）反映済

---

## 8. 🔍 循環参照検証・deps.svg出力（忘れ防止）

- 循環参照検証・deps.svg出力
   - ① npm run deps:circular
   - ② npm run deps:graph
- （docs/deps.svg を更新する場合は②の出力で差し替え）

---

## 9. 📚 docs 作業（状況）

- docs/deps.md 作成済（deps.svgのキャプション）
- docs/ux/screen_spec_v110.md を超簡易で整備予定（入力/出力の2画面）

---
## 10. ⏭ 次のStep（次チャットでやること）

### 優先
1. 食事（Meal）タブ設計＆実装（細切れで進める）
2. 表示画面の実装
3. ドキュメント整備

### その後
- 結合テスト
- システムテスト
- 不要ファイル整理
- 依存グラフ再確認
- 本番移行検討

---

## 9. 🚀 新チャット開始時の合言葉

「v1.1.0 handoff から再開。」

これで即再開可能。

---