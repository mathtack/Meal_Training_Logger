# C-01 日次記録

[日次記録フォーム](src/DailyRecordForm.tsx) は、日付を選んで [DailyRecordAggregate](../00_common/src/domain/type.ts) を編集・表示する。編集できる項目は [体重](src/weights/WeightEditor.tsx)、[体調](src/wellness/WellnessEditor.tsx)、[食事](src/meal/MealEditor.tsx)、[運動](src/exercise/ExerciseSessionsEditor.tsx)。

- [認証](../S-01_auth/spec.md) が完了し、ログインしたユーザーの記録を読み込む。選択日が未保存なら空の記録を編集できる。読込エラー時は再試行まで保存を無効にする。
- 編集と項目クリアはフォームの状態から始まり、保存が成功すると保存済み状態とクラウド履歴を更新する。履歴から日付を読込・削除できる。通信に失敗した場合はその操作のエラーを表示する。
- レポート表示・コピーは [C-06](../C-06_report/spec.md)、クラウドの保存・読込・履歴・削除は [S-02](../S-02_daily-record-persistence/spec.md) が担当する。

フォームの認証・編集タブ・エラーと保存の契約は [自動テスト](src/DailyRecordForm.test.tsx)、編集値の保存と復元は [システムテスト](../../docs/system-test.md#2-dailyrecord-crud) で確認する。
