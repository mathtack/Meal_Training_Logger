# Database / Persistence

## Purpose

このディレクトリは、Meal & Training Logger の永続化方式と Supabase 上の現行構成を説明する。

過去バージョンごとの DB 設計資料は Git 履歴を参照し、現行 Repository には版別コピーを保持しない。

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
また、これらは public schema に存在する一方で RLS が無効である。

したがって、これらを現行 DB 仕様の SSOT として扱わない。
再利用する場合は、用途を明示して migration / RLS / application code を同時に整備する。
不要と判断した場合は、Git 管理 migration を用意した上で Supabase から削除する。

## SSOT rule

現時点の優先順位は以下とする。

1. アプリのデータ契約: `src/domain/type.ts`
2. 実際の永続化処理: `src/domain/storage/dailyRecordStorage.ts`, `src/app/dailyRecordSupabaseService.ts`
3. Supabase schema / RLS: 今後 Git 管理 migration を導入して SSOT 化する

Excel / DBML / version 別 Markdown を並列の正本として管理しない。

## Next database modernization

- Supabase の現行 schema / RLS を Git 管理 migration として取得する
- 未使用の正規化テーブルを削除するか、将来利用するかを確定する
- 未使用テーブルを残す場合は RLS を含めて安全な状態へ修正する
- migration 導入後は、この文書を概要説明に限定し、DDL の詳細は migration を正とする
