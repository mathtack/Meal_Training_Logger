# 📦 引き継ぎ書：外部DB化（Supabase 連携）編

## プロジェクト
- プロダクト名：Meal & Training Logger
- 現行バージョン：v1.1.2（DailyRecordForm v1.1.0）
- この引き継ぎ書のスコープ：
  - Supabase 認証・外部DB連携（バックアップ用途）の実装
  - v2.0.0 に向けた下準備まで

---

## 1. アーキテクチャ概観（v1.1.x）

### 1-1. レイヤと依存関係

- Entry:
  - `main.tsx` → `App.tsx` → `ui/DailyRecordFormV110.tsx`
- レイヤ構造：
  - UI layer: `ui/*`
  - Application layer: `app/dailyRecordService.ts`
  - Repository & Storage:
    - `domain/DailyRecordRepository.ts`
    - `domain/dailyRecordRepository.localStorage.ts`
    - `domain/storage/dailyRecordStorage.ts`
  - Domain:
    - 型定義: `domain/type.ts`
    - ファクトリ／正規化／レポート  
- 依存方向：
  - **UI → Application → Repository/Storage → Domain**
  - Domain は全レイヤ共通のスキーマ源泉（`domain/type.ts`）

### 1-2. データモデル（Aggregate 単位）

`db_aggregate_mapping_updated.md` より：

- `DailyRecordAggregate`
  - `daily_record: DailyRecord`
  - `weights: WeightRecord[]`
  - `wellness: WellnessRecord | null`
  - `meals: MealAggregate[]`
  - `exercise_sessions: ExerciseSessionAggregate[]`
- `MealAggregate`
  - `meal_record: MealRecord`
  - `attachments: MealAttachment[]`
  - `food_items: FoodItemAggregate[]`
- `FoodItemAggregate`
  - `food_item: FoodItem`
  - `materials: FoodMaterial[]`
- `ExerciseSessionAggregate`
  - `session: ExerciseSession`
  - `items: ExerciseItem[]`
  - `recording_style = "SETS"` の場合：`sets: SetItem[]`
  - `recording_style = "TEXT"` の場合：`free_text: string`

### 1-3. localStorage での保存方式（v1.1.x）

- 保存単位：**1日＝1 JSON（DailyRecordAggregate）**
- キー：`daily_record:{record_date}`（例：`daily_record:2026-02-15`）
- 値：`DailyRecordAggregate` を JSON.stringify したもの

---

## 2. Supabase 側の構成（現状）

### 2-1. 主に使っているテーブル

- `auth.users`
  - Supabase 標準。メールリンク認証のユーザーを保持。
- `public.app_user`
  - カラム（想定）：
    - `id` (uuid) — `auth.users.id` への FK
    - `display_name` (text | null)
    - `created_at` (timestamp)
  - 用途：
    - アプリ内ユーザーを表現する補助テーブル（将来の拡張用）。
- `public.daily_record_store`
  - カラム：
    - `id` (uuid, PK)
    - `user_id` (uuid, FK → `app_user.id`)
    - `record_date` (date)
    - `record_json` (jsonb) — `DailyRecordAggregate` を丸ごと保存
    - `saved_at` (timestamp)
  - 制約：
    - `UNIQUE (user_id, record_date)`
- そのほかの正規化テーブル（将来用）：
  - `daily_record`, `weight_record`, `wellness_record`
  - `meal_record`, `meal_attachment`, `food_item`, `food_material`
  - `exercise_session`, `exercise_item`, `set_item`
  - ※現時点ではまだアプリコードからは直接使っていない（ER 図の土台として作成済み）。

### 2-2. RLS（Row Level Security）

- `app_user`
  - ポリシー：`auth.uid() = id` の行だけ読み書き可能。
- `daily_record_store`
  - ポリシー：`auth.uid()` に紐づく `app_user.id` と一致する `user_id` のみ操作可。
- これにより「ログイン中ユーザー以外の記録」は参照・更新・削除できない。

---

## 3. 実装済みのアプリ側機能

### 3-1. 認証（AuthContext / AuthPanel）

- ライブラリ：
  - `@supabase/supabase-js`
