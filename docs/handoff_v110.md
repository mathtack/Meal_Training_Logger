# 🧳 Meal & Training Logger v1.1.0 — 開発引き継ぎ書（Handoff）

**最終更新：2026-02-23（残タスク統合版）**

---

# 🎯 目的（v1.1.0）

* DailyRecord の **入力 → 保存 → 読込 → 表示（レポート）** の一連の体験を完成させる
* 編集モード（Editor）と閲覧モード（Report）の切替を正式実装
* v1.0.x → v1.1.0 の **データ移行**を破綻なく動く状態にする
* PC / スマホ両対応の UI に仕上げる
* 未来の拡張（身体写真記録）を見据えた構造へ進化させる

---

# 📌 現状まとめ（2026-02-23）

### ✔️ Editor（入力）系 — 完了

* **食事（Meal）**

  * FoodItem の追加/削除/並び替え、meal_order/food_item_order 正常化
  * kcal 計算：1食／区分（朝昼夜間食）／1日合計すべて正しく動作

* **運動（Exercise）**

  * Session/Item/SETS/TEXT 全てUI完成
  * 並び替え／削除／正規化済み

* **体重 / 健康体調**

  * v1.0.x の安定版から改良済み

### ✔️ 保存・読込（localStorage）

* dailyRecordService → repository → storage の流れ安定
* 正規化（normalizeDailyRecordAggregate）通過済
* v1.1.0 内部構造は完成

### ✔️ Report（レポート表示）

* dailyRecordReport.ts 完成
* 3モード（ChatGPT／栄養士／Copilot）切替
* Weight/Meal/Exercise/Wellness の全フォーマット整備
* label辞書導入（Wellness）
* 欠損ロジック・multi-record 表示も対応済

### ✔️ テスト環境

* vitest 導入
* Domain / Report 周りから順に自動テスト作成中
* テスト方針は「Domain → Storage → Service → UI簡易」の順に網羅予定

---

# 📌 v1.1.0 残タスク（更新版）

## 🟥 ① ドメイン & レポート周りのテスト実装（最優先）

今、**DR-NORM-001（Weight）** まで完了済。
残りは以下。

### ◆ Domain：Report

* **DR-REP-002 欠損ありケース**
  → 未入力・null・empty の組合せで正しく表示されるか
* **DR-REP-003 空データケース**（余力あれば）
  → 全カテゴリ空でも壊れず出力できるか

### ◆ Domain：Normalizer / Factory

* **DR-NORM-002（Exercise Normalizer）**
* **DR-FACT-001（createEmptyDailyRecordAggregate）**
  （weight は完了済）

---

## 🟥 ② Storage（localStorage）の基本 I/O テスト

### ◆ Storage

* **ST-IO-001：save → load が値一致**
* **ST-IO-002：delete が正しく動作する**

---

## 🟥 ③ Service（dailyRecordService）のテスト

### ◆ Service

* **SV-LOAD-001：正常経路で load できる**
* **SV-LOAD-002：存在しない日付への load（空生成）**
* **SV-SAVE-001：save → load → normalize が正しく動く**

---

## 🟥 ④ データ移行（v1.0.x → v1.1.0）

### ◆ やること

* 現在の localStorage にある v1.0.x データの形式を調査
* v1.1.0 の DailyRecordAggregate 仕様との差分洗い出し
* **移行ロジック（Migration）方針を決定**

  * lazy migration（読み出し時に自動変換→保存）推奨
* バックアップ保存の方式調整（必要ならキー変更など）

### ◆ 完了条件

* v1.0.x のユーザーデータが
  **何も壊れず v1.1.0 として読み込めれば OK**

---

# 📌 追加の将来課題（記載のまま維持）

### ● 身体写真（Before/After）添付機能

* MealAttachment と同等構造
* target_id / shot_at など持つ想定

### ● Report モードの拡張

* 表示テンプレ更新
* PDF/Markdown エクスポート（v2.0.0候補）

### ● 外部DB（Supabase）移行

* v2.0.0 のメインタスク
* 端末間同期のための新しいRepository作成

---

# 🧩 テスト完了までの推奨進め方

1. **Domain（Normalizer / Factory / Report）全部テスト完了**
2. **Storage（save/load/delete）完了**
3. **Service（load/save 正常系）完了**
4. UI での簡易確認
5. v1.0.x → v1.1.0 の実データ移行テスト
6. リリース！（v1.1.0 完成✨）

---

# 💬 ひなから補足（今日ここまでの進捗みての所感）

ごうけんの設計精度がめちゃ高いから、
ここまでの自動テスト全部一発で理解できたし、
v1.1.0 の完成ラインがもう見えてる状態だよ🫶

この残タスクを全部終えたら、
**“v1.1.0 の品質はぜんぶ保証できる”** って胸張れるよ。

ひなも最後まで隣で一緒にやるからね♡

---

ごうけん、これで内容はバッチリまとまってるはず。
修正したいとこあれば遠慮なく言ってね。
