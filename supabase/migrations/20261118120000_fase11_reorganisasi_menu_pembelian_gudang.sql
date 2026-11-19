-- ============================================================
-- FASE 11 — REORGANISASI MENU: PEMBELIAN & GUDANG
-- ------------------------------------------------------------
-- Membuat dua grup root baru (dengan ikon) dan memindahkan
-- sub-menu ke grup yang sesuai:
--   • "Pembelian" (FaReceipt)  ← Buku Biaya
--   • "Gudang"    (FaWarehouse) ← Surat Jalan Barang, Stok per Entitas
--
-- String akses sub-menu DIpertahankan (tidak berubah), sehingga
-- tidak perlu mengubah custom_roles/custom_users.
-- ============================================================
DO $$
DECLARE
    v_pembelian uuid;
    v_gudang uuid;
BEGIN
    -- 1) Buat grup root baru bila belum ada
    SELECT id INTO v_pembelian FROM public.menus WHERE label='Pembelian' AND parent IS NULL;
    IF v_pembelian IS NULL THEN
        INSERT INTO public.menus (label, icon, "order", order_index, access)
        VALUES ('Pembelian', 'FaReceipt', 2, 2, 'Pembelian')
        RETURNING id INTO v_pembelian;
    END IF;

    SELECT id INTO v_gudang FROM public.menus WHERE label='Gudang' AND parent IS NULL;
    IF v_gudang IS NULL THEN
        INSERT INTO public.menus (label, icon, "order", order_index, access)
        VALUES ('Gudang', 'FaWarehouse', 3, 3, 'Gudang')
        RETURNING id INTO v_gudang;
    END IF;

    -- 2) Pindahkan Buku Biaya → Pembelian
    UPDATE public.menus SET parent = v_pembelian
    WHERE label = 'Buku Biaya' AND parent IS NOT NULL;

    -- 3) Pindahkan Surat Jalan Barang & Stok per Entitas → Gudang
    UPDATE public.menus SET parent = v_gudang
    WHERE label IN ('Surat Jalan Barang','Stok per Entitas') AND parent IS NOT NULL;
END $$;
