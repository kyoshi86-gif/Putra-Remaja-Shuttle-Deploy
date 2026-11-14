-- ============================================================
-- FASE 6m — KUNCI EVALUASI DATELINE SAAT SELESAI
-- ============================================================
-- eval_days disimpan saat mekanik klik Selesai (bukan dinamis):
--   positif = sisa hari (mengikuti), 0 = hari ini, negatif = terlewat.
ALTER TABLE public.maintenance_records
    ADD COLUMN IF NOT EXISTS eval_days smallint;

NOTIFY pgrst, 'reload schema';
