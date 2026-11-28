# C-06 レポート

日次記録の表示・保存から、選択中の1日分をテキストで表示する。入力は日次フォームが渡す [DailyRecordAggregate](../00_common/src/domain/type.ts)。

- [テキスト生成](src/dailyRecordReport.ts) は日付の見出しと体重・体調・食事・運動のセクションを返す。空セクション、並び順、時刻、連続する同一セットの表現は [出力テスト](src/dailyRecordReport.test.ts) の期待値で確認する。
- [レポート表示](src/DailyRecordReportView.tsx) には ChatGPT・栄養士・Copilot の選択肢があり、現行の生成処理は共通の書式を使う。
- 「レポートをコピーして保存」は呼出元が渡す保存処理を呼び、続いて本文のクリップボード書き込みを試みる。保存とコピーの成否は個別に表示する。保存先や認証は [日次フォーム](../C-01_daily-record/src/DailyRecordForm.tsx) が担当する。
