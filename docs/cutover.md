# 正規化DBへの切替とJSONB退役

## 前提

切替前の環境では、承認済みのメンテナンス枠で対象DB・対象リリース・判定担当・mirror保持期間を確定する。Git管理のmigration、対象ユーザー範囲、バックアップを確認する。保持期間中はmirrorを削除しない。本番の運用状態は [現行環境](current-state.md) を参照する。

アプリの経路はbuild時の `VITE_DAILY_RECORD_PERSISTENCE`（`jsonb` または `normalized`）で決まり、DBの書込許可は `migration_private.daily_record_write_mode` が管理する。 `frozen` は両経路のアプリ書込を拒否する。モード変更は進行中の書込transactionが終わるまで待機する。

## 切替

1. 承認済みのmigrationだけを適用し、DBモードが `jsonb` で既存経路が利用できることを確認する。正規化ビルドの認証、実PostgRESTの親子関係解決・行数上限、所有者境界、初回保存時のprofile作成を隔離環境で確認する。
2. メンテナンスを開始する。DB管理者は現在値を条件に `jsonb` から `frozen` へ変更し、更新が1行であることと両経路のアプリ書込が止まったことを確認する。両storeとbackfill台帳の復旧点をGit管理外に確保する。
3. 最終JSONBを [backfill照合手順](backfill.md) のcanonical比較で直近の検証済みsourceと比較する。差分がある場合はowner/dateごとに追加・更新・削除を分類し、隔離DBで検証した承認済み差分だけを反映する。初回backfillのinsert手順を既存行の更新に流用しない。初回JSONBに存在しないlegacy由来の採用行は保持する。
4. 採用済みの正規化データを基準にmirrorを照合する。不足分は対象ownerとroot IDを確認して管理者用 `migration_private.upsert_daily_record_mirror(owner, root_id)` で補う。値が異なる行や余分なmirrorがある場合は、原因と処置を確定するまで停止する。全件でowner/date、件数、canonical content hashと必要なidentityが一致することを確認する。
5. 書込停止中に承認済みの正規化ビルドを昇格し、productionの認証、読込、履歴と対象リリースを確認する。照合と読込が合格したら `frozen` から `normalized` へ変更し、正規化save/deleteの成功・両storeの整合・旧ビルドからの書込拒否を確認する。合格後にメンテナンスを解除する。

## JSONBの退役

保持期間を終え、正規化とJSONBのowner/date・canonical hashの全件照合を済ませてから、承認された退役migrationを適用する。

`20261125212008_retire_jsonb_runtime.sql` は正規化RPCの入口を維持し、JSONBの自動更新とブラウザの旧JSONB table/column権限を退役する。適用時はDBを `normalized → frozen` に変更する。適用後に正規化の読込と権限を確認して `frozen → normalized` に戻し、検証用レコードで保存・更新・削除を確認する。

旧JSONB行を削除する承認がある場合は、書込を凍結し、同一transaction内で照合済みの件数と指紋を再確認してから削除する。JSONBの残件数と正規化・台帳の指紋を確認し、正規化の書込を再開する。本番障害への対応は正規化版を対象とする。
