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

2026-09-02 確認時点:

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

## 7. 次の作業

### 最優先: Supabase schema / RLS の Git-managed migration 化

次は現行 Supabase を Git 管理できる baseline migration へ落とす。

安全のため、まず以下までを行う。

1. live Supabase の schema / constraint / index / RLS / policy を再取得する
2. 現行 application に必要な DB 構成を確定する
3. Git に baseline migration を作成する
4. migration 内容をレビューし、現行構成を再現できるか確認する

重要な制約:

- この段階では live Supabase へ DDL を適用しない
- table / policy / constraint を直接変更・削除しない
- 既存本番 DB に baseline migration をそのまま再実行しない
- baseline を既存本番に「適用済み」としてどう管理開始するかは別段階で判断する

未使用の正規化10 table については、まず現状を完全取得する。
その上で次のどちらを baseline とするか評価する。

- live DB 全体を表す完全 baseline
- 現行 application に必要な最小 baseline

勝手に削除・採用判断はせず、推奨案を出してから決定する。

### Step 1 残候補

- unused normalized tables の扱い決定
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
npm test -- --run
npm run deps:circular
npm run lint
```

baseline と差異がなければ Section 7 の Supabase baseline migration 化から再開する。
