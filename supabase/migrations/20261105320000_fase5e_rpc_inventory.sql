-- ============================================================
-- FASE 5e — RPC INVENTORY REQUEST + POSTING OPENING BALANCE
-- ------------------------------------------------------------
-- Sesuai kontrak frontend (service & hook). Additive & idempotent.
-- ============================================================

-- pastikan unique (item_id, store_id) utk ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS uq_item_store_stocks_item_store ON public.item_store_stocks(item_id, store_id);

-- inventory_request_items: updated_at (dipakai RPC approve/update)
ALTER TABLE public.inventory_request_items ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- helper: moving average cost
CREATE OR REPLACE FUNCTION public._mov_avg_cost(
    p_old_qty numeric, p_old_avg numeric,
    p_add_qty numeric, p_add_cost numeric
) RETURNS numeric LANGUAGE plpgsql AS $$
BEGIN
    IF p_add_qty IS NULL OR p_add_qty <= 0 THEN RETURN COALESCE(p_old_avg, 0); END IF;
    IF p_old_qty IS NULL OR p_old_qty <= 0 THEN RETURN COALESCE(p_add_cost, 0); END IF;
    RETURN (p_old_qty * COALESCE(p_old_avg,0) + p_add_qty * COALESCE(p_add_cost,0)) / (p_old_qty + p_add_qty);
END $$;

-- ============================================================
-- 1) CREATE INVENTORY REQUEST
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_inventory_request(
    p_request_date date,
    p_required_date date,
    p_source_store_id uuid,
    p_destination_store_id uuid,
    p_entity_id uuid,
    p_requested_by text,
    p_remarks text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_req uuid := gen_random_uuid(); v_no text; v_seq bigint; v_period text;
BEGIN
    IF p_source_store_id IS NULL OR p_destination_store_id IS NULL THEN
        RAISE EXCEPTION 'Store asal dan tujuan wajib diisi';
    END IF;
    v_period := to_char(COALESCE(p_request_date, CURRENT_DATE), 'YYMM');
    BEGIN
        v_seq := public.next_document_number(p_entity_id, 'IRQ', v_period);
    EXCEPTION WHEN OTHERS THEN v_seq := 1; END;
    v_no := 'IRQ-' || v_period || '-' || lpad(v_seq::text, 5, '0');
    INSERT INTO public.inventory_requests
        (id, entity_id, request_no, request_date, required_date, source_store_id,
         destination_store_id, created_by, status, remarks, created_at)
    VALUES
        (v_req, p_entity_id, v_no, p_request_date, p_required_date, p_source_store_id,
         p_destination_store_id, p_requested_by, 'DRAFT', p_remarks, now());
    RETURN jsonb_build_object('success', true, 'request_id', v_req, 'request_no', v_no);
END $$;

-- ============================================================
-- 2) ADD ITEM KE REQUEST
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_inventory_request_item(
    p_request_id uuid,
    p_item_id uuid,
    p_qty_request numeric,
    p_remarks text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_item_code text; v_item_name text; v_unit_code text; v_it uuid := gen_random_uuid();
BEGIN
    SELECT i.code, i.name, u.code
      INTO v_item_code, v_item_name, v_unit_code
      FROM public.items i
      LEFT JOIN public.units u ON u.id = i.unit_id
      WHERE i.id = p_item_id;
    INSERT INTO public.inventory_request_items
        (id, request_id, item_id, qty_request, qty_approved, qty_transfer,
         item_code, item_name, unit_code, remarks, created_at)
    VALUES
        (v_it, p_request_id, p_item_id, p_qty_request, p_qty_request, 0,
         COALESCE(v_item_code, ''), COALESCE(v_item_name, ''), COALESCE(v_unit_code, ''),
         p_remarks, now());
    RETURN jsonb_build_object('success', true, 'item_id', v_it);
END $$;

-- ============================================================
-- 3) SUBMIT (DRAFT -> APPROVED)
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_inventory_request(
    p_request_id uuid,
    p_user_id text
) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.inventory_requests
    SET status = 'APPROVED', updated_at = now()
    WHERE id = p_request_id AND status = 'DRAFT';
    IF NOT FOUND THEN RAISE EXCEPTION 'Request tidak ditemukan atau bukan DRAFT'; END IF;
    RETURN jsonb_build_object('success', true, 'request_id', p_request_id, 'status', 'APPROVED');
END $$;

