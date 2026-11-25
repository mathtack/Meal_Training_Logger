# Read-only legacy inventory

`src/legacy/localStorage/legacyInventory.ts` は通常runtimeから呼ばないoffline調査用入口。
既存legacy reader経由で `daily_record:*` のみを分類し、localStorage / cloudへ書き込まない。
Auth session valueを読まない。原本JSONやreportはRepository外のアクセス制限された保管先に置く。

## Source capture

実行前にdevice / browser profile / origin / 対応するAuth userをユーザーに確認する。
`TODO_USER_ID` 等の旧JSON内ownerから対応先を推定しない。
全対象の調査範囲表（source ID、device、profile、origin、確認可否、件数、取得日時、export参照）をprivate reportに維持する。
未調査・アクセス不可・read失敗は件数をnullとし、0件にしない。

Repository rootから、出力先をRepository外の絶対pathとしてbundleを生成する。

```powershell
node scripts/legacy-inventory.mjs browser-bundle <private-directory>/legacy-inventory.js
```

確認済みoriginのbrowser consoleへ生成bundleを読み込み、次を実行する。
ownerIdには確認済みAuth UUIDを使用する。tokenは不要。

```javascript
const capture = await LegacyInventory.captureLegacyInventory(localStorage, {
  sourceId: "confirmed-source-id",
  device: "confirmed-device",
  profile: "confirmed-profile",
  origin: location.origin,
  ownerId: "confirmed-auth-user-uuid",
  ownerConfirmed: true,
});
```

`capture` をJSONでprivate exportへ保存する。raw valueをchat / Issueへ貼らない。
取得前後の対象key/value全体のSHA-256 digestが異なる場合は採用せず、他tabの更新を止めて再取得する。
read / enumeration例外時はcapture全体が失敗し、空結果として扱わない。
digest一致は2回の読み取り時点の一致を示す。browser全体のlockやその間の一時的変更まで保証するものではない。

## Cloud snapshot / comparison

JSONBからの移行調査では、対象projectとownerを確認して `public.daily_record_store` をread-onlyで取得する。本番で有効な保存経路は [現行環境](current-state.md) を参照する。
1 snapshotの全対象rowsを取得し、pagination / API上限による欠落がないことを件数照合する。
snapshot途中の更新や全件取得未確認の場合は `complete: true` としない。
過去の件数を流用しない。private cloud exportの形式:

```json
{
  "capturedAt": "2026-11-05T00:00:00Z",
  "complete": true,
  "rows": [
    { "user_id": "confirmed-auth-user-uuid", "record_date": "2026-11-05", "record_json": {} }
  ]
}
```

上記はformat例であり、`record_json` には実際に取得したaggregateを保持する。
`complete` は取得者の全件確認宣言であり、offline比較ツール自身はliveの最新性・欠落を証明しない。

```powershell
node scripts/legacy-inventory.mjs compare <capture.json> <cloud.json> <private-directory>/report.json <private-source-export-reference>
```

CLIは既存reportを上書きせず、Repository内への出力を拒否する。input exportを変更しない。
標準出力には分類件数と未解決有無だけを出す。

## Comparison contract

- key / date / aggregate shape / 全階層のUUID・parent・field型・union・重複entity IDを検証する。未知fieldも情報損失防止のためquarantine。
- ownerは確認済みsource対応とcloud外側 `user_id` を使用する。date不一致は補正しない。
- 既存 `normalizeDailyRecordAggregate` と同じorder normalizationを両側へ適用し、timestampは更新しない。
- canonical JSONはobject key順を固定する。配列は既存normalizerの意味順を保持する。IDs、parent IDs、nullと省略の差を保持する。
- 完全hashは `created_at` / `updated_at` を含む。内容hashは全階層のこの2項目だけを除く。実測時刻等は除かない。
- 内容hashとcanonical文字列の双方が一致した場合だけduplicate。timestampのみの差も完全hashで追跡できる。
- 同じowner/dateのcloudなしはcandidate、内容差はconflict、不正やcloud重複はquarantine。
- reportはkey/date/hash/reason/判断選択肢を保持し、食事・体重・運動等のraw値を含まない。report自体もprivateに保管する。

この分類は移行成功を保証するdry-runではない。DB constraint・全source横断のentity ID衝突・再構成照合はbackfill検証の責務。
複数sourceは同じcloud snapshotで比較し、全reportのowner/dateを突き合わせる。
cloudなしのcandidateが複数sourceで同日になった場合も、local同士の内容hash/原本を確認して採用を決めるまで取込しない。

conflictは日付単位で `keep_cloud / select_local / manual_merge / defer` と影響、判断者・日時・理由をprivate decision listへ記録する。
quarantineも全件にreason・保管先・未解決理由・再開条件を付ける。
ツールは判断を自動採用せず、原本修正・cloud書込・backfill・localStorage削除を実行しない。
対象source未確認・未取得がある場合はIssueをOPENで維持し、部分結果と再開条件をIssueへ残す。