- 設定：
  - `supabaseClient.ts` で `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を使用しクライアント生成。
- コンポーネント：
  - `AuthContext.tsx`
    - `useAuth()` フックで `user` / `session` を提供。
  - `AuthPanel.tsx`
    - メールアドレス入力欄
    - 「ログインリンク送信」ボタン
    - ログイン中はメール＆ `userId` を表示し、ログアウトボタンを表示。
- 動作：
  - Magic Link を使ったログイン／ログアウトが UI レベルで確認済。
  - ログイン後、`AuthContext` から `user.id` を Supabase 連携時に使用。

### 3-2. DailyRecord Supabase 連携

- ファイル：`app/dailyRecordSupabaseService.ts`
- 主な役割：
  - **保存（Create/Update）**
    - `saveDailyRecordToSupabase({ userId, date, record })`
    - `daily_record_store` を `(user_id, record_date)` で UPSERT
    - `record_json` に `DailyRecordAggregate` を保存
  - **取得（Read）**
    - `getDailyRecordFromSupabase({ userId, date })`
    - 指定ユーザー＋日付のレコードを1件取得 → JSON を `DailyRecordAggregate` として返す
  - **削除（Delete）**
    - `deleteDailyRecordFromSupabase({ userId, date })`
    - `(user_id, record_date)` に対応する行を削除

### 3-3. dailyRecordService との接続

- ファイル：`app/dailyRecordService.ts`
- 責務：
  - UI からの「保存／読込／削除／履歴取得」のユースケースをまとめて扱う。
  - localStorage ベースの既存フローに、Supabase バックアップ処理を追加。
- 現状の挙動（ざっくり）：
  - **保存**：
    - localStorage への保存（従来通り）
    - ログイン中であれば Supabase にも `DailyRecordAggregate` を UPSERT
  - **読込**：
    - 今は localStorage 主体（※Supabase 主体に切り替えるかは v2.0 の設計ポイント）
  - **削除**：
    - localStorage の対象キー削除
    - ログイン中であれば Supabase 側の `(user_id, record_date)` も削除

### 3-4. UI 統合（DailyRecordFormV110）

- ファイル：`ui/DailyRecordFormV110.tsx`
- 追加された要素：
  - フォームヘッダに **モード切替トグル**：
    - `編集` / `表示・保存`
  - `保存` ボタン押下により `dailyRecordService.save()` 実行
  - 「保存・読出」タブで履歴一覧を表示し、選択した日付の読込／削除が可能
- AuthPanel は `App.tsx` でフォームの上部に配置されており、
  - ログイン状態は `useAuth()` 経由で DailyRecord 関連サービスに渡る構成。

---

## 4. ここまでで「完了」とみなせる範囲

1. Supabase プロジェクト作成（DB/API/RLS 初期設定）
2. 認証（Magic Link）導入
3. `app_user` / `daily_record_store` テーブルと FK の設定
4. `daily_record_store` への **Create / Update / Delete** 実装
5. DailyRecordForm v1.1.0 からの保存が Supabase に反映されることを確認
6. 手動レベルの CRUD テストで、整合性が取れていることを確認済み

---

## 5. これからやること（残タスク）

### 5-1. システムテスト（正式版）実施

- この引き継ぎ書とは別に「システムテストケース.md」を準備（後述の②）。
- ログイン〜CRUD〜RLS を一通りなぞるシナリオテストを実施して、
  - Supabase 側の JSON と UI 表示がズレていないか
  - 異常系でのメッセージ／挙動
  を確認する。
- ここまで完了した状態を「Step①：JSON でのオンライン化完了」とみなす。


### 5-2. ER 図ベースのモデル構築（v2.0.0 の設計作業）

- `schema_updated.dbml` ＋ Supabase ER 図をソースオブトゥルースに、
  - Domain モデル（`domain/type.ts`）との突き合わせ
  - Aggregate と正規化テーブルのマッピング整理
- `db_aggregate_mapping_updated.md` の内容を最新ER図に合わせてアップデートし、
  - Meal / Exercise / Food / Wellness 各ドメインの **IDベース参照** UI に耐えられる設計へ更新。
- 上記を踏まえて、
  - 「正規化テーブル ←→ DailyRecordAggregate」のマッパー層を設計・実装する。

### 5-3. 正規化テーブルへの切替（ソースオブトゥルース変更）

- Step①（v1.1.x 系）：
  - 「Supabase JSON（`daily_record_store`）」を一次データストアとし、  
    localStorage は補助的なキャッシュ／バックアップとして扱う。
- Step②（v2.0.0）：
  - 永続化のソースオブトゥルースを **正規化テーブル群** に切り替える。
  - 保存フロー：
    - 正規化テーブルに INSERT/UPDATE した上で、
    - 必要に応じて `daily_record_store.record_json` に 1日分スナップショットを保存（任意）。
  - 読み出しフロー：
    - 正規化テーブルから集約して `DailyRecordAggregate` を構築する実装に差し替える。
  - これに伴い、localStorage の役割は最小限（オフライン一時保存など）に縮小していく。

### 5-4. v2.0.0 フェーズでのデータ移行（localStorage & JSON → 正規化テーブル）


- 対象データ：
  - localStorage に残っている既存履歴（v1.x までの全日付）
  - Supabase `daily_record_store.record_json` に保存されている JSON Aggregate
- 方針：
  - `daily_record_store.record_json`（または localStorage）から `DailyRecordAggregate` を読み出し、
  - ER 図に基づいた正規化テーブル群  
    （`daily_record / weight_record / wellness_record / meal_record / food_item / ...`）  
    へ分解して保存する ETL（移行処理）を実装する。
- 実行タイミング：
  - v2.0.0 リリース直前 or 初回起動時に一括実行するバッチ／スクリプトとして準備。
  - 実行済みフラグ（例：`migration_v2_0_done`）を DB or アプリ設定に保持し、二重実行を防ぐ。



---

## 6. v2.0.0 のゴールイメージ

- Step① で実現した「Supabase JSON によるオンライン化」が安定運用されている。
- Step②（v2.0.0 完了時点）では：
  - localStorage と Supabase JSON（`daily_record_store.record_json`）に存在する全レコードが、
    正規化テーブル群に移行されている。
  - DailyRecordForm v2.0.x は、
    - 正規化テーブルを一次データストアとして CRUD を行い、
    - 必要に応じて 1日分スナップショットとして JSON を併用する。
  - 食事・運動・体重・体調が正規化テーブルを通じて保存され、
    - ID ベースでの再利用・集計・可視化、
    - 将来の分析・レコメンド機能の土台として利用できる。

以上。