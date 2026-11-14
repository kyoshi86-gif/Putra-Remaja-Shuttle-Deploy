-- ============================================================
-- FASE 5c — RPC ACCOUNT PAYABLE (LANJUTAN): INVOICE ADMIN + PAYMENT
-- ------------------------------------------------------------
-- Getitive & idempotent. Mengikuti kontrak frontend & docs 04/05.
-- ============================================================

-- ---------- kolom deposit pada alokasi pembayaran ----------
ALTER TABLE public.ap_payment_allocations ADD COLUMN IF NOT EXISTS supplier_deposit_id uuid;

-- ---------- pemetaan metode bayar -> rekening kas/bank (FK cash_accounts) ----------
ALTER TABLE public.purchase_settlement_methods ADD COLUMN IF NOT EXISTS cash_account_id uuid;

-- ---------- ap_invoices: updated_at (dipakai helper alokasi & frontend) ----------
ALTER TABLE public.ap_invoices ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- ============================================================
-- 1) LIST INVOICE (PAGINATED) — return [{data, total_count}]
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_available_ap_invoices_paginated(
    p_entity_id uuid,
    p_keyword text DEFAULT '',
    p_page integer DEFAULT 1,
    p_page_size integer DEFAULT 25
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_offset int := (GREATEST(p_page,1)-1) * GREATEST(p_page_size,1);
BEGIN
    RETURN (SELECT COALESCE(jsonb_agg(r.row_json), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
            'data', jsonb_build_object(
                'id', i.id,
                'entity_id', i.entity_id,
                'receiving_record_id', i.receiving_record_id,
                'supplier_id', COALESCE(i.supplier_id, i.vendor_id),
                'invoice_number', COALESCE(i.invoice_number, i.invoice_no),
                'invoice_date', COALESCE(i.invoice_date, i.tanggal),
                'due_date', i.due_date,
                'subtotal', i.subtotal,
                'discount_amount', i.discount_amount,
                'tax_amount', i.tax,
                'grand_total', COALESCE(i.grand_total, i.total),
                'paid_amount', i.paid_amount,
                'remaining_amount', i.remaining_amount,
                'status', i.status,
                'notes', i.notes,
                'created_by', i.created_by,
                'created_at', i.created_at,
                'updated_at', i.updated_at,
                'supplier_code', s.code,
                'supplier_name', s.name,
                'supplier_invoice_number', i.invoice_number,
                'supplier_invoice_date', i.invoice_date,
                'supplier_due_date', i.due_date,
                'purchase_order_number', po.po_number,
                'receiving_number', r.receiving_number,
                'receiving_date', r.receiving_date,
                'payment_request_id', pr.id,
                'payment_request_number', pr.payment_request_number,
                'payment_request_status', pr.status
            ),
            'total_count', count(*) OVER()
        ) AS row_json
        FROM public.ap_invoices i
        LEFT JOIN public.suppliers s ON s.id = COALESCE(i.supplier_id, i.vendor_id)
        LEFT JOIN public.receiving_records r ON r.id = i.receiving_record_id
        LEFT JOIN public.purchase_orders po ON po.id = i.po_id
        LEFT JOIN public.ap_payment_request_items pri ON pri.ap_invoice_id = i.id
        LEFT JOIN public.ap_payment_requests pr ON pr.id = pri.payment_request_id
        WHERE (p_entity_id IS NULL OR i.entity_id = p_entity_id)
          AND i.status <> 'CANCELLED'
          AND (p_keyword = '' OR COALESCE(i.invoice_number,i.invoice_no) ILIKE '%'||p_keyword||'%'
               OR s.name ILIKE '%'||p_keyword||'%')
        ORDER BY i.created_at DESC
        LIMIT GREATEST(p_page_size,1) OFFSET v_offset
    ) r);
END $$;

