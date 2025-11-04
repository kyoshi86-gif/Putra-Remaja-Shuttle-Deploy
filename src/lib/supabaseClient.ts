import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("supabase.co") === false) {
  console.error("❌ Supabase env tidak valid:", { supabaseUrl, supabaseKey });
  alert("Supabase belum dikonfigurasi dengan benar. Hubungi admin.");
}

console.log("✅ ENV:", {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY,
});
export const supabase = createClient(supabaseUrl, supabaseKey);