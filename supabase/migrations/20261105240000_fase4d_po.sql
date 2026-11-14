-- ============================================================
-- FASE 4d — PURCHASE ORDER: ADAPTASI SKEMA + RPC + MENU
-- ------------------------------------------------------------
-- Additive & idempotent.
-- ============================================================

-- ---------- ADAPTASI KOLOM purchase_orders ----------
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS po_number text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS order_date date;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS expected_delivery_date date;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS supplier_code_snapshot text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS supplier_name_snapshot text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS payment_term_days integer NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS subtotal numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS discount_amount numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS tax_amount numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS grand_total numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'IDR';
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS notes text;
UPDATE public.purchase_orders SET
    po_number = COALESCE(po_number, po_no),
    order_date = COALESCE(order_date, tanggal),
    expected_delivery_date = COALESCE(expected_delivery_date, expected_date)
WHERE po_number IS NULL OR order_date IS NULL;

-- ---------- ADAPTASI KOLOM purchase_order_details ----------
ALTER TABLE public.purchase_order_details ADD COLUMN IF NOT EXISTS purchase_order_id uuid;
ALTER TABLE public.purchase_order_details ADD COLUMN IF NOT EXISTS quantity_ordered numeric(18,2);
ALTER TABLE public.purchase_order_details ADD COLUMN IF NOT EXISTS discount_amount numeric(18,2);
ALTER TABLE public.purchase_order_details ADD COLUMN IF NOT EXISTS tax_amount numeric(18,2);
ALTER TABLE public.purchase_order_details ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.purchase_order_details ADD COLUMN IF NOT EXISTS line_number integer;
ALTER TABLE public.purchase_order_details ADD COLUMN IF NOT EXISTS item_code_snapshot text;
ALTER TABLE public.purchase_order_details ADD COLUMN IF NOT EXISTS item_name_snapshot text;
ALTER TABLE public.purchase_order_details ADD COLUMN IF NOT EXISTS unit_code_snapshot text;
UPDATE public.purchase_order_details SET
    purchase_order_id = COALESCE(purchase_order_id, po_id),
    quantity_ordered = COALESCE(quantity_ordered, quantity),
    discount_amount = COALESCE(discount_amount, discount),
    tax_amount = COALESCE(tax_amount, tax);

