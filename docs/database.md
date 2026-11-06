# Database / Persistence

## Purpose

この文書は Meal & Training Logger の現行永続化方式と Supabase 構成を説明する。
過去 version ごとの DB 設計資料は Git history を参照し、現行 Repository に版別コピーを保持しない。

DB DDL の SSOT は `supabase/migrations/`。現行初期 DDL は `supabase/migrations/20260902090014_current_app_baseline.sql`。

この baseline は空の新規 Supabase DB 専用であり、既存本番 DB には未適用。既存本番には同名 object が存在するため、この SQL を実行してはならない。既存本番 DB はobjectとdataの事前確認後、2026-09-08にbaseline versionをschema適用済みとしてmigration historyへ履歴だけ接続した。baseline SQL自体は実行していない。以後もこの baseline を既存本番へ再実行しない。

## Current persistence model

アプリの1日分データ契約は `src/domain/type.ts` の `DailyRecordAggregate` を基準とする。

環境ごとの接続先と稼働中の保存経路は [現行環境](current-state.md) を参照する。

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

Supabaseへの保存・読出・履歴・削除は `src/app/dailyRecordPersistence.ts` がbuild設定に対応するサービスへ委譲する。

Supabase persistence service は save / read / delete の成功・not-found・errorを
呼び出し側が区別できる result contract と、record date降順のremote history APIを持つ。
service unit tests と DailyRecordForm component tests を持つ。履歴は Supabase の
`record_date` と aggregate 内の `daily_record.updated_at` を使用する。

Supabase client は development / production を問わず初期化されるため、ローカル開発でも `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` が必要。

### `public.daily_record_store`

主要列:

- `id`: uuid, primary key
- `user_id`: uuid, `app_user.id` への foreign key
- `record_date`: date
- `record_json`: jsonb
- `saved_at`: timestamptz

`user_id + record_date` はuniqueで、1ユーザー・1日につき1件のaggregateを保持する。所有者RLSを適用し、アプリによる直接書き込みはDBが `jsonb` モードのときだけ許可する。

### `public.app_user`

Supabase Auth のユーザーに対応するアプリユーザーテーブル。
RLS は有効で、ユーザー本人の行のみ操作可能とする。

## Normalized schema

正規化データは以下のテーブルで構成する。

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

正規化テーブルは所有者RLSを適用する。authenticatedは自分の行を参照でき、保存・削除は所有者を確認するRPCを通す。

### Normalized schema and RPC contract

`20260911085026_normalized_schema_contract.sql` は全childの `user_id`、tenant-qualified composite FK、order / enum constraint、index、food draftのnullable列を定義する。全正規化tableが空であることを適用前に検証する。

`20260911091026_normalized_atomic_write_rpc.sql` はauthenticated ownership RLSと明示grant、`save_daily_record_normalized(jsonb)` を定義する。RPCは `SECURITY INVOKER`、空の `search_path`、authenticated限定EXECUTEとし、最初の保存で `app_user` を冪等作成する。同じuser/dateのrootをlockし、root ID / created_atを維持して全childをtransaction内で置換する。root updated_atはDB transaction時刻とする。schema contractとRPCの両migrationはlive適用済み。

- `src/app/dailyRecordNormalizedWriteMapper.ts` / `dailyRecordNormalizedWriteService.ts`: aggregateの検証・order正規化と保存RPC呼出。
- `src/app/dailyRecordNormalizedQueryService.ts`: root起点のrelational read、root列だけのhistory、atomic delete RPC。親子関係はmigrationのcomposite FK名を指定する。
- `src/app/dailyRecordNormalizedReadMapper.ts`: DB responseからaggregateへ復元。全childのowner / parent ID、型、必須field、TEXT / SETSを検証し、不正な応答をpartial recordとして返さない。wellnessはnull / 0行をnull、1行をobjectとして復元し、複数行を拒否する。

読込は各階層の保存済みorderでsortし、order値、ID、timestamp、foodのnullを保持する。DB専用child user_idとrelation fieldをdomain objectへ持ち込まない。historyは `record_date` 降順のkeyset paginationを使い、空pageまで取得する。途中の失敗時にpartial historyを成功扱いにしない。

readは `found / not_found / error`、deleteは `deleted / not_found / error`、historyは `success / error` を返す。delete RPCは認証userと指定dateでrootを削除し、clientは返却identityを確認する。FoodMaterialは現行aggregateに存在しないためread/write mapperの対象外であり、root削除時はFK cascadeに含まれる。

`src/app/dailyRecordPersistence.ts` はbuild時の `VITE_DAILY_RECORD_PERSISTENCE` でUI経路を選択する。既定値は `jsonb`。 `normalized` では読込・履歴・保存・削除を正規化サービスへ接続し、エラーは画面に伝える。別の保存先への自動fallbackは行わない。

`20261105214519_private_backfill_ledger.sql` はnormalized writerを共通化し、private ledgerと管理者向けinvoker routineを追加する。live適用済み。台帳と管理者向けroutineはbrowser roleからアクセスできず、private schemaはData APIに公開されていない。検証手順は [backfill runbook](backfill.md) を参照する。

`20261105220611_narrow_jsonb_runtime_access.sql` はlive適用済み。既存JSONB経路のownership policyをauthenticatedに限定し、`app_user` のSELECT / INSERT / UPDATEと `daily_record_store` のCRUDをauthenticatedへgrantする。

`20261106033054_atomic_cutover_mirror.sql` はDBの書込モードとmirror対応RPCを追加する。本番への適用状況は [現行環境](current-state.md) を参照する。保存と削除は正規化データとJSONB mirrorを同一transactionで更新する。mirrorは保存済みの正規化データから導出し、運動時刻はJSTのoffset付きで格納する。書込モードと復旧手順は [切替runbook](cutover.md) を参照する。

## Baseline differences from live

安全な新規環境と意図された正規形を優先し、baseline には以下の意図的差分がある。

- live の `daily_record_store(user_id, record_date)` には同一定義の UNIQUE constraint が2個あるが、baseline は `daily_record_store_user_date_key` 1個だけを持つ。

`app_user.id` は `auth.users.id` を参照する。正規化経路では最初の保存時にRPCが `app_user` を作成する。

## SSOT rule

優先順位:

1. アプリのデータ契約: `src/domain/type.ts`
2. 永続化サービスの選択: `src/app/dailyRecordPersistence.ts`
3. Supabase schema / RLS: `supabase/migrations/`

`src/legacy/localStorage/readLegacyDailyRecords.ts` は migration input の読取境界であり、
現行 persistence の SSOT ではない。

Excel / DBML / version 別 Markdown を並列の正本として管理しない。

## Change planning

DBの未実装要求、優先順位、migration / cutover計画、進捗は GitHub Issues を正とする。
この文書は現行DB / persistenceの仕様と安全制約だけを保持する。
