-- ============================================================
-- FASE 1 — FONDASI AKUNTANSI (PRShuttle Back Office)
-- ------------------------------------------------------------
-- Sifat: ADDITIVE & idempotent. Tidak menghapus/mengubah perilaku
-- tabel yang sudah berjalan (kas_harian, dll).
-- Amannya diterapkan di ATAS skema existing (lokal == online).
-- ============================================================

-- ------------------------------------------------------------
-- 1) FISCAL PERIODS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiscal_periods (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   uuid REFERENCES public.entities(id),
    name        text NOT NULL,
    start_date  date NOT NULL,
    end_date    date NOT NULL,
    status      text NOT NULL DEFAULT 'OPEN',        -- OPEN | CLOSED
    closed_at   timestamptz,
    closed_by   text,
    created_at  timestamptz DEFAULT now(),
    created_by  text,
    UNIQUE (entity_id, start_date, end_date)
);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_entity
    ON public.fiscal_periods (entity_id);
COMMENT ON TABLE public.fiscal_periods IS
    'Periode akuntansi per entity. Jurnal hanya boleh diposting ke periode OPEN.';

-- ------------------------------------------------------------
-- 2) COA: tambah kolom pendukung
-- ------------------------------------------------------------
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS normal_balance text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_postable boolean NOT NULL DEFAULT true;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'GLOBAL';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS report_mapping text;
COMMENT ON COLUMN public.accounts.normal_balance IS 'DEBIT atau KREDIT';
COMMENT ON COLUMN public.accounts.scope IS 'GLOBAL (master bersama) atau ENTITY (per cabang)';

-- ------------------------------------------------------------
-- 3) JURNAL: tambah kolom source/posting/periode
-- ------------------------------------------------------------
ALTER TABLE public.journals ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE public.journals ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE public.journals ADD COLUMN IF NOT EXISTS posting_key text;
ALTER TABLE public.journals ADD COLUMN IF NOT EXISTS fiscal_period_id uuid;
ALTER TABLE public.journals ADD COLUMN IF NOT EXISTS posted_at timestamptz;
ALTER TABLE public.journals ADD COLUMN IF NOT EXISTS posted_by text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_journals_fiscal_period'
          AND conrelid = 'public.journals'::regclass
    ) THEN
        ALTER TABLE public.journals
            ADD CONSTRAINT fk_journals_fiscal_period
            FOREIGN KEY (fiscal_period_id) REFERENCES public.fiscal_periods(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_journals_fiscal_period
    ON public.journals (fiscal_period_id);
CREATE INDEX IF NOT EXISTS idx_journals_source
    ON public.journals (source_type, source_id);
-- cegah posting ganda pada jurnal yang sudah menset posting_key
CREATE UNIQUE INDEX IF NOT EXISTS uq_journals_posting_key
    ON public.journals (posting_key) WHERE posting_key IS NOT NULL;

-- ------------------------------------------------------------
-- 4) JOURNAL POSTING EVENTS (anti double-posting / idempotent)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journal_posting_events (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    posting_key text NOT NULL,
    source_type text NOT NULL,
    source_id   text NOT NULL,
    journal_id  uuid REFERENCES public.journals(id),
    entity_id   uuid REFERENCES public.entities(id),
    created_at  timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_posting_events_key
    ON public.journal_posting_events (posting_key);
CREATE INDEX IF NOT EXISTS idx_journal_posting_events_source
    ON public.journal_posting_events (source_type, source_id);

-- ------------------------------------------------------------
-- 5) DOCUMENT NUMBER COUNTERS + fungsi aman concurrency
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_number_counters (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id     uuid,
    doc_type      text NOT NULL,
    period_prefix text NOT NULL,          -- mis. '2026-11'
    last_sequence bigint NOT NULL DEFAULT 0,
    created_at    timestamptz DEFAULT now(),
    updated_at    timestamptz DEFAULT now(),
    UNIQUE (entity_id, doc_type, period_prefix)
);

-- Ambil nomor urut berikutnya secara ATOMIK (row lock via upsert).
-- Menggantikan pola `SELECT MAX(...) + 1` yang rawan duplikat.
CREATE OR REPLACE FUNCTION public.next_document_number(
    p_entity uuid,
    p_doc_type text,
    p_period text
) RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    -- sentinel untuk dokumen global (tanpa entity); pastikan non-NULL
    -- agar unique constraint mendeteksi konflik (NULL tidak pernah konflik).
    v_entity uuid := COALESCE(p_entity, '00000000-0000-0000-0000-000000000000');
    v_seq bigint;
BEGIN
    INSERT INTO public.document_number_counters
        (entity_id, doc_type, period_prefix, last_sequence)
    VALUES
        (v_entity, p_doc_type, p_period, 1)
    ON CONFLICT (entity_id, doc_type, period_prefix)
    DO UPDATE SET last_sequence = public.document_number_counters.last_sequence + 1,
                  updated_at = now()
    RETURNING last_sequence INTO v_seq;

    RETURN v_seq;
END;
$$;
COMMENT ON FUNCTION public.next_document_number IS
    'Ambil nomor dokumen berikutnya per entity/jenis/periode, atomik & aman concurrency.';

-- ------------------------------------------------------------
-- 6) FONDASI PERMISSION GRANULAR (additive, bukan pengganti sistem existing)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permissions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code        text NOT NULL UNIQUE,
    name        text,
    module      text,
    description text,
    created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id       text NOT NULL,
    permission_id uuid NOT NULL REFERENCES public.permissions(id),
    created_at    timestamptz DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_entities (
    user_id    text NOT NULL,
    entity_id  uuid NOT NULL REFERENCES public.entities(id),
    granted_at timestamptz DEFAULT now(),
    granted_by text,
    PRIMARY KEY (user_id, entity_id)
);

-- Seed permission standar (idempotent)
INSERT INTO public.permissions (code, name, module, description) VALUES
    ('accounting.coa.read',    'Baca COA',    'accounting', 'Melihat daftar akun'),
    ('accounting.journal.read','Baca Jurnal', 'accounting', 'Melihat jurnal & buku besar'),
    ('accounting.journal.post','Posting Jurnal','accounting','Memposting jurnal otomatis/manual'),
    ('accounting.period.close','Tutup Periode','accounting','Menutup fiscal period'),
    ('finance.cash.read',      'Baca Kas',    'finance',     'Melihat kas/bank'),
    ('finance.cash.create',    'Tulis Kas',   'finance',     'Mencatat kas masuk/keluar'),
    ('report.financial.read',  'Baca Laporan Keuangan','report','Melihat neraca/laba rugi/arus kas')
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- Catatan: RLS/permission granular penuh akan diaktifkan bertahap
-- setelah UI/backend disesuaikan (auth project ini kustom via Express).
-- Struktur di atas adalah fondasi datanya.
-- ------------------------------------------------------------
