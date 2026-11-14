-- ============================================================
-- FASE 5 — INVENTORY & ASET TETAP (fondasi DB)
-- ------------------------------------------------------------
-- Sifat: ADDITIVE & idempotent. Sesuai 07-persediaan-aset.md.
-- Prinsip:
--   * Kartu stok direkonstruksi dari `inventory_movements` (sumber).
--   * `item_store_stocks` adalah cache untuk performa.
--   * Reversal menunjuk mutasi asal (`reversal_of_id`), tidak menghapus histori.
--   * Aset: depreciation run per periode; disposal menghitung laba/rugi.
-- ============================================================

-- ------------------------------------------------------------
-- 1) INVENTORY MOVEMENTS (sumber kartu stok)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    movement_no text,
    tanggal date DEFAULT CURRENT_DATE,
    movement_type text NOT NULL,  -- RECEIPT|USAGE|TRANSFER_IN|TRANSFER_OUT|RETURN_SUPPLIER|RETURN_USAGE|ADJUSTMENT|OPNAME
    item_id uuid NOT NULL REFERENCES public.items(id),
    qty numeric NOT NULL DEFAULT 0,   -- positif = masuk, negatif = keluar
    unit_cost numeric(18,2) NOT NULL DEFAULT 0,
    from_store_id uuid REFERENCES public.stores(id),
    to_store_id uuid REFERENCES public.stores(id),
    reference_type text,
    reference_id uuid,
    status text NOT NULL DEFAULT 'POSTED',
    reversal_of_id uuid REFERENCES public.inventory_movements(id),
    created_by text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_mov_item   ON public.inventory_movements (item_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_store   ON public.inventory_movements (from_store_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_entity  ON public.inventory_movements (entity_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_type    ON public.inventory_movements (movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_mov_ref     ON public.inventory_movements (reference_type, reference_id);
-- reversal unik (satu asal hanya boleh punya satu reversal)
CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_mov_reversal
    ON public.inventory_movements (reversal_of_id)
    WHERE reversal_of_id IS NOT NULL;

-- ------------------------------------------------------------
-- 2) STOK PER GUDANG (cache)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.item_store_stocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid NOT NULL REFERENCES public.items(id),
    store_id uuid NOT NULL REFERENCES public.stores(id),
    qty_on_hand numeric NOT NULL DEFAULT 0,
    avg_cost numeric(18,2) NOT NULL DEFAULT 0,
    updated_at timestamptz DEFAULT now(),
    UNIQUE (item_id, store_id)
);

-- ------------------------------------------------------------
-- 3) OPENING BALANCE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_opening_balances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    store_id uuid REFERENCES public.stores(id),
    tanggal date,
    status text NOT NULL DEFAULT 'DRAFT',  -- DRAFT|POSTED
    posted_by text,
    posted_at timestamptz,
    created_by text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_opening_balance_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    opening_balance_id uuid NOT NULL REFERENCES public.inventory_opening_balances(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES public.items(id),
    qty numeric NOT NULL DEFAULT 0,
    unit_cost numeric(18,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_inv_open_items_ob ON public.inventory_opening_balance_items (opening_balance_id);

-- ------------------------------------------------------------
-- 4) PERMINTAAN STOK (internal transfer)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    request_no text,
    tanggal date,
    from_store_id uuid REFERENCES public.stores(id),
    to_store_id uuid REFERENCES public.stores(id),
    requested_by text,
    status text NOT NULL DEFAULT 'DRAFT',  -- DRAFT|SUBMITTED|APPROVED|FULFILLED|REJECTED
    notes text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_req_entity ON public.inventory_requests (entity_id);

CREATE TABLE IF NOT EXISTS public.inventory_request_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL REFERENCES public.inventory_requests(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES public.items(id),
    qty numeric NOT NULL DEFAULT 0,
    fulfilled_qty numeric NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_inv_req_items_req ON public.inventory_request_items (request_id);

-- ------------------------------------------------------------
-- 5) VIEW: RINGKASAN STOK (kartu stok / stok gudang)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_inventory_stock_summary AS
SELECT
    s.item_id,
    s.store_id,
    i.kode AS item_kode,
    i.nama AS item_nama,
    i.jenis AS item_jenis,
    s.qty_on_hand,
    s.avg_cost,
    COALESCE(s.qty_on_hand, 0) * COALESCE(s.avg_cost, 0) AS stock_value,
    s.updated_at
FROM public.item_store_stocks s
LEFT JOIN public.items i ON i.id = s.item_id;

-- ------------------------------------------------------------
-- 6) ASET TETAP
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fixed_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    kode text,
    nama text NOT NULL,
    category_id uuid REFERENCES public.item_categories(id),
    acquisition_date date,
    ready_date date,
    cost numeric(18,2) NOT NULL DEFAULT 0,
    residual_value numeric(18,2) NOT NULL DEFAULT 0,
    useful_life_months integer NOT NULL DEFAULT 0,
    depreciation_method text NOT NULL DEFAULT 'STRAIGHT_LINE',  -- STRAIGHT_LINE | DECLINING_BALANCE
    lokasi text,
    custodian text,
    accumulated_depreciation numeric(18,2) NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'AKTIF',  -- AKTIF|DISPOSED|NONAKTIF
    dokumen text,
    created_by text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assets_entity ON public.fixed_assets (entity_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.fixed_assets (status);

CREATE TABLE IF NOT EXISTS public.asset_depreciation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    fiscal_period_id uuid REFERENCES public.fiscal_periods(id),
    run_date date,
    status text NOT NULL DEFAULT 'DRAFT',  -- DRAFT|POSTED
    created_by text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_runs_period ON public.asset_depreciation_runs (fiscal_period_id);

CREATE TABLE IF NOT EXISTS public.asset_depreciation_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.asset_depreciation_runs(id) ON DELETE CASCADE,
    asset_id uuid NOT NULL REFERENCES public.fixed_assets(id),
    amount numeric(18,2) NOT NULL DEFAULT 0,
    period_start date,
    period_end date
);
CREATE INDEX IF NOT EXISTS idx_asset_lines_run ON public.asset_depreciation_lines (run_id);

CREATE TABLE IF NOT EXISTS public.asset_disposals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    asset_id uuid NOT NULL REFERENCES public.fixed_assets(id),
    tanggal date,
    disposal_proceeds numeric(18,2) NOT NULL DEFAULT 0,
    gain_loss numeric(18,2) NOT NULL DEFAULT 0,
    reason text,
    status text NOT NULL DEFAULT 'PENDING',  -- PENDING|APPROVED|PROCESSED|REJECTED
    approved_by text,
    approved_at timestamptz,
    created_by text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_disposals_asset ON public.asset_disposals (asset_id);
