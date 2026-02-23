# Dependencies (v1.1.0)

## Top-level flow

- Entry:
  - `main.tsx` → `App.tsx` → `ui/DailyRecordFormV110.tsx`
- DailyRecord 操作フロー:
  - UI (`ui/*`)
    → Application (`app/dailyRecordService.ts`)
    → Repository (`domain/DailyRecordRepository.ts`, `domain/dailyRecordRepository.localStorage.ts`)
    → Storage (`domain/storage/dailyRecordStorage.ts`)
    → Domain (factories / normalizers / report)

## Layers & responsibilities

- **UI layer (React)**
  - `ui/DailyRecordFormV110.tsx`
  - `ui/WeightEditor.tsx`, `ui/WellnessEditor.tsx`, `ui/ExerciseSessionsEditor.tsx`
  - `domain/report/DailyRecordReportView.tsx`
  - 👉 画面構成と入力イベントの管理のみ。永続化や正規化ロジックは持たない。

- **Application layer**
  - `app/dailyRecordService.ts`
  - 👉 UI からの「保存/読込/削除/一覧」要求をユースケース単位で受け取り、
    Repository・Storage・Normalizer を組み合わせて実行するオーケストレーション層。

- **Repository & Storage layer**
  - `domain/DailyRecordRepository.ts`
  - `domain/dailyRecordRepository.localStorage.ts`
  - `domain/storage/dailyRecordStorage.ts`
  - 👉 永続化ポートの定義と、localStorage 実装。
    - v1.1.0 形式: `daily_record:<ISODate>`
    - legacy 形式: `meal-training-logger:history` / `latestRecord`
    - lazy migration / 一括 migration をここで吸収。

- **Domain layer**
  - 型定義: `domain/type.ts`（全レイヤ共通の契約）
  - ファクトリ: `domain/factories/createEmptyDailyRecordAggregate.ts`
  - 正規化:
    - `domain/normalizers/normalizeWeightOrders.ts`
    - `domain/normalizers/normalizeExerciseOrders.ts`
    - `domain/normalizers/normalizeDailyRecordAggregate.ts`
  - レポート:
    - `domain/report/dailyRecordReport.ts`
  - 👉 ビジネスルール（並び順、初期値、文面生成）をカプセル化し、
    UI や Storage から独立させる。

- **Legacy (pre v1.1.0)**
  - `domain/DailyRecord.ts`
  - `domain/history.ts`
  - `domain/formatDailyRecord.ts`
  - `domain/localStorageHistory.ts`
  - 👉 旧フォームと legacy localStorage (`meal-training-logger:*`) 用のドメイン。
    v1.1.0 以降は読み取り・移行用としてのみ利用し、将来的に削除予定。

## Dependency rules

- UI → Application → Domain → Storage の **一方向依存**。
  - UI から Domain/Storage へ直接触らない（必ず `dailyRecordService` 経由）。
- Normalizers / Factories / Report は **副作用を持たない純粋な関数**として設計する。
- `domain/type.ts` は全レイヤ共通の **単一のスキーマ定義ソース**。
  - ここを介して、Domain・Application・UI の型整合性を保つ。
- legacy コードは v1.1.0 では読み取り専用。
  - 新規書き込みはすべて v1.1.0 形式 (`daily_record:*`) のみ。