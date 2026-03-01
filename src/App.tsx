// src/App.tsx
import { DailyRecordFormV110 } from "./ui/DailyRecordFormV110";
import { AuthPanel } from './features/auth/AuthPanel';
// 旧フォームが完全に不要になったら、この import は削除してOK
// import { DailyRecordForm } from "./components/DailyRecordForm";

export default function App() {
  return (
    <>
      {/* 全画面共通のヘッダ的役割 */}
      <AuthPanel />
      <DailyRecordFormV110 />
    </>
  );
}

console.log("SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL);