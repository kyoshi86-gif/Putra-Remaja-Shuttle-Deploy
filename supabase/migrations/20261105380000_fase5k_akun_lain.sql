-- ============================================================
-- FASE 5k — TAMBAH KOLOM + FK AKUN LAINYA (expense/cogs/stock_adj)
-- ------------------------------------------------------------
-- Frontend (useItemCategories.ts & useItemSubcategories.ts)
-- meng-embed 4 relasi akun per tabel:
--   inventory_account, expense_account, cogs_account, stock_adjustment_account
-- Hanya inventory_account yang sudah punya kolom+FK. Tambahkan 3 sisanya
-- di kedua tabel, mengikuti pola tabel `items`.
-- Additive & idempotent.
-- ============================================================

-- ---------- item_categories ----------
ALTER TABLE public.item_categories ADD COLUMN IF NOT EXISTS expense_account_id uuid;
ALTER TABLE public.item_categories ADD COLUMN IF NOT EXISTS cogs_account_id uuid;
ALTER TABLE public.item_categories ADD COLUMN IF NOT EXISTS stock_adjustment_account_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='item_categories_expense_account_id_fkey' AND conrelid='item_categories'::regclass) THEN
        ALTER TABLE public.item_categories ADD CONSTRAINT item_categories_expense_account_id_fkey FOREIGN KEY (expense_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='item_categories_cogs_account_id_fkey' AND conrelid='item_categories'::regclass) THEN
        ALTER TABLE public.item_categories ADD CONSTRAINT item_categories_cogs_account_id_fkey FOREIGN KEY (cogs_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='item_categories_stock_adjustment_account_id_fkey' AND conrelid='item_categories'::regclass) THEN
        ALTER TABLE public.item_categories ADD CONSTRAINT item_categories_stock_adjustment_account_id_fkey FOREIGN KEY (stock_adjustment_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ---------- item_subcategories ----------
ALTER TABLE public.item_subcategories ADD COLUMN IF NOT EXISTS expense_account_id uuid;
ALTER TABLE public.item_subcategories ADD COLUMN IF NOT EXISTS cogs_account_id uuid;
ALTER TABLE public.item_subcategories ADD COLUMN IF NOT EXISTS stock_adjustment_account_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='item_subcategories_expense_account_id_fkey' AND conrelid='item_subcategories'::regclass) THEN
        ALTER TABLE public.item_subcategories ADD CONSTRAINT item_subcategories_expense_account_id_fkey FOREIGN KEY (expense_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='item_subcategories_cogs_account_id_fkey' AND conrelid='item_subcategories'::regclass) THEN
        ALTER TABLE public.item_subcategories ADD CONSTRAINT item_subcategories_cogs_account_id_fkey FOREIGN KEY (cogs_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='item_subcategories_stock_adjustment_account_id_fkey' AND conrelid='item_subcategories'::regclass) THEN
        ALTER TABLE public.item_subcategories ADD CONSTRAINT item_subcategories_stock_adjustment_account_id_fkey FOREIGN KEY (stock_adjustment_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
    END IF;
END $$;
