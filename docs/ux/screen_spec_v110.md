# UI Screen Spec (v1.1.0) — Meal Training Logger

> 目的：画面の全体像・入力項目・出力項目・保存/更新のタイミングを最小限で共有する  
> 詳細レイアウト（位置・余白・装飾）は対象外（後回し）

---

## 0. Screens (画面一覧)

| Screen ID | 画面名 | 種別 | 概要 |
|---|---|---|---|
| IN-001 | DailyRecord Input | 入力 | 日付単位で体重/健康体調/食事/運動を編集し保存する |
| OUT-001 | Report Output | 出力 | 入力内容から「LINEレポ形式」等の定型文を生成し表示/コピーする |

---

## 1. IN-001 — DailyRecord Input（入力）

### 1.1 構成
- Header（共通領域）
- Tabs（4つ）：体重 / 健康体調 / 食事 / 運動
- Tab Content（選択中タブの編集UI）

### 1.2 Header（共通領域）

| 項目 | 種別 | データ/参照 | 備考 |
|---|---|---|---|
| 記録日 | date input | `daily_record.record_date` | 日付を切り替えて当日のレコードを編集 |
| 保存 | button | save action | Aggregateを保存（localStorage） |
| タブ別クリア | button | clear current tab | 選択中タブに該当する入力を削除（保存は別） |
| 未保存表示 | text | dirty flag | 変更があれば「未保存」 |
| 保存状態表示 | text | status | Saved / Error 等（実装依存） |
| 最終更新日時 | text | `daily_record.updated_at` | `yyyy/m/d hh:mm:ss` 表示 |
| 記録・表示切替 | button | (future) view mode | v1.1.0では配置のみ（挙動は後回し） |

> NOTE: Headerは「全タブ共通のシステム情報・操作」のみ置く（入力項目は原則タブ側）

### 1.3 Tabs（共通）
- 体重（WEIGHT）
- 健康体調（WELLNESS）
- 食事（MEAL）
- 運動（EXERCISE）

### 1.4 Tab: 体重（WEIGHT）

| 項目 | 種別 | データ | 仕様 |
|---|---|---|---|
| 朝 測定時刻 | time input | `weights[slot=MORNING].measured_at` | 任意。HH:mm入力/選択。保存時ISOに変換 |
| 朝 体重(kg) | text input | `weights[slot=MORNING].weight` | 10〜999.99、小数0〜2桁。IME考慮：入力中は素通し、確定はblur |
| 夜 測定時刻 | time input | `weights[slot=EVENING].measured_at` | 同上 |
| 夜 体重(kg) | text input | `weights[slot=EVENING].weight` | 同上 |

- 空欄にすると該当枠は削除扱い（保存前は未反映の可能性あり）
- 正規化：measurement_order 等は保存前に正規化される

### 1.5 Tab: 健康体調（WELLNESS）※暫定

| 項目 | 種別 | データ | 選択肢（保存値） |
|---|---|---|---|
| 睡眠時間 | select | `wellness.sleep_duration_category` | lt6h / h6to7 / gte7h |
| 睡眠の質 | select | `wellness.sleep_quality` | bad / normal / good |
| 水分摂取 | select | `wellness.water_intake` | lt1l / l1to1_5 / l1_5to2 / gte2l |
| 身体の調子 | select | `wellness.physical_condition` | fine / slightly_tired / tired / exhausted |
| 気分 | select | `wellness.mood` | good / normal / bad / worst |
| 空腹感 | select | `wellness.hunger_level` | none / slight / strong |
| 便通 | select | `wellness.bowel_movement` | none / once / twice / three_or_more |

- v1.1.0では「暫定仕様」：使い方/項目は改廃可能性あり
- `sleep_duration_minutes` / `sleep_source` は将来用（UI非表示）

### 1.6 Tab: 食事（MEAL）
> v1.1.0時点：実装/仕様は作業中（別チケット/別記）

- ここは後日追記（細切れ開発予定）

### 1.7 Tab: 運動（EXERCISE）
- ExerciseSessionsEditor にてセッション単位で編集
- セッションの並び替え（↑↓）あり
- 仕様詳細は後日追記（既存実装に準拠）

---

## 2. OUT-001 — Report Output（出力）

### 2.1 目的
入力内容を元に、送信先に応じた定型文を生成・プレビューし、コピーできるようにする。

### 2.2 出力（最低限）
| 項目 | 種別 | 備考 |
|---|---|---|
| 出力プレビュー | text | 送信先別にフォーマットが変わる場合あり |
| コピー | button | クリップボードへコピー |

> v1.1.0時点で実装が既にある場合は、現行の仕様に合わせて追記する

---

## 3. Data & Behavior（データと挙動：最小）

- 編集対象は日付単位の `DailyRecordAggregate`
- 保存前に正規化（normalize）を通す（入口は app layer で一本化）
- 保存先は localStorage（将来DBへ移行予定）
