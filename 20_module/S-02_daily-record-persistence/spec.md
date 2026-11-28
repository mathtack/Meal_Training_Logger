# S-02 日次記録の永続化

[永続化の入口](src/dailyRecordPersistence.ts) は、認証済みのユーザーと日付に対応する [DailyRecordAggregate](../00_common/src/domain/type.ts) を正規化 Supabase に保存し、読込・履歴・削除を提供する。

| 操作 | 契約と実装 | 自動検証 |
| --- | --- | --- |
| 保存 | [保存前の正規化](src/dailyRecordCloud.ts) で所有者と日付を適用し、[保存サービス](src/dailyRecordNormalizedWriteService.ts) が RPC を呼ぶ。保存成功時は DB の返す ID と時刻を反映する。 | [保存サービス](src/dailyRecordNormalizedWriteService.test.ts)・[書込形式](src/dailyRecordNormalizedWriteMapper.test.ts) |
| 読込・履歴 | [読込サービス](src/dailyRecordNormalizedQueryService.ts) が所有者を条件に読込し、記録がない日とエラーを区別する。履歴は日付降順でページをたどる。 | [クエリ](src/dailyRecordNormalizedQueryService.test.ts)・[読込形式](src/dailyRecordNormalizedReadMapper.test.ts) |
| 削除 | [削除サービス](src/dailyRecordNormalizedQueryService.ts) が日付を RPC に渡す。結果の所有者・日付を検証し、記録がない場合は `not_found` を返す。 | [クエリ](src/dailyRecordNormalizedQueryService.test.ts) |

別の保存先への自動フォールバックはない。DB のテーブル・RPC・権限は [Database](../../docs/database.md)、隔離 DB 検証は [テスト方針](../../docs/testing.md#normalized-database-verification) を参照する。
