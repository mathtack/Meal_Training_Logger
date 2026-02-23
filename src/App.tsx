// src/App.tsx
import { DailyRecordFormV110 } from "./ui/DailyRecordFormV110";
// 旧フォームが完全に不要になったら、この import は削除してOK
// import { DailyRecordForm } from "./components/DailyRecordForm";

export default function App() {
  // 常に v1.1.0 のフォームを表示
  return <DailyRecordFormV110 />;
}