-- ============================================================
-- FASE 6g — TAMBAH KOLOM dateline DI unit_inspections
-- ============================================================
-- Tenggat (deadline) untuk SPK maintenance. Diisi bila ada
-- jenis pekerjaan (work_type). Null saat tidak ada perbaikan.

ALTER TABLE public.unit_inspections
    ADD COLUMN IF NOT EXISTS dateline date;

-- Reload schema PostgREST
NOTIFY pgrst, 'reload schema';
