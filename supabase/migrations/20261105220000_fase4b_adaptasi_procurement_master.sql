-- ============================================================
-- FASE 4b — ADAPTASI SKEMA PROCUREMENT MASTER KE FRONTEND
-- ------------------------------------------------------------
-- Halaman-halaman frontend ditulis dgn skema (code/name/is_active/dll)
-- yang OBREDA dgn kolom awal. Migration ini menambah kolom kompatibilitas
-- (additive, idempotent) + seed menu Procurement + akses Administrator.
-- ============================================================

-- ---------- SUPPLIERS ----------
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact_person text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS default_payment_term_days integer NOT NULL DEFAULT 0;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE public.suppliers SET name = COALESCE(name, nama), code = COALESCE(code, kode) WHERE name IS NULL OR code IS NULL;

-- ---------- UNITS ----------
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE public.units SET name = COALESCE(name, nama), code = COALESCE(code, kode) WHERE name IS NULL OR code IS NULL;

-- ---------- STORES ----------
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS store_type text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE public.stores SET name = COALESCE(name, nama), code = COALESCE(code, kode), address = COALESCE(address, alamat) WHERE name IS NULL OR code IS NULL;

-- ---------- ITEM_CATEGORIES ----------
ALTER TABLE public.item_categories ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.item_categories ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.item_categories ADD COLUMN IF NOT EXISTS article_prefix integer;
ALTER TABLE public.item_categories ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.item_categories ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE public.item_categories SET name = COALESCE(name, nama), code = COALESCE(code, kode) WHERE name IS NULL OR code IS NULL;

-- ---------- ITEM_SUBCATEGORIES ----------
ALTER TABLE public.item_subcategories ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.item_subcategories ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.item_subcategories ADD COLUMN IF NOT EXISTS article_prefix integer;
ALTER TABLE public.item_subcategories ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.item_subcategories ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE public.item_subcategories SET name = COALESCE(name, nama), code = COALESCE(code, kode) WHERE name IS NULL OR code IS NULL;

-- ---------- ITEMS ----------
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'STOCK';
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS inventory_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS expense_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS cogs_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS stock_adjustment_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS minimum_stock numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS standard_cost numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE public.items SET name = COALESCE(name, nama), code = COALESCE(code, kode) WHERE name IS NULL OR code IS NULL;

-- ---------- PURCHASE_SETTLEMENT_METHODS ----------
ALTER TABLE public.purchase_settlement_methods ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.purchase_settlement_methods ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.purchase_settlement_methods ADD COLUMN IF NOT EXISTS settlement_type text NOT NULL DEFAULT 'CASH';
ALTER TABLE public.purchase_settlement_methods ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_settlement_methods ADD COLUMN IF NOT EXISTS requires_amount boolean NOT NULL DEFAULT false;
ALTER TABLE public.purchase_settlement_methods ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
ALTER TABLE public.purchase_settlement_methods ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.purchase_settlement_methods ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE public.purchase_settlement_methods SET name = COALESCE(name, nama), code = COALESCE(code, kode) WHERE name IS NULL OR code IS NULL;

-- ---------- MENU: GROUP PROCUREMENT ----------
DO $$
DECLARE v_parent uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.menus WHERE label = 'Procurement' AND parent IS NULL) THEN
        INSERT INTO public.menus (id, label, parent, order_index)
        VALUES (gen_random_uuid(), 'Procurement', NULL, 0);
    END IF;

    SELECT id INTO v_parent FROM public.menus WHERE label = 'Procurement' AND parent IS NULL LIMIT 1;
    IF v_parent IS NOT NULL THEN
        INSERT INTO public.menus (id, label, path, component, access, parent, order_index)
        SELECT gen_random_uuid(), v.label, v.path, v.component, v.access, v_parent, v.ord
        FROM (VALUES
            ('Suppliers', '/suppliers', 'procurement/suppliers/SupplierPage', 'Procurement -> Suppliers', 1),
            ('Units', '/units', 'procurement/units/UnitPage', 'Procurement -> Units', 2),
            ('Stores', '/stores', 'procurement/stores/StorePage', 'Procurement -> Stores', 3),
            ('Item Categories', '/item-categories', 'procurement/item-categories/ItemCategoryPage', 'Procurement -> Item Categories', 4),
            ('Item Subcategories', '/item-subcategories', 'procurement/item-subcategories/ItemSubcategoryPage', 'Procurement -> Item Subcategories', 5),
            ('Items', '/items', 'procurement/items/ItemPage', 'Procurement -> Items', 6),
            ('Settlement Methods', '/purchase-settlement-methods', 'procurement/purchase-settlement-methods/PurchaseSettlementMethodPage', 'Procurement -> Settlement Methods', 7)
        ) AS v(label, path, component, access, ord)
        WHERE NOT EXISTS (
            SELECT 1 FROM public.menus m WHERE m.parent = v_parent AND m.label = v.label
        );
    END IF;
END $$;

-- ---------- AKSES ADMINISTRATOR ----------
DO $$
DECLARE accs text[] := ARRAY[
    'Procurement',
    'Procurement -> Suppliers',
    'Procurement -> Units',
    'Procurement -> Stores',
    'Procurement -> Item Categories',
    'Procurement -> Item Subcategories',
    'Procurement -> Items',
    'Procurement -> Settlement Methods'
];
BEGIN
    UPDATE public.custom_roles SET access = access || accs
    WHERE name = 'Administrator' AND NOT (access @> accs);
    UPDATE public.custom_users SET access = access || accs
    WHERE role = 'Administrator' AND NOT (access @> accs);
END $$;
