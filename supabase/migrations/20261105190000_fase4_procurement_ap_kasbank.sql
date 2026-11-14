-- ============================================================
-- FASE 4 — PROCUREMENT, AP & KAS-BANK (fondasi DB)
-- ------------------------------------------------------------
-- Sifat: ADDITIVE & idempotent. Sesuai 04-pembelian-procurement.md
-- dan 05-kas-bank-keuangan.md.
-- Proteksi kunci:
--   * Invoice vendor anti-ganda: UNIQUE(vendor_id, invoice_no, entity_id)
--   * Pembayaran/transfer/kas/refund anti double-posting: posting_key UNIQUE
--   * Receiving tidak boleh melebihi sisa PO (dijaga di app + FK)
-- ============================================================

-- ============ MASTER PROCUREMENT ============

CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    kode text,
    nama text NOT NULL,
    npwp text,
    kontak text,
    alamat text,
    telepon text,
    email text,
    payment_terms text,
    status text NOT NULL DEFAULT 'AKTIF',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_entity ON public.suppliers (entity_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON public.suppliers (status);

CREATE TABLE IF NOT EXISTS public.units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kode text UNIQUE,
    nama text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.item_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kode text UNIQUE,
    nama text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'AKTIF'
);

CREATE TABLE IF NOT EXISTS public.item_subcategories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid REFERENCES public.item_categories(id),
    kode text,
    nama text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_item_subcategories_cat ON public.item_subcategories (category_id);

CREATE TABLE IF NOT EXISTS public.items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    kode text,
    nama text NOT NULL,
    category_id uuid REFERENCES public.item_categories(id),
    subcategory_id uuid REFERENCES public.item_subcategories(id),
    unit_id uuid REFERENCES public.units(id),
    jenis text NOT NULL DEFAULT 'BARANG',   -- BARANG | JASA
    valuation_method text,                   -- FIFO | MOVING_AVERAGE
    min_stock numeric DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_items_entity ON public.items (entity_id);
CREATE INDEX IF NOT EXISTS idx_items_category ON public.items (category_id);

CREATE TABLE IF NOT EXISTS public.stores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    kode text,
    nama text NOT NULL,
    alamat text
);
CREATE INDEX IF NOT EXISTS idx_stores_entity ON public.stores (entity_id);

-- ============ PURCHASE REQUEST ============

CREATE TABLE IF NOT EXISTS public.purchase_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    pr_no text,
    tanggal date,
    requested_by text,
    department text,
    required_date date,
    cost_center text,
    reason text,
    lampiran text,
    status text NOT NULL DEFAULT 'DRAFT',  -- DRAFT|SUBMITTED|APPROVED|REJECTED|CANCELLED
    created_by text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pr_entity ON public.purchase_requests (entity_id);
CREATE INDEX IF NOT EXISTS idx_pr_status ON public.purchase_requests (status);

