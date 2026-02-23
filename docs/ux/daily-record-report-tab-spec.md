# DailyRecord v1.1.0 — レポートタブ仕様（確定版ドラフト）
更新日: 2026-02-22

---

## 1. 目的

- 1日分の **体重・健康体調・食事・運動** の記録を、1つのテキストレポートとして整形して表示する。
- 「コピーして保存」ボタン1つで、
  - ① レポートテキストをクリップボードにコピー
  - ② 当日の記録を保存（正規化付き）
  を同時に実行できるようにする。
- 出力は、用途別に3パターン（ChatGPT向け / 栄養士向け / Copilot向け）をサポートする。

---

## 2. UI構成

### 2.1 画面位置

- Reportタブの「レポート表示」タブ内で利用するコンポーネント:
  - `DailyRecordReportView`（仮名）

### 2.2 レイアウト

- 上段 右側:
  - 表示対象ラジオボタン（3種類）
    - `ChatGPT向け`
    - `栄養士向け`
    - `Copilot向け`
  - 「レポートをコピーして保存」ボタン
- 下段:
  - レポートテキスト（読み取り専用 `<pre>` 表示）

### 2.3 ラジオボタン仕様

- 種別（audience）:
  - `"chatgpt" | "dietitian" | "copilot"`
- 初期値:
  - `"chatgpt"`
- 切り替え時:
  - 即座にレポートテキストを再生成する。

---

## 3. 「レポートをコピーして保存」ボタン仕様

### 3.1 ラベル

- `レポートをコピーして保存`

### 3.2 処理フロー

1. 親コンポーネントから渡された `onSave()` を呼び出す。  
   - 内部では `dailyRecordService.save(record)` を通じて保存・正規化を行う。
2. 保存結果（成功/失敗）を bool で受け取る。
3. `buildDailyRecordReport(record, { audience })` で `reportText` を生成する。
4. `navigator.clipboard.writeText(reportText)` を呼び出し、コピー結果（成功/失敗）を bool で受け取る。
5. 以下4パターンに応じてメッセージを表示する（場所はステータスバー or トーストなど）:
   - 保存OK: `保存したよ`
   - 保存NG: `保存失敗しちゃった`
   - コピーOK: `クリップボードにコピーしたよ`
   - コピーNG: `コピー失敗しちゃった`

※ 実装上は `saveOk: boolean`, `copyOk: boolean` からメッセージを組み立てる。

### 3.3 ボタン活性条件

- 対象日の `record` がロード済み。
- ロード中（loading状態）のときは無効化してもよい（任意）。

---

## 4. レポートテキスト仕様

### 4.1 全体構造
<体重・食事・運動記録 (M/D 曜)>

⚖ 体重
...

🧠 コンディション
...

🍽️ 食事
...

🏋️‍♂️ 運動
...

- ヘッダ行は全audienceで必ず出す。
- セクション順序は以下で固定（全audience共通）:
  1. 体重
  2. コンディション
  3. 食事
  4. 運動

### 4.2 日付フォーマット

- `(M/D 曜)` 形式
  - 例: `2/19 木`
- 曜日: `日/月/火/水/木/金/土` のいずれか。

### 4.3 改行ルール

- セクションとセクションの間は **空行1行** を挟む。
- 最後の行の末尾に余計な改行は付けない（テキスト全体の末尾は改行なし）。

---

## 5. セクション仕様

### 5.1 ⚖ 体重セクション

#### 5.1.1 表示例
⚖ 体重
[朝] #0  7:00 144.4kg #1 7:30 144.3kg
[夜] （記録なし）


#### 5.1.2 データソース

- `record.weights: WeightRecord[]`
  - `measurement_time_slot`: `"MORNING" | "EVENING" | "OTHER"`（想定）
  - `measured_at`: ISO datetime
  - `weight`: number (kg)

#### 5.1.3 ロジック

- `measurement_time_slot` 別に `weights` を分ける。
  - 朝: `MORNING`
  - 夜: `EVENING`
  - その他: `OTHER`（現時点ではレポート出力対象外）
- 朝の行:
  - 朝のweight一覧を `measured_at` or `measurement_order` 昇順でソートして全件出力。
  - ラベル: `[朝] #0..., #1...`  （indexは0始まりで表示）
- 同様に夜も `[夜] #0..., #1...` 形式で出力。
- 各行のフォーマット:
  - `時刻 weight`: `HH:MM 144.4kg`
  - `measured_at` が無ければ時刻部分を省略。
  - `weight` が無ければ `（記録なし）` として扱う。
- 朝or夜に1件も記録が無い場合:
  - `[朝] （記録なし）`
  - `[夜] （記録なし）`

---

### 5.2 🧠 コンディションセクション

#### 5.2.1 表示例
🧠 コンディション
🛌 睡眠：6時間未満 / 質：普通
💧 水分：2L以上
🔋 身体：少し疲れ
💭 気分：普通
🤤 空腹感：なし
🚽 便通：2回


#### 5.2.2 データソース

- `record.wellness: WellnessRecord | null`

#### 5.2.3 ロジック

- `record.wellness` が `null` の場合:
  - コンディションセクション **全体を非表示**（セクション丸ごと出さない）。
- 各項目は `WellnessRecord` のフィールド値を **ラベルマップ** から日本語へ変換して表示する。
  - ラベルマップは `src/domain/labels/wellnessLabels.ts` に定義。
- 各フィールドが `null` の場合:
  - その行は **出力しない**（未入力行は非表示）。

---

