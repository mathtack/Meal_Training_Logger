# System Test — Supabase / Multi-device

## Scope

- Supabase Auth (Magic Link)
- DailyRecord save / load / delete
- Supabase cloud SSOT と localStorage 非 fallback
- RLS によるユーザー分離
- PC / smartphone 間の同期
- 通信失敗時の基本挙動

## Preconditions

- `.env.local` に `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` が設定されている。
- Supabase の `app_user` / `daily_record_store` が利用可能。
- `daily_record_store` は RLS 有効で、ログインユーザー自身の `user_id` の行だけ操作可能。
- Auth と `app_user` に登録済みで、現在ログイン可能な受入テスト用メールアドレスを利用できる。
- PC browser と smartphone browser、または独立した2ブラウザを利用できる。
- RLS 確認用に必要であれば2ユーザーを用意する。

保存先は development / production で切り替わらない。DailyRecord の永続化操作はログイン必須で、
ログイン中の正式経路は Supabase JSONB のみ。既存 localStorage data は削除しないが、画面は自動 fallback しない。
Supabase client は起動時に初期化されるため、未ログイン表示の確認時も環境変数は必要。

## 0. Persistence routing

### ROUTE-01 Logged-out persistence gate

1. logout して未ログイン状態にする。
2. DailyRecord 領域を確認する。
3. Network tab で `daily_record_store` request が発生していないことを確認する。

Expected:

- ログインが必要という案内が表示される。
- DailyRecord の入力・保存・履歴・削除 UI は表示されない。
- Supabase `daily_record_store` と `daily_record:*` localStorage のどちらも読み書きしない。

### ROUTE-02 Read error does not fall back to localStorage

1. ログイン状態で、テスト専用日付の localStorage に識別可能な legacy record がある状態を用意する。
2. Network を offline にするなど、Supabase read を失敗させる。
3. 同じ日付を画面で開く。

Expected:

- クラウド記録の読込失敗が表示される。
- legacy localStorage record は正式データとして画面に表示されない。
- 保存操作は read の再試行が成功するまで無効である。

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

### AUTH-03 Same email re-login identity continuity

1. 受入テスト用の既存メールアドレスでログインし、Auth の `user.id` とクラウド履歴を確認する。
2. logout する。
3. 同じメールアドレスへ Magic Link を送信し、再ログインする。
4. Auth の `user.id` とクラウド履歴を再確認する。

Expected:

- 同じメールアドレスで再ログインできる。
- 再ログイン前後で同じ Auth `user.id` になる。
- 同じ `app_user` ownership の既存記録と履歴を引き続き利用できる。
- 新規メールアドレスの provisioning はこの受入条件に含めない。

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

- Supabase `daily_record_store` から対象行が消える。
- 削除成功後に画面とクラウド履歴から対象日が消える。
- 同日付の legacy localStorage data が存在しても、再読込時に削除済みデータが復活しない。

### CRUD-04 Date isolation

複数日を異なる値で保存して切り替える。

Expected:

- 日付間で入力内容が混ざらない。
- 各日付に対応する内容だけが表示される。

### CRUD-05 Cloud history

1. 複数日の記録を Supabase に保存する。
2. 「表示・保存」から「保存・読出」を開く。
3. 別 browser または smartphone でも同じユーザーで履歴を開く。

Expected:

- 両方の画面に Supabase の同じ日付一覧が降順で表示される。
- 最終保存時刻は aggregate の `daily_record.updated_at` に対応する。
- localStorage にしかない日付は履歴へ混入しない。

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

1. online でテスト日付のクラウド記録を読み込む。
2. 値を変更して「未保存」を表示させる。
3. browser network を offline にする、または開発環境で Supabase save を失敗させる。
4. DailyRecord を保存する。

Expected:

- アプリ全体が crash しない。
- クラウド保存失敗が画面に表示され、「保存しました」と表示されない。
- 入力内容と「未保存」状態が維持される。
- localStorage を代替保存先として書き換えない。

### ERR-02 Delete failure

1. online でクラウド履歴を開く。
2. Supabase delete が失敗する状態で対象日を削除する。

Expected:

- クラウド削除失敗が画面に表示される。
- 対象日の画面データと履歴を削除済み扱いにしない。

### ERR-03 Recovery

1. ERR-01 後に network を復旧する。
2. 同日付を再度保存・読込する。

Expected:

- Supabase への保存が再び成功する。
- reload 後の表示と Supabase `record_json` が整合する。

## Completion

主要シナリオを PASS したら、現在の baseline や次アクションへ影響する事項だけ `docs/current-state.md` に反映する。
過去の実施記録をこの文書へ蓄積しない。
