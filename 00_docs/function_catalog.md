# 現行機能の索引

機能 ID から、現行の仕様・実装・データ・検証へ辿るための索引。責務の全体像は [アーキテクチャ](../docs/architecture.md)、テストの使い分けは [テスト方針](../docs/testing.md) を参照する。

## C-01 日次記録

[日次記録フォーム](../src/ui/DailyRecordForm.tsx) が日付と編集内容を扱う。[DailyRecordAggregate](../src/domain/type.ts) が1日分のデータ契約。[フォームテスト](../src/ui/DailyRecordForm.test.tsx) は認証の境界、日付の読込、クラウド保存・履歴・削除を確認する。編集結果の手動確認は [CRUD-01](../docs/system-test.md#crud-01-create-and-reload) と [CRUD-02](../docs/system-test.md#crud-02-update) を使う。

| 編集項目 | 実装入口 | データ | 関連する自動検証 |
| --- | --- | --- | --- |
| 体重 | [WeightEditor](../src/ui/weights/WeightEditor.tsx) | [WeightRecord](../src/domain/type.ts)、DB の `weight_record` | [並び順](../src/domain/normalizers/normalizeWeightOrders.test.ts) |
| 体調 | [WellnessEditor](../src/ui/wellness/WellnessEditor.tsx)、[表示ラベル](../src/domain/labels/wellnessLabels.ts) | [WellnessRecord](../src/domain/type.ts)、DB の `wellness_record` | [正規化書込マッパー](../src/app/dailyRecordNormalizedWriteMapper.test.ts)、[レポート表示](../20_module/C-06_report/src/dailyRecordReport.test.ts) |
| 食事 | [MealEditor](../src/ui/meal/MealEditor.tsx) | [MealAggregate](../src/domain/type.ts)、食事・食品・材料・添付の [関連テーブル](../docs/database.md#normalized-schema) | [日次正規化](../src/domain/normalizers/normalizeDailyRecordAggregate.test.ts)、[正規化読込マッパー](../src/app/dailyRecordNormalizedReadMapper.test.ts) |
| 運動 | [ExerciseSessionsEditor](../src/ui/exercise/ExerciseSessionsEditor.tsx) | [ExerciseSessionAggregate](../src/domain/type.ts)、セッション・種目・セットの [関連テーブル](../docs/database.md#normalized-schema) | [時刻](../src/domain/exerciseClockTime.test.ts)、[並び順](../src/domain/normalizers/normalizeExerciseOrders.test.ts) |

## C-06 レポート

表示・生成・保存とコピーの契約、実装・テストへの入口は [C-06 レポート仕様](../20_module/C-06_report/spec.md) を参照する。

## S-01 認証

[認証 UI](../src/features/auth/AuthPanel.tsx) と [AuthContext](../src/features/auth/AuthContext.tsx) が Supabase Auth のサインイン、セッション、サインアウトを扱う。[認証とクライアントの責務](../docs/architecture.md#auth--external-client)、[認証の手動ケース](../docs/system-test.md#1-authentication)、[フォームの認証境界テスト](../src/ui/DailyRecordForm.test.tsx) を参照する。

## S-02 日次記録の永続化

[永続化経路](../src/app/dailyRecordPersistence.ts) は正規化 Supabase サービスを使用する。[保存前の正規化](../src/app/dailyRecordCloud.ts)、[正規化保存](../src/app/dailyRecordNormalizedWriteService.ts)、[正規化読込・履歴・削除](../src/app/dailyRecordNormalizedQueryService.ts) が実装入口。[永続化の仕様](../docs/database.md#current-persistence-model)、[現行環境](../docs/current-state.md#current-runtime-facts)、[保存テスト](../src/app/dailyRecordNormalizedWriteService.test.ts)、[クエリテスト](../src/app/dailyRecordNormalizedQueryService.test.ts)、[所有者分離の手動ケース](../docs/system-test.md#4-rls) を参照する。
