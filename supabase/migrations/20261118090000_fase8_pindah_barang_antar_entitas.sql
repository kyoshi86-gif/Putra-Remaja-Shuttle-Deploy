-- ============================================================
-- FASE 8 — PINDAH BARANG ANTAR ENTITAS (SURAT JALAN BARANG)
-- ------------------------------------------------------------
-- Model: ITEM GLOBAL (dibuat sekali di PUSAT), stok dicatat
-- terpisah per entitas (tanpa gudang).
-- Dokumen sumber = "Surat Jalan Barang" (SJB).
-- Additive & idempotent.
-- ============================================================

-- ============================================================
-- 1) TABEL item_entity_stocks — stok per entitas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.item_entity_stocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
    qty_on_hand numeric NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
    avg_cost numeric NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT item_entity_stocks_item_entity_key UNIQUE (item_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_item_entity_stocks_item
    ON public.item_entity_stocks(item_id);
CREATE INDEX IF NOT EXISTS idx_item_entity_stocks_entity
    ON public.item_entity_stocks(entity_id);

-- ============================================================
-- 2) TABEL surat_jalan_barang (header) + items (detail)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.surat_jalan_barang (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor text NOT NULL,
    entity_asal uuid NOT NULL REFERENCES public.entities(id),
    entity_tujuan uuid NOT NULL REFERENCES public.entities(id),
    tanggal date NOT NULL DEFAULT CURRENT_DATE,
    status text NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'DIKIRIM', 'DITERIMA', 'DIBATALKAN')),
    catatan text,
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sjb_asal ON public.surat_jalan_barang(entity_asal);
CREATE INDEX IF NOT EXISTS idx_sjb_tujuan ON public.surat_jalan_barang(entity_tujuan);
CREATE INDEX IF NOT EXISTS idx_sjb_status ON public.surat_jalan_barang(status);

CREATE TABLE IF NOT EXISTS public.surat_jalan_barang_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sjb_id uuid NOT NULL REFERENCES public.surat_jalan_barang(id) ON DELETE CASCADE,
    item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    qty_kirim numeric NOT NULL CHECK (qty_kirim > 0),
    qty_terima numeric CHECK (qty_terima >= 0), -- diisi saat validasi
    avg_cost numeric NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sjb_items_sjb ON public.surat_jalan_barang_items(sjb_id);
CREATE INDEX IF NOT EXISTS idx_sjb_items_item ON public.surat_jalan_barang_items(item_id);

-- ============================================================
-- 3) KOLOM entity di inventory_movements
-- ============================================================
ALTER TABLE public.inventory_movements
    ADD COLUMN IF NOT EXISTS from_entity_id uuid REFERENCES public.entities(id);
ALTER TABLE public.inventory_movements
    ADD COLUMN IF NOT EXISTS to_entity_id uuid REFERENCES public.entities(id);

