# Meal & Training Logger v1.1.0  
Test Plan

## 0. 目的・範囲

- 対象バージョン: v1.1.0
- 目的:
  - v1.1.0 で追加・変更した **Domain / Storage / Service 層の機能**が、
    仕様通りに動作することを確認する
  - 将来のリグレッションテストに使える、自動テストの土台を用意する
- 今回のテストレイヤ:
  - Domain ロジック（正規化・レポート生成・migration 等）
  - Storage 層（localStorage I/O）
  - Service 層（ユースケース API）
- 今回はスコープ外（項目だけ残す）:
  - UI/E2E（ブラウザ操作）  
    ※ v2.0.0 以降で自動化 or 手動チェック方針を検討

---

## 1. Domain テスト

### 1-1. DailyRecordReport（レポート生成）

| ID | 観点 | 内容 | 種別 | 自動化 |
|----|------|------|------|--------|
| DR-REP-001 | 基本ケース | 体重/コンディション/食事/運動 すべて入力されている 1 日分の Aggregate から、仕様通りのレポートテキストが生成される（現在実装済み） | 正常系 | ✅ |
| DR-REP-002 | 欠損ありケース | いくつかのセクションが未入力（例: 食事なし, 運動なし）の場合に、`（記録なし）` 表示とセクション非表示ルールが仕様通りになる | 正常系＋欠損 | 予定 |
| DR-REP-003 | 空データケース | 完全に空の DailyRecordAggregate を渡した場合、全セクションが `（記録なし）` / または非表示ルールに従って出力される | 最小ケース | 予定 |
| DR-REP-004 | 並び順 | 複数件の体重/食事/セッション/アイテム/セットがある場合に、recording_order / session_order / item_order / set_order の順に並んでいる | 並び順 | 予定 |
| DR-REP-005 | ラベル辞書 | Wellness の enum 値を変えても、対応する日本語ラベルが正しく出力される（ラベル辞書の抜け・誤り検知） | ラベル | 予定 |

### 1-2. Normalizer / Factory

| ID | 観点 | 内容 | 種別 | 自動化 |
|----|------|------|------|--------|
| DR-NORM-001 | weight 並び順 | `normalizeWeightOrders` に weight 一覧を渡したとき、measurement_time / measurement_slot のルールに従って measurement_order が再採番される | 並び順 | 予定 |
| DR-NORM-002 | exercise 並び順 | `normalizeExerciseOrders` が session / item / set の order を 1 から連番で振り直す | 並び順 | 予定 |
| DR-NORM-003 | 冪等性 | normalize 系を同じ Aggregate に複数回かけても結果が変わらない（冪等） | 冪等 | 予定 |
| DR-FACT-001 | 空 Aggregate 生成 | `createEmptyDailyRecordAggregate` が、指定日付の空の DailyRecordAggregate を仕様通り生成する | Factory | 予定 |

### 1-3. Migration / 互換

| ID | 観点 | 内容 | 種別 | 自動化 |
|----|------|------|------|--------|
| DR-MIG-001 | legacy → v1.1.0 | 旧 `DailyRecord` 形式から v1.1.0 の DailyRecordAggregate への変換が、レポートや UI で利用可能な形になっている（必須フィールドが欠けない） | Migration | 予定 |
| DR-MIG-002 | 互換レポート | legacy データを migration した結果の Aggregate を `dailyRecordReport` に通したとき、最低限レポートとして破綻しない | Migration + Report | 予定 |

---

## 2. Storage テスト（localStorage I/O）

対象: `src/domain/storage/dailyRecordStorage.ts` など

### 2-1. save / load / delete

| ID | 観点 | 内容 | 種別 | 自動化 |
|----|------|------|------|--------|
| ST-IO-001 | save → load | v1.1.0 形式の Aggregate を save し、同じ日付で load したときに、同等の Aggregate が返る（フィールドが欠けない） | 正常系 | 予定 |
| ST-IO-002 | delete | save 済みの日付に対して delete を行うと、次回 load 時には新規日扱いになる（データが残っていない） | 正常系 | 予定 |
| ST-IO-003 | created_at | 既存データに対して save した場合、`created_at` は保持され、`updated_at` のみ更新される | timestamp | 予定 |
| ST-IO-004 | 新規作成 | 新規日を初めて save したとき、`created_at`＝`updated_at` となる | timestamp | 予定 |

