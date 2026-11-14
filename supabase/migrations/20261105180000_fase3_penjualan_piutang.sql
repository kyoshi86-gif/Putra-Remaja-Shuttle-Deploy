-- ============================================================
-- FASE 3 — PENJUALAN & PIUTANG (fondasi DB)
-- ------------------------------------------------------------
-- Sifat: ADDITIVE & idempotent. Sesuai 03-penjualan-booking.md.
-- Catatan penting:
--  * Kursi anti double-book via UNIQUE (trip_id, seat_no).
--  * Pembayaran anti double-posting via UNIQUE posting_key.
--  * Refund TERPISAH dari credit note; keduanya wajib merujuk asal.
--  * Jurnal otomatis disambungkan kemudian (posting_key tersedia).
-- ============================================================

-- ------------------------------------------------------------
-- 1) BOOKINGS (header)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id      uuid REFERENCES public.entities(id),
    booking_no     text,
    booking_date   timestamptz DEFAULT now(),
    booking_source  text NOT NULL DEFAULT 'WALK_IN',
    external_ref   text,
    trip_id        uuid REFERENCES public.trips(id),
    customer_name  text NOT NULL,
    customer_phone text,
    customer_email  text,
    total_fare     numeric(18,2) NOT NULL DEFAULT 0,
    discount       numeric(18,2) NOT NULL DEFAULT 0,
    tax            numeric(18,2) NOT NULL DEFAULT 0,
    other_charges  numeric(18,2) NOT NULL DEFAULT 0,
    total_amount   numeric(18,2) NOT NULL DEFAULT 0,
    payment_method text,
    payment_status text NOT NULL DEFAULT 'UNPAID',
    status         text NOT NULL DEFAULT 'DRAFT',
    notes          text,
    created_by     text,
    created_at     timestamptz DEFAULT now(),
    updated_by     text,
    updated_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bookings_entity ON public.bookings (entity_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip   ON public.bookings (trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status  ON public.bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_no      ON public.bookings (booking_no);

-- ------------------------------------------------------------
-- 2) BOOKING PASSENGERS (detail; anti double-book kursi per trip)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_passengers (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id    uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    trip_id       uuid REFERENCES public.trips(id),   -- di-denormalisasi utk constraint kursi
    passenger_name text NOT NULL,
    seat_no       text,
    fare          numeric(18,2) NOT NULL DEFAULT 0,
    class         text,
    boarding_status text NOT NULL DEFAULT 'NOT_CHECKED_IN',
    special_notes text
);
CREATE INDEX IF NOT EXISTS idx_booking_passengers_booking ON public.booking_passengers (booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_passengers_trip   ON public.booking_passengers (trip_id);
-- Satu kursi satu penumpang per trip (mencegah jual ganda)
CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_passengers_trip_seat
    ON public.booking_passengers (trip_id, seat_no)
    WHERE seat_no IS NOT NULL;

-- ------------------------------------------------------------
-- 3) PAYMENTS (pembayaran booking/invoice; anti double-posting)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id    uuid REFERENCES public.entities(id),
    payment_no   text,
    payment_date timestamptz DEFAULT now(),
    payment_method text NOT NULL,
    amount       numeric(18,2) NOT NULL DEFAULT 0,
    reference    text,
    source_type  text NOT NULL,      -- BOOKING | INVOICE
    source_id    uuid NOT NULL,
    posting_key  text UNIQUE,
    journal_id   uuid REFERENCES public.journals(id),
    status       text NOT NULL DEFAULT 'PAID',
    created_by   text,
    created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_entity ON public.payments (entity_id);
CREATE INDEX IF NOT EXISTS idx_payments_source ON public.payments (source_type, source_id);

-- ------------------------------------------------------------
-- 4) INVOICES CORPORATE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id    uuid REFERENCES public.entities(id),
    invoice_no   text,
    invoice_date date NOT NULL,
    due_date     date,
    customer_name text NOT NULL,
    customer_phone text,
    subtotal     numeric(18,2) NOT NULL DEFAULT 0,
    tax          numeric(18,2) NOT NULL DEFAULT 0,
    total        numeric(18,2) NOT NULL DEFAULT 0,
    status       text NOT NULL DEFAULT 'DRAFT',  -- DRAFT|ISSUED|PARTIAL_PAID|PAID|VOID
    notes        text,
    created_by   text,
    created_at   timestamptz DEFAULT now(),
    updated_by   text,
    updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_entity  ON public.invoices (entity_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status   ON public.invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_no       ON public.invoices (invoice_no);

-- ------------------------------------------------------------
-- 5) INVOICE LINES (rincian trip)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_lines (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id  uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    trip_id     uuid REFERENCES public.trips(id),
    description text,
    amount      numeric(18,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON public.invoice_lines (invoice_id);

-- ------------------------------------------------------------
-- 6) INVOICE PAYMENT ALLOCATIONS (alokasi parsial)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_payment_allocations (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    payment_id uuid NOT NULL REFERENCES public.payments(id),
    amount     numeric(18,2) NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE (invoice_id, payment_id)
);
CREATE INDEX IF NOT EXISTS idx_allocations_invoice ON public.invoice_payment_allocations (invoice_id);

-- ------------------------------------------------------------
-- 7) CREDIT NOTES (koreksi tagihan — BUKAN refund)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_notes (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id      uuid REFERENCES public.entities(id),
    credit_note_no text,
    invoice_id     uuid REFERENCES public.invoices(id),
    booking_id     uuid REFERENCES public.bookings(id),
    reason         text,
    amount         numeric(18,2) NOT NULL DEFAULT 0,
    status         text NOT NULL DEFAULT 'DRAFT',
    approved_by    text,
    approved_at    timestamptz,
    created_by     text,
    created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice  ON public.credit_notes (invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_entity   ON public.credit_notes (entity_id);

-- ------------------------------------------------------------
-- 8) REFUNDS (pengembalian dana — TERPISAH dari credit note)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refunds (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   uuid REFERENCES public.entities(id),
    refund_no   text,
    payment_id  uuid REFERENCES public.payments(id),   -- pembayaran asal
    booking_id  uuid REFERENCES public.bookings(id),
    amount      numeric(18,2) NOT NULL DEFAULT 0,
    reason      text,
    status      text NOT NULL DEFAULT 'PENDING',       -- PENDING|APPROVED|PROCESSED|REJECTED
    approved_by text,
    approved_at timestamptz,
    posting_key text UNIQUE,
    journal_id  uuid REFERENCES public.journals(id),
    created_by  text,
    created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON public.refunds (payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_entity  ON public.refunds (entity_id);
