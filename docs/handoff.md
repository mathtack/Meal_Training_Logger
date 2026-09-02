# Meal & Training Logger - Handoff

更新日: 2026-09-02

## 1. この文書の役割

この文書は作業中断・再開用の最新チェックポイントである。

- 過去状態は Git history を参照する。
- version 別 handoff は作らない。
- 再開時はいきなり変更せず、Git 状態と baseline を確認する。

## 2. 現在の目的

Meal & Training Logger を SELENA だけで開発する状態から、ASTRAEA を常時利用可能な Codex 作業ノードとして使える状態へ移行する。

最終形:

```text
Remote instruction
  -> ASTRAEA
  -> Codex CLI
  -> latest main
  -> codex/<task-name>
  -> edit / verify / commit / push or PR
```

Repository 内の README / AGENTS / code / tests / handoff だけで、安全に作業開始できることを目標とする。

## 3. 現在のフェーズ

### Step 1: Repository Modernization — IN PROGRESS

ASTRAEA clone 前に、Repository を現行 SSOT 構成へ整理している。

現在の作業 branch:

`codex/version-name-cleanup`

`main` を直接編集しない。

## 4. Baseline

2026-09-02 にユーザー環境で確認済み:

- `npm run build`: PASS
- `npm test -- --run`: PASS
  - 6 test files
  - 15 tests passed
  - skipped 0
- `npm run deps:circular`: PASS
  - circular dependency なし
- `npm run lint`: FAIL
  - 30 existing errors

Modernization 中の最低条件:

- build を壊さない
- tests を壊さない
- circular dependency を発生させない
- lint error を 30 から増やさない

source cleanup 後もユーザー環境で baseline に変化がないことを確認済み。

## 5. 完了した Repository 整理

### 不要物 / legacy

完了済み:

- `.bak` 撤去
- 未使用 asset の一部撤去
- `src/legacy` 撤去
- legacy migration の死んだ実装・コメント・test 撤去
- Madge の legacy exclude 撤去
- obsolete migration test 撤去

### version 表現 / SSOT 整理

方針:

- Git を version history の正本とする。
- 現行 source / docs のファイル名・フォルダ名に履歴管理目的の version を付けない。
- `old/`, `backup/`, `.bak`, version 別コピーを原則作らない。
- アプリ version 自体は継続し、`package.json` を正とする。
- データ互換性など意味のある version semantics は、意味を確認してから変更する。

完了:

- `DailyRecordFormV110.tsx` -> `DailyRecordForm.tsx`
- `DailyRecordFormV110` -> `DailyRecordForm`
- 画面タイトルの `v1.1.0` 表記撤去
- App の旧フォームコメントアウト撤去
- `src/main.tsx` の死んだ `migrateAllLegacyHistoryToV110` コメント撤去
- `dailyRecordStorage.ts` の `loadV110` / `v110` / `v1.1.0 only` を現行の汎用表現へ変更
- `dailyRecordReport.ts` の version 由来履歴コメントを現在ルールの説明へ変更

### DB docs

旧 version 別 DB 資料を撤去:

- `docs/db/v1.1.0/`
- `docs/db/v1.2.0/`
- DB 設計 Excel / DBML / 重複 Markdown

現行概要:

- `docs/db/README.md`

### Test docs

version 別 Test Plan を撤去し、現行2枚へ統合:

- `docs/test/README.md`
- `docs/test/system-test.md`

自動テストの SSOT は `src/**/*.test.ts`。

### UX docs

現行実装と矛盾していた旧仕様書を撤去:

- `docs/ux/screen_spec_v110.md`
- `docs/ux/daily-record-report-tab-spec.md`

レポート挙動は現行 implementation / automated tests を正とする。

### Repository entry / setup documents

新規 / 再構築:

- root `README.md`
- `AGENTS.md`
- `.env.example`

`.env.example` は以下の必要変数名のみを Git 管理し、実値は含めない。

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`.env.local` は `.gitignore` の `*.local` で除外される。

撤去:

- obsolete `docs/README.md`
- obsolete `docs/deps.md`
- generated `docs/deps.svg`

`npm run deps:graph` は必要時のみ生成し、graph を設計 SSOT として扱わない。

## 6. 現行 persistence / Supabase

重要: 保存先は development / production では分岐していない。開発環境と Vercel 本番環境では同じ persistence logic が動く。

実際の保存・読込経路は主にログイン状態で分岐する。

