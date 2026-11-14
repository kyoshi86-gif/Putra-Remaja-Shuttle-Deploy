-- ============================================================
-- FASE 5f — RPC STOREKEEPER (TRANSFER/ADJUSTMENT/OPNAME + LAPORAN)
-- ------------------------------------------------------------
-- Sesuai kontrak frontend. Additive & idempotent.
-- ============================================================

-- ============================================================
-- 1) POST TRANSFER
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_inventory_transfer(
    p_entity_id uuid,
    p_transfer_date date,
    p_item_id uuid,
    p_from_store_id uuid,
    p_to_store_id uuid,
    p_quantity numeric,
    p_reference text,
    p_description text,
    p_user_id text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_stock record; v_mov uuid; v_no text; v_seq bigint; v_period text;
BEGIN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Kuantitas harus > 0'; END IF;
    IF p_from_store_id = p_to_store_id THEN RAISE EXCEPTION 'Store asal dan tujuan tidak boleh sama'; END IF;
    SELECT * INTO v_stock FROM public.item_store_stocks WHERE item_id = p_item_id AND store_id = p_from_store_id;
    IF v_stock IS NULL OR v_stock.qty_on_hand < p_quantity THEN
        RAISE EXCEPTION 'Stok asal tidak mencukupi';
    END IF;

    UPDATE public.item_store_stocks SET qty_on_hand = qty_on_hand - p_quantity, updated_at = now()
    WHERE id = v_stock.id;

    INSERT INTO public.item_store_stocks (item_id, store_id, qty_on_hand, avg_cost, updated_at)
    VALUES (p_item_id, p_to_store_id, p_quantity, v_stock.avg_cost, now())
    ON CONFLICT (item_id, store_id)
    DO UPDATE SET
        qty_on_hand = public.item_store_stocks.qty_on_hand + EXCLUDED.qty_on_hand,
        avg_cost = public._mov_avg_cost(public.item_store_stocks.qty_on_hand, public.item_store_stocks.avg_cost, EXCLUDED.qty_on_hand, EXCLUDED.avg_cost),
        updated_at = now();

    v_mov := gen_random_uuid();
    v_period := to_char(COALESCE(p_transfer_date, CURRENT_DATE), 'YYMM');
    BEGIN v_seq := public.next_document_number(p_entity_id, 'MOV', v_period); EXCEPTION WHEN OTHERS THEN v_seq := 1; END;
    v_no := COALESCE(p_reference, 'MOV-' || v_period || '-' || lpad(v_seq::text,5,'0'));
    INSERT INTO public.inventory_movements
        (id, entity_id, movement_no, movement_date, movement_type, item_id,
         quantity_in, quantity_out, quantity_before, quantity_after,
         average_cost_before, average_cost_after, from_store_id, to_store_id,
         reference, description, reference_type, status, created_by, created_at)
    VALUES
        (v_mov, p_entity_id, v_no, COALESCE(p_transfer_date, CURRENT_DATE), 'TRANSFER', p_item_id,
         p_quantity, p_quantity, v_stock.qty_on_hand, v_stock.qty_on_hand - p_quantity,
         v_stock.avg_cost, v_stock.avg_cost, p_from_store_id, p_to_store_id,
         v_no, p_description, 'MANUAL', 'POSTED', p_user_id, now());

    RETURN jsonb_build_object('success', true, 'movement_id', v_mov, 'reference', v_no);
END $$;

-- ============================================================
-- 2) POST ADJUSTMENT BATCH
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_inventory_adjustment_batch(
    p_entity_id uuid,
    p_adjustment_date date,
    p_lines jsonb,
    p_reference text,
    p_description text,
    p_is_opname boolean,
    p_user_id text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    it jsonb; v_stock record; v_mov uuid; v_no text; v_seq bigint; v_period text;
    v_qty numeric; v_account uuid; v_diff numeric; v_cnt int := 0; v_type text;
BEGIN
    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN RAISE EXCEPTION 'Tidak ada baris adjustment'; END IF;
    v_period := to_char(COALESCE(p_adjustment_date, CURRENT_DATE), 'YYMM');
    BEGIN v_seq := public.next_document_number(p_entity_id, 'ADJ', v_period); EXCEPTION WHEN OTHERS THEN v_seq := 1; END;
    v_no := COALESCE(p_reference, 'ADJ-' || v_period || '-' || lpad(v_seq::text,5,'0'));

    FOR it IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        SELECT * INTO v_stock FROM public.item_store_stocks WHERE id = ((it->>'stockId')::uuid);
        IF v_stock IS NULL THEN RAISE EXCEPTION 'Stok tidak ditemukan'; END IF;
        v_qty := (it->>'qty')::numeric;
        v_diff := v_qty - v_stock.qty_on_hand;
        v_account := (it->>'accountId')::uuid;
        IF abs(v_diff) > 0.0001 THEN
            UPDATE public.item_store_stocks SET qty_on_hand = v_qty, updated_at = now() WHERE id = v_stock.id;
            v_mov := gen_random_uuid();
            v_type := CASE WHEN v_diff > 0 THEN 'ADJUSTMENT_IN' ELSE 'ADJUSTMENT_OUT' END;
            INSERT INTO public.inventory_movements
                (id, entity_id, movement_no, movement_date, movement_type, item_id,
                 quantity_in, quantity_out, quantity_before, quantity_after,
                 average_cost_before, average_cost_after, to_store_id, from_store_id,
                 offset_account_id, reference, description, reference_type, status, created_by, created_at)
            VALUES
                (v_mov, p_entity_id, v_no, COALESCE(p_adjustment_date, CURRENT_DATE), v_type, v_stock.item_id,
                 GREATEST(v_diff,0), GREATEST(-v_diff,0), v_stock.qty_on_hand, v_qty,
                 v_stock.avg_cost, v_stock.avg_cost,
                 CASE WHEN v_diff>0 THEN v_stock.store_id ELSE NULL END,
                 CASE WHEN v_diff<0 THEN v_stock.store_id ELSE NULL END,
                 v_account, v_no, p_description, 'MANUAL', 'POSTED', p_user_id, now());
            v_cnt := v_cnt + 1;
        END IF;
    END LOOP;
    RETURN jsonb_build_object('success', true, 'reference', v_no, 'changed_lines', v_cnt);
END $$;

-- ============================================================
-- 3) POST OPNAME BATCH
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_inventory_opname_batch(
    p_entity_id uuid,
    p_adjustment_date date,
    p_store_id uuid,
    p_lines jsonb,
    p_reference text,
    p_description text,
    p_user_id text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    it jsonb; v_stock record; v_mov uuid; v_no text; v_seq bigint; v_period text;
    v_actual numeric; v_diff numeric; v_cnt int := 0;
BEGIN
    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN RAISE EXCEPTION 'Tidak ada baris opname'; END IF;
    IF p_store_id IS NULL THEN RAISE EXCEPTION 'Store opname wajib diisi'; END IF;
    v_period := to_char(COALESCE(p_adjustment_date, CURRENT_DATE), 'YYMM');
    BEGIN v_seq := public.next_document_number(p_entity_id, 'OPN', v_period); EXCEPTION WHEN OTHERS THEN v_seq := 1; END;
    v_no := COALESCE(p_reference, 'OPN-' || v_period || '-' || lpad(v_seq::text,5,'0'));

    FOR it IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        v_actual := (it->>'actual_quantity')::numeric;
        IF v_actual IS NULL OR v_actual < 0 THEN RAISE EXCEPTION 'Qty fisik tidak valid'; END IF;
        SELECT * INTO v_stock FROM public.item_store_stocks
        WHERE item_id = ((it->>'item_id')::uuid) AND store_id = p_store_id;
        IF v_stock IS NULL THEN
            -- stok sistem 0
            INSERT INTO public.item_store_stocks (item_id, store_id, qty_on_hand, avg_cost, updated_at)
            VALUES ((it->>'item_id')::uuid, p_store_id, v_actual, 0, now());
            v_diff := v_actual;
            v_stock := ROW(NULL, (it->>'item_id')::uuid, p_store_id, 0::numeric, 0::numeric, now());
        ELSE
            v_diff := v_actual - v_stock.qty_on_hand;
            UPDATE public.item_store_stocks SET qty_on_hand = v_actual, updated_at = now() WHERE id = v_stock.id;
        END IF;
        IF abs(v_diff) > 0.0001 THEN
            v_mov := gen_random_uuid();
            INSERT INTO public.inventory_movements
                (id, entity_id, movement_no, movement_date, movement_type, item_id,
                 quantity_in, quantity_out, quantity_before, quantity_after,
                 average_cost_before, average_cost_after, to_store_id, from_store_id,
                 reference, description, reference_type, status, created_by, created_at)
            VALUES
                (v_mov, p_entity_id, v_no, COALESCE(p_adjustment_date, CURRENT_DATE), 'STOCK_OPNAME', v_stock.item_id,
                 GREATEST(v_diff,0), GREATEST(-v_diff,0), COALESCE(v_stock.qty_on_hand,0), v_actual,
                 COALESCE(v_stock.avg_cost,0), COALESCE(v_stock.avg_cost,0),
                 CASE WHEN v_diff>0 THEN p_store_id ELSE NULL END,
                 CASE WHEN v_diff<0 THEN p_store_id ELSE NULL END,
                 v_no, p_description, 'MANUAL', 'POSTED', p_user_id, now());
            v_cnt := v_cnt + 1;
        END IF;
    END LOOP;
    RETURN jsonb_build_object('success', true, 'reference', v_no, 'changed_lines', v_cnt);
END $$;

-- ============================================================
-- 4) LAPORAN: ADJUSTMENT DOCUMENTS
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_adjustment_documents(
    p_date_from date, p_date_to date, p_store_id uuid,
    p_keyword text DEFAULT '', p_page integer DEFAULT 1, p_page_size integer DEFAULT 25
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_offset int := (GREATEST(p_page,1)-1) * GREATEST(p_page_size,1);
BEGIN
    RETURN (SELECT COALESCE(jsonb_agg(r.row_json), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
            'data', jsonb_build_object(
                'reference', d.reference,
                'movement_date', d.movement_date::text,
                'created_at', d.created_at,
                'created_by', d.created_by,
                'store', CASE WHEN d.sid IS NOT NULL THEN jsonb_build_object('id',d.sid,'code',d.scode,'name',d.sname) ELSE NULL END,
                'items', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object(
                        'code', i.code, 'name', i.name, 'unit_code', u.code,
                        'qtyBefore', m.quantity_before,
                        'qtyAdjustment', COALESCE(m.quantity_in, m.quantity_out),
                        'qtyAfter', m.quantity_after,
                        'averageCost', COALESCE(m.average_cost_after, m.average_cost_before),
                        'value', COALESCE(m.quantity_in, m.quantity_out) * COALESCE(m.average_cost_after, m.average_cost_before, 0)
                    )) FROM public.inventory_movements m
                    LEFT JOIN public.items i ON i.id = m.item_id
                    LEFT JOIN public.units u ON u.id = i.unit_id
                    WHERE m.reference = d.reference AND m.movement_type IN ('ADJUSTMENT_IN','ADJUSTMENT_OUT')
                ), '[]'::jsonb),
                'totalQty', COALESCE((SELECT sum(COALESCE(m.quantity_in, m.quantity_out)) FROM public.inventory_movements m WHERE m.reference=d.reference AND m.movement_type IN ('ADJUSTMENT_IN','ADJUSTMENT_OUT')),0),
                'totalValue', COALESCE((SELECT sum(COALESCE(m.quantity_in, m.quantity_out) * COALESCE(m.average_cost_after, m.average_cost_before, 0)) FROM public.inventory_movements m WHERE m.reference=d.reference AND m.movement_type IN ('ADJUSTMENT_IN','ADJUSTMENT_OUT')),0)
            ),
            'total_count', count(*) OVER()
        ) AS row_json
        FROM (
            SELECT m.reference, max(m.movement_date) AS movement_date, min(m.created_at) AS created_at,
                   min(m.created_by) AS created_by,
                   (array_agg(COALESCE(m.to_store_id, m.from_store_id)))[1] AS sid,
                   max(s.code) AS scode, max(s.name) AS sname
            FROM public.inventory_movements m
            LEFT JOIN public.stores s ON s.id = COALESCE(m.to_store_id, m.from_store_id)
            WHERE m.movement_type IN ('ADJUSTMENT_IN','ADJUSTMENT_OUT')
              AND (p_date_from IS NULL OR m.movement_date >= p_date_from)
              AND (p_date_to IS NULL OR m.movement_date <= p_date_to)
              AND (p_store_id IS NULL OR COALESCE(m.to_store_id, m.from_store_id) = p_store_id)
              AND (p_keyword = '' OR m.reference ILIKE '%'||p_keyword||'%')
            GROUP BY m.reference
        ) d
        ORDER BY d.movement_date DESC, d.reference
        LIMIT GREATEST(p_page_size,1) OFFSET v_offset
    ) r);
END $$;

-- ============================================================
-- 5) LAPORAN: OPNAME DOCUMENTS
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_opname_documents(
    p_date_from date, p_date_to date, p_store_id uuid,
    p_keyword text DEFAULT '', p_page integer DEFAULT 1, p_page_size integer DEFAULT 25
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_offset int := (GREATEST(p_page,1)-1) * GREATEST(p_page_size,1);
BEGIN
    RETURN (SELECT COALESCE(jsonb_agg(r.row_json), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
            'data', jsonb_build_object(
                'reference', d.reference,
                'movement_date', d.movement_date::text,
                'created_at', d.created_at,
                'created_by', d.created_by,
                'store', CASE WHEN d.sid IS NOT NULL THEN jsonb_build_object('id',d.sid,'code',d.scode,'name',d.sname) ELSE NULL END,
                'items', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object(
                        'code', i.code, 'name', i.name, 'unit_code', u.code,
                        'qtySystem', COALESCE(m.quantity_before, 0),
                        'qtyOpname', COALESCE(m.quantity_after, 0),
                        'difference', COALESCE(m.quantity_after,0) - COALESCE(m.quantity_before,0),
                        'averageCost', COALESCE(m.average_cost_after, m.average_cost_before, 0),
                        'value', abs(COALESCE(m.quantity_after,0) - COALESCE(m.quantity_before,0)) * COALESCE(m.average_cost_after, m.average_cost_before, 0)
                    )) FROM public.inventory_movements m
                    LEFT JOIN public.items i ON i.id = m.item_id
                    LEFT JOIN public.units u ON u.id = i.unit_id
                    WHERE m.reference = d.reference AND m.movement_type = 'STOCK_OPNAME'
                ), '[]'::jsonb),
                'totalDifference', COALESCE((SELECT sum(COALESCE(m.quantity_after,0) - COALESCE(m.quantity_before,0)) FROM public.inventory_movements m WHERE m.reference=d.reference AND m.movement_type='STOCK_OPNAME'),0),
                'totalValue', COALESCE((SELECT sum(abs(COALESCE(m.quantity_after,0) - COALESCE(m.quantity_before,0)) * COALESCE(m.average_cost_after, m.average_cost_before,0)) FROM public.inventory_movements m WHERE m.reference=d.reference AND m.movement_type='STOCK_OPNAME'),0)
            ),
            'total_count', count(*) OVER()
        ) AS row_json
        FROM (
            SELECT m.reference, max(m.movement_date) AS movement_date, min(m.created_at) AS created_at,
                   min(m.created_by) AS created_by,
                   (array_agg(COALESCE(m.to_store_id, m.from_store_id)))[1] AS sid,
                   max(s.code) AS scode, max(s.name) AS sname
            FROM public.inventory_movements m
            LEFT JOIN public.stores s ON s.id = COALESCE(m.to_store_id, m.from_store_id)
            WHERE m.movement_type = 'STOCK_OPNAME'
              AND (p_date_from IS NULL OR m.movement_date >= p_date_from)
              AND (p_date_to IS NULL OR m.movement_date <= p_date_to)
              AND (p_store_id IS NULL OR COALESCE(m.to_store_id, m.from_store_id) = p_store_id)
              AND (p_keyword = '' OR m.reference ILIKE '%'||p_keyword||'%')
            GROUP BY m.reference
        ) d
        ORDER BY d.movement_date DESC, d.reference
        LIMIT GREATEST(p_page_size,1) OFFSET v_offset
    ) r);
END $$;

-- ============================================================
-- 6) LAPORAN: TRANSFER DOCUMENTS
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_transfer_documents(
    p_date_from date, p_date_to date, p_from_store_id uuid, p_to_store_id uuid,
    p_keyword text DEFAULT '', p_page integer DEFAULT 1, p_page_size integer DEFAULT 25
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_offset int := (GREATEST(p_page,1)-1) * GREATEST(p_page_size,1);
BEGIN
    RETURN (SELECT COALESCE(jsonb_agg(r.row_json), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
            'data', jsonb_build_object(
                'reference', d.reference,
                'movement_date', d.movement_date::text,
                'created_at', d.created_at,
                'created_by', d.created_by,
                'fromStore', CASE WHEN d.fid IS NOT NULL THEN jsonb_build_object('id',d.fid,'code',d.fcode,'name',d.fname) ELSE NULL END,
                'toStore', CASE WHEN d.tid IS NOT NULL THEN jsonb_build_object('id',d.tid,'code',d.tcode,'name',d.tname) ELSE NULL END,
                'items', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object(
                        'code', i.code, 'name', i.name, 'unit_code', u.code,
                        'qty', COALESCE(m.quantity_in, m.quantity_out),
                        'value', COALESCE(m.quantity_in, m.quantity_out) * COALESCE(m.average_cost_after, m.average_cost_before, 0)
                    )) FROM public.inventory_movements m
                    LEFT JOIN public.items i ON i.id = m.item_id
                    LEFT JOIN public.units u ON u.id = i.unit_id
                    WHERE m.reference = d.reference AND m.movement_type = 'TRANSFER'
                ), '[]'::jsonb),
                'totalQty', COALESCE((SELECT sum(COALESCE(m.quantity_in, m.quantity_out)) FROM public.inventory_movements m WHERE m.reference=d.reference AND m.movement_type='TRANSFER'),0),
                'totalValue', COALESCE((SELECT sum(COALESCE(m.quantity_in, m.quantity_out) * COALESCE(m.average_cost_after, m.average_cost_before,0)) FROM public.inventory_movements m WHERE m.reference=d.reference AND m.movement_type='TRANSFER'),0)
            ),
            'total_count', count(*) OVER()
        ) AS row_json
        FROM (
            SELECT m.reference, max(m.movement_date) AS movement_date, min(m.created_at) AS created_at,
                   min(m.created_by) AS created_by,
                   (array_agg(m.from_store_id))[1] AS fid, max(sf.code) AS fcode, max(sf.name) AS fname,
                   (array_agg(m.to_store_id))[1] AS tid, max(st.code) AS tcode, max(st.name) AS tname
            FROM public.inventory_movements m
            LEFT JOIN public.stores sf ON sf.id = m.from_store_id
            LEFT JOIN public.stores st ON st.id = m.to_store_id
            WHERE m.movement_type = 'TRANSFER'
              AND (p_date_from IS NULL OR m.movement_date >= p_date_from)
              AND (p_date_to IS NULL OR m.movement_date <= p_date_to)
              AND (p_from_store_id IS NULL OR m.from_store_id = p_from_store_id)
              AND (p_to_store_id IS NULL OR m.to_store_id = p_to_store_id)
              AND (p_keyword = '' OR m.reference ILIKE '%'||p_keyword||'%')
            GROUP BY m.reference
        ) d
        ORDER BY d.movement_date DESC, d.reference
        LIMIT GREATEST(p_page_size,1) OFFSET v_offset
    ) r);
END $$;
