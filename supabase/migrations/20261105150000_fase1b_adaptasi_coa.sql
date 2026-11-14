-- ============================================================
-- FASE 1b — ADAPTASI SKEMA MENUTUK FRONTEND COA + SEED MENU
-- ------------------------------------------------------------
-- Halaman CoaPage (src/pages/accounting/coa) memakai kolom yang
-- belum ada di tabel accounts. Tambah kolom (additive), backfill,
-- lalu daftarkan menu Chart of Accounts di tabel menus.
-- ============================================================

-- 1) Kolom tambahan untuk tabel accounts (dipakai CoaPage/useCoa)
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS parent_account_id uuid REFERENCES public.accounts(id);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS category_code text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS account_type text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_posting boolean NOT NULL DEFAULT true;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_summary boolean NOT NULL DEFAULT false;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_accounts_parent ON public.accounts (parent_account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_entity ON public.accounts (entity_id);

-- Backfill dari kolom lama (agar CO lama tercermin)
UPDATE public.accounts
   SET account_type = type
 WHERE account_type IS NULL AND type IS NOT NULL;

UPDATE public.accounts
   SET parent_account_id = parent_id
 WHERE parent_account_id IS NULL AND parent_id IS NOT NULL;

-- 2) Daftarkan menu "Chart of Accounts" di bawah menu Accounting (sidebar)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.menus WHERE path = '/coa') THEN
        INSERT INTO public.menus (label, path, access, component, parent, order_index, created_at)
        SELECT 'Chart of Accounts', '/coa', 'Accounting -> Chart of Accounts',
               'accounting/coa/CoaPage',
               'da20c1b6-7099-4152-9c94-1ea03f9f9458',
               COALESCE(MAX(order_index), 0) + 1, now()
          FROM public.menus
         WHERE parent = 'da20c1b6-7099-4152-9c94-1ea03f9f9458';
    END IF;
END $$;