-- ============================================================
-- 4) APPROVE (update qty_approved per detail)
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_inventory_request(
    p_request_id uuid,
    p_user_id text,
    p_note text,
    p_details jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE it jsonb; v_id uuid; v_qty numeric;
BEGIN
    IF p_details IS NOT NULL THEN
        FOR it IN SELECT * FROM jsonb_array_elements(p_details) LOOP
            v_id := (it->>'id')::uuid;
            v_qty := (it->>'qty_approved')::numeric;
            UPDATE public.inventory_request_items SET qty_approved = v_qty, updated_at = now()
            WHERE id = v_id AND request_id = p_request_id;
        END LOOP;
    END IF;
    UPDATE public.inventory_requests
    SET status = 'APPROVED',
        remarks = COALESCE(remarks,'') || CASE WHEN p_note IS NOT NULL AND p_note <> '' THEN E'\n' || p_note ELSE '' END,
        updated_at = now()
    WHERE id = p_request_id;
    RETURN jsonb_build_object('success', true, 'request_id', p_request_id, 'status', 'APPROVED');
END $$;

-- ============================================================
-- 5/6) UPDATE ITEM APPROVED / TRANSFER (single)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_inventory_request_item_approved(
    p_item_id uuid,
    p_qty_approved numeric
) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.inventory_request_items SET qty_approved = p_qty_approved, updated_at = now()
    WHERE id = p_item_id;
    RETURN jsonb_build_object('success', true, 'item_id', p_item_id);
END $$;

CREATE OR REPLACE FUNCTION public.update_inventory_request_item_transfer(
    p_item_id uuid,
    p_qty_transfer numeric
) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.inventory_request_items SET qty_transfer = p_qty_transfer, updated_at = now()
    WHERE id = p_item_id;
    RETURN jsonb_build_object('success', true, 'item_id', p_item_id);
END $$;