-- ---------- RPC: CREATE PURCHASE ORDER ----------
CREATE OR REPLACE FUNCTION public.create_purchase_order(
    p_entity_id uuid,
    p_order_date date,
    p_expected_delivery_date date,
    p_supplier_id uuid,
    p_store_id uuid,
    p_payment_term_days integer,
    p_notes text,
    p_details jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_po_id uuid;
    v_po_number text;
    v_seq bigint;
    v_period text := to_char(COALESCE(p_order_date, CURRENT_DATE), 'YYMM');
    v_supplier_code text;
    v_supplier_name text;
    v_subtotal numeric := 0;
    v_discount numeric := 0;
    v_tax numeric := 0;
    v_total numeric := 0;
    d jsonb;
    v_item uuid;
    v_line integer := 0;
BEGIN
    IF p_details IS NULL OR jsonb_array_length(p_details) = 0 THEN
        RAISE EXCEPTION 'Detail PO minimal satu baris';
    END IF;

    IF p_supplier_id IS NOT NULL THEN
        SELECT code, name INTO v_supplier_code, v_supplier_name
        FROM public.suppliers WHERE id = p_supplier_id;
    END IF;

    BEGIN
        v_seq := public.next_document_number(p_entity_id, 'PO', v_period);
    EXCEPTION WHEN OTHERS THEN
        v_seq := (SELECT COALESCE(MAX(substr(po_number, length('PO-'||v_period||'-')+1)::bigint),0)+1
                  FROM public.purchase_orders WHERE po_number LIKE 'PO-'||v_period||'-%');
    END;

    v_po_number := 'PO-' || v_period || '-' || lpad(v_seq::text, 5, '0');

    INSERT INTO public.purchase_orders
        (entity_id, po_no, po_number, order_date, expected_delivery_date, vendor_id,
         supplier_code_snapshot, supplier_name_snapshot, ship_to_store_id, payment_term_days,
         status, subtotal, discount_amount, tax_amount, grand_total, currency_code, notes)
    VALUES
        (p_entity_id, v_po_number, v_po_number, p_order_date, p_expected_delivery_date, p_supplier_id,
         v_supplier_code, v_supplier_name, p_store_id, p_payment_term_days,
         'DRAFT', 0, 0, 0, 0, 'IDR', p_notes)
    RETURNING id INTO v_po_id;

    FOR d IN SELECT * FROM jsonb_array_elements(p_details) LOOP
        v_line := v_line + 1;
        v_item := (d->>'item_id')::uuid;
        v_subtotal := v_subtotal + (COALESCE((d->>'quantity_ordered')::numeric,0) * COALESCE((d->>'unit_price')::numeric,0));
        v_discount := v_discount + COALESCE((d->>'discount_amount')::numeric,0);
        v_tax := v_tax + COALESCE((d->>'tax_amount')::numeric,0);

        INSERT INTO public.purchase_order_details
            (po_id, purchase_order_id, item_id, quantity_ordered, quantity, unit_price,
             discount_amount, discount, tax_amount, tax, notes, line_number,
             item_code_snapshot, item_name_snapshot, unit_code_snapshot)
        SELECT v_po_id, v_po_id, v_item, (d->>'quantity_ordered')::numeric, (d->>'quantity_ordered')::numeric,
               (d->>'unit_price')::numeric, (d->>'discount_amount')::numeric, (d->>'discount_amount')::numeric,
               (d->>'tax_amount')::numeric, (d->>'tax_amount')::numeric, (d->>'notes'), v_line,
               i.code, i.name, u.code
        FROM (SELECT 1) x
        LEFT JOIN public.items i ON i.id = v_item
        LEFT JOIN public.units u ON u.id = i.unit_id;
    END LOOP;

    v_total := v_subtotal - v_discount + v_tax;
    UPDATE public.purchase_orders
       SET subtotal = v_subtotal, discount_amount = v_discount,
           tax_amount = v_tax, grand_total = v_total
     WHERE id = v_po_id;

    RETURN jsonb_build_object('success', true,
        'purchase_order_id', v_po_id,
        'po_number', v_po_number,
        'status', 'DRAFT',
        'grand_total', v_total);
END $$;

-- ---------- RPC: UPDATE DRAFT ----------
CREATE OR REPLACE FUNCTION public.update_purchase_order_draft(
    p_purchase_order_id uuid,
    p_order_date date,
    p_expected_delivery_date date,
    p_supplier_id uuid,
    p_store_id uuid,
    p_payment_term_days integer,
    p_notes text,
    p_details jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_supplier_code text;
    v_supplier_name text;
    v_subtotal numeric := 0;
    v_discount numeric := 0;
    v_tax numeric := 0;
    v_total numeric := 0;
    d jsonb;
    v_item uuid;
    v_line integer := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.purchase_orders WHERE id = p_purchase_order_id AND status = 'DRAFT') THEN
        RAISE EXCEPTION 'Hanya PO status DRAFT yang dapat diubah';
    END IF;

    IF p_details IS NULL OR jsonb_array_length(p_details) = 0 THEN
        RAISE EXCEPTION 'Detail PO minimal satu baris';
    END IF;

    IF p_supplier_id IS NOT NULL THEN
        SELECT code, name INTO v_supplier_code, v_supplier_name
        FROM public.suppliers WHERE id = p_supplier_id;
    END IF;

    UPDATE public.purchase_orders SET
        order_date = COALESCE(p_order_date, order_date),
        expected_delivery_date = p_expected_delivery_date,
        vendor_id = p_supplier_id,
        supplier_code_snapshot = COALESCE(v_supplier_code, supplier_code_snapshot),
        supplier_name_snapshot = COALESCE(v_supplier_name, supplier_name_snapshot),
        ship_to_store_id = p_store_id,
        payment_term_days = p_payment_term_days,
        notes = p_notes
    WHERE id = p_purchase_order_id;

    DELETE FROM public.purchase_order_details WHERE purchase_order_id = p_purchase_order_id;

    FOR d IN SELECT * FROM jsonb_array_elements(p_details) LOOP
        v_line := v_line + 1;
        v_item := (d->>'item_id')::uuid;
        v_subtotal := v_subtotal + (COALESCE((d->>'quantity_ordered')::numeric,0) * COALESCE((d->>'unit_price')::numeric,0));
        v_discount := v_discount + COALESCE((d->>'discount_amount')::numeric,0);
        v_tax := v_tax + COALESCE((d->>'tax_amount')::numeric,0);

        INSERT INTO public.purchase_order_details
            (po_id, purchase_order_id, item_id, quantity_ordered, quantity, unit_price,
             discount_amount, discount, tax_amount, tax, notes, line_number,
             item_code_snapshot, item_name_snapshot, unit_code_snapshot)
        SELECT p_purchase_order_id, p_purchase_order_id, v_item, (d->>'quantity_ordered')::numeric, (d->>'quantity_ordered')::numeric,
               (d->>'unit_price')::numeric, (d->>'discount_amount')::numeric, (d->>'discount_amount')::numeric,
               (d->>'tax_amount')::numeric, (d->>'tax_amount')::numeric, (d->>'notes'), v_line,
               i.code, i.name, u.code
        FROM (SELECT 1) x
        LEFT JOIN public.items i ON i.id = v_item
        LEFT JOIN public.units u ON u.id = i.unit_id;
    END LOOP;

    v_total := v_subtotal - v_discount + v_tax;
    UPDATE public.purchase_orders
       SET subtotal = v_subtotal, discount_amount = v_discount,
           tax_amount = v_tax, grand_total = v_total
     WHERE id = p_purchase_order_id;

    RETURN jsonb_build_object('success', true,
        'purchase_order_id', p_purchase_order_id,
        'po_number', (SELECT po_number FROM public.purchase_orders WHERE id = p_purchase_order_id),
        'status', 'DRAFT',
        'grand_total', v_total);
END $$;

-- ---------- RPC: DELETE DRAFT ----------
CREATE OR REPLACE FUNCTION public.delete_purchase_order_draft(
    p_purchase_order_id uuid
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_no text;
BEGIN
    SELECT po_number INTO v_no FROM public.purchase_orders WHERE id = p_purchase_order_id;
    IF v_no IS NULL THEN
        RAISE EXCEPTION 'PO tidak ditemukan';
    END IF;
    IF EXISTS (SELECT 1 FROM public.purchase_orders WHERE id = p_purchase_order_id AND status <> 'DRAFT') THEN
        RAISE EXCEPTION 'Hanya PO status DRAFT yang dapat dihapus';
    END IF;
    DELETE FROM public.purchase_order_details WHERE purchase_order_id = p_purchase_order_id;
    DELETE FROM public.purchase_orders WHERE id = p_purchase_order_id;
    RETURN jsonb_build_object('success', true, 'purchase_order_id', p_purchase_order_id, 'po_number', v_no);
END $$;

-- ---------- RPC: OPEN ----------
CREATE OR REPLACE FUNCTION public.open_purchase_order(
    p_purchase_order_id uuid
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_no text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.purchase_orders WHERE id = p_purchase_order_id AND status = 'DRAFT') THEN
        RAISE EXCEPTION 'Hanya PO status DRAFT yang dapat dibuka';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.purchase_orders WHERE id = p_purchase_order_id AND vendor_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Supplier wajib dilengkapi sebelum PO dibuka';
    END IF;
    UPDATE public.purchase_orders SET status = 'OPEN' WHERE id = p_purchase_order_id RETURNING po_number INTO v_no;
    RETURN jsonb_build_object('success', true, 'purchase_order_id', p_purchase_order_id, 'po_number', v_no, 'status', 'OPEN');
END $$;

-- ---------- RPC: CANCEL ----------
CREATE OR REPLACE FUNCTION public.cancel_purchase_order(
    p_purchase_order_id uuid,
    p_cancel_reason text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_no text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.purchase_orders WHERE id = p_purchase_order_id AND status NOT IN ('CLOSED','CANCELLED')) THEN
        RAISE EXCEPTION 'PO tidak dapat dibatalkan pada status ini';
    END IF;
    UPDATE public.purchase_orders SET status = 'CANCELLED', notes = p_cancel_reason
     WHERE id = p_purchase_order_id RETURNING po_number INTO v_no;
    RETURN jsonb_build_object('success', true, 'purchase_order_id', p_purchase_order_id, 'po_number', v_no, 'status', 'CANCELLED');
END $$;

-- ---------- RPC: CLOSE OUTSTANDING ----------
CREATE OR REPLACE FUNCTION public.close_purchase_order_outstanding(
    p_purchase_order_id uuid,
    p_close_reason text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_no text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.purchase_orders WHERE id = p_purchase_order_id AND status IN ('OPEN','PARTIAL_RECEIVED')) THEN
        RAISE EXCEPTION 'PO tidak dapat ditutup pada status ini';
    END IF;
    UPDATE public.purchase_orders SET status = 'CLOSED', notes = p_close_reason
     WHERE id = p_purchase_order_id RETURNING po_number INTO v_no;
    RETURN jsonb_build_object('success', true, 'purchase_order_id', p_purchase_order_id, 'po_number', v_no, 'status', 'CLOSED');
END $$;

-- ---------- MENU: PURCHASE ORDERS ----------
DO $$
DECLARE v_parent uuid;
BEGIN
    SELECT id INTO v_parent FROM public.menus WHERE label = 'Procurement' AND parent IS NULL LIMIT 1;
    IF v_parent IS NULL THEN RETURN; END IF;
    INSERT INTO public.menus (id, label, path, component, access, parent, order_index)
    SELECT gen_random_uuid(), 'Purchase Orders', '/purchase-orders',
           'procurement/purchase-orders/PurchaseOrderPage', 'Procurement -> Purchase Orders', v_parent, 8
    WHERE NOT EXISTS (SELECT 1 FROM public.menus m WHERE m.parent = v_parent AND m.label = 'Purchase Orders');
END $$;

-- ---------- AKSES ADMINISTRATOR ----------
DO $$
DECLARE accs text[] := ARRAY['Procurement -> Purchase Orders'];
BEGIN
    UPDATE public.custom_roles SET access = access || accs
    WHERE name = 'Administrator' AND NOT (access @> accs);
    UPDATE public.custom_users SET access = access || accs
    WHERE role = 'Administrator' AND NOT (access @> accs);
END $$;
