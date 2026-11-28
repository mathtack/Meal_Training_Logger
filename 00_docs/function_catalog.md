# 現行機能の索引

機能 ID から、現行の仕様・実装・データ・検証へ辿るための索引。責務の全体像は [アーキテクチャ](../docs/architecture.md)、テストの使い分けは [テスト方針](../docs/testing.md) を参照する。

## C-01 日次記録

日付の選択、編集・表示、保存やレポートとの連携は [C-01 日次記録仕様](../20_module/C-01_daily-record/spec.md) を参照する。

| 編集項目 | 実装入口 | データ | 関連する自動検証 |
| --- | --- | --- | --- |
| 体重 | [WeightEditor](../20_module/C-01_daily-record/src/weights/WeightEditor.tsx) | [WeightRecord](../20_module/00_common/src/domain/type.ts)、DB の `weight_record` | [体重編集](../20_module/C-01_daily-record/src/weights/WeightEditor.test.tsx)、[並び順](../20_module/00_common/src/domain/normalizers/normalizeWeightOrders.test.ts) |
| 体調 | [WellnessEditor](../20_module/C-01_daily-record/src/wellness/WellnessEditor.tsx)、[表示ラベル](../20_module/00_common/src/domain/labels/wellnessLabels.ts) | [WellnessRecord](../20_module/00_common/src/domain/type.ts)、DB の `wellness_record` | [正規化書込マッパー](../20_module/S-02_daily-record-persistence/src/dailyRecordNormalizedWriteMapper.test.ts)、[レポート表示](../20_module/C-06_report/src/dailyRecordReport.test.ts) |
| 食事 | [MealEditor](../20_module/C-01_daily-record/src/meal/MealEditor.tsx) | [MealAggregate](../20_module/00_common/src/domain/type.ts)、食事・食品・材料・添付の [関連テーブル](../docs/database.md#normalized-schema) | [日次正規化](../20_module/00_common/src/domain/normalizers/normalizeDailyRecordAggregate.test.ts)、[正規化読込マッパー](../20_module/S-02_daily-record-persistence/src/dailyRecordNormalizedReadMapper.test.ts) |
| 運動 | [ExerciseSessionsEditor](../20_module/C-01_daily-record/src/exercise/ExerciseSessionsEditor.tsx) | [ExerciseSessionAggregate](../20_module/00_common/src/domain/type.ts)、セッション・種目・セットの [関連テーブル](../docs/database.md#normalized-schema) | [時刻](../20_module/00_common/src/domain/exerciseClockTime.test.ts)、[並び順](../20_module/00_common/src/domain/normalizers/normalizeExerciseOrders.test.ts) |

## C-06 レポート

表示・生成・保存とコピーの契約、実装・テストへの入口は [C-06 レポート仕様](../20_module/C-06_report/spec.md) を参照する。

## S-01 認証

メールログイン、セッション、日次フォームの認証境界と検証先は [S-01 認証仕様](../20_module/S-01_auth/spec.md) を参照する。

## S-02 日次記録の永続化

正規化 Supabase での保存・読込・履歴・削除、各サービスとテストへの入口は [S-02 永続化仕様](../20_module/S-02_daily-record-persistence/spec.md) を参照する。
