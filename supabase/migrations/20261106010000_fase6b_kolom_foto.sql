-- ============================================================
-- FASE 6b — INSPEKSI: KOLOM FOTO (WEBP) + BUCKET STORAGE
-- ============================================================
-- Additive & idempotent. Kolom menampung public URL hasil konversi
-- WebP server-side (Edge Function convert-webp) per sisi kendaraan.

ALTER TABLE public.unit_inspections
    ADD COLUMN IF NOT EXISTS front_image_url  text,
    ADD COLUMN IF NOT EXISTS rear_image_url   text,
    ADD COLUMN IF NOT EXISTS left_image_url   text,
    ADD COLUMN IF NOT EXISTS right_image_url  text;

-- Bucket penyimpanan foto inspeksi (public agar bisa ditampilkan langsung)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('inspection-images', 'inspection-images', true, 10485760, ARRAY['image/webp','image/jpeg','image/png','image/jpg'])
ON CONFLICT (id) DO NOTHING;
