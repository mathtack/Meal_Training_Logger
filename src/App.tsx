// src/App.tsx
import { DailyRecordForm } from "./components/DailyRecordForm";
import { DailyRecordFormV110 } from "./ui/DailyRecordFormV110";

export default function App() {
  const useV110 = import.meta.env.DEV;
  return useV110 ? <DailyRecordFormV110 /> : <DailyRecordForm />;
}
