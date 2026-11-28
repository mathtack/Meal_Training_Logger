# AGENTS.md

## 作業開始・再開

1. [README](README.md) でリポジトリの入口を確認する。
2. [品質ゲート](docs/testing.md#quality-gate) と [運用の安全条件](00_docs/product_operations.md#承認と実行前の確認) を確認する。
3. 対象の GitHub Issue と、その親 Issue の Scope・着手条件・checkpoint・STOP GATE を確認する。
4. [開発標準](00_docs/development_standard.md) の該当箇所と、Issue が参照する仕様・実装・テストを読む。機能から探す場合は [機能索引](00_docs/function_catalog.md) を使う。

GitHub Issues を開発計画、承認、進捗、引き継ぎの正本とする。現行仕様と変更履歴はリポジトリと Git を参照する。

## 作業上の境界

- 主担当、対象 Issue、起点と作業ブランチを確認し、clean な作業ツリーで開始する。Git と Issue の手順は [開発標準](00_docs/development_standard.md) に従う。
- 本番デプロイ、Supabase の schema・RLS・Auth・データ、書込モードの変更や復旧は [本番運用](00_docs/product_operations.md) の境界に従う。
- 資格情報・個人データ・Git 管理外の作業成果物は [作業フォルダと保全](00_docs/development_standard.md#作業フォルダと保全) に従う。
- 完了時は検証と引き継ぎを Issue に記録し、対象 Issue の STOP GATE で停止する。

[Skill の配置・責務](skills/README.md) を参照する。
