-- ============================================================
-- FASE 4e — RECEIVING (DRAFT): ADAPTASI SKEMA + RPC
-- ------------------------------------------------------------
-- Additive & idempotent. Posting (stok+AP+jurnal) menyusul.
-- ============================================================

-- ---------- quantity_received di purchase_order_details ----------
ALTER TABLE public.purchase_order_details ADD COLUMN IF NOT EXISTS quantity_received numeric(18,2) NOT NULL DEFAULT 0;

-- ---------- ADAPTASI KOLOM receiving_records ----------
ALTER TABLE public.receiving_records ADD COLUMN IF NOT EXISTS receiving_number text;
ALTER TABLE public.receiving_records ADD COLUMN IF NOT EXISTS receiving_date date;
ALTER TABLE public.receiving_records ADD COLUMN IF NOT EXISTS posted_at timestamptz;
ALTER TABLE public.receiving_records ADD COLUMN IF NOT EXISTS purchase_order_number_snapshot text;
ALTER TABLE public.receiving_records ADD COLUMN IF NOT EXISTS supplier_name_snapshot text;
ALTER TABLE public.receiving_records ADD COLUMN IF NOT EXISTS store_name_snapshot text;
ALTER TABLE public.receiving_records ADD COLUMN IF NOT EXISTS supplier_invoice_number text;
ALTER TABLE public.receiving_records ADD COLUMN IF NOT EXISTS supplier_invoice_date date;
ALTER TABLE public.receiving_records ADD COLUMN IF NOT EXISTS supplier_due_date date;
ALTER TABLE public.receiving_records ADD COLUMN IF NOT EXISTS grand_total numeric(18,2) NOT NULL DEFAULT 0;
UPDATE public.receiving_records SET
    receiving_number = COALESCE(receiving_number, receiving_no),
    receiving_date = COALESCE(receiving_date, tanggal)
WHERE receiving_number IS NULL OR receiving_date IS NULL;

-- ---------- ADAPTASI KOLOM receiving_record_details ----------
ALTER TABLE public.receiving_record_details ADD COLUMN IF NOT EXISTS purchase_order_detail_id uuid;
ALTER TABLE public.receiving_record_details ADD COLUMN IF NOT EXISTS quantity_received numeric(18,2);
ALTER TABLE public.receiving_record_details ADD COLUMN IF NOT EXISTS unit_cost numeric(18,2);
ALTER TABLE public.receiving_record_details ADD COLUMN IF NOT EXISTS discount_amount numeric(18,2);
ALTER TABLE public.receiving_record_details ADD COLUMN IF NOT EXISTS tax_amount numeric(18,2);
ALTER TABLE public.receiving_record_details ADD COLUMN IF NOT EXISTS notes text;
UPDATE public.receiving_record_details SET
    quantity_received = COALESCE(quantity_received, qty_received)
WHERE quantity_received IS NULL;

-- ---------- TABEL SETTLEMENT RECEIVING ----------
CREATE TABLE IF NOT EXISTS public.receiving_record_settlements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receiving_record_id uuid NOT NULL REFERENCES public.receiving_records(id) ON DELETE CASCADE,
    settlement_method_id uuid NOT NULL REFERENCES public.purchase_settlement_methods(id),
    supplier_deposit_id uuid,
    amount numeric(18,2) NOT NULL DEFAULT 0,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_receiving_settlements_record
    ON public.receiving_record_settlements (receiving_record_id);

