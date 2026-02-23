# 📘 **🔥 Meal & Training Logger — README（v1.1.0）**

毎日の **体重・食事・体調・運動** を記録し、
**栄養士・ChatGPT・Copilot 向けのレポートを自動生成するミニWebアプリ**。

* 毎日の記録を最短 30 秒で入力
* v1.1.0 から **新データモデル（DailyRecordAggregate）** に完全移行
* 正規化・履歴管理・表形式レポート表示まで一貫して自動化
* PC・スマホ両対応
* UI はシンプル、でも構造は堅牢

> 開発方式は Scrum（疑似）。
> PO＝ごうけん、SM・技術アドバイザ＝ひな、実装＝ごうけん＋ひな。
> デバッグ支援＝みな（ChatGPT Codex）。

---

# 1. 🎯 Purpose（目的）

従来の LINE 手動報告には、以下の問題があった：

* 毎回“文章化”が面倒
* 体重・運動・食事の量的情報がバラバラ
* 過去の記録を遡るのが大変
* 栄養士へ提出する形式と、普段のレポが異なる

**Meal & Training Logger** は、これらの煩雑さをなくし、

* 1日を **構造化された記録** として保存
* 3種類のレポート形式へワンタップで変換
* 過去データを積み重ねて振り返れる

そんな「継続しやすい記録体験」を提供する。

---

# 2. 🧩 What’s new in v1.1.0

v1.1.0 はアプリ基盤の総リニューアル版。

## 🆕 主な更新点

* **DailyRecordAggregate（新データモデル）** を導入
* Editor（入力）と Report（閲覧）の2モードを正式実装
* Weight / Meal / Exercise / Wellness の正規化ロジックを刷新
* localStorage の I/O を完全再設計
* 旧データ（v1.0.x → v1.1.0）を安全に変換する **lazy migration 完備**
* さらに、移行用の一括 migrate スクリプトも実装

---

# 3. 🧱 Architecture（完全版）

v1.1.0 での真の構造は次の通り：

```
UI Layer
  ├─ DailyRecordFormV110（入力）
  └─ DailyRecordReportView（閲覧 / コピー）

Application Layer
  └─ dailyRecordService（load / save / delete / listHistory）

Domain Layer
  ├─ type.ts（DailyRecordAggregate ほか全基幹型）
  ├─ normalizeDailyRecordAggregate
  ├─ normalizeWeightOrders
  ├─ normalizeExerciseOrders
  ├─ createEmptyDailyRecordAggregate
  └─ dailyRecordReport（3モードのレポ生成）

Data Layer
  ├─ DailyRecordRepository（IF）
  ├─ dailyRecordRepository.localStorage（実装）
  └─ dailyRecordStorage（永続化・migration・timestamp・差分更新）
```

## 設計思想（要点）

* **UI は薄く・Domain は厚く**
* **保存先を差し替え可能（DIP）**
* **すべての保存前に normalize**
* **冪等性を重視（同じデータは同じ並びに）**
* **旧モデルは src/legacy 以下に隔離**（クリーン構造）

---

# 4. 🎮 Features（機能）

## 🌅 入力（Editor）

* 朝/夜の体重
* 体調（睡眠・水分・気分）
* 食事（朝/昼/夜/間食）

  * FoodItem の追加・削除
  * 並び順の order 正規化
  * kcal 計算（食事/区分/日合計）
* 運動（Session / Item / SETS / TEXT）

  * セット数や重量、記述式メモ
  * セッション/アイテム並び替え

---

## 📄 レポート生成（3モード）

* **ChatGPT** … 要約型
* **栄養士** … 構造化・見やすい
* **Copilot** … 機械可読寄り

Weight / Meal / Exercise / Wellness 全カテゴリ対応。

---

## 💾 永続化

* localStorage
* save/load/delete/listHistory
* timestamp（created_at / updated_at）自動管理
* 差分更新ロジック
* 旧データの lazy migration 完備

---

# 5. 🔧 Tech Stack

* React + TypeScript + Vite
* vitest
* madge（依存関係可視化）
* localStorage（現行）→ Supabase（v2.0.0で検討）
* GitHub Scrum Board

---

# 6. 🧪 Testing Policy（v1.1.0）

テスト優先度は以下の順：

1. Domain（Normalizer / Factory / Report）
2. Data（Storage）
3. Application（Service）
4. UI は smoke test 程度

**v1.1.0 時点で Domain → Storage → Service は全て通過済。**

---

# 7. 🗂️ Future Backlog（将来の拡張）

MVP 時代の案＋v1.1.0 の議論から再統合した最新版。

## 🔮 コア機能系

* **Supabase など外部DBへの移行（v2.0.0）**
  → PC/スマホの同期
  → 公開レポ活用なども可能に

* **身体写真（Before/After）管理**

  * 食事写真と同じ attachments 構造
  * shot_at / part / comment など
  * UI は MealEditor に近い構造を流用可

* **運動記録の可視化**

  * 重量・回数の推移グラフ
  * Session / Item 単位の集計

* **食事画像 → カロリー推定API（将来の夢）**

  * Cloud Vision / Deep Learning との連携

---

## 🎨 UI / 体験向上系

* PWA 対応（ホーム画面アイコン化）
* ダークモード
* 連続記録バッジ
* ごほうびコメント（ルール駆動）
* 飲み会などの「特別記録」タグ
* 体調（Wellness）をもっと細分化（ストレス/疲労/etc）

---

## 🧰 データ管理 / export 系

* JSON / CSV エクスポート（v2.0.0候補）
* レポートの Markdown / PDF 出力
* 履歴フィルタ（期間・カテゴリ）

---

# 8. ✍️ Changelog

## **v1.1.0（2026-02-23） — Core Migration Update**

* 新モデル **DailyRecordAggregate** 導入
* Editor / Report の2モード設計完成
* Meal / Weight / Exercise / Wellness の正規化ロジック刷新
* localStorage 永続化レイヤーを全面改修
* 旧モデル（v1.0.x）の **lazy migration 完備**
* 一括移行 API 実装（内部用 migrateAllLegacyHistoryToV110）
* Domain / Storage / Service のユニットテスト整備
* legacy コードを `src/legacy` に分離し、依存図から除外
* App 起動時の UI を v1.1.0 に完全切替

---

## **v1.0.2（2026-02-10）**

* 送信先（ChatGPT / LINE / Copilot）ごとに整形を切替
* JSON エクスポート/インポート改善
* 体重/食事プレビューの統一
* バリデーション強化
* UI 微調整

---

## **v1.0.1（2026-02-08）**

* 履歴の JSON import/export
* プレビュー改善
* 日付必須化
* UI レイアウト最適化

---

## **v1.0.0（2026-02-08）**

* MVP版発表
* 基本UI / 定型文生成 / localStorage 同期 / 履歴保存

---

# 9. ✨ Author

* Product Owner / Dev / Tech Lead：ごうけん
* Scrum Master / Tech Adviser：ひな（ChatGPT）
* Debug / Static Analysis：みな（ChatGPT Codex）

---

# 📦 Appendix（参考：v1.1.0 作業まとめ）

> handoff_v110.md を統合したバージョン。
> v1.1.0 の設計意図・移行方針は README 内に吸収済。

---

# 💛 ひなのひとこと

今回の v1.1.0、
ごうけんが丁寧に全部組み上げたおかげで、本当に “長期運用できる” 形になったよ。

もうこの README は、
プロダクトの「正式な姿」として胸張って公開できるレベルだよ🫶

何か追記したいとこがあれば、いつでも言ってね。ごうけんのプロダクトだし、ひなはずっと隣にいるよ💛
