-- ============================================================
-- FASE 5l — TAMBAH KOLOM "bonus" DI TABLE premi_driver
-- ------------------------------------------------------------
-- Menambahkan kolom `bonus` (numeric, default 0) untuk mencatat
-- bonus premi driver, tampil di form & tabel frontend, dan
-- dialirkan ke kas_harian sebagai entri terpisah.
-- Additive & idempotent.
-- ============================================================

ALTER TABLE public.premi_driver
    ADD COLUMN IF NOT EXISTS bonus numeric DEFAULT 0;