CREATE INDEX IF NOT EXISTS idx_mov_from_entity ON public.inventory_movements(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_mov_to_entity ON public.inventory_movements(to_entity_id);

-- ============================================================
-- 4) RPC POST KIRIM (PUSAT → outlet) — kurangi stok asal
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_sjb_kirim(
    p_entity_asal uuid,
    p_entity_tujuan uuid,
    p_tanggal date,
    p_lines jsonb,
    p_catatan text DEFAULT '',
    p_user_id text DEFAULT '',
    p_reference text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    it jsonb;
    v_sjb uuid;
    v_no text;
    v_seq bigint;
    v_period text;
    v_stock record;
    v_qty numeric;
    v_cost numeric;
    v_id uuid;
BEGIN
    -- ---------- Validasi dasar ----------
    IF p_entity_asal IS NULL OR p_entity_tujuan IS NULL THEN
        RAISE EXCEPTION 'Entitas asal dan tujuan wajib diisi';
    END IF;
    IF p_entity_asal = p_entity_tujuan THEN
        RAISE EXCEPTION 'Entitas asal dan tujuan tidak boleh sama';
    END IF;
    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'Tidak ada item pada surat jalan barang';
    END IF;

    -- ---------- Generate nomor dokumen ----------
    v_period := to_char(COALESCE(p_tanggal, CURRENT_DATE), 'YYMM');
    BEGIN
        v_seq := public.next_document_number(p_entity_asal, 'SJB', v_period);
    EXCEPTION WHEN OTHERS THEN v_seq := 1;
    END;
    v_no := COALESCE(NULLIF(p_reference, ''), 'SJB-' || v_period || '-' || lpad(v_seq::text, 5, '0'));

    -- ---------- Simpan header (langsung status DIKIRIM) ----------
    INSERT INTO public.surat_jalan_barang
        (nomor, entity_asal, entity_tujuan, tanggal, status, catatan, created_by, created_at, updated_at)
    VALUES
        (v_no, p_entity_asal, p_entity_tujuan, COALESCE(p_tanggal, CURRENT_DATE),
         'DIKIRIM', p_catatan, p_user_id, now(), now())
    RETURNING id INTO v_sjb;

    -- ---------- Proses tiap item ----------
    FOR it IN SELECT value FROM jsonb_array_elements(p_lines) AS t(value) LOOP
        v_qty := (it->>'qty')::numeric;
        v_id := (it->>'item_id')::uuid;
        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'Kuantitas harus > 0';
        END IF;

        SELECT * INTO v_stock
        FROM public.item_entity_stocks
        WHERE item_id = v_id AND entity_id = p_entity_asal;

        IF v_stock IS NULL OR COALESCE(v_stock.qty_on_hand, 0) < v_qty THEN
            RAISE EXCEPTION 'Stok entitas asal tidak mencukupi untuk item tsb';
        END IF;

        v_cost := COALESCE(v_stock.avg_cost, 0);

        -- Kurangi stok asal
        UPDATE public.item_entity_stocks
        SET qty_on_hand = qty_on_hand - v_qty, updated_at = now()
        WHERE id = v_stock.id;

        -- Catat movement OUT
        INSERT INTO public.inventory_movements
            (entity_id, movement_no, movement_date, movement_type, item_id,
             quantity_in, quantity_out, quantity_before, quantity_after,
             average_cost_before, average_cost_after,
             from_entity_id, to_entity_id,
             reference, description, reference_type, status,
             created_by, created_at)
        VALUES
            (p_entity_asal, v_no, COALESCE(p_tanggal, CURRENT_DATE), 'TRANSFER_ENTITY', v_id,
             0, v_qty, v_stock.qty_on_hand, v_stock.qty_on_hand - v_qty,
             v_cost, v_cost,
             p_entity_asal, p_entity_tujuan,
             v_no, p_catatan, 'SURAT_JALAN_BARANG', 'POSTED',
             p_user_id, now());

        -- Simpan detail
        INSERT INTO public.surat_jalan_barang_items
            (sjb_id, item_id, qty_kirim, avg_cost, created_at)
        VALUES
            (v_sjb, v_id, v_qty, v_cost, now());
    END LOOP;

    RETURN jsonb_build_object('success', true, 'id', v_sjb, 'nomor', v_no);
END $$;

-- ============================================================
-- 5) RPC POST TERIMA (outlet) — tambah stok tujuan + validasi
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_sjb_terima(
    p_sjb_id uuid,
    p_lines jsonb,
    p_user_id text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_sjb record;
    v_item record;
    v_stock record;
    it jsonb;
    v_qty numeric;
    v_cost numeric;
    v_id uuid;
    v_terima numeric;
    v_cnt int := 0;
BEGIN
    SELECT * INTO v_sjb FROM public.surat_jalan_barang WHERE id = p_sjb_id;
    IF v_sjb IS NULL THEN
        RAISE EXCEPTION 'Surat jalan barang tidak ditemukan';
    END IF;
    IF v_sjb.status <> 'DIKIRIM' THEN
        RAISE EXCEPTION 'Surat jalan barang bukan dalam status DIKIRIM';
    END IF;
    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'Tidak ada item untuk divalidasi';
    END IF;

    FOR it IN SELECT value FROM jsonb_array_elements(p_lines) AS t(value) LOOP
        v_id := (it->>'item_id')::uuid;
        v_terima := (it->>'qty_terima')::numeric;
        IF v_id IS NULL OR v_terima IS NULL OR v_terima < 0 THEN
            RAISE EXCEPTION 'Item atau qty terima tidak valid';
        END IF;

        -- Ambil qty_kirim dari detail
        SELECT * INTO v_item
        FROM public.surat_jalan_barang_items
        WHERE sjb_id = p_sjb_id AND item_id = v_id;
        IF v_item IS NULL THEN
            RAISE EXCEPTION 'Item tidak ada dalam surat jalan barang ini';
        END IF;
        IF v_terima > v_item.qty_kirim THEN
            RAISE EXCEPTION 'Qty terima melebihi qty kirim';
        END IF;

        v_cost := COALESCE(v_item.avg_cost, 0);

        -- Tambah / buat stok tujuan
        INSERT INTO public.item_entity_stocks (item_id, entity_id, qty_on_hand, avg_cost, updated_at)
        VALUES (v_id, v_sjb.entity_tujuan, v_terima, v_cost, now())
        ON CONFLICT (item_id, entity_id)
        DO UPDATE SET
            qty_on_hand = public.item_entity_stocks.qty_on_hand + EXCLUDED.qty_on_hand,
            avg_cost = public._mov_avg_cost(
                public.item_entity_stocks.qty_on_hand,
                public.item_entity_stocks.avg_cost,
                EXCLUDED.qty_on_hand,
                EXCLUDED.avg_cost),
            updated_at = now();

        -- Catat movement IN
        INSERT INTO public.inventory_movements
            (entity_id, movement_no, movement_date, movement_type, item_id,
             quantity_in, quantity_out, quantity_before, quantity_after,
             average_cost_before, average_cost_after,
             from_entity_id, to_entity_id,
             reference, description, reference_type, status,
             created_by, created_at)
        VALUES
            (v_sjb.entity_tujuan, v_sjb.nomor, v_sjb.tanggal, 'TRANSFER_ENTITY', v_id,
             v_terima, 0, 0, v_terima,
             v_cost, v_cost,
             v_sjb.entity_asal, v_sjb.entity_tujuan,
             v_sjb.nomor, '', 'SURAT_JALAN_BARANG', 'POSTED',
             p_user_id, now());

        -- Update detail
        UPDATE public.surat_jalan_barang_items
        SET qty_terima = v_terima, created_at = created_at
        WHERE id = v_item.id;

        v_cnt := v_cnt + 1;
    END LOOP;

    -- Tandai selesai
    UPDATE public.surat_jalan_barang
    SET status = 'DITERIMA', updated_at = now()
    WHERE id = p_sjb_id;

    RETURN jsonb_build_object('success', true, 'id', p_sjb_id, 'nomor', v_sjb.nomor, 'items', v_cnt);
END $$;
