# Database / Persistence

## Purpose

この文書は Meal & Training Logger の現行永続化方式と Supabase 構成を説明する。
過去 version ごとの DB 設計資料は Git history を参照し、現行 Repository に版別コピーを保持しない。

DB DDL の SSOT は `supabase/migrations/`。現行初期 DDL は `supabase/migrations/20260902090014_current_app_baseline.sql`。

この baseline は空の新規 Supabase DB 専用であり、既存本番 DB には未適用。既存本番には同名 object が存在するため、この SQL を実行してはならない。既存本番 DB は現時点で baseline migration history へ接続していない。将来変更は GitHub Issues で計画し、この baseline を既存本番へ再実行しない。

## Current persistence model

アプリの1日分データ契約は `src/domain/type.ts` の `DailyRecordAggregate` を基準とする。

保存先は development / production で切り替えていない。

- 未ログイン: DailyRecord の永続化操作にはログインが必要。
- ログイン中: 保存・読込・履歴・削除は Supabase のみを正式経路とする。
- Supabase read の `not_found` は空の新規レコードとして扱う。
- Supabase read の `error` は読込失敗として表示し、localStorage へ自動 fallback しない。
- Supabase save / delete の成功確認後だけ、UI の保存済み状態・履歴を更新する。

旧 localStorage repository / service / write storage は廃止済み。browser に残る
`daily_record:<ISODate>` データは削除せず、将来の migration 調査用入力としてだけ扱う。
`src/legacy/localStorage/readLegacyDailyRecords.ts` は、呼出側から明示的に渡された storage の
対象 key だけを読み、現行 aggregate の top-level shape と key / record date の整合を確認する。
不正候補は reason と raw value を返し、正規化、書込、削除、clear、クラウドへの自動昇格を行わない。
現行 application runtime はこの reader を import しない。Supabase Auth が session 維持に利用する
storage は別責務であり、この変更では Auth 設定・session data の読み書き・ログイン挙動を変更しない。

Supabase への保存・読出・削除は `src/app/dailyRecordSupabaseService.ts` が担当する。
現行アプリが利用する主要テーブルは `public.daily_record_store` で、1ユーザー・1日につき1件の `record_json` として `DailyRecordAggregate` を保存する。

Supabase persistence service は save / read / delete の成功・not-found・errorを
呼び出し側が区別できる result contract と、record date降順のremote history APIを持つ。
service unit tests と DailyRecordForm component tests を持つ。履歴は Supabase の
`record_date` と aggregate 内の `daily_record.updated_at` を使用する。

現行 remote persistence は正規化 RDB への行単位保存ではなく JSONB 保存。正規化 table 群への persistence は未実装であり、将来変更は GitHub Issues で管理する。この文書へ実装計画や進捗を複製しない。

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
2. 実際の永続化処理: `src/app/dailyRecordSupabaseService.ts`
3. Supabase schema / RLS: `supabase/migrations/`

`src/legacy/localStorage/readLegacyDailyRecords.ts` は migration input の読取境界であり、
現行 persistence の SSOT ではない。

Excel / DBML / version 別 Markdown を並列の正本として管理しない。

## Change planning

DBの未実装要求、優先順位、migration / cutover計画、進捗は GitHub Issues を正とする。
この文書は現行DB / persistenceの仕様と安全制約だけを保持する。
