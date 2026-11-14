// Supabase Edge Function: convert-webp (v3 — WASM murni, tanpa native lib)
// decode jpeg/png via @jsquash (WASM) -> encode WebP -> upload ke bucket
// "inspection-images" -> return { url }
//
// Deploy: supabase functions deploy convert-webp --no-verify-jwt
// Lokal : supabase functions serve convert-webp

import { decode as decodeJpeg } from "npm:@jsquash/jpeg@1.2.0";
import { decode as decodePng } from "npm:@jsquash/png@1.4.0";
import { encode as encodeWebp } from "npm:@jsquash/webp@1.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "inspection-images";
const MAX_BYTES = 8 * 1024 * 1024; // 8MB input

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

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({ error: "field 'file' required (multipart)" }, 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) {
      return json({ error: "file too large (max 8MB)" }, 413);
    }
    if (bytes.byteLength === 0) {
      return json({ error: "empty file" }, 400);
    }

    const type = (file.type || "").toLowerCase();

    // decode -> ImageData (RGBA)
    let imageData: ImageData;
    try {
      if (type === "image/jpeg" || type === "image/jpg") {
        imageData = await decodeJpeg(bytes);
      } else if (type === "image/png") {
        imageData = await decodePng(bytes);
      } else {
        // coba png dulu, lalu jpeg
        try {
          imageData = await decodePng(bytes);
        } catch {
          imageData = await decodeJpeg(bytes);
        }
      }
    } catch (e) {
      return json({ error: "decode failed: " + String(e) }, 400);
    }

    // resize kalau > 1200px
    let w = imageData.width;
    let h = imageData.height;
    if (w > 1200 || h > 1200) {
      const scale = Math.min(1200 / w, 1200 / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    // konversi pr RGBA, resize pakai canvas 2D buffer manual (simple box)
    const data = new Uint8ClampedArray(w * h * 4);
    if (w === imageData.width && h === imageData.height) {
      data.set(imageData.data);
    } else {
      const sw = imageData.width;
      const s = imageData.data;
      for (let y = 0; y < h; y++) {
        const sy = Math.floor(y / h * imageData.height);
        for (let x = 0; x < w; x++) {
          const sx = Math.floor(x / w * sw);
          const si = (sy * sw + sx) * 4;
          const di = (y * w + x) * 4;
          data[di] = s[si];
          data[di + 1] = s[si + 1];
          data[di + 2] = s[si + 2];
          data[di + 3] = s[si + 3];
        }
      }
    }
    const resized: ImageData = new ImageData(data, w, h);

    // encode WebP
    let webp: Uint8Array;
    try {
      webp = await encodeWebp(resized, { quality: 80 });
    } catch (e) {
      return json({ error: "encode failed: " + String(e) }, 400);
    }

    const name = `insp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.webp`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(name, webp, { contentType: "image/webp", upsert: false });
    if (upErr) return json({ error: upErr.message }, 500);

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(name);
    return json({ url: pub.publicUrl });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