### 2-2. list / サマリ

| ID | 観点 | 内容 | 種別 | 自動化 |
|----|------|------|------|--------|
| ST-LIST-001 | 日付一覧 | 保存済み日付の一覧（サマリ）取得 API が、日付の降順（新しい順）で並んでいる | 並び順 | 予定 |
| ST-LIST-002 | 最終更新日 | サマリの `last_saved_at` が、実際の `updated_at` と一致している | 整合性 | 予定 |

### 2-3. 異常系 / 壊れたデータ

| ID | 観点 | 内容 | 種別 | 自動化 |
|----|------|------|------|--------|
| ST-ERR-001 | 壊れた JSON | localStorage に壊れた JSON が入っている場合に、例外でアプリ全体が落ちない（try/catch などでハンドリング／もしくはテストで TODO として振る） | 異常系 | 任意 |
| ST-ERR-002 | 想定外スキーマ | 必須フィールドが欠けたオブジェクトを load した場合の挙動（無視する／デフォルト補完する 等）を決めてテストする | 異常系 | 任意 |

---

## 3. Service テスト（ユースケース API）

対象: `src/app/dailyRecordService.ts` など

### 3-1. load / save / delete（ユースケース単位）

| ID | 観点 | 内容 | 種別 | 自動化 |
|----|------|------|------|--------|
| SV-LOAD-001 | 新規日 load | `load(date)` で保存済みレコードがなければ、`createEmptyDailyRecordAggregate` による空データが返る | 正常系 | 予定 |
| SV-LOAD-002 | 既存日 load | 既存データがある日付を `load(date)` したとき、`normalizeDailyRecordAggregate` を通した Aggregate が返る | 正常系＋正規化 | 予定 |
| SV-SAVE-001 | save 正常 | `save(aggregate)` が Storage 層に正しく保存を委譲し、戻り値（成功/失敗 or 更新後データ）が期待通りになる | 正常系 | 予定 |
| SV-DEL-001 | delete 正常 | `delete(date)` が指定日付のデータを削除し、再 load 時に新規日扱いになる | 正常系 | 予定 |

### 3-2. cross-layer 確認（軽い結合テスト）

| ID | 観点 | 内容 | 種別 | 自動化 |
|----|------|------|------|--------|
| SV-INTEG-001 | save → load 一連 | Service の `save` で保存した Aggregate を、同じ Service の `load` で取得したときに、Domain の normalize/migration 観点を含めて一貫したデータになっている | 結合 | 予定 |
| SV-INTEG-002 | migration 経由 | legacy データが Storage に存在する状態で `load(date)` したとき、migration＋normalize を通った Aggregate が返る | 結合＋Migration | 任意 |

---

## 4. UI / E2E テスト（v2.0.0 以降で検討）

※ 今回は項目のみ。v2.0.0 以降で、自動テスト or 手動チェック方針を検討する。

| ID | 観点 | 内容 | 種別 | 自動化 |
|----|------|------|------|--------|
| UI-E2E-001 | 1日記録作成〜保存〜再読込 | 体重/コンディション/食事/運動を入力→保存→別日へ移動→再度同じ日付を開き、値が復元される | E2E | 未定 |
| UI-E2E-002 | レポート生成とコピー | 入力済みデータからレポートタブを開き、3モード（ChatGPT/栄養士/Copilot）切替＋「レポートをコピーして保存」ボタン押下で、保存＆クリップボードコピーが成功する | E2E | 未定 |
| UI-E2E-003 | 保存・読出タブ | 保存・読出タブに日付一覧が表示され、任意の日付を選んで「この日の記録を読み込む／削除」が期待通り動く | E2E | 未定 |