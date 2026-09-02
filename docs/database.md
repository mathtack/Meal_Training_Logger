# Database / Persistence

## Purpose

この文書は Meal & Training Logger の現行永続化方式と Supabase 構成を説明する。
過去 version ごとの DB 設計資料は Git history を参照し、現行 Repository に版別コピーを保持しない。

DB DDL の SSOT は `supabase/migrations/`。現行初期 DDL は `supabase/migrations/20260902090014_current_app_baseline.sql`。

この baseline は空の新規 Supabase DB 専用であり、既存本番 DB には未適用。既存本番には同名 object が存在するため、この SQL を実行してはならない。既存本番を migration 管理へ接続する手順は別タスクで決定する。

## Current persistence model

アプリの1日分データ契約は `src/domain/type.ts` の `DailyRecordAggregate` を基準とする。

保存先は development / production で切り替えていない。

- 未ログイン: localStorage のみを利用する。
- ログイン中の保存: localStorage に保存した後、Supabase にも remote 保存する。
- ログイン中の読込: Supabase を優先し、対象データが無い場合や取得できない場合は localStorage を利用する。
- Supabase 保存失敗時も、先に完了した localStorage の保存は残る。

ローカル保存は `src/domain/storage/dailyRecordStorage.ts` が担当し、localStorage の `daily_record:<ISODate>` に `DailyRecordAggregate` を JSON 保存する。

Supabase への保存・読出・削除は `src/app/dailyRecordSupabaseService.ts` が担当する。
現行アプリが利用する主要テーブルは `public.daily_record_store` で、1ユーザー・1日につき1件の `record_json` として `DailyRecordAggregate` を保存する。

現行 remote persistence は正規化 RDB への行単位保存ではなく JSONB 保存。正規化 table 群への persistence は未実装で、追加開発は GitHub Issue #47 `Implement normalized Supabase persistence` で管理する。

Supabase client は development / production を問わず初期化されるため、ローカル開発でも `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` が必要。

### `public.daily_record_store`

主要列:

- `id`: uuid, primary key
- `user_id`: uuid, `app_user.id` への foreign key
- `record_date`: date
- `record_json`: jsonb
- `saved_at`: timestamptz

`user_id + record_date` は unique で、アプリはこの組み合わせを upsert key として利用する。
RLS は有効で、ログインユーザーが自身の `user_id` の行だけを操作できる policy を持つ。

### `public.app_user`

Supabase Auth のユーザーに対応するアプリユーザーテーブル。
RLS は有効で、ユーザー本人の行のみ操作可能とする。

## Normalized schema reserved for future use

Supabase には以下の正規化 table も存在する。

- `daily_record`
- `weight_record`
- `wellness_record`
- `meal_record`
- `meal_attachment`
- `food_item`
- `food_material`
- `exercise_session`
- `exercise_item`
- `set_item`

2026-09-02 確認時点では全て 0 rows で、現行アプリの Supabase 保存経路から参照されていない。
Git 履歴の旧 Excel / DBML / aggregate mapping と現行 `src/domain/type.ts` の確認結果から、将来採用候補として baseline に保持している。

live では RLS disabled のままだが、baseline は新規環境で危険な状態を再生しないよう、10 table を RLS enabled・policyなし・browser role grantなしの deny-by-default で作成する。live 側はこの modernization では変更していない。

採用時は aggregate contract、write / read / delete unit、ownership chain、RLS、grant、migration / cutover を確定し、application code と後続 migration を同時に整備する。詳細 Backlog は Issue #47 を正とする。

## Baseline differences from live

安全な新規環境と意図された正規形を優先し、baseline には以下の意図的差分がある。live DB は未変更。

- live の `daily_record_store(user_id, record_date)` には同一定義の UNIQUE constraint が2個あるが、baseline は `daily_record_store_user_date_key` 1個だけを持つ。
- live の主要2 policy は `TO public` だが、baseline は `TO authenticated` とする。ownership 条件は同じ。
- live は全12 tableについて browser role に広い table privilege を持つが、baseline は主要2 tableの `authenticated` に `SELECT / INSERT / UPDATE / DELETE` だけを与える。
- live の未使用正規化10 tableは RLS disabled だが、baseline は deny-by-default とする。

`app_user.id` は `auth.users.id` を参照する。live にも source にも Auth user 作成時の `app_user` 自動作成 trigger はなく、現行 source は `app_user` を作成しない。新規 user provisioning 方法は未解決で、baseline では推測実装していない。

## SSOT rule

優先順位:

1. アプリのデータ契約: `src/domain/type.ts`
2. 実際の永続化処理: `src/domain/storage/dailyRecordStorage.ts`, `src/app/dailyRecordSupabaseService.ts`
3. Supabase schema / RLS: `supabase/migrations/`

Excel / DBML / version 別 Markdown を並列の正本として管理しない。

## Open work

移送前提ではない DB 追加開発は GitHub Issues で管理する。

- normalized Supabase persistence: Issue #47
- 既存本番 DB を baseline 再実行なしで migration history へ接続する方法
- `app_user` provisioning
- live の未使用正規化10 table の安全化
- Docker 利用可能環境での Supabase official local stack / `db reset` 追加確認
