# Meal & Training Logger

毎日の体重・体調・食事・運動を1日単位で記録し、用途別のテキストレポートを生成する React / TypeScript アプリ。PC とスマートフォンで利用でき、Supabase Auth とクラウド保存で同一ユーザーの記録を同期する。

## 現行仕様と作業の入口

| 知りたいこと | 参照先 |
| --- | --- |
| 機能・仕様・実装・検証 | [現行機能の索引](00_docs/function_catalog.md) |
| 全体構造とデータ保存 | [アーキテクチャ](docs/architecture.md)・[DB 契約](docs/database.md) |
| テストと実機確認 | [テスト方針](docs/testing.md)・[システムテスト](docs/system-test.md) |
| 作業を開始・再開する | [AGENTS.md](AGENTS.md)・[開発標準](00_docs/development_standard.md) |
| 現在の環境・品質 baseline | [現行環境](docs/current-state.md) |
| 本番配信・書込停止・復旧 | [本番運用](00_docs/product_operations.md) |
| 開発計画・承認・進捗・引き継ぎ | [GitHub Issues](https://github.com/mathtack/Meal_Training_Logger/issues) |
| 再利用可能な Agent 手順 | [Skills](skills/README.md) |

アプリのバージョンは [package.json](package.json)、データ契約は [型定義](src/domain/type.ts)、DB DDL と RLS は [migrations](supabase/migrations/) を参照する。変更履歴は Git で確認する。

## ローカル起動

Git、Node.js、npm を用意し、[現行環境](docs/current-state.md) でバージョンと環境条件を確認する。

```powershell
npm ci
```

[環境設定例](.env.example) をもとに、利用が許可された環境の値を `.env.local` に設定する。正規化経路を使う場合は `VITE_DAILY_RECORD_PERSISTENCE=normalized` を指定する。

```powershell
npm run dev
```

作業開始と品質ゲートは [開発標準](00_docs/development_standard.md#verification) を参照する。