- 未ログイン: localStorage のみ
- ログイン中の保存: localStorage に保存後、Supabase にも remote 保存
- ログイン中の読込: Supabase 優先、対象データが無い場合は localStorage
- Supabase 保存失敗時も、先に完了した localStorage 保存は残る

Supabase client は development / production を問わず初期化されるため、ローカル開発でも `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` が必要。

現行 application code が利用する remote persistence:

- `public.daily_record_store`
- `record_json` に `DailyRecordAggregate` を JSONB 保存
- `user_id + record_date` を upsert key とする
- RLS enabled
- 現行 remote persistence は正規化 RDB への行単位保存ではない

2026-09-02 に read-only で再確認した正確な row count:

- `app_user`: 3 rows
- `daily_record_store`: 19 rows

Supabase には旧正規化設計由来の以下の table も残存する:

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

確認時点では全て 0 rows で、現行 source の Supabase 保存経路から参照されていない。
これら10 table は public schema にあり RLS disabled のため、Supabase Security Advisor で ERROR になっている。

`daily_record_store` には `user_id + record_date` に対する UNIQUE 制約が2個あり、将来 migration 化時の整理候補。

この modernization 中、live Supabase schema の変更・削除はまだ行っていない。

### ③-A: 現状取得 — COMPLETED

対象 project: `meal-training-logger` (`ap-northeast-1`, PostgreSQL 17)。

Supabase の read-only catalog query と Repository の現行 source / docs を突合した。live DB への DDL、policy / constraint 変更、data row の内容閲覧は行っていない。

取得事実:

- `public` には `app_user`, `daily_record_store` と未使用正規化10 table の計12 table が存在する。
- 全12 table の owner は `postgres`。列順、型、NULL可否、default、PK、FK、UNIQUE、index、RLS、policy、API role grant を確認済み。
- ID列は `daily_record_store.id` だけ `gen_random_uuid()` default を持つ。他の正規化tableのUUID ID列にはdefaultがない。
- timestamp default は `app_user.created_at`, `daily_record_store.saved_at` と、正規化tableの `created_at` / `updated_at` にある `now()`。
- numeric精度は `weight_record.weight numeric(5,2)`、food量・calorieと `set_item.load_value` は `numeric(6,2)`、三大栄養素は `numeric(5,2)`。
- 全12 table は `anon`, `authenticated`, `service_role` に `SELECT / INSERT / UPDATE / DELETE / TRUNCATE / REFERENCES / TRIGGER` grantを持つ。
- Supabase migration history は0件。
- `public` tableおよび `auth.users` に関連する非internal triggerは存在しない。

主要2 table:

- `app_user(id uuid PK/FK -> auth.users.id ON DELETE CASCADE, display_name text NULL, created_at timestamptz NOT NULL DEFAULT now())`
- `app_user` はRLS enabled。policy `Users can manage their own profile` は `FOR ALL TO public`, `USING (auth.uid() = id)`, `WITH CHECK (auth.uid() = id)`。
- `daily_record_store(id uuid PK DEFAULT gen_random_uuid(), user_id uuid FK -> app_user.id ON DELETE CASCADE, record_date date, record_json jsonb, saved_at timestamptz DEFAULT now())`。全列NOT NULL。
- `daily_record_store` はRLS enabled。policy `Users can manage their own daily records` は `FOR ALL TO public`, `USING (auth.uid() = user_id)`, `WITH CHECK (auth.uid() = user_id)`。
- `daily_record_store(user_id, record_date)` には同一定義のUNIQUE constraintが2個存在する: `daily_record_store_user_date_key`, `daily_record_store_user_date_uniq`。それぞれ別のunique indexを持つ。

未使用正規化10 table:

- `daily_record`: PK `id`; FK `user_id -> app_user.id`; UNIQUE `(user_id, record_date)`。
- `weight_record`: PK `id`; FK `daily_record_id -> daily_record.id`。
- `wellness_record`: PK/FK `daily_record_id -> daily_record.id`。
- `meal_record`: PK `id`; FK `daily_record_id -> daily_record.id`。
- `meal_attachment`: PK `id`; FK `meal_record_id -> meal_record.id`。
- `food_item`: PK `id`; FK `meal_record_id -> meal_record.id`。
- `food_material`: PK `id`; FK `food_item_id -> food_item.id`。
- `exercise_session`: PK `id`; FK `daily_record_id -> daily_record.id`; UNIQUE `(daily_record_id, session_order)`。
- `exercise_item`: PK `id`; FK `exercise_session_id -> exercise_session.id`; UNIQUE `(exercise_session_id, item_order)`。
- `set_item`: PK `id`; FK `exercise_item_id -> exercise_item.id`; UNIQUE `(exercise_item_id, set_order)`。
- FKは全て `ON DELETE CASCADE`。10 tableはいずれもRLS disabled、policyなし、0 rows。