### 5.3 🍽️ 食事セクション

#### 5.3.1 表示例
🍽️ 食事
[朝食] #0 7:00,570kcal：ネギトロ丼（酢飯、納豆、めかぶ、ネギトロ、しそ）, #1 8:00,120kcal：ホエイプロテイン、豆乳
[昼食] 12:00,450kcal：たまご鯛雑炊
[夕食] 19:00,700kcal：親子丼（玄米、玉ねぎ、鶏むね肉）
[間食] 16:00,300kcal：アーモンドミルクラテ、焼き鳥串


#### 5.3.2 データソース

- `record.meals: MealAggregate[]`
  - `meal_record.recording_category`: `"BREAKFAST" | "LUNCH" | "DINNER" | "SNACK"`
  - `meal_record.eaten_at`: ISO datetime
  - `food_items: FoodItem[]`（`food_name`, `food_calorie` など）

#### 5.3.3 ロジック

- `recording_category` ごとにMealsを4グループに分ける:
  - BREAKFAST → 朝食
  - LUNCH → 昼食
  - DINNER → 夕食
  - SNACK → 間食
- グループ内は `meal_order` 昇順で並び替える。
- 各Mealについて1行を生成:
  - ラベル: `[朝食] #0..., #1...`（0始まりindex）（LUNCHなら `[昼食] #0..., #1...`）
    - 2件目以降: 
  - 時刻: `HH:MM`（`eaten_at` から）
  - カロリー:
    - `totalCalorie = sum(food_items[].food_calorie)` をkcalとして表示。
    - `food_calorie` が無い場合は `,XXXkcal` 部分を省略。
  - 食事名・材料:
    - 表示名:  
      - `food_items` の `food_name` を `、` で連結。
      - メインぽい名称（例: ネギトロ丼）は必要に応じて先頭に置く。迷ったら `food_items[0]` をメインとする。
- 朝/昼/夕/間食のうち:
  - 朝/昼/夕：どのスロットにもMealが1件も無ければ、`[朝食] （記録なし）` のように「(記録なし)」行を出す。
  - 間食：1件も無い場合は、間食の行自体を出さない（`（記録なし）` は表示しない）。

---

### 5.4 🏋️‍♂️ 運動セクション

#### 5.4.1 表示例（イメージ）
🏋️‍♂️ 運動
Session #0 7:00 - 8:00 
 スクワット 60kg x 8rep x 3set
 ベンチプレス 40kg x 10rep x 3set
 プランク 50sec
 サイドプランク 30sec x 左右
...


#### 5.4.2 データソース

- `record.exercise_sessions: ExerciseSessionAggregate[]`
  - セッション名、種目名、recording_style、set_items など

#### 5.4.3 ロジック

- 全セッションを `session_order` 順に走査し、各セッション内の種目を `item_order` 順に処理する。
- `recording_style === "SETS"` の場合:
  - `set_items` の情報から
    - 重量, 回数, セット数 をテキストにする
    - 必要なら同一パターンをまとめて `60kg x 8rep x 3set` のように表現する。
- `recording_style === "TEXT"` の場合:
  - `text_memo`（仮）等、自由記述をそのまま1行として出力する。
- 全体の行の並び順は、`normalizeExerciseOrders` 後の order に従う。
- 運動記録が1件も無い場合:
  - `🏋️‍♂️ 運動` セクションは出す。
  - 内容は `（記録なし）` の1行のみとする。

---

## 6. audience別の違い

### 6.1 共通ルール

- ヘッダー行は全audienceで必ず表示。
- セクション順序・フォーマットは現時点では **全audience共通**。
- 今後、audienceごとに「出すセクション」「粒度」を変えたくなった場合は、
  `buildDailyRecordReport(record, { audience })` 内のロジックで出し分けを行う。

---

## 7. 実装構成（ファイル）

### 7.1 Domain

- `src/domain/labels/wellnessLabels.ts`
  - Wellness系フィールド値 → 日本語ラベルマップ
- `src/domain/labels/mealLabels.ts`（必要に応じて）
- `src/domain/labels/weightLabels.ts`（必要に応じて）
- `src/domain/report/dailyRecordReport.ts`
  - 関数:
    - `buildDailyRecordReport(record: DailyRecordAggregate, options: { audience: ReportAudience }): string`
  - 内部で各セクションビルド関数を呼び出す。

### 7.2 UI

- `src/ui/report/DailyRecordReportView.tsx`
  - Props:
    - `record: DailyRecordAggregate`
    - `onSave: () => Promise<boolean> | boolean`（保存成功ならtrue）
  - 役割:
    - audienceラジオボタンの管理
    - `buildDailyRecordReport`でreportText生成
    - `<pre>` でテキスト表示
    - 「レポートをコピーして保存」ボタンのクリック処理
- `src/ui/report/DailyRecordIOSection.tsx`
  - 「保存・読出」タブ用（別途設計）

- `DailyRecordFormV110.tsx`
  - 編集モード/レポートモードの切替
  - Reportタブの「レポート表示」内容として `DailyRecordReportView` をレンダリングする。
  - `handleSave()` を共通化し、編集タブとレポートタブの両方から利用する。

---

## 8. ロジック関数シグネチャ

```ts
// src/domain/report/dailyRecordReport.ts
export type ReportAudience = "chatgpt" | "dietitian" | "copilot";

export interface DailyRecordReportOptions {
  audience: ReportAudience;
}

export function buildDailyRecordReport(
  record: DailyRecordAggregate,
  options: DailyRecordReportOptions
): string;