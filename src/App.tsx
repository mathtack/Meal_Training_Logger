// src/App.tsx
import { DailyRecordForm } from "./ui/DailyRecordForm";
import { AuthPanel } from './features/auth/AuthPanel';

export default function App() {
  return (
    <>
      {/* 全画面共通のヘッダ的役割 */}
      <AuthPanel />
      <DailyRecordForm />
    </>
  );
}

console.log("SUPABASE_URL:", import.meta.env.VITE_SUPABASE_URL);