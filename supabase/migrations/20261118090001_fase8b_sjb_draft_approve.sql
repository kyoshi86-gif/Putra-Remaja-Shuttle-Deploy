-- ============================================================
-- FASE 8B — ALUR DRAFT → APPROVED UNTUK SJB
-- ------------------------------------------------------------
-- Ubah alur: "Simpan" membuat SJB status DRAFT (belum sentuh
-- stok). Baru saat "Approved" stok asal dikurangi & movement
-- OUT tercatat. Edit/hapus hanya boleh saat DRAFT.
-- Additive & idempotent. Tak mengubah RPC lama (post_sjb_kirim
-- tetap ada untuk kompatibilitas).
-- ============================================================

-- ============================================================
-- 1) RPC BUAT DRAFT — simpan header+items status DRAFT
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_sjb_draft(
    p_entity_asal uuid,
    p_entity_tujuan uuid,
    p_tanggal date,
    p_lines jsonb,
    p_catatan text DEFAULT '',
    p_user_id text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    it jsonb;
    v_sjb uuid;
    v_no text;
    v_seq bigint;
    v_period text;
    v_qty numeric;
    v_id uuid;
    v_item record;
BEGIN
    -- ---------- Validasi dasar ----------
    IF p_entity_asal IS NULL OR p_entity_tujuan IS NULL THEN
        RAISE EXCEPTION 'Entitas asal dan tujuan wajib diisi';
    END IF;
    IF p_entity_asal = p_entity_tujuan THEN
        RAISE EXCEPTION 'Entitas asal dan tujuan tidak boleh sama';
    END IF;
    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'Tidak ada item pada surat jalan barang';
    END IF;

    -- ---------- Generate nomor dokumen ----------
    v_period := to_char(COALESCE(p_tanggal, CURRENT_DATE), 'YYMM');
    BEGIN
        v_seq := public.next_document_number(p_entity_asal, 'SJB', v_period);
    EXCEPTION WHEN OTHERS THEN v_seq := 1;
    END;
    v_no := 'SJB-' || v_period || '-' || lpad(v_seq::text, 5, '0');

    -- ---------- Simpan header (status DRAFT) ----------
    INSERT INTO public.surat_jalan_barang
        (nomor, entity_asal, entity_tujuan, tanggal, status, catatan, created_by, created_at, updated_at)
    VALUES
        (v_no, p_entity_asal, p_entity_tujuan, COALESCE(p_tanggal, CURRENT_DATE),
         'DRAFT', p_catatan, p_user_id, now(), now())
    RETURNING id INTO v_sjb;

    -- ---------- Proses tiap item (tanpa sentuh stok) ----------
    FOR it IN SELECT value FROM jsonb_array_elements(p_lines) AS t(value) LOOP
        v_qty := (it->>'qty')::numeric;
        v_id := (it->>'item_id')::uuid;
        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'Kuantitas harus > 0';
        END IF;
        SELECT * INTO v_item FROM public.items WHERE id = v_id;
        IF v_item IS NULL THEN
            RAISE EXCEPTION 'Item tidak ditemukan';
        END IF;
        INSERT INTO public.surat_jalan_barang_items
            (sjb_id, item_id, qty_kirim, avg_cost, created_at)
        VALUES
            (v_sjb, v_id, v_qty, 0, now());
    END LOOP;

    RETURN jsonb_build_object('success', true, 'id', v_sjb, 'nomor', v_no);
END $$;

-- ============================================================
-- 2) RPC APPROVED — konversi DRAFT → DIKIRIM + kurangi stok asal
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_sjb_approve(
    p_sjb_id uuid,
    p_user_id text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_sjb record;
    v_line record;
    v_stock record;
    v_cost numeric;
    v_cnt int := 0;
BEGIN
    SELECT * INTO v_sjb FROM public.surat_jalan_barang WHERE id = p_sjb_id;
    IF v_sjb IS NULL THEN
        RAISE EXCEPTION 'Surat jalan barang tidak ditemukan';
    END IF;
    IF v_sjb.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Hanya surat jalan status DRAFT yang dapat diapprove';
    END IF;

    FOR v_line IN
        SELECT * FROM public.surat_jalan_barang_items
        WHERE sjb_id = p_sjb_id ORDER BY created_at
    LOOP
        -- Cek stok asal
        SELECT * INTO v_stock
        FROM public.item_entity_stocks
        WHERE item_id = v_line.item_id AND entity_id = v_sjb.entity_asal;
        IF v_stock IS NULL OR COALESCE(v_stock.qty_on_hand, 0) < v_line.qty_kirim THEN
            RAISE EXCEPTION 'Stok entitas asal tidak mencukupi untuk item tsb';
        END IF;
        v_cost := COALESCE(v_stock.avg_cost, 0);

        -- Kurangi stok asal
        UPDATE public.item_entity_stocks
        SET qty_on_hand = qty_on_hand - v_line.qty_kirim, updated_at = now()
        WHERE id = v_stock.id;

        -- Catat movement OUT
        INSERT INTO public.inventory_movements
            (entity_id, movement_no, movement_date, movement_type, item_id,
             quantity_in, quantity_out, quantity_before, quantity_after,
             average_cost_before, average_cost_after,
             from_entity_id, to_entity_id,
             reference, description, reference_type, status,
             created_by, created_at)
        VALUES
            (v_sjb.entity_asal, v_sjb.nomor, v_sjb.tanggal, 'TRANSFER_ENTITY', v_line.item_id,
             0, v_line.qty_kirim, v_stock.qty_on_hand, v_stock.qty_on_hand - v_line.qty_kirim,
             v_cost, v_cost,
             v_sjb.entity_asal, v_sjb.entity_tujuan,
             v_sjb.nomor, v_sjb.catatan, 'SURAT_JALAN_BARANG', 'POSTED',
             p_user_id, now());

        -- Isi avg_cost pada detail
        UPDATE public.surat_jalan_barang_items
        SET avg_cost = v_cost
        WHERE id = v_line.id;

        v_cnt := v_cnt + 1;
    END LOOP;

    -- Tandai DIKIRIM
    UPDATE public.surat_jalan_barang
    SET status = 'DIKIRIM', updated_at = now()
    WHERE id = p_sjb_id;

    RETURN jsonb_build_object('success', true, 'id', p_sjb_id, 'nomor', v_sjb.nomor, 'items', v_cnt);
END $$;

-- ============================================================
-- 3) RPC HAPUS — hanya status DRAFT (cascade hapus items)
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_sjb_hapus(
    p_sjb_id uuid
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_sjb record;
BEGIN
    SELECT * INTO v_sjb FROM public.surat_jalan_barang WHERE id = p_sjb_id;
    IF v_sjb IS NULL THEN
        RAISE EXCEPTION 'Surat jalan barang tidak ditemukan';
    END IF;
    IF v_sjb.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Hanya surat jalan status DRAFT yang dapat dihapus';
    END IF;
    DELETE FROM public.surat_jalan_barang WHERE id = p_sjb_id;
    RETURN jsonb_build_object('success', true);
END $$;

-- ============================================================
-- 4) RPC EDIT — hanya status DRAFT (replace items + header)
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_sjb_edit(
    p_sjb_id uuid,
    p_entity_tujuan uuid,
    p_tanggal date,
    p_lines jsonb,
    p_catatan text DEFAULT '',
    p_user_id text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    it jsonb;
    v_sjb record;
    v_qty numeric;
    v_id uuid;
BEGIN
    SELECT * INTO v_sjb FROM public.surat_jalan_barang WHERE id = p_sjb_id;
    IF v_sjb IS NULL THEN
        RAISE EXCEPTION 'Surat jalan barang tidak ditemukan';
    END IF;
    IF v_sjb.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Hanya surat jalan status DRAFT yang dapat diedit';
    END IF;
    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'Tidak ada item pada surat jalan barang';
    END IF;

    -- Update header
    UPDATE public.surat_jalan_barang
    SET entity_tujuan = p_entity_tujuan,
        tanggal = COALESCE(p_tanggal, tanggal),
        catatan = p_catatan,
        updated_at = now()
    WHERE id = p_sjb_id;

    -- Replace items
    DELETE FROM public.surat_jalan_barang_items WHERE sjb_id = p_sjb_id;

    FOR it IN SELECT value FROM jsonb_array_elements(p_lines) AS t(value) LOOP
        v_qty := (it->>'qty')::numeric;
        v_id := (it->>'item_id')::uuid;
        IF v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'Kuantitas harus > 0';
        END IF;
        INSERT INTO public.surat_jalan_barang_items
            (sjb_id, item_id, qty_kirim, avg_cost, created_at)
        VALUES
            (p_sjb_id, v_id, v_qty, 0, now());
    END LOOP;

    RETURN jsonb_build_object('success', true, 'id', p_sjb_id, 'nomor', v_sjb.nomor);
END $$;
