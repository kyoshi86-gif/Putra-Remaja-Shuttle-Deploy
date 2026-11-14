-- ============================================================
-- FASE 6j — MAINTENANCE SPK: timestamp Mulai/Selesai + alasan batal
-- ============================================================
-- Saat mekanik klik Mulai/Selesai, tanggal-waktu tersimpan otomatis.
-- Batalkan SPK wajib mengisi alasan (cancel_reason).

ALTER TABLE public.maintenance_records
    ADD COLUMN IF NOT EXISTS started_at     timestamptz,
    ADD COLUMN IF NOT EXISTS finished_at    timestamptz,
    ADD COLUMN IF NOT EXISTS cancel_reason  text;

NOTIFY pgrst, 'reload schema';
