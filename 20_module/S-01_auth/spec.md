# S-01 認証

Supabase Auth のメールログインとセッションを管理する。接続は [共用クライアント](../00_common/src/lib/supabaseClient.ts) を使う。

- [認証画面](src/AuthPanel.tsx) はメールアドレスを受け取り、現在の origin を戻り先にログインリンクを送る。ログイン中はユーザー情報とログアウト操作を表示する。
- [AuthProvider と useAuth](src/AuthContext.tsx) は起動時にセッションを読み、認証状態の変更を購読して `session`、`user`、`isLoading` を公開する。画面の破棄時に購読を解除する。
- [日次フォーム](../../src/ui/DailyRecordForm.tsx) は認証確認中と未ログイン時に保存や履歴を表示せず、ログイン後にユーザーIDに対応する記録を読む。

フォームの認証境界は [自動テスト](../../src/ui/DailyRecordForm.test.tsx)、メールリンク・ログアウト・再ログインは [システムテスト](../../docs/system-test.md#1-authentication) で確認する。
