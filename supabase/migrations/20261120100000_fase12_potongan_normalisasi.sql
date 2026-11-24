-- ============================================================
-- FASE 12 — NORMALISASI POTONGAN PER JENIS (premi_driver_potongan)
-- ------------------------------------------------------------
-- Tujuan:
--   • Mendukung JENIS POTONGAN DINAMIS apa pun (dari tabel
--     jenis_potongan), mis. "Piutang Hp" kategori jaminan.
--   • Menyimpan detail potongan per-jenis di tabel terpisah,
--     sehingga tidak tercampur dalam kolom agregat.
--   • Backfill data lama dari kolom agregat premi_driver
--     (sumber kebenaran ringkasan) + kas_harian utk jenis yang
--     tidak punya kolom (mis. Klaim BBM / Klaim Etoll), agar
--     data lama tetap muncul di Driver Ledger.
-- ============================================================

-- 1) Tabel detail potongan per-jenis
CREATE TABLE IF NOT EXISTS public.premi_driver_potongan (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    premi_driver_id    integer NOT NULL REFERENCES public.premi_driver(id) ON DELETE CASCADE,
    jenis_potongan_id  uuid REFERENCES public.jenis_potongan(id) ON DELETE SET NULL,
    nama               text NOT NULL,
    kategori           text,
    nominal            numeric NOT NULL DEFAULT 0,
    entity_id          uuid REFERENCES public.entities(id),
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_premi_potongan_premi ON public.premi_driver_potongan (premi_driver_id);
CREATE INDEX IF NOT EXISTS idx_premi_potongan_jenis ON public.premi_driver_potongan (jenis_potongan_id);
CREATE INDEX IF NOT EXISTS idx_premi_potongan_entity ON public.premi_driver_potongan (entity_id);

-- 2) Backfill data lama
DO $$
DECLARE
    v_jaminan uuid;
    v_piutang uuid;
    v_klaim_laka uuid;
    v_bbm uuid;
    v_etoll uuid;
BEGIN
    -- Ambil id jenis potongan standar
    SELECT id INTO v_jaminan FROM public.jenis_potongan WHERE nama = 'Jaminan Driver' LIMIT 1;
    SELECT id INTO v_piutang FROM public.jenis_potongan WHERE nama = 'Piutang Driver' LIMIT 1;
    SELECT id INTO v_klaim_laka FROM public.jenis_potongan WHERE nama = 'Klaim Laka' LIMIT 1;
    SELECT id INTO v_bbm FROM public.jenis_potongan WHERE nama = 'Klaim BBM' LIMIT 1;
    SELECT id INTO v_etoll FROM public.jenis_potongan WHERE nama = 'Klaim Etoll' LIMIT 1;

    -- 2a) Dari kolom agregat premi_driver (sumber kebenaran ringkasan)
    IF v_jaminan IS NOT NULL THEN
        INSERT INTO public.premi_driver_potongan
            (premi_driver_id, jenis_potongan_id, nama, kategori, nominal, entity_id, created_at)
        SELECT p.id, v_jaminan, j.nama, j.kategori, p.potongan_jaminan, p.entity_id, p.created_at
        FROM public.premi_driver p
        JOIN public.jenis_potongan j ON j.id = v_jaminan
        WHERE p.potongan_jaminan IS NOT NULL AND p.potongan_jaminan <> 0;
    END IF;

    IF v_piutang IS NOT NULL THEN
        INSERT INTO public.premi_driver_potongan
            (premi_driver_id, jenis_potongan_id, nama, kategori, nominal, entity_id, created_at)
        SELECT p.id, v_piutang, j.nama, j.kategori, p.potongan_piutang, p.entity_id, p.created_at
        FROM public.premi_driver p
        JOIN public.jenis_potongan j ON j.id = v_piutang
        WHERE p.potongan_piutang IS NOT NULL AND p.potongan_piutang <> 0;
    END IF;

    IF v_klaim_laka IS NOT NULL THEN
        INSERT INTO public.premi_driver_potongan
            (premi_driver_id, jenis_potongan_id, nama, kategori, nominal, entity_id, created_at)
        SELECT p.id, v_klaim_laka, j.nama, j.kategori, p.potongan_klaim_laka, p.entity_id, p.created_at
        FROM public.premi_driver p
        JOIN public.jenis_potongan j ON j.id = v_klaim_laka
        WHERE p.potongan_klaim_laka IS NOT NULL AND p.potongan_klaim_laka <> 0;
    END IF;

    -- 2b) Jenis tanpa kolom agregat (Klaim BBM / Klaim Etoll) dari kas_harian
    IF v_bbm IS NOT NULL THEN
        INSERT INTO public.premi_driver_potongan
            (premi_driver_id, jenis_potongan_id, nama, kategori, nominal, entity_id, created_at)
        SELECT DISTINCT ON (k.sumber_id) k.sumber_id, v_bbm, j.nama, j.kategori, k.nominal, k.entity_id, k.created_at
        FROM public.kas_harian k
        JOIN public.jenis_potongan j ON j.id = v_bbm
        WHERE k.sumber_tabel = 'potongan'
          AND lower(k.keterangan) LIKE '%bbm%'
          AND k.nominal IS NOT NULL AND k.nominal <> 0
        ORDER BY k.sumber_id;
    END IF;

    IF v_etoll IS NOT NULL THEN
        INSERT INTO public.premi_driver_potongan
            (premi_driver_id, jenis_potongan_id, nama, kategori, nominal, entity_id, created_at)
        SELECT DISTINCT ON (k.sumber_id) k.sumber_id, v_etoll, j.nama, j.kategori, k.nominal, k.entity_id, k.created_at
        FROM public.kas_harian k
        JOIN public.jenis_potongan j ON j.id = v_etoll
        WHERE k.sumber_tabel = 'potongan'
          AND lower(k.keterangan) LIKE '%etoll%'
          AND k.nominal IS NOT NULL AND k.nominal <> 0
        ORDER BY k.sumber_id;
    END IF;
END $$;
