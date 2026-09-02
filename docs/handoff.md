# Meal & Training Logger - Handoff

更新日: 2026-09-02

## 1. この文書の役割

この文書は作業中断・再開用の最新チェックポイントである。

- 過去状態・詳細な調査経緯は Git history を参照する。
- version 別 handoff は作らない。
- 再開時はいきなり変更せず、Git 状態と baseline を確認する。
- README / AGENTS / code / tests / migration と矛盾する場合は、実体を確認してからこの handoff を更新する。

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

## 3. 現在地

作業 branch:

`codex/version-name-cleanup`

`main` を直接編集しない。

Repository modernization と Supabase baseline migration の整備は、ASTRAEA bootstrap を開始できる水準まで完了している。

次の主作業は **Step 2: ASTRAEA Bootstrap**。

正規化 Supabase persistence の本実装は移送の前提条件から外し、GitHub Issue #47 `Implement normalized Supabase persistence` で追加開発として管理する。

## 4. Baseline

2026-09-02 確認済み:

- `npm run build`: PASS
- `TZ=Asia/Tokyo npm test -- --run`: PASS
  - 6 test files
  - 15 tests passed
- `npm run deps:circular`: PASS
  - 0 circular
- `npm run lint`: FAIL
  - 30 existing errors

最低条件:

- build を壊さない
- tests を壊さない
- circular dependency を発生させない
- lint error を 30 から増やさない

既知事項:

- UTC のまま test を実行すると、固定 offset 時刻の表示差により report test 2件が失敗する。
- Windows / ASTRAEA では test 前に `$env:TZ = "Asia/Tokyo"` を設定する。

## 5. Repository 整理済み

### SSOT / history

- Git を version history の正本とする。
- `old/`, `backup/`, `.bak`, version 別コピーを原則作らない。
- アプリ version は `package.json` を正とする。
- 現行 source / docs のファイル名に履歴管理目的の version を付けない。

主な完了事項:

- `DailyRecordFormV110` 系を現行名 `DailyRecordForm` へ統一
- source 内の死んだ legacy migration / version 表現を撤去
- `src/legacy`、obsolete migration test、`.bak`、未使用 asset を撤去
- version 別 DB / Test / UX 資料を撤去し、Git history へ一本化
- root `README.md` / `AGENTS.md` / `.env.example` を整備
- generated `docs/deps.svg` / obsolete `docs/deps.md` を撤去
- Vite 初期テンプレの未使用 `src/App.css` を撤去
- Vite favicon `public/vite.svg` と `index.html` の参照を撤去
- 静的 SVG dependency graph は運用上不要なため `deps:graph` script を廃止
- Madge は `npm run deps:circular` の品質ゲートとして継続利用

### node_modules

- `node_modules` は Git 管理しない。
- root `.gitignore` で除外済み。
- ASTRAEA へコピーせず、tracked な `package.json` / `package-lock.json` を基に `npm ci` で再生成する。

### docs 構成

現時点では以下を維持する。

- `docs/db/README.md`
- `docs/test/README.md`
- `docs/test/system-test.md`
- `docs/handoff.md`

folder / README の平坦化は未決定。ASTRAEA 移送を阻害しないため、ユーザー判断まで構成変更しない。

## 6. Persistence / Supabase

### 現行アプリ

保存先は development / production では分岐していない。

- 未ログイン: localStorage のみ
- ログイン中の保存: localStorage 保存後、Supabase に remote 保存
- ログイン中の読込: Supabase 優先、取得できない場合は localStorage fallback

現行 remote persistence:

- `public.daily_record_store`
- `record_json` に `DailyRecordAggregate` 全体を JSONB 保存
- `user_id + record_date` を upsert key とする

Supabase client は local / Vercel とも初期化されるため、以下が必要:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### Git-managed migration

DDL SSOT:

`supabase/migrations/20260902090014_current_app_baseline.sql`

Supabase CLI 構成:

- `supabase/config.toml`
- `supabase/.gitignore`

baseline は **空の新規 Supabase DB 専用**。

**既存本番 DB に baseline migration を実行してはならない。**

live Supabase への DDL 適用、table / policy / constraint の変更は、この modernization では行っていない。

### baseline の設計判断

baseline は12 tableの構造を保持する。

現行利用:

- `app_user`
- `daily_record_store`

将来採用候補の正規化10 table:

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

正規化10 table は削除候補ではなく、旧 Excel / DBML / mapping と live schema を照合した上で将来採用候補として baseline に保持した。

新規 baseline では:

- 全12 table: RLS enabled
- `app_user` / `daily_record_store`: authenticated 本人所有 policy + 必要最小 grant
- 未使用正規化10 table: policyなし / browser role grantなしの deny-by-default
- live の `daily_record_store(user_id, record_date)` 重複 UNIQUE は1個に正規化

③-A〜Dの inventory / 方針決定 / migration作成 / PGlite再現性検証は完了済み。

検証結果:

- migration 適用: PASS
- 12 public tables / 104 columns
- PK 12 / FK 12 / business UNIQUE 5 / index 17
- live catalog と、意図的に除外した重複 UNIQUE 以外は整合
- 本人行 RLS 基本動作 PASS

残課題:

- 既存本番 DB の migration history は0件。baselineを再実行せず管理へ接続する方法は未決定。
- `app_user` 自動 provisioning は未定義。
- live の正規化10 table は0 rowsだがRLS disabledのまま。
- Supabase公式 local stack の `db reset` は Docker 利用可能環境で追加確認する。

## 7. 追加開発: Issue #47

GitHub Issue #47 `Implement normalized Supabase persistence` で管理する。

対象:

- `DailyRecordAggregate` と正規化 table の正式 mapping
- `FoodItem` / `FoodMaterial` contract
- UUID 生成責務
- write / read / delete transaction boundary
- ownership chain / RLS / grant
- `app_user` provisioning
- JSONB との併存期間
- JSONB -> 正規化 RDB の backfill / cutover / rollback

この追加開発は ASTRAEA 移送完了後に再開可能。現時点では移送を優先する。

## 8. 次の主作業: ASTRAEA移送

### Step 2: ASTRAEA Bootstrap

1. Git / Node.js / Codex CLI 確認
2. Repository clone
3. `npm ci`
4. `.env.example` -> `.env.local`
5. Supabase 環境変数を安全に設定
6. build / tests / circular / lint baseline 確認
7. Vite 起動
8. Supabase Auth / save / load の実画面 smoke test

### Step 3: Branch / Agent Safety E2E

- latest main 取得
- `codex/test-*` 作成
- Agent が README / AGENTS / handoff を読んで作業
- edit / verify / commit / push or PR
- main を直接変更しないことを確認

### Step 4: Remote Instruction E2E

リモート指示から ASTRAEA / Codex が小規模タスクを完了できれば移行完了。

## 9. 後続の品質改善候補

ASTRAEA移送の blocker ではない。

- lint 30 existing errors の解消
- GitHub Actions CI 導入
- `npm audit` findings の別タスク化
- docs / folder 構成の最終整理（ユーザー判断後）

## 10. 再開時

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

baseline と差異がなければ Step 2: ASTRAEA Bootstrap から再開する。

正規化 RDB persistence は Issue #47 で別管理する。
既存本番 DB へ baseline migration を実行しない。