-- ============================================================
-- 2) LIST PAYMENT REQUEST (PAGINATED) — return [{data, total_count}]
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_ap_payment_requests_paginated(
    p_entity_id uuid,
    p_keyword text DEFAULT '',
    p_page integer DEFAULT 1,
    p_page_size integer DEFAULT 25
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_offset int := (GREATEST(p_page,1)-1) * GREATEST(p_page_size,1);
BEGIN
    RETURN (SELECT COALESCE(jsonb_agg(r.row_json), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
            'data', jsonb_build_object(
                'id', q.id,
                'entity_id', q.entity_id,
                'payment_request_number', COALESCE(q.payment_request_number, q.request_no),
                'request_date', COALESCE(q.request_date, q.tanggal),
                'supplier_id', COALESCE(q.vendor_id, q.supplier_id),
                'total_amount', COALESCE(q.total_amount, q.amount),
                'status', q.status,
                'notes', q.notes,
                'created_by', q.created_by,
                'approved_by', q.approved_by,
                'approved_at', q.approved_at,
                'cancelled_by', q.cancelled_by,
                'cancelled_at', q.cancelled_at,
                'cancel_reason', q.cancel_reason,
                'created_at', q.created_at,
                'updated_at', q.updated_at,
                'supplier_code', s.code,
                'supplier_name', s.name,
                'items', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object(
                        'id', it.id,
                        'payment_request_id', it.payment_request_id,
                        'ap_invoice_id', it.ap_invoice_id,
                        'receiving_record_id', it.receiving_record_id,
                        'requested_amount', COALESCE(it.requested_amount, it.amount),
                        'notes', it.notes,
                        'invoice_number', ivl.invoice_number,
                        'invoice_date', ivl.invoice_date,
                        'due_date', ivl.due_date,
                        'remaining_amount', ivl.remaining_amount,
                        'receiving_number', rl.receiving_number,
                        'receiving_date', rl.receiving_date,
                        'purchase_order_number', pol.po_number
                    )) FROM public.ap_payment_request_items it
                    LEFT JOIN public.ap_invoices ivl ON ivl.id = it.ap_invoice_id
                    LEFT JOIN public.receiving_records rl ON rl.id = it.receiving_record_id
                    LEFT JOIN public.purchase_orders pol ON pol.id = ivl.po_id
                    WHERE it.payment_request_id = q.id
                ), '[]'::jsonb)
            ),
            'total_count', count(*) OVER()
        ) AS row_json
        FROM public.ap_payment_requests q
        LEFT JOIN public.suppliers s ON s.id = COALESCE(q.vendor_id, q.supplier_id)
        WHERE (p_entity_id IS NULL OR q.entity_id = p_entity_id)
          AND (p_keyword = '' OR COALESCE(q.payment_request_number,q.request_no) ILIKE '%'||p_keyword||'%'
               OR s.name ILIKE '%'||p_keyword||'%')
        ORDER BY q.created_at DESC
        LIMIT GREATEST(p_page_size,1) OFFSET v_offset
    ) r);
END $$;

-- ============================================================
-- 3) INVOICE ADMIN
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_ap_invoice(
    p_invoice_id uuid,
    p_invoice_number text,
    p_invoice_date date,
    p_due_date date,
    p_notes text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_no text;
BEGIN
    SELECT COALESCE(invoice_number, invoice_no) INTO v_no FROM public.ap_invoices WHERE id = p_invoice_id;
    IF v_no IS NULL THEN RAISE EXCEPTION 'Invoice tidak ditemukan'; END IF;
    IF EXISTS (SELECT 1 FROM public.ap_invoices WHERE id = p_invoice_id AND status IN ('PAID','CANCELLED')) THEN
        RAISE EXCEPTION 'Invoice PAID/CANCELLED tidak dapat diubah';
    END IF;
    UPDATE public.ap_invoices SET
        invoice_number = COALESCE(p_invoice_number, invoice_number),
        invoice_date = COALESCE(p_invoice_date, invoice_date),
        due_date = p_due_date,
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = p_invoice_id;
    RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'invoice_number', v_no);
END $$;

CREATE OR REPLACE FUNCTION public.delete_ap_invoice(
    p_invoice_id uuid
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_no text;
BEGIN
    SELECT COALESCE(invoice_number, invoice_no) INTO v_no FROM public.ap_invoices WHERE id = p_invoice_id;
    IF v_no IS NULL THEN RAISE EXCEPTION 'Invoice tidak ditemukan'; END IF;
    IF EXISTS (SELECT 1 FROM public.ap_invoices WHERE id = p_invoice_id AND status IN ('PAID','CANCELLED')) THEN
        RAISE EXCEPTION 'Invoice PAID/CANCELLED tidak dapat dihapus';
    END IF;
    IF EXISTS (SELECT 1 FROM public.ap_payment_allocations WHERE ap_invoice_id = p_invoice_id AND amount > 0) THEN
        RAISE EXCEPTION 'Invoice sudah memiliki alokasi pembayaran, tidak dapat dihapus';
    END IF;
    DELETE FROM public.ap_payment_request_items WHERE ap_invoice_id = p_invoice_id;
    DELETE FROM public.ap_invoices WHERE id = p_invoice_id;
    RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'invoice_number', v_no);
