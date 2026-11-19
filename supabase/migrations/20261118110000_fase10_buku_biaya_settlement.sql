-- ============================================================
-- FASE 10 — BUKU BIAYA: METODE PEMBAYARAN (CASH / TRANSFER)
-- ------------------------------------------------------------
-- 1) kas_harian.skip_journal → entri yang dibuat dari Buku Biaya
--    tidak memicu jurnal ganda (jurnal sudah dibuat RPC).
-- 2) biaya_langsung.settlement_id → simpan metode pembayaran.
-- 3) post_biaya_langsung: p_settlement_id. Kredit ke akun
--    settlement method. Jika metode = CASH → selain jurnal,
--    buat baris kas_harian (muncul di halaman Kas Harian).
-- ============================================================

-- ---------- 1. kas_harian.skip_journal ----------
ALTER TABLE public.kas_harian
    ADD COLUMN IF NOT EXISTS skip_journal boolean NOT NULL DEFAULT false;

DROP TRIGGER IF EXISTS trg_kas_harian_post_journal ON public.kas_harian;

CREATE OR REPLACE FUNCTION public.tg_kas_harian_post_journal()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF COALESCE(NEW.skip_journal, false) THEN
        RETURN NEW;
    END IF;
    PERFORM public.post_kas_harian_journal(NEW.id);
    RETURN NEW;
END $$;

CREATE TRIGGER trg_kas_harian_post_journal
AFTER INSERT ON public.kas_harian
FOR EACH ROW EXECUTE FUNCTION public.tg_kas_harian_post_journal();

-- ---------- 2. biaya_langsung.settlement_id ----------
ALTER TABLE public.biaya_langsung
    ADD COLUMN IF NOT EXISTS settlement_id uuid
        REFERENCES public.purchase_settlement_methods(id) ON DELETE SET NULL;

