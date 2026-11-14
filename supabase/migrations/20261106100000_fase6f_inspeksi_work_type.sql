-- ============================================================
-- FASE 6f — TAMBAH KOLOM work_type DI unit_inspections
-- ============================================================
-- Jenis pekerjaan (sama persis dengan pilihan di form SPK):
--   preventive / corrective / berkala / pajak
-- Ditentukan saat inspeksi; lalu di-* bawa* ke SPK (read-only).

ALTER TABLE public.unit_inspections
    ADD COLUMN IF NOT EXISTS work_type text DEFAULT 'corrective';

CREATE INDEX IF NOT EXISTS idx_inspeksi_work_type
    ON public.unit_inspections(work_type);

-- Reload schema PostgREST
NOTIFY pgrst, 'reload schema';