END $$;

CREATE OR REPLACE FUNCTION public.open_ap_invoice(
    p_invoice_id uuid
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_no text;
BEGIN
    SELECT COALESCE(invoice_number, invoice_no) INTO v_no FROM public.ap_invoices WHERE id = p_invoice_id;
    IF v_no IS NULL THEN RAISE EXCEPTION 'Invoice tidak ditemukan'; END IF;
    UPDATE public.ap_invoices SET status = 'OPEN', updated_at = now() WHERE id = p_invoice_id;
    RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'invoice_number', v_no, 'status', 'OPEN');
END $$;

CREATE OR REPLACE FUNCTION public.cancel_ap_invoice(
    p_invoice_id uuid,
    p_cancel_reason text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_no text;
BEGIN
    SELECT COALESCE(invoice_number, invoice_no) INTO v_no FROM public.ap_invoices WHERE id = p_invoice_id;
    IF v_no IS NULL THEN RAISE EXCEPTION 'Invoice tidak ditemukan'; END IF;
    IF EXISTS (SELECT 1 FROM public.ap_invoices WHERE id = p_invoice_id AND status = 'PAID') THEN
        RAISE EXCEPTION 'Invoice PAID tidak dapat dibatalkan';
    END IF;
    UPDATE public.ap_invoices SET status = 'CANCELLED', notes = COALESCE(notes,'') || E'\n' || COALESCE(p_cancel_reason,''), updated_at = now()
    WHERE id = p_invoice_id;
    RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'invoice_number', v_no, 'status', 'CANCELLED');
END $$;

