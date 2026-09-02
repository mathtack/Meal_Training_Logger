# Database / Persistence

## Purpose

このディレクトリは、Meal & Training Logger の永続化方式と Supabase 上の現行構成を説明する。

過去バージョンごとの DB 設計資料は Git 履歴を参照し、現行 Repository には版別コピーを保持しない。

DB DDL のSSOTは `supabase/migrations/` に置く。現行の初期DDLは `supabase/migrations/20260902090014_current_app_baseline.sql`。

このbaselineは空の新規Supabase DB専用であり、既存本番DBには未適用である。既存本番には同名objectが既に存在するため、このSQLを実行してはならない。既存本番をmigration管理へ接続する手順は別段階で決める。

## Current persistence model

アプリの1日分データの契約は `src/domain/type.ts` の `DailyRecordAggregate` を基準とする。

保存先は development / production で切り替えていない。開発環境と Vercel 本番環境では同じ persistence logic が動作し、保存・読込経路は主にログイン状態で分岐する。

- 未ログイン: localStorage のみを利用する。
- ログイン中の保存: localStorage に保存した後、Supabase にも remote 保存する。
- ログイン中の読込: Supabase を優先し、対象データが無い場合や取得できない場合は localStorage を利用する。
- Supabase 保存失敗時も、先に完了した localStorage の保存は残る。

ローカル保存は `src/domain/storage/dailyRecordStorage.ts` が担当し、localStorage の `daily_record:<ISODate>` に `DailyRecordAggregate` を JSON 保存する。

Supabase への保存・読出・削除は `src/app/dailyRecordSupabaseService.ts` が担当する。
現行アプリが利用する主要テーブルは `public.daily_record_store` であり、1ユーザー・1日につき1件の `record_json` として `DailyRecordAggregate` を保存する。

現行の remote persistence は正規化 RDB への行単位保存ではなく、JSONB 保存である。正規化テーブル群への persistence は未実装。

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

## Unused normalized schema

Supabase には以下の正規化テーブルも存在する。

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

2026-09-02 時点では、これらのテーブルは全て 0 rows で、現行アプリの Supabase 保存経路からは参照されていない。

Git履歴の旧Excel / DBML / aggregate mappingと現行 `src/domain/type.ts` を確認した結果、これらは日次・体重・wellness・食事・food material・運動を正規化保存するために意図して設計された将来採用候補である。

liveではpublic schemaに存在する一方でRLSが無効である。baselineはこの危険な状態を新規環境へ再生せず、10 tableをRLS enabled・policyなし・`anon` / `authenticated` grantなしのdeny-by-defaultで作成する。liveのRLS状態はこの作業では変更していない。

したがって、これらを現行application persistenceとしては扱わないが、削除前提にも置かない。
採用時は、aggregate contract、書込 / 読込単位、ownership chain、RLS policy、grant、移行方法を確定し、application codeと後続migrationを同時に整備する。

## Baseline differences from live

安全な新規環境と意図された正規形を優先し、baselineには次の意図的差分がある。live DBは未変更。

- liveの `daily_record_store(user_id, record_date)` には同一定義のUNIQUE constraintが2個あるが、baselineは `daily_record_store_user_date_key` 1個だけを持つ。
- liveの主要2 policyは `TO public` だが、baselineは認証済み利用を明示する `TO authenticated` とする。ownership条件は同じ。
- liveは全12 tableについて `anon` / `authenticated` / `service_role` に広いtable privilegeを持つが、baselineは主要2 tableの `authenticated` に `SELECT / INSERT / UPDATE / DELETE` だけを与える。
- liveの未使用正規化10 tableはRLS disabledだが、baselineはdeny-by-defaultとする。

`app_user.id` は `auth.users.id` を参照する。liveにもsourceにもAuth user作成時の `app_user` 自動作成triggerはなく、現行sourceは `app_user` を作成しない。新規user provisioning方法は未解決であり、baselineでは推測実装していない。

## SSOT rule

現時点の優先順位は以下とする。

1. アプリのデータ契約: `src/domain/type.ts`
2. 実際の永続化処理: `src/domain/storage/dailyRecordStorage.ts`, `src/app/dailyRecordSupabaseService.ts`
3. Supabase schema / RLS: `supabase/migrations/`

Excel / DBML / version 別 Markdown を並列の正本として管理しない。

## Next database modernization

- baselineを新規DBとして再生し、schema / constraint / index / RLS / policy / grantを検証する
- 既存本番DBへbaselineを再実行せず、migration履歴へ安全に接続する方法を決める
- liveの未使用正規化10 tableをdeny-by-defaultへ移行する後続migrationと適用計画を決める
- 正規化persistence採用時に、旧設計を現行要件へ再評価してapplication codeと後続migrationを実装する
