// Supabase Edge Function: delete-inspection-images
// Menghapus foto dari bucket "inspection-images" via Storage API
// dengan SERVICE_ROLE_KEY (bebas RLS). Tanpa library gambar berat,
// jadi pasti boot di local & cloud runtime.
//
// Request: POST, JSON { paths: ["a.webp","b.webp"] }
// Response: { removed: [...] } atau { error }.
// Deploy: supabase functions deploy delete-inspection-images --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "inspection-images";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !serviceKey) return json({ error: "env missing" }, 500);

    const supabase = createClient(url, serviceKey);

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
    const paths: string[] = Array.isArray(body?.paths) ? body.paths : [];
    if (paths.length === 0) return json({ error: "paths required" }, 400);

    const { data, error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) return json({ error: error.message }, 500);

    return json({ removed: data ?? [] });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
