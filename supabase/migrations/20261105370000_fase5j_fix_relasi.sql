-- ============================================================
-- FASE 5j — PERBAIKAN RELASI & KOLOM (item category/subcategory + settlement)
-- ------------------------------------------------------------
-- 1) item_categories: tambah FK bernama (frontend pakai
--    `accounts!item_categories_inventory_account_id_fkey`) ke accounts.
-- 2) item_subcategories: tambah kolom inventory_account_id + FK
--    `accounts!item_subcategories_inventory_account_id_fkey`.
-- 3) purchase_settlement_methods: tambah kolom entity_id & available_for
--    (dipakai filter PAYMENT/BOTH oleh halaman pembayaran).
-- Additive & idempotent.
-- ============================================================

-- 1) item_categories FK
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='item_categories_inventory_account_id_fkey' AND conrelid='item_categories'::regclass) THEN
        ALTER TABLE public.item_categories
            ADD CONSTRAINT item_categories_inventory_account_id_fkey
            FOREIGN KEY (inventory_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2) item_subcategories kolom + FK
ALTER TABLE public.item_subcategories ADD COLUMN IF NOT EXISTS inventory_account_id uuid;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='item_subcategories_inventory_account_id_fkey' AND conrelid='item_subcategories'::regclass) THEN
        ALTER TABLE public.item_subcategories
            ADD CONSTRAINT item_subcategories_inventory_account_id_fkey
            FOREIGN KEY (inventory_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3) purchase_settlement_methods entity_id + available_for
ALTER TABLE public.purchase_settlement_methods ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE public.purchase_settlement_methods ADD COLUMN IF NOT EXISTS available_for text NOT NULL DEFAULT 'BOTH';
