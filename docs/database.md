# Database / Persistence

## Purpose

この文書は Meal & Training Logger の現行永続化方式と Supabase 構成を説明する。
過去 version ごとの DB 設計資料は Git history を参照し、現行 Repository に版別コピーを保持しない。

DB DDL の SSOT は `supabase/migrations/`。現行初期 DDL は `supabase/migrations/20260902090014_current_app_baseline.sql`。

この baseline は空の新規 Supabase DB 専用であり、既存本番 DB には未適用。既存本番には同名 object が存在するため、この SQL を実行してはならない。既存本番 DB はobjectとdataの事前確認後、2026-09-08にbaseline versionをschema適用済みとしてmigration historyへ履歴だけ接続した。baseline SQL自体は実行していない。以後もこの baseline を既存本番へ再実行しない。

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

現行 remote persistence は JSONB 保存。正規化 RDB 用のサービスは下記のとおり実装されているが、画面の保存・読込・履歴・削除経路からは利用しない。切替計画と進捗は GitHub Issues で管理する。

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

## Normalized schema and dormant services

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

2026-09-08 確認時点では全て 0 rows で、現行アプリの Supabase 保存経路から参照されていない。
Git 履歴の旧 Excel / DBML / aggregate mapping と現行 `src/domain/type.ts` の確認結果から、将来採用候補として baseline に保持している。

baseline は新規環境で危険な状態を再生しないよう、10 table を RLS enabled・policyなし・browser role grantなしの deny-by-default で作成する。liveにも `20260907121742_harden_dormant_normalized_tables.sql` を適用済みで、同じdeny-by-default状態とする。allow policyとbrowser role grantは、ownership modelとruntime persistenceを実装・レビューするまで追加しない。

採用時は aggregate contract、write / read / delete unit、ownership chain、RLS、grant、migration / cutover を確定し、application code と後続 migration を同時に整備する。詳細 Backlog は Issue #47 を正とする。

### Repository contract

`20260911085026_normalized_schema_contract.sql` は全childの `user_id`、tenant-qualified composite FK、order / enum constraint、index、food draftのnullable列を定義する。全正規化tableが空であることを適用前に検証する。

`20260911091026_normalized_atomic_write_rpc.sql` はauthenticated ownership RLSと明示grant、`save_daily_record_normalized(jsonb)` を定義する。RPCは `SECURITY INVOKER`、空の `search_path`、authenticated限定EXECUTEとし、最初の保存で `app_user` を冪等作成する。同じuser/dateのrootをlockし、root ID / created_atを維持して全childをtransaction内で置換する。root updated_atはDB transaction時刻とする。両migrationはlive適用済みの記述ではない。

- `src/app/dailyRecordNormalizedWriteMapper.ts` / `dailyRecordNormalizedWriteService.ts`: aggregateの検証・order正規化と保存RPC呼出。
- `src/app/dailyRecordNormalizedQueryService.ts`: root起点の1回のrelational read、root列だけのhistory、root削除とFK cascade。親子関係はmigrationのcomposite FK名を指定する。
- `src/app/dailyRecordNormalizedReadMapper.ts`: DB responseからaggregateへ復元。全childのowner / parent ID、型、必須field、TEXT / SETSを検証し、不正な応答をpartial recordとして返さない。wellnessはnull / 0行をnull、1行をobjectとして復元し、複数行を拒否する。

読込は各階層の保存済みorderでsortし、order値、ID、timestamp、foodのnullを保持する。DB専用child user_idとrelation fieldをdomain objectへ持ち込まない。historyは `record_date` 降順のkeyset paginationを使い、空pageまで取得する。途中の失敗時にpartial historyを成功扱いにしない。

readは `found / not_found / error`、deleteは `deleted / not_found / error`、historyは `success / error` を返す。deleteはuser/dateで絞った1 rootの返却identityを確認する。cutover期間のrollback mirrorはこの削除サービスには含まれない。FoodMaterialは現行aggregateに存在しないためread/write mapperの対象外であり、root削除時はFK cascadeに含まれる。

これらのサービスはcurrent UIからimportしない。実PostgRESTでのrelationship解決とAPIの行数上限は、live適用・切替時に実環境で検証する。

`20261105214519_private_backfill_ledger.sql` はnormalized writerを共通化し、private ledgerと管理者向けinvoker routineを追加する。Repositoryでの検証手順とlive適用前の条件は [backfill runbook](backfill.md) を参照する。

`20261105220611_narrow_jsonb_runtime_access.sql` は、既存JSONB経路のownership policyをauthenticatedに限定し、`app_user` のSELECT / INSERT / UPDATEと `daily_record_store` のCRUDだけをbrowser roleへgrantする。Repositoryで検証済みのforward migrationであり、liveの権限は適用時のpostflightで確認する。

## Baseline differences from live

安全な新規環境と意図された正規形を優先し、baseline には以下の意図的差分がある。

- live の `daily_record_store(user_id, record_date)` には同一定義の UNIQUE constraint が2個あるが、baseline は `daily_record_store_user_date_key` 1個だけを持つ。
- live の主要2 policy は `TO public` だが、baseline は `TO authenticated` とする。ownership 条件は同じ。
- live の主要2 tableは `anon` / `authenticated` に広い table privilegeを持つが、baseline は `authenticated` に `SELECT / INSERT / UPDATE / DELETE` だけを与える。

未使用正規化10 tableのRLS・grant状態は、後続hardening migrationにより現在はbaselineと同じdeny-by-defaultであり、上記の差分には含まれない。

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