-- ---------- 3. RPC posting biaya langsung + settlement ----------
CREATE OR REPLACE FUNCTION public.post_biaya_langsung(
    p_entity_id uuid,
    p_tanggal  date,
    p_lines     jsonb,
    p_description text DEFAULT '',
    p_kas_account_id uuid DEFAULT NULL,
    p_user_id   text DEFAULT '',
    p_settlement_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    it          jsonb;
    v_id        uuid;
    v_qty       numeric;
    v_price     numeric;
    v_acc       uuid;
    v_item      record;
    v_line_total numeric;
    v_total     numeric := 0;
    v_nomor     text;
    v_period    text;
    v_seq       bigint;
    v_biaya     uuid;
    v_kas       uuid;
    v_nama_item text;
    v_journal   uuid;
    v_sett      record;
    v_is_cash   boolean;
BEGIN
    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'Minimal satu baris barang wajib diisi.';
    END IF;

    -- Resolve akun lawan (kredit): dari settlement method aktif, atau fallback Kas.
    IF p_settlement_id IS NOT NULL THEN
        SELECT * INTO v_sett
        FROM public.purchase_settlement_methods
        WHERE id = p_settlement_id AND is_active;
        IF v_sett IS NULL THEN
            RAISE EXCEPTION 'Metode pembayaran tidak ditemukan / tidak aktif.';
        END IF;
        v_kas := COALESCE(v_sett.account_id, p_kas_account_id);
        v_is_cash := lower(COALESCE(v_sett.code, v_sett.kode)) = 'cash';
    ELSE
        v_is_cash := true;
        IF p_kas_account_id IS NULL THEN
            SELECT id INTO v_kas FROM public.accounts
            WHERE code = 'A-100' AND is_active LIMIT 1;
            IF v_kas IS NULL THEN
                RAISE EXCEPTION 'Akun Kas (A-100) belum tersedia.';
            END IF;
        ELSE
            v_kas := p_kas_account_id;
        END IF;
    END IF;

    IF v_kas IS NULL THEN
        RAISE EXCEPTION 'Akun lawan (Kas/Bank) belum tersedia.';
    END IF;

    -- Generate nomor dokumen
    v_period := to_char(COALESCE(p_tanggal, CURRENT_DATE), 'YYMM');
    BEGIN
        v_seq := public.next_document_number(
            COALESCE(p_entity_id, '00000000-0000-0000-0000-000000000000'),
            'BYA', v_period);
    EXCEPTION WHEN OTHERS THEN
        v_seq := 1;
    END;
    v_nomor := 'BYA-' || v_period || '-' || lpad(v_seq::text, 5, '0');

    INSERT INTO public.biaya_langsung
        (nomor, tanggal, entity_id, description, total, created_by, settlement_id)
    VALUES
        (v_nomor, COALESCE(p_tanggal, CURRENT_DATE), p_entity_id,
         NULLIF(p_description, ''), 0, p_user_id, p_settlement_id)
    RETURNING id INTO v_biaya;

    FOR it IN SELECT value FROM jsonb_array_elements(p_lines) AS t(value) LOOP
        v_id     := (it->>'item_id')::uuid;
        v_qty    := COALESCE((it->>'qty')::numeric, 1);
        v_price   := (it->>'price')::numeric;
        v_acc     := (it->>'account_id')::uuid;
        v_line_total := round(v_qty * v_price, 2);

        IF v_id IS NULL THEN
            RAISE EXCEPTION 'Barang wajib dipilih.';
        END IF;
        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'Jumlah barang harus lebih dari nol.';
        END IF;
        IF v_price IS NULL OR v_price < 0 THEN
            RAISE EXCEPTION 'Harga tidak boleh negatif.';
        END IF;
        IF v_line_total <= 0 THEN
            RAISE EXCEPTION 'Total nominal harus lebih dari nol.';
        END IF;
        IF v_acc IS NULL THEN
            RAISE EXCEPTION 'Akun biaya wajib dipilih.';
        END IF;

        SELECT * INTO v_item FROM public.items WHERE id = v_id AND is_active;
        IF v_item IS NULL THEN
            RAISE EXCEPTION 'Barang tidak ditemukan atau tidak aktif.';
        END IF;

        INSERT INTO public.biaya_langsung_items
            (biaya_id, item_id, item_code, item_name, qty, price, account_id, line_total)
        VALUES
            (v_biaya, v_id, v_item.code, v_item.nama, v_qty, v_price, v_acc, v_line_total);

        v_nama_item := v_nama_item || CASE WHEN v_nama_item IS NULL THEN '' ELSE ', ' END
                        || v_item.nama || ' x' || v_qty::text;

        v_total := v_total + v_line_total;
    END LOOP;

    UPDATE public.biaya_langsung SET total = v_total, updated_at = now()
    WHERE id = v_biaya;

    -- ===== Posting jurnal (balance): Debit akun biaya → Kredit Kas/Bank =====
    INSERT INTO public.journals
        (tanggal, waktu, description, reference, entity_id, user_id,
         source_type, source_id, created_at, updated_at)
    VALUES
        (COALESCE(p_tanggal, CURRENT_DATE), now(),
         'Biaya Langsung: ' || v_nama_item, v_nomor, p_entity_id, p_user_id,
         'biaya_langsung', v_biaya::text, now(), now())
    RETURNING id INTO v_journal;

    INSERT INTO public.journal_details (journal_id, account_id, debit, credit, description)
    SELECT v_journal, b.account_id, b.line_total, 0,
           b.item_name || ' x' || b.qty::text
    FROM public.biaya_langsung_items b
    WHERE b.biaya_id = v_biaya;

    INSERT INTO public.journal_details (journal_id, account_id, debit, credit, description)
    VALUES (v_journal, v_kas, 0, v_total, 'Biaya Langsung ' || v_nomor);

    -- ===== Bila CASH: buat baris kas_harian (muncul di Kas Harian) =====
    IF v_is_cash THEN
        INSERT INTO public.kas_harian
            (tanggal, bukti_transaksi, keterangan, kategori, jenis_transaksi, nominal,
             metode_pembayaran, user_id, catatan, entity_id, waktu, skip_journal, sumber_tabel)
        VALUES
            (COALESCE(p_tanggal, CURRENT_DATE), v_nomor, NULLIF(p_description, ''),
             'Kas Keluar', 'kredit', v_total,
             'CASH', NULLIF(p_user_id, ''), 'Biaya Langsung ' || v_nomor,
             p_entity_id, to_char(now(), 'HH24:MI'), true, 'biaya_langsung');
    END IF;

    RETURN jsonb_build_object(
        'success', true, 'id', v_biaya, 'nomor', v_nomor, 'total', v_total);
END $$;
