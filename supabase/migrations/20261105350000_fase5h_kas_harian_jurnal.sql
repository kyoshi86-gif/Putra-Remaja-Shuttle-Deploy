-- ============================================================
-- FASE 5h — OTOMATISASI KAS HARIAN -> JURNAL
-- ------------------------------------------------------------
-- Prinsip docs: posting idempotent, jurnal seimbang, reversal/delete.
-- Akun lawan via mapping kategori, fallback default.
-- ============================================================

-- ---------- tabel mapping kategori -> akun lawan ----------
CREATE TABLE IF NOT EXISTS public.kas_harian_akun_mapping (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kategori text NOT NULL,
    jenis_transaksi text NOT NULL,
    account_id uuid NOT NULL REFERENCES public.accounts(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_kas_mapping UNIQUE (kategori, jenis_transaksi)
);

-- seed mapping default
INSERT INTO public.kas_harian_akun_mapping (kategori, jenis_transaksi, account_id)
SELECT v.k, v.j, a.id
FROM (VALUES
    ('Kas Masuk',  'debet',  'R-400'),
    ('Kas Keluar', 'kredit', 'X-500'),
    ('Jaminan Driver', 'debet',  'R-401'),
    ('Jaminan Driver', 'kredit', 'X-500'),
    ('Piutang Driver', 'kredit', 'A-120')
) AS v(k, j, acc)
JOIN public.accounts a ON a.code = v.acc
ON CONFLICT (kategori, jenis_transaksi) DO NOTHING;

-- ---------- helper: hapus jurnal kas (utk delete/update) ----------
CREATE OR REPLACE FUNCTION public._delete_kas_journal(p_kas_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM public.journal_details jd
    USING public.journals j
    WHERE jd.journal_id = j.id
      AND j.source_type = 'KAS_HARIAN'
      AND j.source_id = p_kas_id::text;
    DELETE FROM public.journals
    WHERE source_type = 'KAS_HARIAN' AND source_id = p_kas_id::text;
END $$;

-- ---------- fungsi posting (idempotent) ----------
CREATE OR REPLACE FUNCTION public.post_kas_harian_journal(p_kas_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
    k record;
    v_acc_kas uuid;
    v_acc_lawan uuid;
    v_journal uuid;
    v_user uuid;
    v_cnt int := 0;
BEGIN
    SELECT id INTO v_acc_kas FROM public.accounts WHERE code = 'A-100';
    IF v_acc_kas IS NULL THEN RAISE EXCEPTION 'Akun Kas (A-100) tidak ditemukan'; END IF;

    FOR k IN
        SELECT k2.*
        FROM public.kas_harian k2
        WHERE (p_kas_id IS NULL OR k2.id = p_kas_id)
          AND COALESCE(k2.nominal, 0) > 0
          AND NOT EXISTS (
              SELECT 1 FROM public.journals j
              WHERE j.source_type = 'KAS_HARIAN' AND j.source_id = k2.id::text
          )
    LOOP
        v_acc_lawan := NULL;
        SELECT account_id INTO v_acc_lawan FROM public.kas_harian_akun_mapping
        WHERE kategori = k.kategori AND jenis_transaksi = k.jenis_transaksi;
        IF v_acc_lawan IS NULL THEN
            SELECT id INTO v_acc_lawan FROM public.accounts
            WHERE code = CASE WHEN k.jenis_transaksi = 'debet' THEN 'R-400' ELSE 'X-500' END;
        END IF;

        v_journal := gen_random_uuid();
        v_user := CASE
            WHEN k.user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN k.user_id::uuid ELSE NULL END;
        INSERT INTO public.journals
            (id, tanggal, description, reference, created_by, created_at, entity_id,
             source_type, source_id, posting_key, posted_at, posted_by)
        VALUES
            (v_journal, k.tanggal, COALESCE(k.keterangan, k.kategori), k.bukti_transaksi,
             v_user, now(), k.entity_id,
             'KAS_HARIAN', k.id::text, 'KAS:' || k.id::text, now(), v_user);

        IF k.jenis_transaksi = 'debet' THEN
            INSERT INTO public.journal_details (journal_id, account_id, debit, credit, description) VALUES
                (v_journal, v_acc_kas, k.nominal, 0, 'Kas'),
                (v_journal, v_acc_lawan, 0, k.nominal, COALESCE(k.kategori, ''));
        ELSE
            INSERT INTO public.journal_details (journal_id, account_id, debit, credit, description) VALUES
                (v_journal, v_acc_lawan, k.nominal, 0, COALESCE(k.kategori, '')),
                (v_journal, v_acc_kas, 0, k.nominal, 'Kas');
        END IF;
        v_cnt := v_cnt + 1;
    END LOOP;
    RETURN v_cnt;
END $$;

-- ---------- trigger ----------
CREATE OR REPLACE FUNCTION public.tg_kas_harian_post_journal()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.post_kas_harian_journal(NEW.id);
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_kas_harian_delete_journal()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public._delete_kas_journal(OLD.id);
    RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_kas_harian_post_journal ON public.kas_harian;
CREATE TRIGGER trg_kas_harian_post_journal
AFTER INSERT ON public.kas_harian
FOR EACH ROW EXECUTE FUNCTION public.tg_kas_harian_post_journal();

DROP TRIGGER IF EXISTS trg_kas_harian_delete_journal ON public.kas_harian;
CREATE TRIGGER trg_kas_harian_delete_journal
AFTER DELETE ON public.kas_harian
FOR EACH ROW EXECUTE FUNCTION public.tg_kas_harian_delete_journal();

-- ---------- backfill data lama ----------
SELECT 'BACKFILL' AS status, public.post_kas_harian_journal(NULL) AS jumlah_kas_diposting;
