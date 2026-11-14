-- ============================================================
-- FASE 5i — TAMBAH KOLOM inventory_account_id DI item_categories
-- ------------------------------------------------------------
-- Halaman Opening Balance (dan form item) mengharapkan fallback
-- akun persediaan dari KATEGORI (item.category.inventory_account_id).
-- Kolom ini sebelumnya hanya ada di `items`; tambahkan juga ke
-- `item_categories` agar query & logika frontend berhasil.
-- Additive & idempotent.
-- ============================================================
ALTER TABLE public.item_categories ADD COLUMN IF NOT EXISTS inventory_account_id uuid;