CREATE TABLE IF NOT EXISTS public.purchase_request_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_id uuid NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
    item_id uuid REFERENCES public.items(id),
    quantity numeric NOT NULL DEFAULT 0,
    unit_id uuid REFERENCES public.units(id),
    estimated_price numeric(18,2) NOT NULL DEFAULT 0,
    line_total numeric(18,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pr_items_pr ON public.purchase_request_items (pr_id);

-- ============ PURCHASE ORDER ============

CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    po_no text,
    vendor_id uuid REFERENCES public.suppliers(id),
    tanggal date,
    expected_date date,
    reference_pr_id uuid REFERENCES public.purchase_requests(id),
    ship_to_store_id uuid REFERENCES public.stores(id),
    payment_terms text,
    revision integer NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'DRAFT',  -- DRAFT|SUBMITTED|APPROVED|SENT|PARTIALLY_RECEIVED|RECEIVED|CLOSED|CANCELLED
    created_by text,
    created_at timestamptz DEFAULT now(),
    approved_by text,
    approved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_po_entity ON public.purchase_orders (entity_id);
CREATE INDEX IF NOT EXISTS idx_po_vendor ON public.purchase_orders (vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.purchase_orders (status);

CREATE TABLE IF NOT EXISTS public.purchase_order_details (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    item_id uuid REFERENCES public.items(id),
    quantity numeric NOT NULL DEFAULT 0,
    unit_price numeric(18,2) NOT NULL DEFAULT 0,
    discount numeric(18,2) NOT NULL DEFAULT 0,
    tax numeric(18,2) NOT NULL DEFAULT 0,
    line_total numeric(18,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_po_details_po ON public.purchase_order_details (po_id);

CREATE TABLE IF NOT EXISTS public.purchase_settlement_methods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kode text UNIQUE,
    nama text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'AKTIF'
);

-- ============ RECEIVING ============

CREATE TABLE IF NOT EXISTS public.receiving_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    receiving_no text,
    po_id uuid REFERENCES public.purchase_orders(id),
    tanggal date,
    store_id uuid REFERENCES public.stores(id),
    received_by text,
    notes text,
    reversal_ref text,          -- menuuk dokumen reversal bila reopen/cancel
    status text NOT NULL DEFAULT 'RECEIVED',  -- RECEIVED|VOID|REVERSED
    created_by text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_receiving_po ON public.receiving_records (po_id);
CREATE INDEX IF NOT EXISTS idx_receiving_entity ON public.receiving_records (entity_id);

CREATE TABLE IF NOT EXISTS public.receiving_record_details (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receiving_id uuid NOT NULL REFERENCES public.receiving_records(id) ON DELETE CASCADE,
    po_detail_id uuid REFERENCES public.purchase_order_details(id),
    item_id uuid REFERENCES public.items(id),
    qty_received numeric NOT NULL DEFAULT 0,
    kondisi text,
    lot_no text,
    serial_no text,
    lokasi text
);
CREATE INDEX IF NOT EXISTS idx_receiving_details_recv ON public.receiving_record_details (receiving_id);
CREATE INDEX IF NOT EXISTS idx_receiving_details_item ON public.receiving_record_details (item_id);

CREATE TABLE IF NOT EXISTS public.supplier_deposits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    supplier_id uuid REFERENCES public.suppliers(id),
    tanggal date,
    amount numeric(18,2) NOT NULL DEFAULT 0,
    method text,
    reason text,
    status text NOT NULL DEFAULT 'OPEN',
    created_by text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_deposits_sup ON public.supplier_deposits (supplier_id);

-- ============ KAS-BANK (master rekening) ============

CREATE TABLE IF NOT EXISTS public.cash_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    kode text,
    nama text NOT NULL,
    jenis text NOT NULL DEFAULT 'CASH',  -- CASH | BANK | PETTY_CASH
    mata_uang text NOT NULL DEFAULT 'IDR',
    nomor_rekening text,
    opening_balance numeric(18,2) NOT NULL DEFAULT 0,
    effective_date date,
    status text NOT NULL DEFAULT 'AKTIF'
);
CREATE INDEX IF NOT EXISTS idx_cash_accounts_entity ON public.cash_accounts (entity_id);
CREATE INDEX IF NOT EXISTS idx_cash_accounts_jenis ON public.cash_accounts (jenis);

-- ============ ACCOUNT PAYABLE ============

CREATE TABLE IF NOT EXISTS public.ap_invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    invoice_no text NOT NULL,
    vendor_id uuid NOT NULL REFERENCES public.suppliers(id),
    po_id uuid REFERENCES public.purchase_orders(id),
    tanggal date,
    due_date date,
    subtotal numeric(18,2) NOT NULL DEFAULT 0,
    tax numeric(18,2) NOT NULL DEFAULT 0,
    total numeric(18,2) NOT NULL DEFAULT 0,
    payment_terms text,
    status text NOT NULL DEFAULT 'OPEN',  -- OPEN|PARTIAL|PAID|VOID|DISPUTED
    posting_key text UNIQUE,
    journal_id uuid REFERENCES public.journals(id),
    created_by text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_entity ON public.ap_invoices (entity_id);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_vendor ON public.ap_invoices (vendor_id);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_status ON public.ap_invoices (status);
-- cegah invoice vendor ganda (entity NULL diperlakukan sebagai global)
DROP INDEX IF EXISTS uq_ap_invoices_vendor_no;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ap_invoices_vendor_no
    ON public.ap_invoices (vendor_id, invoice_no, COALESCE(entity_id::text, '__GLOBAL__'));

CREATE TABLE IF NOT EXISTS public.ap_invoice_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ap_invoice_id uuid NOT NULL REFERENCES public.ap_invoices(id) ON DELETE CASCADE,
    item_id uuid REFERENCES public.items(id),
    quantity numeric NOT NULL DEFAULT 0,
    unit_price numeric(18,2) NOT NULL DEFAULT 0,
    po_detail_id uuid REFERENCES public.purchase_order_details(id),
    receiving_detail_id uuid REFERENCES public.receiving_record_details(id),
    amount numeric(18,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ap_invoice_lines_inv ON public.ap_invoice_lines (ap_invoice_id);

CREATE TABLE IF NOT EXISTS public.ap_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    payment_no text,
    payment_date date,
    source_account_id uuid REFERENCES public.cash_accounts(id),
    method text,
    amount numeric(18,2) NOT NULL DEFAULT 0,
    vendor_id uuid REFERENCES public.suppliers(id),
    status text NOT NULL DEFAULT 'PAID',
    posting_key text UNIQUE,
    journal_id uuid REFERENCES public.journals(id),
    created_by text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ap_payments_entity ON public.ap_payments (entity_id);
CREATE INDEX IF NOT EXISTS idx_ap_payments_vendor ON public.ap_payments (vendor_id);

CREATE TABLE IF NOT EXISTS public.ap_payment_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ap_payment_id uuid NOT NULL REFERENCES public.ap_payments(id) ON DELETE CASCADE,
    ap_invoice_id uuid NOT NULL REFERENCES public.ap_invoices(id),
    amount numeric(18,2) NOT NULL DEFAULT 0,
    UNIQUE (ap_payment_id, ap_invoice_id)
);
CREATE INDEX IF NOT EXISTS idx_ap_alloc_invoice ON public.ap_payment_allocations (ap_invoice_id);

CREATE TABLE IF NOT EXISTS public.ap_payment_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    request_no text,
    vendor_id uuid REFERENCES public.suppliers(id),
    tanggal date,
    amount numeric(18,2) NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'DRAFT',  -- DRAFT|SUBMITTED|APPROVED|REJECTED|PAID|CANCELLED
    requested_by text,
    approved_by text,
    approved_at timestamptz,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ap_req_entity ON public.ap_payment_requests (entity_id);
CREATE INDEX IF NOT EXISTS idx_ap_req_vendor ON public.ap_payment_requests (vendor_id);

CREATE TABLE IF NOT EXISTS public.ap_payment_request_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL REFERENCES public.ap_payment_requests(id) ON DELETE CASCADE,
    ap_invoice_id uuid REFERENCES public.ap_invoices(id),
    amount numeric(18,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ap_req_items_req ON public.ap_payment_request_items (request_id);

CREATE TABLE IF NOT EXISTS public.debit_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    debit_note_no text,
    ap_invoice_id uuid REFERENCES public.ap_invoices(id),
    po_id uuid REFERENCES public.purchase_orders(id),
    receiving_id uuid REFERENCES public.receiving_records(id),
    reason text,
    amount numeric(18,2) NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'DRAFT',
    posting_key text UNIQUE,
    journal_id uuid REFERENCES public.journals(id),
    created_by text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_debit_notes_invoice ON public.debit_notes (ap_invoice_id);

-- ============ KAS-BANK (transaksi) ============

CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    account_id uuid NOT NULL REFERENCES public.cash_accounts(id),
    tanggal date,
    trans_type text NOT NULL,          -- IN | OUT
    amount numeric(18,2) NOT NULL DEFAULT 0,
    description text,
    source_type text,
    source_id uuid,
    posting_key text UNIQUE,
    journal_id uuid REFERENCES public.journals(id),
    created_by text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cash_tx_account ON public.cash_transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_cash_tx_entity ON public.cash_transactions (entity_id);

CREATE TABLE IF NOT EXISTS public.cash_transfers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    from_account_id uuid NOT NULL REFERENCES public.cash_accounts(id),
    to_account_id uuid NOT NULL REFERENCES public.cash_accounts(id),
    tanggal date,
    amount numeric(18,2) NOT NULL DEFAULT 0,
    reference text,
    status text NOT NULL DEFAULT 'PROCESSED',
    posting_key text UNIQUE,
    journal_id uuid REFERENCES public.journals(id),
    created_by text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cash_transfers_entity ON public.cash_transfers (entity_id);
CREATE INDEX IF NOT EXISTS idx_cash_transfers_from ON public.cash_transfers (from_account_id);
CREATE INDEX IF NOT EXISTS idx_cash_transfers_to ON public.cash_transfers (to_account_id);

CREATE TABLE IF NOT EXISTS public.bank_statement_imports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid REFERENCES public.cash_accounts(id),
    file_name text,
    import_date date,
    imported_by text,
    status text NOT NULL DEFAULT 'UPLOADED'
);

CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id uuid REFERENCES public.bank_statement_imports(id),
    statement_date date,
    description text,
    debit numeric(18,2) NOT NULL DEFAULT 0,
    credit numeric(18,2) NOT NULL DEFAULT 0,
    reference text,
    status text NOT NULL DEFAULT 'UNMATCHED',  -- UNMATCHED|MATCHED|EXCLUDED
    exclusion_reason text
);
CREATE INDEX IF NOT EXISTS idx_bank_stmt_lines_import ON public.bank_statement_lines (import_id);

CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid REFERENCES public.entities(id),
    account_id uuid REFERENCES public.cash_accounts(id),
    period_start date,
    period_end date,
    closing_balance numeric(18,2),
    status text NOT NULL DEFAULT 'OPEN',  -- OPEN|LOCKED
    opened_by text,
    locked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_bank_rec_entity ON public.bank_reconciliations (entity_id);
CREATE INDEX IF NOT EXISTS idx_bank_rec_account ON public.bank_reconciliations (account_id);

CREATE TABLE IF NOT EXISTS public.bank_reconciliation_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_id uuid NOT NULL REFERENCES public.bank_reconciliations(id) ON DELETE CASCADE,
    statement_line_id uuid REFERENCES public.bank_statement_lines(id),
    cash_transaction_id uuid REFERENCES public.cash_transactions(id),
    method text NOT NULL DEFAULT 'MANUAL',  -- AUTO | MANUAL
    matched_by text,
    matched_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_match_rec ON public.bank_reconciliation_matches (reconciliation_id);
