# 正規化DBへの切替と復旧

## 前提

承認済みのメンテナンス枠で、対象DB・対象リリース・復旧用JSONBリリース・判定担当・mirror保持期間を確定する。Git管理のmigration、対象ユーザー範囲、バックアップと復元手段を確認する。保持期間中はmirrorを削除しない。

アプリの経路はbuild時の `VITE_DAILY_RECORD_PERSISTENCE`（`jsonb` または `normalized`）で決まり、DBの書込許可は `migration_private.daily_record_write_mode` が管理する。 `frozen` は両経路のアプリ書込を拒否する。モード変更は進行中の書込transactionが終わるまで待機する。

## 切替

1. 承認済みのmigrationだけを適用し、DBモードが `jsonb` で既存経路が利用できることを確認する。正規化ビルドの認証、実PostgRESTの親子関係解決・行数上限、所有者境界、初回保存時のprofile作成を隔離環境で確認する。
2. メンテナンスを開始する。DB管理者は現在値を条件に `jsonb` から `frozen` へ変更し、更新が1行であることと両経路のアプリ書込が止まったことを確認する。両storeとbackfill台帳の復旧点をGit管理外に確保する。
3. 最終JSONBを [backfill照合手順](backfill.md) のcanonical比較で直近の検証済みsourceと比較する。差分がある場合はowner/dateごとに追加・更新・削除を分類し、隔離DBで検証した承認済み差分だけを反映する。初回backfillのinsert手順を既存行の更新に流用しない。初回JSONBに存在しないlegacy由来の採用行は保持する。
4. 採用済みの正規化データを基準にmirrorを照合する。不足分は対象ownerとroot IDを確認して管理者用 `migration_private.upsert_daily_record_mirror(owner, root_id)` で補う。値が異なる行や余分なmirrorがある場合は、原因と処置を確定するまで停止する。全件でowner/date、件数、canonical content hashと必要なidentityが一致することを確認する。
5. 書込停止中に承認済みの正規化ビルドを昇格し、productionの認証、読込、履歴と対象リリースを確認する。照合と読込が合格したら `frozen` から `normalized` へ変更し、正規化save/deleteの成功・両storeの整合・旧ビルドからの書込拒否を確認する。合格後にメンテナンスを解除する。

## 復旧

切替後に復旧判定が出たら `normalized` から `frozen` に変更し、進行中の書込を止める。切替後の変更を含め、正規化データとmirrorのowner/date、件数、canonical content hash、identityを照合する。不一致時は書込停止を維持し、直近の復旧点と差分を確認する。照合後に承認済みのJSONBリリースを復元し、読込と履歴を確認する。 `frozen` から `jsonb` に戻してJSONBのCRUDを検証した後、メンテナンスを解除する。再切替時は復旧中のJSONB差分を改めて照合する。
