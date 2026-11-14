-- ============================================================
-- FASE 1c — TABEL ACCOUNT_MAPPINGS + MENU MODUL LAPORAN AKUNTANSI
-- ------------------------------------------------------------
-- (1) account_mappings: tabel yang dipakai halaman Account Mapping
--     (sudah di menu tapi tabel belum ada).
-- (2) Daftarkan menu Buku Besar, Trial Balance, Neraca, Laba Rugi.
-- (3) Beri akses Administrator untuk modul-modul tersebut.
-- ============================================================

-- 1) account_mappings
CREATE TABLE IF NOT EXISTS public.account_mappings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    module_code      text NOT NULL,
    transaction_code text NOT NULL,
    mapping_key      text,
    account_id       uuid REFERENCES public.accounts(id),
    entity_id        uuid,
    name             text,
    description      text,
    is_active        boolean NOT NULL DEFAULT true,
    created_at       timestamptz DEFAULT now(),
    updated_at       timestamptz DEFAULT now(),
    created_by       text,
    updated_by       text
);
CREATE INDEX IF NOT EXISTS idx_account_mappings_entity   ON public.account_mappings (entity_id);
CREATE INDEX IF NOT EXISTS idx_account_mappings_account  ON public.account_mappings (account_id);
CREATE INDEX IF NOT EXISTS idx_account_mappings_module   ON public.account_mappings (module_code, transaction_code, mapping_key);

-- 2) Seed menu modul laporan akuntansi (sidebar: tabel menus)
DO $$
DECLARE
    v_parent uuid := 'da20c1b6-7099-4152-9c94-1ea03f9f9458'; -- group Accounting
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.menus WHERE path = '/buku-besar') THEN
        INSERT INTO public.menus (label, path, access, component, parent, order_index, created_at)
        SELECT 'Buku Besar', '/buku-besar', 'Accounting -> Buku Besar',
               'accounting/general-ledger/GeneralLedgerPage', v_parent,
               COALESCE(MAX(order_index), 0) + 1, now()
          FROM public.menus WHERE parent = v_parent;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.menus WHERE path = '/trial-balance') THEN
        INSERT INTO public.menus (label, path, access, component, parent, order_index, created_at)
        SELECT 'Trial Balance', '/trial-balance', 'Accounting -> Trial Balance',
               'accounting/trial-balance/TrialBalancePage', v_parent,
               COALESCE(MAX(order_index), 0) + 1, now()
          FROM public.menus WHERE parent = v_parent;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.menus WHERE path = '/neraca') THEN
        INSERT INTO public.menus (label, path, access, component, parent, order_index, created_at)
        SELECT 'Neraca', '/neraca', 'Accounting -> Neraca',
               'accounting/balance-sheet/BalanceSheetPage', v_parent,
               COALESCE(MAX(order_index), 0) + 1, now()
          FROM public.menus WHERE parent = v_parent;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.menus WHERE path = '/laba-rugi') THEN
        INSERT INTO public.menus (label, path, access, component, parent, order_index, created_at)
        SELECT 'Laba Rugi', '/laba-rugi', 'Accounting -> Laba Rugi',
               'accounting/income-statement/IncomeStatementPage', v_parent,
               COALESCE(MAX(order_index), 0) + 1, now()
          FROM public.menus WHERE parent = v_parent;
    END IF;
END $$;

-- 3) Akses Administrator untuk modul laporan
DO $$
DECLARE
    v_accs text[] := ARRAY[
        'Accounting -> Buku Besar',
        'Accounting -> Trial Balance',
        'Accounting -> Neraca',
        'Accounting -> Laba Rugi'
    ];
BEGIN
    UPDATE public.custom_roles
       SET access = access || v_accs
     WHERE name = 'Administrator'
       AND NOT (access @> v_accs);

    UPDATE public.custom_users
       SET access = access || v_accs
     WHERE role = 'Administrator'
       AND NOT (access @> v_accs);
END $$;
