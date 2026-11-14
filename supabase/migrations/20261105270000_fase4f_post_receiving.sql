-- ============================================================
-- FASE 4f — RECEIVING POSTING (stok + AP + jurnal)
-- ------------------------------------------------------------
-- Additive & idempotent.
-- ============================================================

-- ---------- AKUN: PPN MASUKAN ----------
INSERT INTO public.accounts (code, name, type, is_postable, scope, is_posting, is_summary, category_code)
VALUES ('A-115', 'PPN Masukan', 'asset', true, 'GLOBAL', true, false, '-')
ON CONFLICT (code) DO NOTHING;

-- ---------- RPC: POST RECEIVING ----------
CREATE OR REPLACE FUNCTION public.post_receiving_record(
    p_receiving_record_id uuid,
    p_custom_user_id text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_rec record;
    v_po record;
    v_acc_persediaan uuid;
    v_acc_ppn uuid;
    v_acc_hutang uuid;
    v_persediaan numeric := 0;
    v_tax numeric := 0;
    v_grand numeric;
    v_journal uuid;
    v_journal_no text;
    v_jseq bigint;
    v_jperiod text;
    v_inv_no text;
    v_iseq bigint;
    v_period2 text;
    v_next_due date;
    v_mseq bigint;
    v_mperiod text;
    v_po_status text;
    r record;
    v_item_id uuid;
    v_sum_qty numeric;
    v_sum_val numeric;
BEGIN
    SELECT * INTO v_rec FROM public.receiving_records WHERE id = p_receiving_record_id;
    IF v_rec IS NULL THEN RAISE EXCEPTION 'Receiving tidak ditemukan'; END IF;
    IF v_rec.status <> 'DRAFT' THEN RAISE EXCEPTION 'Hanya draft receiving yang dapat diposting'; END IF;

    SELECT * INTO v_po FROM public.purchase_orders WHERE id = v_rec.po_id;
    IF v_po IS NULL THEN RAISE EXCEPTION 'Purchase Order tidak ditemukan'; END IF;

    SELECT id INTO v_acc_persediaan FROM public.accounts WHERE code = 'A-110';
    SELECT id INTO v_acc_hutang FROM public.accounts WHERE code = 'L-200';
    SELECT id INTO v_acc_ppn FROM public.accounts WHERE code = 'A-115';
    IF v_acc_persediaan IS NULL OR v_acc_hutang IS NULL OR v_acc_ppn IS NULL THEN
        RAISE EXCEPTION 'Akun jurnal receiving belum lengkap (Persediaan, Hutang Usaha, PPN Masukan)';
    END IF;

    FOR r IN SELECT * FROM public.receiving_record_details WHERE receiving_id = p_receiving_record_id LOOP
        v_persediaan := v_persediaan + (r.quantity_received * COALESCE(r.unit_cost, 0)) - COALESCE(r.discount_amount, 0);
        v_tax := v_tax + COALESCE(r.tax_amount, 0);
        UPDATE public.purchase_order_details SET quantity_received = quantity_received + r.quantity_received
         WHERE id = r.purchase_order_detail_id;
    END LOOP;

    v_grand := v_persediaan + v_tax;

    SELECT CASE WHEN COUNT(*) FILTER (WHERE d.quantity_received < d.quantity_ordered) = 0
                THEN 'CLOSED' ELSE 'PARTIAL_RECEIVED' END
      INTO v_po_status
      FROM public.purchase_order_details d WHERE d.purchase_order_id = v_po.id;
    UPDATE public.purchase_orders SET status = v_po_status WHERE id = v_po.id;

    -- JURNAL
    v_jperiod := to_char(COALESCE(v_rec.receiving_date, CURRENT_DATE), 'YYMM');
    BEGIN
        v_jseq := public.next_document_number(v_rec.entity_id, 'JR', v_jperiod);
    EXCEPTION WHEN OTHERS THEN v_jseq := 1; END;
    v_journal_no := 'JR-' || v_jperiod || '-' || lpad(v_jseq::text, 5, '0');

    INSERT INTO public.journals
        (tanggal, description, reference, entity_id, user_id, source_type, source_id, posting_key, posted_at, posted_by, fiscal_period_id)
    VALUES
        (COALESCE(v_rec.receiving_date, CURRENT_DATE), 'Receiving ' || v_rec.receiving_number, v_rec.receiving_number,
         v_rec.entity_id, p_custom_user_id, 'RECEIVING', p_receiving_record_id,
         'RCV-POST:' || p_receiving_record_id, now(), p_custom_user_id, NULL)
    RETURNING id INTO v_journal;

    INSERT INTO public.journal_details (journal_id, account_id, debit, credit, description)
    VALUES (v_journal, v_acc_persediaan, v_persediaan, 0, 'Persediaan diterima'),
           (v_journal, v_acc_ppn, v_tax, 0, 'PPN Masukan'),
           (v_journal, v_acc_hutang, 0, v_grand, 'Hutang Usaha');

    -- AP INVOICE
    v_period2 := to_char(COALESCE(v_rec.receiving_date, CURRENT_DATE), 'YYMM');
    BEGIN
        v_iseq := public.next_document_number(v_rec.entity_id, 'AP', v_period2);
    EXCEPTION WHEN OTHERS THEN v_iseq := 1; END;
    v_inv_no := 'AP-' || v_period2 || '-' || lpad(v_iseq::text, 5, '0');

    v_next_due := (COALESCE(v_rec.supplier_invoice_date, COALESCE(v_rec.receiving_date, CURRENT_DATE)))::date
                  + COALESCE(v_po.payment_term_days, 0);

    INSERT INTO public.ap_invoices
        (entity_id, invoice_no, vendor_id, po_id, tanggal, due_date, subtotal, tax, total,
         payment_terms, status, posting_key, journal_id)
    VALUES
        (v_rec.entity_id, v_inv_no, v_po.vendor_id, v_po.id,
         COALESCE(v_rec.supplier_invoice_date, COALESCE(v_rec.receiving_date, CURRENT_DATE)), v_next_due,
         v_persediaan, v_tax, v_grand, v_po.payment_term_days, 'OPEN',
         'RCV-AP:' || p_receiving_record_id, v_journal);

    -- MUTASI STOK
    IF v_rec.store_id IS NOT NULL THEN
        FOR r IN SELECT * FROM public.receiving_record_details WHERE receiving_id = p_receiving_record_id LOOP
            SELECT item_id INTO v_item_id FROM public.purchase_order_details WHERE id = r.purchase_order_detail_id;

            v_mperiod := to_char(CURRENT_DATE, 'YYMM');
            BEGIN
                v_mseq := public.next_document_number(v_rec.entity_id, 'STK', v_mperiod);
            EXCEPTION WHEN OTHERS THEN v_mseq := 1; END;

            INSERT INTO public.inventory_movements
                (entity_id, movement_no, tanggal, movement_type, item_id, qty, unit_cost, to_store_id,
                 reference_type, reference_id, status, created_by)
            VALUES
                (v_rec.entity_id, 'STK-' || v_mperiod || '-' || lpad(v_mseq::text, 5, '0'), CURRENT_DATE,
                 'RECEIPT', v_item_id, r.quantity_received, r.unit_cost, v_rec.store_id,
                 'RECEIVING', p_receiving_record_id, 'POSTED', p_custom_user_id);

            SELECT qty_on_hand, avg_cost INTO v_sum_qty, v_sum_val
            FROM public.item_store_stocks
            WHERE item_id = v_item_id AND store_id = v_rec.store_id;

            IF v_sum_qty IS NULL THEN
                INSERT INTO public.item_store_stocks (item_id, store_id, qty_on_hand, avg_cost)
                VALUES (v_item_id, v_rec.store_id, r.quantity_received, r.unit_cost);
            ELSE
                UPDATE public.item_store_stocks SET
                    qty_on_hand = qty_on_hand + r.quantity_received,
                    avg_cost = CASE WHEN qty_on_hand + r.quantity_received = 0 THEN avg_cost
                                    ELSE (qty_on_hand * avg_cost + r.quantity_received * r.unit_cost)
                                         / (qty_on_hand + r.quantity_received) END,
                    updated_at = now()
                WHERE item_id = v_item_id AND store_id = v_rec.store_id;
            END IF;
        END LOOP;
    END IF;

    UPDATE public.receiving_records
       SET status = 'POSTED', posted_at = now(), supplier_due_date = v_next_due
     WHERE id = p_receiving_record_id;

    RETURN jsonb_build_object('receiving_number', v_rec.receiving_number,
        'purchase_order_status', v_po_status,
        'ap_trade_amount', v_grand);
END $$;
