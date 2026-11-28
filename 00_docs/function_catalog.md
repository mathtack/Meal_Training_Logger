# 現行機能の索引

機能 ID から、現行の仕様・実装・データ・検証へ辿るための索引。責務の全体像は [アーキテクチャ](../docs/architecture.md)、テストの使い分けは [テスト方針](../docs/testing.md) を参照する。

## C-01 日次記録

[日次記録フォーム](../src/ui/DailyRecordForm.tsx) が日付と編集内容を扱う。[DailyRecordAggregate](../20_module/00_common/src/domain/type.ts) が1日分のデータ契約。[フォームテスト](../src/ui/DailyRecordForm.test.tsx) は認証の境界、日付の読込、クラウド保存・履歴・削除を確認する。編集結果の手動確認は [CRUD-01](../docs/system-test.md#crud-01-create-and-reload) と [CRUD-02](../docs/system-test.md#crud-02-update) を使う。

| 編集項目 | 実装入口 | データ | 関連する自動検証 |
| --- | --- | --- | --- |
| 体重 | [WeightEditor](../src/ui/weights/WeightEditor.tsx) | [WeightRecord](../20_module/00_common/src/domain/type.ts)、DB の `weight_record` | [並び順](../20_module/00_common/src/domain/normalizers/normalizeWeightOrders.test.ts) |
| 体調 | [WellnessEditor](../src/ui/wellness/WellnessEditor.tsx)、[表示ラベル](../20_module/00_common/src/domain/labels/wellnessLabels.ts) | [WellnessRecord](../20_module/00_common/src/domain/type.ts)、DB の `wellness_record` | [正規化書込マッパー](../20_module/S-02_daily-record-persistence/src/dailyRecordNormalizedWriteMapper.test.ts)、[レポート表示](../20_module/C-06_report/src/dailyRecordReport.test.ts) |
| 食事 | [MealEditor](../src/ui/meal/MealEditor.tsx) | [MealAggregate](../20_module/00_common/src/domain/type.ts)、食事・食品・材料・添付の [関連テーブル](../docs/database.md#normalized-schema) | [日次正規化](../20_module/00_common/src/domain/normalizers/normalizeDailyRecordAggregate.test.ts)、[正規化読込マッパー](../20_module/S-02_daily-record-persistence/src/dailyRecordNormalizedReadMapper.test.ts) |
| 運動 | [ExerciseSessionsEditor](../src/ui/exercise/ExerciseSessionsEditor.tsx) | [ExerciseSessionAggregate](../20_module/00_common/src/domain/type.ts)、セッション・種目・セットの [関連テーブル](../docs/database.md#normalized-schema) | [時刻](../20_module/00_common/src/domain/exerciseClockTime.test.ts)、[並び順](../20_module/00_common/src/domain/normalizers/normalizeExerciseOrders.test.ts) |

## C-06 レポート

表示・生成・保存とコピーの契約、実装・テストへの入口は [C-06 レポート仕様](../20_module/C-06_report/spec.md) を参照する。

## S-01 認証

メールログイン、セッション、日次フォームの認証境界と検証先は [S-01 認証仕様](../20_module/S-01_auth/spec.md) を参照する。

## S-02 日次記録の永続化

正規化 Supabase での保存・読込・履歴・削除、各サービスとテストへの入口は [S-02 永続化仕様](../20_module/S-02_daily-record-persistence/spec.md) を参照する。
