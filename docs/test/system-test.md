# System Test — Supabase / Multi-device

## Scope

- Supabase Auth (Magic Link)
- DailyRecord save / load / delete
- localStorage と Supabase の整合
- RLS によるユーザー分離
- PC / smartphone 間の同期
- 通信失敗時の基本挙動

## Preconditions

- `.env.local` に `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` が設定されている。
- Supabase の `app_user` / `daily_record_store` が利用可能。
- `daily_record_store` は RLS 有効で、ログインユーザー自身の `user_id` の行だけ操作可能。
- PC browser と smartphone browser、または独立した2ブラウザを利用できる。
- RLS 確認用に必要であれば2ユーザーを用意する。

保存先は development / production で切り替わらない。未ログイン時は localStorage のみ、ログイン中は localStorage と Supabase JSONB を併用する。
なお未ログインで localStorage のみ利用する場合でも、Supabase client は起動時に初期化されるため環境変数は必要。

## 0. Persistence routing

### ROUTE-01 Logged-out localStorage only

1. logout して未ログイン状態にする。
2. 他のテストと重ならない日付に、識別しやすい値で DailyRecord を入力する。
3. 保存する。
4. reload または別日へ移動後に同じ日付を開く。
5. browser storage の `daily_record:<ISODate>` を確認する。
6. Network tab で `daily_record_store` への保存 request が発生していないことを確認する。

Expected:

- 入力内容が localStorage から復元される。
- `daily_record:<ISODate>` に DailyRecordAggregate が JSON 保存されている。
- 未ログイン状態では Supabase `daily_record_store` への保存を行わない。

## 1. Authentication

### AUTH-01 Magic Link login

1. 未ログイン状態でメールアドレスを入力し、Magic Link を送信する。
2. 受信したリンクからアプリを開く。
3. ログインユーザーが AuthPanel に反映されることを確認する。
4. reload 後もセッションが維持されることを確認する。

Expected:

- アプリが正常に表示される。
- ログインユーザーが取得できる。
- reload / 同一browserの新規tabでも再ログイン不要。

### AUTH-02 Logout

1. ログイン状態から logout する。
2. reload する。

Expected:

- 未ログイン表示へ戻る。
- reload 後もログイン状態へ勝手に復帰しない。

## 2. DailyRecord CRUD

テスト専用の日付を利用し、既存の実データを変更しない。

### CRUD-01 Create and reload

1. 体重・体調・食事・運動を識別しやすい値で入力する。
2. 保存する。
3. 別日へ移動してから元の日付へ戻る、または reload する。
4. Supabase `daily_record_store` を確認する。

Expected:

- 入力内容が復元される。
- `user_id + record_date` に対応する行が1件存在する。
- `record_json` が画面の DailyRecordAggregate と論理的に一致する。

### CRUD-02 Update

1. 保存済み日付の一部を変更する。
2. 保存して reload する。

Expected:

- 内容が更新される。
- `user_id + record_date` の行数は増えず、同じ行が upsert される。

### CRUD-03 Delete

1. 保存済み日付を削除する。
2. reload または再読込する。
3. Supabase を確認する。

Expected:

- localStorage から対象日が消える。
- Supabase `daily_record_store` からも対象行が消える。
- 再読込時に削除済みデータが復活しない。

### CRUD-04 Date isolation

複数日を異なる値で保存して切り替える。

Expected:

- 日付間で入力内容が混ざらない。
- 各日付に対応する内容だけが表示される。

## 3. Multi-device

### MULTI-01 Same user sync

1. PC でログインし、テスト日付の記録を保存する。
2. smartphone / 別browser で同じユーザーとしてログインし、同日付を開く。
3. 2台目で内容を変更して保存する。
4. PC 側を reload して同日付を開く。

Expected:

- 2台目で PC の保存内容を取得できる。
- 2台目での更新後、PC reload で最新内容を取得できる。
- Supabase には `user_id + record_date` ごとに1行だけ存在する。

## 4. RLS

### RLS-01 Other user's data is not readable

1. User A でテスト日付を保存する。
2. User B で同じ日付を開く。

Expected:

- User A の `record_json` が User B の UI / API response に現れない。

### RLS-02 Other user's data is not writable

User B の session から User A の行に対する update / delete を試験できる場合に確認する。

Expected:

- User A の行を変更・削除できない。

## 5. Failure handling

### ERR-01 Supabase unavailable

1. browser network を offline にする、または開発環境で Supabase 通信を失敗させる。
2. DailyRecord を保存する。

Expected:

- アプリ全体が crash しない。
- localStorage 側の保存結果を確認できる。
- Supabase failure が少なくとも console 上で検知可能。

### ERR-02 Recovery

1. ERR-01 後に network を復旧する。
2. 同日付を再度保存・読込する。

Expected:

- Supabase への保存が再び成功する。
- reload 後の表示と Supabase `record_json` が整合する。

## Completion

主要シナリオを PASS したら、実施日・対象commit・特記事項を `docs/handoff.md` に記録する。

この文書には過去version固有のmigration試験を保持しない。廃止済みmigrationの履歴は Git history を参照する。
