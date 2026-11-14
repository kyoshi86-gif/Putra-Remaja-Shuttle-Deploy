-- ============================================================
-- FASE 5a — ADAPTASI KOLOM ACCOUNT PAYABLE (frontend)
-- ------------------------------------------------------------
-- Additive & idempotent. Kolom docs tetap; kolom frontend ditambahkan
-- & di-backfill agar halaman & RPC dapat membaca.
-- ============================================================

-- ---------- ap_invoices ----------
ALTER TABLE public.ap_invoices ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE public.ap_invoices ADD COLUMN IF NOT EXISTS invoice_date date;
ALTER TABLE public.ap_invoices ADD COLUMN IF NOT EXISTS discount_amount numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.ap_invoices ADD COLUMN IF NOT EXISTS grand_total numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.ap_invoices ADD COLUMN IF NOT EXISTS paid_amount numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.ap_invoices ADD COLUMN IF NOT EXISTS remaining_amount numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.ap_invoices ADD COLUMN IF NOT EXISTS supplier_id uuid;
ALTER TABLE public.ap_invoices ADD COLUMN IF NOT EXISTS receiving_record_id uuid;
ALTER TABLE public.ap_invoices ADD COLUMN IF NOT EXISTS notes text;
UPDATE public.ap_invoices SET
    invoice_number = COALESCE(invoice_number, invoice_no),
    invoice_date = COALESCE(invoice_date, tanggal),
    supplier_id = COALESCE(supplier_id, vendor_id),
    grand_total = COALESCE(grand_total, total),
    remaining_amount = COALESCE(remaining_amount, COALESCE(total,0) - COALESCE(paid_amount,0))
WHERE invoice_number IS NULL OR invoice_date IS NULL;

-- ---------- ap_payment_requests ----------
ALTER TABLE public.ap_payment_requests ADD COLUMN IF NOT EXISTS payment_request_number text;
ALTER TABLE public.ap_payment_requests ADD COLUMN IF NOT EXISTS request_date date;
ALTER TABLE public.ap_payment_requests ADD COLUMN IF NOT EXISTS total_amount numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.ap_payment_requests ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.ap_payment_requests ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE public.ap_payment_requests ADD COLUMN IF NOT EXISTS cancelled_by text;
ALTER TABLE public.ap_payment_requests ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.ap_payment_requests ADD COLUMN IF NOT EXISTS cancel_reason text;
UPDATE public.ap_payment_requests SET
    payment_request_number = COALESCE(payment_request_number, request_no),
    request_date = COALESCE(request_date, tanggal),
    total_amount = COALESCE(total_amount, amount)
WHERE payment_request_number IS NULL OR request_date IS NULL;

-- ---------- ap_payment_request_items ----------
ALTER TABLE public.ap_payment_request_items ADD COLUMN IF NOT EXISTS payment_request_id uuid;
ALTER TABLE public.ap_payment_request_items ADD COLUMN IF NOT EXISTS requested_amount numeric(18,2);
ALTER TABLE public.ap_payment_request_items ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.ap_payment_request_items ADD COLUMN IF NOT EXISTS receiving_record_id uuid;
UPDATE public.ap_payment_request_items SET
    payment_request_id = COALESCE(payment_request_id, request_id),
    requested_amount = COALESCE(requested_amount, amount)
WHERE payment_request_id IS NULL OR requested_amount IS NULL;

-- ---------- ap_payments ----------
ALTER TABLE public.ap_payments ADD COLUMN IF NOT EXISTS payment_number text;
ALTER TABLE public.ap_payments ADD COLUMN IF NOT EXISTS payment_method_id uuid;
ALTER TABLE public.ap_payments ADD COLUMN IF NOT EXISTS reference_number text;
ALTER TABLE public.ap_payments ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.ap_payments ADD COLUMN IF NOT EXISTS payment_request_id uuid;
ALTER TABLE public.ap_payments ADD COLUMN IF NOT EXISTS supplier_id uuid;
UPDATE public.ap_payments SET payment_number = COALESCE(payment_number, payment_no) WHERE payment_number IS NULL;

-- ---------- supplier_deposits ----------
ALTER TABLE public.supplier_deposits ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE public.supplier_deposits ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.supplier_deposits ADD COLUMN IF NOT EXISTS original_amount numeric(18,2);
ALTER TABLE public.supplier_deposits ADD COLUMN IF NOT EXISTS allocated_amount numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE public.supplier_deposits ADD COLUMN IF NOT EXISTS deposit_date date;
UPDATE public.supplier_deposits SET
    original_amount = COALESCE(original_amount, amount),
    deposit_date = COALESCE(deposit_date, tanggal)
WHERE original_amount IS NULL OR deposit_date IS NULL;
