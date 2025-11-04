// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validasi env
if (
  typeof supabaseUrl !== "string" ||
  typeof supabaseKey !== "string" ||
  !supabaseUrl.includes("supabase.co")
) {
  throw new Error("❌ Supabase env tidak valid. Cek konfigurasi Vercel dan prefix VITE_");
}

// Inisialisasi Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);