-- ============================================================
-- 4) PAYMENT — helper internal: alokasi invoice
-- ============================================================
CREATE OR REPLACE FUNCTION public._apply_ap_allocation(
    p_invoice_id uuid,
    p_amount numeric,
    p_deposit_id uuid
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_remaining numeric; v_new_remaining numeric; v_paid numeric;
BEGIN
    SELECT COALESCE(remaining_amount, COALESCE(grand_total,total), 0), COALESCE(paid_amount,0)
      INTO v_remaining, v_paid FROM public.ap_invoices WHERE id = p_invoice_id;
    IF v_remaining IS NULL THEN RAISE EXCEPTION 'Invoice tidak ditemukan'; END IF;
    IF p_amount > v_remaining + 0.0001 THEN
        RAISE EXCEPTION 'Jumlah alokasi melebihi sisa tagihan (%)', v_remaining;
    END IF;
    v_new_remaining := v_remaining - p_amount;
    UPDATE public.ap_invoices SET
        paid_amount = v_paid + p_amount,
        remaining_amount = GREATEST(v_new_remaining, 0),
        status = CASE WHEN v_new_remaining <= 0.0001 THEN 'PAID' ELSE 'PARTIAL' END,
        updated_at = now()
    WHERE id = p_invoice_id;
    IF p_deposit_id IS NOT NULL THEN
        UPDATE public.supplier_deposits SET allocated_amount = COALESCE(allocated_amount,0) + p_amount
        WHERE id = p_deposit_id;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public._reverse_ap_allocation(
    p_invoice_id uuid,
    p_amount numeric,
    p_deposit_id uuid
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_paid numeric; v_new_paid numeric; v_total numeric;
BEGIN
    SELECT COALESCE(paid_amount,0), COALESCE(grand_total,total), 0 INTO v_paid, v_total FROM public.ap_invoices WHERE id = p_invoice_id;
    v_new_paid := GREATEST(v_paid - p_amount, 0);
    UPDATE public.ap_invoices SET
        paid_amount = v_new_paid,
        remaining_amount = v_total - v_new_paid,
        status = CASE WHEN v_new_paid <= 0.0001 THEN 'OPEN' ELSE 'PARTIAL' END,
        updated_at = now()
    WHERE id = p_invoice_id;
    IF p_deposit_id IS NOT NULL THEN
        UPDATE public.supplier_deposits SET allocated_amount = GREATEST(COALESCE(allocated_amount,0) - p_amount, 0)
        WHERE id = p_deposit_id;
    END IF;
END $$;

-- ---------- CREATE PAYMENT ----------
CREATE OR REPLACE FUNCTION public.create_ap_payment(
    p_entity_id uuid,
    p_payment_date date,
    p_payment_method_id uuid,
    p_reference_number text,
    p_notes text,
    p_created_by text,
    p_custom_user_id text,
    p_payment_request_id uuid,
    p_allocations jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_pay_id uuid := gen_random_uuid();
    v_no text;
    v_seq bigint;
    v_period text;
    v_total numeric := 0;
    v_acc_kas uuid;
    v_cash uuid;
    v_acc_hutang uuid;
    v_journal uuid;
    v_jno text;
    v_jseq bigint;
    v_jperiod text;
    v_supplier uuid;
    v_req_no text;
    it jsonb;
    v_inv uuid;
BEGIN
    IF p_allocations IS NULL OR jsonb_array_length(p_allocations) = 0 THEN
        RAISE EXCEPTION 'Minimal satu alokasi invoice wajib diisi';
    END IF;

    SELECT cash_account_id, account_id INTO v_cash, v_acc_kas FROM public.purchase_settlement_methods WHERE id = p_payment_method_id;
    IF v_cash IS NULL THEN
        SELECT id INTO v_cash FROM public.cash_accounts
        WHERE (entity_id IS NULL OR entity_id = p_entity_id) AND COALESCE(lower(status),'active') IN ('active','aktif')
        ORDER BY nama LIMIT 1;
    END IF;
    IF v_cash IS NULL THEN RAISE EXCEPTION 'Master kas/bank belum diatur untuk metode pembayaran'; END IF;
    IF v_acc_kas IS NULL THEN
        SELECT id INTO v_acc_kas FROM public.accounts WHERE code = 'A-100'; -- fallback Kas
    END IF;
    SELECT id INTO v_acc_hutang FROM public.accounts WHERE code = 'L-200';
    IF v_acc_hutang IS NULL THEN RAISE EXCEPTION 'Akun Hutang Usaha tidak ditemukan'; END IF;

    v_period := to_char(COALESCE(p_payment_date, CURRENT_DATE), 'YYMM');
    BEGIN
        v_seq := public.next_document_number(p_entity_id, 'PMT', v_period);
    EXCEPTION WHEN OTHERS THEN v_seq := 1; END;
    v_no := 'PMT-' || v_period || '-' || lpad(v_seq::text, 5, '0');

    -- totalkan dan validasi
    FOR it IN SELECT * FROM jsonb_array_elements(p_allocations) LOOP
        v_total := v_total + COALESCE((it->>'amount')::numeric, 0);
        v_inv := (it->>'invoice_id')::uuid;
        IF v_inv IS NULL THEN RAISE EXCEPTION 'Alokasi tanpa invoice'; END IF;
        IF v_supplier IS NULL THEN
            SELECT COALESCE(supplier_id, vendor_id) INTO v_supplier FROM public.ap_invoices WHERE id = v_inv;
        END IF;
    END LOOP;

    INSERT INTO public.ap_payments
        (id, entity_id, payment_no, payment_number, payment_date, source_account_id,
         method, amount, vendor_id, status, posting_key, created_by, payment_method_id,
         reference_number, notes, payment_request_id, supplier_id)
    VALUES
        (v_pay_id, p_entity_id, v_no, v_no, COALESCE(p_payment_date, CURRENT_DATE), v_cash,
         (SELECT code FROM public.purchase_settlement_methods WHERE id = p_payment_method_id),
         v_total, v_supplier, 'POSTED', 'APP-PAY:' || v_pay_id, COALESCE(p_created_by, p_custom_user_id),
         p_payment_method_id, p_reference_number, p_notes, p_payment_request_id, v_supplier);

    FOR it IN SELECT * FROM jsonb_array_elements(p_allocations) LOOP
        INSERT INTO public.ap_payment_allocations (ap_payment_id, ap_invoice_id, amount, supplier_deposit_id)
        VALUES (v_pay_id, (it->>'invoice_id')::uuid, (it->>'amount')::numeric, (it->>'deposit_id')::uuid);
        PERFORM public._apply_ap_allocation((it->>'invoice_id')::uuid, (it->>'amount')::numeric, (it->>'deposit_id')::uuid);
    END LOOP;

    -- JURNAL: Dr Hutang Usaha, Cr Kas/Bank
    v_jperiod := to_char(COALESCE(p_payment_date, CURRENT_DATE), 'YYMM');
    BEGIN
        v_jseq := public.next_document_number(p_entity_id, 'JR', v_jperiod);
    EXCEPTION WHEN OTHERS THEN v_jseq := 1; END;
    v_jno := 'JR-' || v_jperiod || '-' || lpad(v_jseq::text, 5, '0');

    INSERT INTO public.journals (tanggal, description, reference, entity_id, user_id, source_type, source_id, posting_key, posted_at, posted_by)
    VALUES (COALESCE(p_payment_date, CURRENT_DATE), 'Pembayaran Hutang ' || v_no, v_no, p_entity_id, p_custom_user_id, 'AP_PAYMENT', v_pay_id, 'APP-PAY:' || v_pay_id, now(), p_custom_user_id)
    RETURNING id INTO v_journal;

    INSERT INTO public.journal_details (journal_id, account_id, debit, credit, description)
    VALUES (v_journal, v_acc_hutang, v_total, 0, 'Bayar Hutang Usaha'),
           (v_journal, v_acc_kas, 0, v_total, 'Kas/Bank keluar');

    UPDATE public.ap_payments SET journal_id = v_journal WHERE id = v_pay_id;

    IF p_payment_request_id IS NOT NULL THEN
        SELECT payment_request_number INTO v_req_no FROM public.ap_payment_requests WHERE id = p_payment_request_id;
        UPDATE public.ap_payment_requests SET status = 'PAID', updated_at = now() WHERE id = p_payment_request_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'payment_id', v_pay_id, 'payment_number', v_no,
        'payment_request_id', p_payment_request_id, 'payment_request_number', v_req_no,
        'entity_id', p_entity_id, 'supplier_id', v_supplier, 'payment_date', p_payment_date,
        'payment_method_id', p_payment_method_id, 'amount', v_total,
        'reference_number', p_reference_number, 'allocation_count', jsonb_array_length(p_allocations),
        'payment_request_status', CASE WHEN p_payment_request_id IS NOT NULL THEN 'PAID' END);
END $$;

-- ---------- UPDATE PAYMENT ----------
CREATE OR REPLACE FUNCTION public.update_ap_payment(
    p_payment_id uuid,
    p_entity_id uuid,
    p_payment_date date,
    p_payment_method_id uuid,
    p_reference_number text,
    p_notes text,
    p_created_by text,
    p_custom_user_id text,
    p_allocations jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_no text;
    v_total numeric := 0;
    v_acc_kas uuid;
    v_cash uuid;
    v_acc_hutang uuid;
    v_journal uuid;
    v_jno text;
    v_jseq bigint;
    v_jperiod text;
    v_supplier uuid;
    v_old record;
    v_a record;
    it jsonb;
    v_inv uuid;
BEGIN
    SELECT * INTO v_old FROM public.ap_payments WHERE id = p_payment_id AND (p_entity_id IS NULL OR entity_id = p_entity_id);
    IF v_old IS NULL THEN RAISE EXCEPTION 'Pembayaran tidak ditemukan'; END IF;
    IF p_allocations IS NULL OR jsonb_array_length(p_allocations) = 0 THEN
        RAISE EXCEPTION 'Minimal satu alokasi invoice wajib diisi';
    END IF;

    -- rollback alokasi lama
    FOR v_a IN SELECT ap_invoice_id, amount, supplier_deposit_id FROM public.ap_payment_allocations WHERE ap_payment_id = p_payment_id LOOP
        PERFORM public._reverse_ap_allocation(v_a.ap_invoice_id, v_a.amount, v_a.supplier_deposit_id);
    END LOOP;
    DELETE FROM public.ap_payment_allocations WHERE ap_payment_id = p_payment_id;

    -- hapus jurnal lama (jika ada)
    IF v_old.journal_id IS NOT NULL THEN
        UPDATE public.ap_payments SET journal_id = NULL WHERE id = p_payment_id;
        DELETE FROM public.journal_details WHERE journal_id = v_old.journal_id;
        DELETE FROM public.journals WHERE id = v_old.journal_id;
    END IF;

    SELECT account_id INTO v_acc_kas FROM public.purchase_settlement_methods WHERE id = p_payment_method_id;
    IF v_acc_kas IS NULL THEN SELECT id INTO v_acc_kas FROM public.accounts WHERE code = 'A-100'; END IF;
    SELECT id INTO v_acc_hutang FROM public.accounts WHERE code = 'L-200';

    FOR it IN SELECT * FROM jsonb_array_elements(p_allocations) LOOP
        v_total := v_total + COALESCE((it->>'amount')::numeric, 0);
        v_inv := (it->>'invoice_id')::uuid;
        IF v_supplier IS NULL THEN
            SELECT COALESCE(supplier_id, vendor_id) INTO v_supplier FROM public.ap_invoices WHERE id = v_inv;
        END IF;
    END LOOP;

    UPDATE public.ap_payments SET
        payment_date = COALESCE(p_payment_date, payment_date),
        payment_method_id = p_payment_method_id,
        source_account_id = v_cash,
        method = (SELECT code FROM public.purchase_settlement_methods WHERE id = p_payment_method_id),
        amount = v_total,
        reference_number = p_reference_number,
        notes = p_notes,
        supplier_id = COALESCE(v_supplier, supplier_id),
        vendor_id = COALESCE(v_supplier, vendor_id)
    WHERE id = p_payment_id;

    FOR it IN SELECT * FROM jsonb_array_elements(p_allocations) LOOP
        INSERT INTO public.ap_payment_allocations (ap_payment_id, ap_invoice_id, amount, supplier_deposit_id)
        VALUES (p_payment_id, (it->>'invoice_id')::uuid, (it->>'amount')::numeric, (it->>'deposit_id')::uuid);
        PERFORM public._apply_ap_allocation((it->>'invoice_id')::uuid, (it->>'amount')::numeric, (it->>'deposit_id')::uuid);
    END LOOP;

    v_jperiod := to_char(COALESCE(p_payment_date, CURRENT_DATE), 'YYMM');
    BEGIN
        v_jseq := public.next_document_number(p_entity_id, 'JR', v_jperiod);
    EXCEPTION WHEN OTHERS THEN v_jseq := 1; END;
    v_jno := 'JR-' || v_jperiod || '-' || lpad(v_jseq::text, 5, '0');

    INSERT INTO public.journals (tanggal, description, reference, entity_id, user_id, source_type, source_id, posting_key, posted_at, posted_by)
    VALUES (COALESCE(p_payment_date, CURRENT_DATE), 'Pembayaran Hutang ' || v_old.payment_number, v_old.payment_number, p_entity_id, p_custom_user_id, 'AP_PAYMENT', p_payment_id, 'APP-PAY:' || p_payment_id, now(), p_custom_user_id)
    RETURNING id INTO v_journal;

    INSERT INTO public.journal_details (journal_id, account_id, debit, credit, description)
    VALUES (v_journal, v_acc_hutang, v_total, 0, 'Bayar Hutang Usaha'),
           (v_journal, v_acc_kas, 0, v_total, 'Kas/Bank keluar');

    UPDATE public.ap_payments SET journal_id = v_journal WHERE id = p_payment_id;

    RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'payment_number', v_old.payment_number,
        'payment_request_id', v_old.payment_request_id, 'amount', v_total);
END $$;

-- ---------- DELETE PAYMENT ----------
CREATE OR REPLACE FUNCTION public.delete_ap_payment(
    p_payment_id uuid,
    p_entity_id uuid
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_no text; v_old record; v_a record; v_jid uuid;
BEGIN
    SELECT * INTO v_old FROM public.ap_payments WHERE id = p_payment_id AND (p_entity_id IS NULL OR entity_id = p_entity_id);
    IF v_old IS NULL THEN RAISE EXCEPTION 'Pembayaran tidak ditemukan'; END IF;
    v_no := COALESCE(v_old.payment_number, v_old.payment_no);

    FOR v_a IN SELECT ap_invoice_id, amount, supplier_deposit_id FROM public.ap_payment_allocations WHERE ap_payment_id = p_payment_id LOOP
        PERFORM public._reverse_ap_allocation(v_a.ap_invoice_id, v_a.amount, v_a.supplier_deposit_id);
    END LOOP;

    v_jid := (SELECT journal_id FROM public.ap_payments WHERE id = p_payment_id);
    IF v_jid IS NOT NULL THEN
        UPDATE public.ap_payments SET journal_id = NULL WHERE id = p_payment_id;
        DELETE FROM public.journal_details WHERE journal_id = v_jid;
        DELETE FROM public.journals WHERE id = v_jid;
    END IF;

    DELETE FROM public.ap_payment_allocations WHERE ap_payment_id = p_payment_id;
    DELETE FROM public.ap_payments WHERE id = p_payment_id;

    RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'payment_number', v_no);
END $$;