-- ---------- RPC: CREATE DRAFT ----------
CREATE OR REPLACE FUNCTION public.create_receiving_record_draft(
    p_entity_id uuid,
    p_receiving_date date,
    p_purchase_order_id uuid,
    p_store_id uuid,
    p_notes text,
    p_details jsonb,
    p_settlements jsonb,
    p_supplier_invoice_number text,
    p_supplier_invoice_date date
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_id uuid;
    v_number text;
    v_seq bigint;
    v_period text := to_char(COALESCE(p_receiving_date, CURRENT_DATE), 'YYMM');
    v_po_no text;
    v_supplier_name text;
    v_store_name text;
    v_total numeric := 0;
    d jsonb;
BEGIN
    IF p_details IS NULL OR jsonb_array_length(p_details) = 0 THEN
        RAISE EXCEPTION 'Detail receiving minimal satu baris';
    END IF;

    SELECT po_number, supplier_name_snapshot INTO v_po_no, v_supplier_name
    FROM public.purchase_orders WHERE id = p_purchase_order_id;
    IF v_po_no IS NULL THEN
        RAISE EXCEPTION 'Purchase Order tidak ditemukan';
    END IF;

    SELECT name INTO v_store_name FROM public.stores WHERE id = p_store_id;

    BEGIN
        v_seq := public.next_document_number(p_entity_id, 'RCV', v_period);
    EXCEPTION WHEN OTHERS THEN
        v_seq := (SELECT COALESCE(MAX(substr(receiving_number, length('RCV-'||v_period||'-')+1)::bigint),0)+1
                  FROM public.receiving_records WHERE receiving_number LIKE 'RCV-'||v_period||'-%');
    END;

    v_number := 'RCV-' || v_period || '-' || lpad(v_seq::text, 5, '0');

    INSERT INTO public.receiving_records
        (entity_id, receiving_no, receiving_number, receiving_date, po_id,
         store_id, notes, status, purchase_order_number_snapshot, supplier_name_snapshot,
         store_name_snapshot, supplier_invoice_number, supplier_invoice_date, grand_total)
    VALUES
        (p_entity_id, v_number, v_number, COALESCE(p_receiving_date, CURRENT_DATE), p_purchase_order_id,
         p_store_id, p_notes, 'DRAFT', v_po_no, v_supplier_name,
         v_store_name, p_supplier_invoice_number, p_supplier_invoice_date, 0)
    RETURNING id INTO v_id;

    FOR d IN SELECT * FROM jsonb_array_elements(p_details) LOOP
        v_total := v_total + (COALESCE((d->>'quantity_received')::numeric,0) * COALESCE((d->>'unit_cost')::numeric,0))
                   - COALESCE((d->>'discount_amount')::numeric,0)
                   + COALESCE((d->>'tax_amount')::numeric,0);
        INSERT INTO public.receiving_record_details
            (receiving_id, purchase_order_detail_id, quantity_received, qty_received,
             unit_cost, discount_amount, tax_amount, notes)
        VALUES
            (v_id, (d->>'purchase_order_detail_id')::uuid, (d->>'quantity_received')::numeric, (d->>'quantity_received')::numeric,
             (d->>'unit_cost')::numeric, (d->>'discount_amount')::numeric, (d->>'tax_amount')::numeric, (d->>'notes'));
    END LOOP;

    IF p_settlements IS NOT NULL AND jsonb_array_length(p_settlements) > 0 THEN
        FOR d IN SELECT * FROM jsonb_array_elements(p_settlements) LOOP
            INSERT INTO public.receiving_record_settlements
                (receiving_record_id, settlement_method_id, supplier_deposit_id, amount, notes)
            VALUES
                (v_id, (d->>'settlement_method_id')::uuid, (d->>'supplier_deposit_id')::uuid,
                 (d->>'amount')::numeric, (d->>'notes'));
        END LOOP;
    END IF;

    UPDATE public.receiving_records SET grand_total = v_total WHERE id = v_id;

    RETURN jsonb_build_object('success', true, 'receiving_record_id', v_id, 'receiving_number', v_number);
END $$;

-- ---------- RPC: UPDATE DRAFT ----------
CREATE OR REPLACE FUNCTION public.update_receiving_record_draft(
    p_receiving_record_id uuid,
    p_receiving_date date,
    p_store_id uuid,
    p_notes text,
    p_details jsonb,
    p_settlements jsonb,
    p_supplier_invoice_number text,
    p_supplier_invoice_date date
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_number text;
    v_store_name text;
    v_total numeric := 0;
    d jsonb;
BEGIN
    SELECT receiving_number INTO v_number FROM public.receiving_records
    WHERE id = p_receiving_record_id;
    IF v_number IS NULL THEN
        RAISE EXCEPTION 'Receiving tidak ditemukan';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.receiving_records WHERE id = p_receiving_record_id AND status = 'DRAFT') THEN
        RAISE EXCEPTION 'Hanya draft receiving yang dapat diubah';
    END IF;

    SELECT name INTO v_store_name FROM public.stores WHERE id = p_store_id;

    UPDATE public.receiving_records SET
        receiving_date = COALESCE(p_receiving_date, receiving_date),
        store_id = p_store_id,
        store_name_snapshot = v_store_name,
        notes = p_notes,
        supplier_invoice_number = p_supplier_invoice_number,
        supplier_invoice_date = p_supplier_invoice_date,
        grand_total = 0
    WHERE id = p_receiving_record_id;

    DELETE FROM public.receiving_record_details WHERE receiving_id = p_receiving_record_id;
    DELETE FROM public.receiving_record_settlements WHERE receiving_record_id = p_receiving_record_id;

    FOR d IN SELECT * FROM jsonb_array_elements(p_details) LOOP
        v_total := v_total + (COALESCE((d->>'quantity_received')::numeric,0) * COALESCE((d->>'unit_cost')::numeric,0))
                   - COALESCE((d->>'discount_amount')::numeric,0)
                   + COALESCE((d->>'tax_amount')::numeric,0);
        INSERT INTO public.receiving_record_details
            (receiving_id, purchase_order_detail_id, quantity_received, qty_received,
             unit_cost, discount_amount, tax_amount, notes)
        VALUES
            (p_receiving_record_id, (d->>'purchase_order_detail_id')::uuid, (d->>'quantity_received')::numeric, (d->>'quantity_received')::numeric,
             (d->>'unit_cost')::numeric, (d->>'discount_amount')::numeric, (d->>'tax_amount')::numeric, (d->>'notes'));
    END LOOP;

    IF p_settlements IS NOT NULL AND jsonb_array_length(p_settlements) > 0 THEN
        FOR d IN SELECT * FROM jsonb_array_elements(p_settlements) LOOP
            INSERT INTO public.receiving_record_settlements
                (receiving_record_id, settlement_method_id, supplier_deposit_id, amount, notes)
            VALUES
                (p_receiving_record_id, (d->>'settlement_method_id')::uuid, (d->>'supplier_deposit_id')::uuid,
                 (d->>'amount')::numeric, (d->>'notes'));
        END LOOP;
    END IF;

    UPDATE public.receiving_records SET grand_total = v_total WHERE id = p_receiving_record_id;

    RETURN jsonb_build_object('success', true, 'receiving_record_id', p_receiving_record_id, 'receiving_number', v_number);
END $$;

-- ---------- RPC: DELETE DRAFT ----------
CREATE OR REPLACE FUNCTION public.delete_receiving_record_draft(
    p_receiving_record_id uuid
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_number text;
BEGIN
    SELECT receiving_number INTO v_number FROM public.receiving_records
    WHERE id = p_receiving_record_id;
    IF v_number IS NULL THEN
        RAISE EXCEPTION 'Receiving tidak ditemukan';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.receiving_records WHERE id = p_receiving_record_id AND status = 'DRAFT') THEN
        RAISE EXCEPTION 'Hanya draft receiving yang dapat dihapus';
    END IF;
    DELETE FROM public.receiving_record_details WHERE receiving_id = p_receiving_record_id;
    DELETE FROM public.receiving_record_settlements WHERE receiving_record_id = p_receiving_record_id;
    DELETE FROM public.receiving_records WHERE id = p_receiving_record_id;
    RETURN jsonb_build_object('success', true, 'receiving_record_id', p_receiving_record_id, 'receiving_number', v_number);
END $$;