source突合:

- Authは `signInWithOtp`, `getSession`, `onAuthStateChange`, `signOut` を使い、取得した `user.id` をremote persistenceへ渡す。
- `dailyRecordSupabaseService.ts` は `daily_record_store` のみを `user_id + record_date` でupsert / select / deleteする。
- `record_json` は `src/domain/type.ts` の `DailyRecordAggregate` 全体をJSONB保存する。
- 現行sourceは `app_user` のinsert/upsertを行わず、live DBにもAuth user作成時の `app_user` 自動作成triggerはない。既存3 rowsの作成経路はRepositoryとschemaから確定できず、新規環境・新規userのprovisioningは未解決。

次アクションは③-B。完全baselineと最小baselineを比較し、未使用10 table、重複UNIQUE、policy target role、API grants、`app_user` provisioningを推測で変更せず、baselineの責務境界として決める。

### ③-B: baseline方針決定 — COMPLETED

比較結果:

| 案 | 利点 | 問題 |
| --- | --- | --- |
| live DB全体の完全baseline | 現時点の12 tableと、将来採用意図のある正規化schemaをGit上に保存できる | liveのRLS disabled / broad grantsまで忠実再現すると、新規環境にも既知の危険を持ち込む |
| 現行applicationの最小baseline | 実行中のremote persistenceだけを安全に再現し、責務が小さい | 意図して設計・実装済みの正規化10 tableを新規環境で再現できず、将来利用時に再構築が必要 |

採用方針:

- Git履歴の旧設計資料を追加確認した結果、完全な「構造baseline」を採用し、12 table全てを作成する方針へ補正した。
- 未使用正規化10 tableは削除候補ではなく、将来採用候補としてbaselineに含める。ただし現時点でapplication persistenceへ採用したとは扱わない。
- 旧v1.1 / v1.2のExcel、DBML、aggregate mappingには、日次をhubとする体重・wellness・食事・food material・運動の正規化設計と、表示順・粒度・将来拡張意図が明記されている。
- liveの10 tableはこの旧設計および現行 `src/domain/type.ts` と大部分が整合する。`FoodMaterial` はv1.2で追加され、`food_item_order` はv1.2 Excel / live / 現行型に存在する一方、旧v1.2 DBMLには欠落しているため、旧DBML単独を正とはしない。
- 旧v1.2 mappingが想定した `FoodItemAggregate.materials` は現行 `MealAggregate.food_items: FoodItem[]` には未反映であり、`food_material` を含む正規化永続化は依然として未実装である。
- baselineは空の新規Supabase DB向けの初期DDLとする。idempotent再実行用SQLにはせず、既存本番DBには絶対に実行しない。
- DDL SSOTは `supabase/migrations/` のmigration SQLとし、`docs/db/README.md` は概要・運用上の注意だけを持つ。
- RepositoryにSupabase構成がまだないため、Supabase CLIで `supabase/config.toml` を初期化し、CLIの `migration new current_app_baseline` でmigration filenameを生成する。
- baseline migrationには12 tableのschema、PK / FK / UNIQUE、必要index、RLS、policy、Data API利用に必要なgrantを明示する。
- `daily_record_store(user_id, record_date)` の重複UNIQUEは現状忠実再現を選ばず、意図された正規形として `daily_record_store_user_date_key` 1個だけを定義する。live側の2 constraintは変更しない。
- RLSのownership条件はliveと同じく `auth.uid() = app_user.id` / `auth.uid() = daily_record_store.user_id` とし、ALL相当のselect / insert / update / deleteを本人行に限定する。
- policy targetは現行appの認証済み利用を明示するため `TO authenticated` とする。liveの `TO public` とはcatalog表現が異なるが、anonでは `auth.uid()` がNULLのため拒否される現行app上のownership semanticsは維持する。
- Data API grantは最小権限として `SELECT, INSERT, UPDATE, DELETE` を `authenticated` に明示する。liveにある `anon` / `service_role` への全table privilegeはcatalog忠実再現せず、現行browser appに不要な `TRUNCATE / REFERENCES / TRIGGER` も与えない。
- 未使用正規化10 tableは新規環境ではRLS enabled、policyなし、`anon` / `authenticated` へのtable privilegeなしのdeny-by-defaultとする。これはliveの危険な露出状態を再生しないための意図的なsecurity差分であり、将来採用時にownership chainと必要policy / grantを別migrationで設計する。
- Auth schema自体やAuth設定はSupabase platform管理のためbaselineの責務外。`app_user.id -> auth.users.id ON DELETE CASCADE` のlinkageだけを定義する。
- live/sourceに存在しない `app_user` 自動provisioning triggerはbaselineへ推測追加しない。新規user provisioningは残課題として明示する。
- data、Auth user、seed、secret、project link情報はmigrationに含めない。