-- ============================================================
-- 7) COMPLETE (pindahkan stok + movement TRANSFER)
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_inventory_request(
    p_request_id uuid,
    p_user_id text,
    p_details jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_src uuid; v_dst uuid; v_no text; v_entity uuid; v_seq bigint; v_period text;
    it jsonb; v_item uuid; v_qty numeric;
    v_stock record; v_mov uuid;
    v_new_avg numeric;
BEGIN
    SELECT source_store_id, destination_store_id, request_no, entity_id INTO v_src, v_dst, v_no, v_entity
      FROM public.inventory_requests WHERE id = p_request_id;
    IF v_src IS NULL THEN RAISE EXCEPTION 'Request tidak ditemukan'; END IF;
    IF v_src = v_dst THEN RAISE EXCEPTION 'Store asal dan tujuan tidak boleh sama'; END IF;

    IF p_details IS NOT NULL THEN
        FOR it IN SELECT * FROM jsonb_array_elements(p_details) LOOP
            v_item := (it->>'id')::uuid;
            v_qty := (it->>'qty_transfer')::numeric;
            UPDATE public.inventory_request_items SET qty_transfer = v_qty, updated_at = now()
            WHERE id = v_item AND request_id = p_request_id;
            IF v_qty IS NOT NULL AND v_qty > 0 THEN
                -- stok asal
                SELECT * INTO v_stock FROM public.item_store_stocks
                WHERE item_id = (SELECT item_id FROM public.inventory_request_items WHERE id = v_item) AND store_id = v_src;
                IF v_stock IS NULL OR v_stock.qty_on_hand < v_qty THEN
                    RAISE EXCEPTION 'Stok asal tidak mencukupi untuk item %', v_item;
                END IF;
                -- kurangi asal
                UPDATE public.item_store_stocks
                SET qty_on_hand = qty_on_hand - v_qty, updated_at = now()
                WHERE id = v_stock.id;
                -- tambah tujuan
                INSERT INTO public.item_store_stocks (item_id, store_id, qty_on_hand, avg_cost, updated_at)
                VALUES (v_stock.item_id, v_dst, v_qty, v_stock.avg_cost, now())
                ON CONFLICT (item_id, store_id)
                DO UPDATE SET
                    qty_on_hand = public.item_store_stocks.qty_on_hand + EXCLUDED.qty_on_hand,
                    avg_cost = public._mov_avg_cost(public.item_store_stocks.qty_on_hand, public.item_store_stocks.avg_cost, EXCLUDED.qty_on_hand, EXCLUDED.avg_cost),
                    updated_at = now();
                -- movement TRANSFER
                v_mov := gen_random_uuid();
                v_period := to_char(CURRENT_DATE, 'YYMM');
                BEGIN v_seq := public.next_document_number(v_entity, 'MOV', v_period); EXCEPTION WHEN OTHERS THEN v_seq := 1; END;
                INSERT INTO public.inventory_movements
                    (id, entity_id, movement_no, movement_date, movement_type, item_id,
                     quantity_in, quantity_out, quantity_before, quantity_after,
                     average_cost_before, average_cost_after, from_store_id, to_store_id,
                     reference, description, reference_type, reference_id, status, created_by, created_at)
                VALUES
                    (v_mov, v_entity, 'MOV-' || v_period || '-' || lpad(v_seq::text,5,'0'), CURRENT_DATE,
                     'TRANSFER', v_stock.item_id,
                     v_qty, v_qty, v_stock.qty_on_hand, v_stock.qty_on_hand - v_qty,
                     v_stock.avg_cost, v_stock.avg_cost, v_src, v_dst,
                     v_no, 'Transfer stok antar store', 'INVENTORY_REQUEST', p_request_id,
                     'POSTED', p_user_id, now());
            END IF;
        END LOOP;
    END IF;

    UPDATE public.inventory_requests SET status = 'COMPLETED', updated_at = now() WHERE id = p_request_id;
    RETURN jsonb_build_object('success', true, 'request_id', p_request_id, 'status', 'COMPLETED');
END $$;

-- ============================================================
-- 8) POSTING OPENING BALANCE
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_inventory_opening_balance(
    p_opening_balance_id uuid,
    p_posted_by text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_no text; v_entity uuid; v_store uuid; v_seq bigint; v_period text; v_mov uuid;
    lin record; v_new_avg numeric;
BEGIN
    SELECT opening_number, entity_id, store_id INTO v_no, v_entity, v_store
      FROM public.inventory_opening_balances WHERE id = p_opening_balance_id;
    IF v_no IS NULL THEN RAISE EXCEPTION 'Saldo awal tidak ditemukan'; END IF;
    IF EXISTS (SELECT 1 FROM public.inventory_opening_balances WHERE id = p_opening_balance_id AND status <> 'DRAFT') THEN
        RAISE EXCEPTION 'Saldo awal sudah pernah diposting';
    END IF;

    FOR lin IN SELECT item_id, qty, unit_cost FROM public.inventory_opening_balance_items
               WHERE opening_balance_id = p_opening_balance_id LOOP
        INSERT INTO public.item_store_stocks (item_id, store_id, qty_on_hand, avg_cost, updated_at)
        VALUES (lin.item_id, v_store, lin.qty, COALESCE(lin.unit_cost,0), now())
        ON CONFLICT (item_id, store_id)
        DO UPDATE SET
            qty_on_hand = public.item_store_stocks.qty_on_hand + EXCLUDED.qty_on_hand,
            avg_cost = public._mov_avg_cost(public.item_store_stocks.qty_on_hand, public.item_store_stocks.avg_cost, EXCLUDED.qty_on_hand, EXCLUDED.avg_cost),
            updated_at = now();

        v_mov := gen_random_uuid();
        v_period := to_char(CURRENT_DATE, 'YYMM');
        BEGIN v_seq := public.next_document_number(v_entity, 'MOV', v_period); EXCEPTION WHEN OTHERS THEN v_seq := 1; END;
        INSERT INTO public.inventory_movements
            (id, entity_id, movement_no, movement_date, movement_type, item_id,
             quantity_in, quantity_out, quantity_before, quantity_after,
             average_cost_before, average_cost_after, to_store_id, reference, description,
             reference_type, reference_id, status, created_by, created_at)
        VALUES
            (v_mov, v_entity, 'MOV-' || v_period || '-' || lpad(v_seq::text,5,'0'), CURRENT_DATE,
             'OPENING', lin.item_id,
             lin.qty, 0, 0, lin.qty,
             0, COALESCE(lin.unit_cost,0), v_store, v_no, 'Saldo awal',
             'OPENING_BALANCE', p_opening_balance_id, 'POSTED', p_posted_by, now());
    END LOOP;

    UPDATE public.inventory_opening_balances
    SET status = 'POSTED', posted_by = p_posted_by, posted_at = now(), updated_at = now()
    WHERE id = p_opening_balance_id;

    RETURN jsonb_build_object('success', true, 'opening_balance_id', p_opening_balance_id, 'status', 'POSTED');
END $$;
