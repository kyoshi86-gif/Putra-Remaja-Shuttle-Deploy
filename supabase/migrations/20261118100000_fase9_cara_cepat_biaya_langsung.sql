-- ============================================================
-- FASE 9 — CARA CEPAT INPUT BIAYA LANGSUNG (TANPA PO)
-- ------------------------------------------------------------
-- User pilih barang + harga + akun biaya, simpan → posting jurnal
-- (Debit akun biaya, Kredit Kas) + tersimpan di tabel khusus agar
-- bisa ditracking: barang apa yang jadi biaya, jumlah, harga terakhir.
-- ============================================================

-- ---------- Header biaya langsung ----------
CREATE TABLE IF NOT EXISTS public.biaya_langsung (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor       text NOT NULL,
    tanggal     date NOT NULL,
    entity_id   uuid REFERENCES public.entities(id),
    description text,
    total       numeric(18,2) NOT NULL DEFAULT 0,
    status      text NOT NULL DEFAULT 'POSTED',
    created_by  text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biaya_langsung_tanggal
    ON public.biaya_langsung (tanggal);
CREATE INDEX IF NOT EXISTS idx_biaya_langsung_nomor
    ON public.biaya_langsung (nomor);

-- ---------- Detail biaya langsung (untuk tracking barang) ----------
CREATE TABLE IF NOT EXISTS public.biaya_langsung_items (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    biaya_id     uuid NOT NULL REFERENCES public.biaya_langsung(id) ON DELETE CASCADE,
    item_id      uuid NOT NULL REFERENCES public.items(id),
    item_code    text,
    item_name    text,
    qty         numeric(18,2) NOT NULL DEFAULT 1,
    price       numeric(18,2) NOT NULL DEFAULT 0,
    account_id   uuid NOT NULL REFERENCES public.accounts(id),
    line_total   numeric(18,2) NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biaya_langsung_items_biaya
    ON public.biaya_langsung_items (biaya_id);

-- ---------- RPC: posting biaya langsung ----------
CREATE OR REPLACE FUNCTION public.post_biaya_langsung(
    p_entity_id uuid,
    p_tanggal  date,
    p_lines     jsonb,
    p_description text DEFAULT '',
    p_kas_account_id uuid DEFAULT NULL,
    p_user_id   text DEFAULT ''
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
BEGIN
    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'Minimal satu baris barang wajib diisi.';
    END IF;

    -- Default akun lawan (kredit) = Kas (A-100)
    IF p_kas_account_id IS NULL THEN
        SELECT id INTO v_kas FROM public.accounts WHERE code = 'A-100' AND is_active LIMIT 1;
        IF v_kas IS NULL THEN
            RAISE EXCEPTION 'Akun Kas (A-100) belum tersedia.';
        END IF;
    ELSE
        v_kas := p_kas_account_id;
    END IF;

    -- Generate nomor dokumen
    v_period := to_char(COALESCE(p_tanggal, CURRENT_DATE), 'YYMM');
    BEGIN
        v_seq := public.next_document_number(COALESCE(p_entity_id, '00000000-0000-0000-0000-000000000000'), 'BYA', v_period);
    EXCEPTION WHEN OTHERS THEN
        v_seq := 1;
    END;
    v_nomor := 'BYA-' || v_period || '-' || lpad(v_seq::text, 5, '0');

    INSERT INTO public.biaya_langsung (nomor, tanggal, entity_id, description, total, created_by)
    VALUES (v_nomor, COALESCE(p_tanggal, CURRENT_DATE), p_entity_id, NULLIF(p_description, ''), 0, p_user_id)
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

        -- kumpulkan label barang utk keterangan jurnal
        v_nama_item := v_nama_item || CASE WHEN v_nama_item IS NULL THEN '' ELSE ', ' END
                        || v_item.nama || ' x' || v_qty::text;

        v_total := v_total + v_line_total;
    END LOOP;

    -- Update total header
    UPDATE public.biaya_langsung SET total = v_total, updated_at = now() WHERE id = v_biaya;

    -- ===== Posting jurnal (balance): Debit akun biaya per baris → Kredit Kas =====
    INSERT INTO public.journals
        (tanggal, waktu, description, reference, entity_id, user_id, source_type, source_id, created_at, updated_at)
    VALUES
        (COALESCE(p_tanggal, CURRENT_DATE), now(),
         'Biaya Langsung: ' || v_nama_item, v_nomor, p_entity_id, p_user_id,
         'biaya_langsung', v_biaya::text, now(), now())
    RETURNING id INTO v_journal;

    -- Debit per baris (akun biaya)
    INSERT INTO public.journal_details (journal_id, account_id, debit, credit, description)
    SELECT v_journal, b.account_id, b.line_total, 0,
           b.item_name || ' x' || b.qty::text
    FROM public.biaya_langsung_items b
    WHERE b.biaya_id = v_biaya;

    -- Kredit Kas (total)
    INSERT INTO public.journal_details (journal_id, account_id, debit, credit, description)
    VALUES (v_journal, v_kas, 0, v_total, 'Biaya Langsung ' || v_nomor);

    RETURN jsonb_build_object('success', true, 'id', v_biaya, 'nomor', v_nomor, 'total', v_total);
END $$;
