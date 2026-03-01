// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // 起動時に気付きたいので、あえて throw
  throw new Error('Supabase URL or anon key is missing. Check your .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 👇 これを追加（デバッグ用）
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}