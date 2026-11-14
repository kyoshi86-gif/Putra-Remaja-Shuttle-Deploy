-- ============================================================
-- FASE 5b — RPC ACCOUNT PAYABLE: PAYMENT REQUEST + MENU
-- ------------------------------------------------------------
-- create/approve/cancel_ap_payment_request. Additive & idempotent.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_ap_payment_request(
    p_entity_id uuid,
    p_request_date date,
    p_supplier_id uuid,
    p_items jsonb,
    p_notes text,
    p_created_by text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_id uuid;
    v_no text;
    v_seq bigint;
    v_period text;
    v_total numeric := 0;
    it jsonb;
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Minimal satu item payment request wajib diisi';
    END IF;

    v_period := to_char(COALESCE(p_request_date, CURRENT_DATE), 'YYMM');
    BEGIN
        v_seq := public.next_document_number(p_entity_id, 'APR', v_period);
    EXCEPTION WHEN OTHERS THEN v_seq := 1; END;
    v_no := 'APR-' || v_period || '-' || lpad(v_seq::text, 5, '0');

    INSERT INTO public.ap_payment_requests
        (entity_id, request_no, payment_request_number, vendor_id, request_date, tanggal,
         total_amount, amount, status, notes, requested_by)
    VALUES
        (p_entity_id, v_no, v_no, p_supplier_id, COALESCE(p_request_date, CURRENT_DATE),
         COALESCE(p_request_date, CURRENT_DATE), 0, 0, 'DRAFT', p_notes, p_created_by)
    RETURNING id INTO v_id;

    FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        INSERT INTO public.ap_payment_request_items
            (request_id, payment_request_id, ap_invoice_id, receiving_record_id,
             requested_amount, amount, notes)
        VALUES
            (v_id, v_id, (it->>'ap_invoice_id')::uuid, (it->>'receiving_record_id')::uuid,
             (it->>'requested_amount')::numeric, (it->>'requested_amount')::numeric, (it->>'notes'));
        v_total := v_total + COALESCE((it->>'requested_amount')::numeric, 0);
    END LOOP;

    UPDATE public.ap_payment_requests SET total_amount = v_total, amount = v_total WHERE id = v_id;

    RETURN jsonb_build_object('success', true, 'payment_request_id', v_id,
        'payment_request_number', v_no, 'supplier_id', p_supplier_id,
        'status', 'DRAFT', 'total_amount', v_total);
END $$;

CREATE OR REPLACE FUNCTION public.approve_ap_payment_request(
    p_payment_request_id uuid,
    p_approved_by text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_number text; v_total numeric;
BEGIN
    SELECT payment_request_number, total_amount INTO v_number, v_total
    FROM public.ap_payment_requests WHERE id = p_payment_request_id;
    IF v_number IS NULL THEN RAISE EXCEPTION 'Payment request tidak ditemukan'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.ap_payment_requests WHERE id = p_payment_request_id AND status = 'DRAFT') THEN
        RAISE EXCEPTION 'Hanya payment request draft yang dapat disetujui';
    END IF;

    UPDATE public.ap_payment_requests
       SET status = 'APPROVED', approved_by = p_approved_by, approved_at = now()
     WHERE id = p_payment_request_id;

    RETURN jsonb_build_object('success', true, 'payment_request_id', p_payment_request_id,
        'payment_request_number', v_number, 'status', 'APPROVED',
        'total_amount', v_total, 'approved_at', now());
END $$;

CREATE OR REPLACE FUNCTION public.cancel_ap_payment_request(
    p_payment_request_id uuid,
    p_cancelled_by text,
    p_cancel_reason text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_number text;
BEGIN
    SELECT payment_request_number INTO v_number FROM public.ap_payment_requests
    WHERE id = p_payment_request_id;
    IF v_number IS NULL THEN RAISE EXCEPTION 'Payment request tidak ditemukan'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.ap_payment_requests WHERE id = p_payment_request_id AND status IN ('DRAFT','APPROVED')) THEN
        RAISE EXCEPTION 'Payment request tidak dapat dibatalkan pada status ini';
    END IF;

    UPDATE public.ap_payment_requests
       SET status = 'CANCELLED', cancelled_by = p_cancelled_by,
           cancelled_at = now(), cancel_reason = p_cancel_reason
     WHERE id = p_payment_request_id;

    RETURN jsonb_build_object('success', true, 'payment_request_id', p_payment_request_id,
        'payment_request_number', v_number, 'status', 'CANCELLED');
END $$;

-- ---------- MENU: ACCOUNT PAYABLE ----------
DO $$
DECLARE v_parent uuid;
BEGIN
    SELECT id INTO v_parent FROM public.menus WHERE label = 'Procurement' AND parent IS NULL LIMIT 1;
    IF v_parent IS NOT NULL THEN
        INSERT INTO public.menus (id, label, path, component, access, parent, order_index)
        SELECT gen_random_uuid(), v.label, v.path, v.component, v.access, v_parent, v.ord
        FROM (VALUES
            ('Supplier Invoice', '/supplier-invoices', 'procurement/account-payable/SupplierInvoicePage', 'Procurement -> Supplier Invoice', 10),
            ('Pembayaran', '/payments', 'procurement/account-payable/PaymentPage', 'Procurement -> Pembayaran', 11)
        ) AS v(label, path, component, access, ord)
        WHERE NOT EXISTS (SELECT 1 FROM public.menus m WHERE m.parent = v_parent AND m.label = v.label);
    END IF;
END $$;

DO $$
DECLARE accs text[] := ARRAY['Procurement -> Supplier Invoice', 'Procurement -> Pembayaran'];
BEGIN
    UPDATE public.custom_roles SET access = access || accs
    WHERE name = 'Administrator' AND NOT (access @> accs);
    UPDATE public.custom_users SET access = access || accs
    WHERE role = 'Administrator' AND NOT (access @> accs);
END $$;
