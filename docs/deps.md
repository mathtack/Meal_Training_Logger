# Dependencies (v1.1.0)

- Entry: App.tsx → ui/DailyRecordFormV110.tsx
- Update/Save flow: ui → app/dailyRecordService.ts → repository(localStorage) → normalizeDailyRecordAggregate.ts
- Rule: UI must not call normalizers directly; normalization is centralized in app layer.
- Contract: domain/type.ts is the stable schema contract across layers.