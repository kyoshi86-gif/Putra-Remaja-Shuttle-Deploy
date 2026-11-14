-- ============================================================
-- FASE 6k — INSPEKSI: kolom odometer + alur ke SPK
-- ============================================================
-- Odometer diisi wajib saat inspeksi; dibawa otomatis ke SPK
-- (maintenance_records.odometer) saat mekanik mengedit.

ALTER TABLE public.unit_inspections
    ADD COLUMN IF NOT EXISTS odometer numeric;

NOTIFY pgrst, 'reload schema';
