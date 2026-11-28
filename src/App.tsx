// src/App.tsx
import { DailyRecordForm } from "../20_module/C-01_daily-record/src/DailyRecordForm";
import { AuthPanel } from '../20_module/S-01_auth/src/AuthPanel';

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