-- ============================================================================
-- fase28 — SPK: odometer servis berikutnya + mekanik diisi saat mulai
-- ----------------------------------------------------------------------------
-- 1. Tambah kolom next_odometer (rencana odometer servis berikutnya).
--    Sebelumnya dipakai schedule_date (tanggal) — sekarang jadi odometer.
-- 2. Bersihkan placeholder "draft" pada mechanic (warisan kode lama yang
--    mengisi nama petugas inspeksi seolah-olah itu nama mekanik).
--
-- Idempoten & non-destruktif: hanya ADD COLUMN IF NOT EXISTS + UPDATE NULL.
-- Aman dijalankan berulang dan aman di production.
-- ============================================================================

BEGIN;

ALTER TABLE public.maintenance_records
  ADD COLUMN IF NOT EXISTS next_odometer numeric;

COMMENT ON COLUMN public.maintenance_records.next_odometer IS
  'Odometer (km) rencana servis berikutnya. Diisi dari SPK (halaman Maintenance) atau saat validasi di halaman Jadwal Maintenance bila masih kosong.';

UPDATE public.maintenance_records
   SET mechanic = NULL
 WHERE mechanic IN ('draft', '');

COMMIT;
