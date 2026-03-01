import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './features/auth/AuthContext'

//import { migrateAllLegacyHistoryToV110 } from "./domain/storage/dailyRecordStorage";

// ブラウザコンソールから実行できるように export しておく
//if (typeof window !== "undefined") {
//  (window as any).migrateAllLegacyHistoryToV110 = migrateAllLegacyHistoryToV110;
//}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>  
      <App />
    </AuthProvider>
  </StrictMode>,
)
