-- ============================================================
-- FASE 5d — ADAPTASI KOLOM & RELASI TABEL INVENTORY (frontend)
-- ------------------------------------------------------------
-- Additive & idempotent. Rename dibungkus DO block ceck kolom.
-- ============================================================

-- ---------- helper: rename kalau kolom lama masih ada ----------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='inventory_requests' AND column_name='from_store_id') THEN
        ALTER TABLE public.inventory_requests RENAME COLUMN from_store_id TO source_store_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='inventory_requests' AND column_name='to_store_id') THEN
        ALTER TABLE public.inventory_requests RENAME COLUMN to_store_id TO destination_store_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='inventory_requests' AND column_name='tanggal') THEN
        ALTER TABLE public.inventory_requests RENAME COLUMN tanggal TO request_date;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='inventory_requests' AND column_name='notes') THEN
        ALTER TABLE public.inventory_requests RENAME COLUMN notes TO remarks;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='inventory_requests' AND column_name='requested_by') THEN
        ALTER TABLE public.inventory_requests RENAME COLUMN requested_by TO created_by;
    END IF;
END $$;

ALTER TABLE public.inventory_requests DROP CONSTRAINT IF EXISTS inventory_requests_from_store_id_fkey;
ALTER TABLE public.inventory_requests DROP CONSTRAINT IF EXISTS inventory_requests_to_store_id_fkey;
ALTER TABLE public.inventory_requests ADD COLUMN IF NOT EXISTS required_date date;
ALTER TABLE public.inventory_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_inventory_requests_source_store') THEN
        ALTER TABLE public.inventory_requests ADD CONSTRAINT fk_inventory_requests_source_store
            FOREIGN KEY (source_store_id) REFERENCES public.stores(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_inventory_requests_destination_store') THEN
        ALTER TABLE public.inventory_requests ADD CONSTRAINT fk_inventory_requests_destination_store
            FOREIGN KEY (destination_store_id) REFERENCES public.stores(id);
    END IF;
END $$;

-- ---------- inventory_request_items ----------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='inventory_request_items' AND column_name='qty') THEN
        ALTER TABLE public.inventory_request_items RENAME COLUMN qty TO qty_request;
    END IF;
END $$;
ALTER TABLE public.inventory_request_items ADD COLUMN IF NOT EXISTS qty_approved numeric DEFAULT 0;
ALTER TABLE public.inventory_request_items ADD COLUMN IF NOT EXISTS qty_transfer numeric DEFAULT 0;
ALTER TABLE public.inventory_request_items ADD COLUMN IF NOT EXISTS item_code text;
ALTER TABLE public.inventory_request_items ADD COLUMN IF NOT EXISTS item_name text;
ALTER TABLE public.inventory_request_items ADD COLUMN IF NOT EXISTS unit_code text;
ALTER TABLE public.inventory_request_items ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE public.inventory_request_items ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ---------- inventory_opening_balances ----------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='inventory_opening_balances' AND column_name='tanggal') THEN
        ALTER TABLE public.inventory_opening_balances RENAME COLUMN tanggal TO opening_date;
    END IF;
END $$;
ALTER TABLE public.inventory_opening_balances ADD COLUMN IF NOT EXISTS opening_number text;
ALTER TABLE public.inventory_opening_balances ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.inventory_opening_balances ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- ---------- inventory_movements ----------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='inventory_movements' AND column_name='tanggal') THEN
        ALTER TABLE public.inventory_movements RENAME COLUMN tanggal TO movement_date;
    END IF;
END $$;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS quantity_in numeric DEFAULT 0;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS quantity_out numeric DEFAULT 0;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS quantity_before numeric;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS quantity_after numeric;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS average_cost_before numeric;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS average_cost_after numeric;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS offset_account_id uuid;

-- ---------- item_store_stocks: FK ke stores & items ----------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='item_store_stocks_store_id_fkey') THEN
        ALTER TABLE public.item_store_stocks ADD CONSTRAINT item_store_stocks_store_id_fkey
            FOREIGN KEY (store_id) REFERENCES public.stores(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='item_store_stocks_item_id_fkey') THEN
        ALTER TABLE public.item_store_stocks ADD CONSTRAINT item_store_stocks_item_id_fkey
            FOREIGN KEY (item_id) REFERENCES public.items(id);
    END IF;
END $$;

-- ---------- view ringkasan stok sesuai StockRow ----------
DROP VIEW IF EXISTS public.v_inventory_stock_summary;
CREATE VIEW public.v_inventory_stock_summary AS
SELECT
    s.id,
    st.entity_id,
    s.store_id,
    st.code AS store_code,
    st.name AS store_name,
    st.store_type,
    s.item_id,
    i.code AS item_code,
    i.name AS item_name,
    i.item_type,
    c.code AS category_code,
    c.name AS category_name,
    sc.code AS subcategory_code,
    sc.name AS subcategory_name,
    u.code AS unit_code,
    s.qty_on_hand AS quantity_on_hand,
    s.avg_cost AS average_cost,
    COALESCE(s.qty_on_hand,0) * COALESCE(s.avg_cost,0) AS stock_value,
    s.updated_at AS last_movement_at
FROM public.item_store_stocks s
LEFT JOIN public.stores st ON st.id = s.store_id
LEFT JOIN public.items i ON i.id = s.item_id
LEFT JOIN public.item_categories c ON c.id = i.category_id
LEFT JOIN public.item_subcategories sc ON sc.id = i.subcategory_id
LEFT JOIN public.units u ON u.id = i.unit_id;