次アクションは③-C。上記方針でCLI生成のmigrationを作成し、`docs/db/README.md` をmigration DDL SSOT参照へ更新する。live Supabaseには未適用のまま進める。

### ③-C: baseline migration作成 — COMPLETED

生成・更新物:

- Supabase CLI 2.116.0の `init` で `supabase/config.toml`, `supabase/.gitignore` を生成した。project link情報やsecretは含めていない。
- Supabase CLIの `migration new current_app_baseline` で `supabase/migrations/20260902090014_current_app_baseline.sql` を生成した。
- migrationに12 tableの列、default、PK、FK、UNIQUE、RLS、主要2 policy、grant / revokeを明示した。
- `docs/db/README.md` を更新し、migration SQLをDDL SSOTとした。

設計意図:

- liveの12 table構造と将来利用候補の正規化schemaを保存する。
- `app_user` / `daily_record_store` は本人所有行だけを認証済みuserが操作できる。
- 未使用正規化10 tableは構造を保存しつつ、新規環境ではdeny-by-defaultにする。
- 重複UNIQUEは新規環境では1個に正規化する。
- schema-onlyとし、data / Auth user / seed / secretは含めない。

重要: baselineは既存本番DBには未適用であり、今後もそのまま実行しない。live SupabaseへのDDL変更は0件。

次アクションは③-D。SQLの依存順序・constraint / index・RLS / policy・grantを静的照合し、可能なら空の検証DBへ適用する。Dockerが利用できない場合は無理にliveや有償remote環境を使わず、ローカルで可能な構文・catalog再現性検証とapp baseline検証を行い、制約を残リスクとして記録する。

### ③-D: migrationレビュー / 再現性検証 — COMPLETED

静的レビュー結果:

- `auth.users -> app_user -> daily_record_store / daily_record -> child tables` の順で作成され、全FK参照先が先に存在する。
- 12 PK、12 FK、5 business UNIQUEの名前・列・`ON DELETE CASCADE` を確認した。
- PK / UNIQUEが生成するindexは17個。liveの重複index 1個はbaselineに再現していない。
- 全12 tableでRLS enabled。主要2 tableは `TO authenticated`、`(select auth.uid())` を使う本人所有policyの `USING` / `WITH CHECK` を持つ。
- 主要2 tableのgrantは `authenticated` の `SELECT / INSERT / UPDATE / DELETE` のみ。未使用10 tableはRLS enabled・policyなし・browser role grantなし。
- baseline用途のため `IF NOT EXISTS` 等による再実行可能化は行っていない。

空DB適用・catalog検証:

- Docker / local PostgreSQL binaryはこの作業環境に無いため、Supabase full local stackの `supabase db reset` は実行できなかった。
- 代わりに一時的なPGlite 0.5.8の空PostgreSQL互換DBへ、Supabase管理objectの最小stub (`auth.users`, `auth.uid()`, `anon`, `authenticated`) を用意し、baseline SQLを実行した。live Supabaseは使用していない。
- migration適用PASS、12 public tables / 104 columns / PK 12 / FK 12 / UNIQUE 5 / index 17を確認。
- live catalogとbaseline適用後catalogのcolumns / PK・FK・UNIQUE / indexesをそれぞれ正規化hashで比較し、liveの `daily_record_store_user_date_uniq` だけを除外した状態で全一致した。
- RLS動作は、本人行SELECT可、本人行INSERT可、他人行INSERT拒否を確認した。
- 未使用正規化tableは `authenticated` でもtable privilege境界で拒否されることを確認した。

Repository baseline確認:

- `npm run build`: PASS
- `TZ=Asia/Tokyo npm test -- --run`: PASS (6 files / 15 tests)
- `npm run deps:circular`: PASS (0 circular)
- `npm run lint`: FAIL (30 existing errors、増加なし)
- UTCのまま `npm test -- --run` すると、固定offset時刻の表示が `07:00` ではなく `15:00` になりreport test 2件が失敗する。今回のDB変更起因ではないが、test portabilityの既知リスクとして残す。

read-only advisor再確認:

- live Security Advisorは未使用10 tableのRLS disabledを引き続きERRORとして報告する。baselineは新規DBで解消するが、liveは未変更。
- live Performance Advisorは重複index、主要2 policyの `auth.uid()` per-row評価、未使用tableのunindexed FK 5件を報告する。baselineは重複indexを1個へ正規化し、policyは `(select auth.uid())` を使用する。未使用FK indexは利用query未定のため推測追加せず、正規化persistence採用時に評価する。
- Authのleaked password protection disabled警告はDDL baselineの範囲外。現行UIはmagic linkを利用するが、Auth設定見直し時の確認事項として残す。

残リスク / 未解決事項:

- Supabase公式local stack上の完全な `db reset` とadvisor検証は、Docker利用可能環境で再確認が必要。
- `app_user` 自動provisioningはliveにもsourceにも存在せず、新規Auth userの初回保存経路は未定義。
- 既存本番DBのmigration historyは0件。baselineを再実行せずmigration管理へ接続する方法は未決定。
- liveの未使用10 tableは0 rowsだがRLS disabledのまま。将来利用意向を前提に、削除ではなく安全なdeny-by-default化と採用順序を別段階で決める。
- 旧設計と現行型には `FoodItemAggregate.materials` 等の差異があり、正規化persistence採用前にcontractを再設計する必要がある。

live SupabaseへのDDL適用、table / policy / constraint変更、baselineの既存本番適用はいずれも0件。

## 7. 次の作業

### Supabase schema / RLS の Git-managed migration 化 — ③-A/B/C/D COMPLETED

次段階は今回の範囲外。着手前に方針を決める。

1. 既存本番DBにbaselineを再実行せず、migration管理へ接続する方法
2. 将来利用する正規化10 tableをliveでdeny-by-default化するmigrationと安全な適用計画
3. `app_user` provisioning方式
4. 正規化persistenceの採用順序とaggregate contract

Docker利用可能環境では、空のlocal Supabaseに対する `supabase db reset` とadvisorを追加確認する。

### 正規化 Supabase persistence は追加開発へ分離

正規化10 tableを利用した本格的なRDB persistence実装は、ASTRAEA移送の前提条件から外し、追加開発として GitHub Issue #47 `Implement normalized Supabase persistence` で管理する。

- 現行remote persistenceは引き続き `daily_record_store.record_json` のJSONB保存を利用する。
- 正規化10 tableは削除前提ではなく、将来採用候補としてbaselineに保持する。
- aggregate contract、`FoodItem` / `FoodMaterial`、RLS、grant、JSONBからのcutover等はIssue #47で設計・実装する。
- live DBの正規化10 tableは本Issueの設計・migration計画が固まるまで変更しない。
- この追加開発はASTRAEA移送完了後に再開可能であり、現時点では移送作業を優先する。

### 次の主作業: ASTRAEA移送

Repository ModernizationでASTRAEA bootstrapに必要なREADME / AGENTS / handoff / `.env.example` / baseline migrationの整備が完了したため、次はStep 2のASTRAEA Bootstrapへ進む。

### Step 1 残候補

- lint 30 existing errors の解消
- GitHub Actions CI 導入
- `npm audit` findings の別タスク化

Step 1 完了条件:

ASTRAEA に clone しただけで、README / AGENTS / handoff / code / tests から
「何を読むか」「どう検証するか」「何を変更してはいけないか」が判断できること。

## 8. Step 1 後

### Step 2: ASTRAEA Bootstrap

- Git / Node.js / Codex CLI 確認
- Repository clone
- `npm ci`
- `.env.example` -> `.env.local`
- Supabase 環境変数を安全に設定
- build / tests / circular / lint
- Vite 起動
- Supabase Auth / save / load の実画面確認

### Step 3: Branch / Agent Safety E2E

- latest main 取得
- `codex/test-*` 作成
- Agent が README / AGENTS / handoff を読んで作業
- edit / verify / commit / push or PR
- main 直接変更をしないことを確認

### Step 4: Remote Instruction E2E

リモート指示から ASTRAEA / Codex が小規模タスクを完了できれば移行完了。

## 9. 再開時

現在の branch を継続する場合:

```powershell
git status
git switch codex/version-name-cleanup
git pull --ff-only

npm run build
$env:TZ = "Asia/Tokyo"
npm test -- --run
npm run deps:circular
npm run lint
```

baseline と差異がなければ Section 7 の ASTRAEA移送（Step 2: ASTRAEA Bootstrap）から再開する。正規化RDB persistenceはIssue #47で別管理し、既存本番DBへbaseline migrationを実行しない。
