-- ============================================================
-- FASE 7a — PERMISSION GRANULAR PROCUREMENT (master + transaksi)
-- ============================================================
-- Semua tombol di modul Procurement dicek via hasAccess(code).
-- Kode yang dipakai frontend:
--   Master : units|stores|suppliers|item_categories|item_subcategories|
--            items|settlement_method . create|edit|delete|export
--   Transaksi: purchase_order.*, receiving.*, ap_invoice.*,
--            ap_payment.*, ap_payment_request.*, inventory_request.*,
--            storekeeper.*
-- ============================================================

INSERT INTO public.permissions (code, name, module, description) VALUES
  -- Master: Units
  ('units.create',        'Tambah Satuan',          'procurement', 'Menambah satuan baru'),
  ('units.edit',          'Edit Satuan',            'procurement', 'Mengubah satuan'),
  ('units.delete',        'Hapus Satuan',           'procurement', 'Menghapus satuan'),
  ('units.export',        'Export Satuan',          'procurement', 'Export daftar satuan ke Excel'),
  -- Master: Stores
  ('stores.create',       'Tambah Toko',            'procurement', 'Menambah toko baru'),
  ('stores.edit',         'Edit Toko',              'procurement', 'Mengubah toko'),
  ('stores.delete',       'Hapus Toko',             'procurement', 'Menghapus toko'),
  ('stores.export',       'Export Toko',            'procurement', 'Export daftar toko ke Excel'),
  -- Master: Suppliers
  ('suppliers.create',    'Tambah Supplier',        'procurement', 'Menambah supplier baru'),
  ('suppliers.edit',      'Edit Supplier',          'procurement', 'Mengubah supplier'),
  ('suppliers.delete',    'Hapus Supplier',         'procurement', 'Menghapus supplier'),
  ('suppliers.export',    'Export Supplier',        'procurement', 'Export daftar supplier ke Excel'),
  -- Master: Item Categories
  ('item_categories.create', 'Tambah Kategori',     'procurement', 'Menambah kategori artikel'),
  ('item_categories.edit',   'Edit Kategori',       'procurement', 'Mengubah kategori artikel'),
  ('item_categories.delete', 'Hapus Kategori',      'procurement', 'Menghapus kategori artikel'),
  ('item_categories.export', 'Export Kategori',     'procurement', 'Export daftar kategori ke Excel'),
  -- Master: Item Subcategories
  ('item_subcategories.create', 'Tambah Subkategori', 'procurement', 'Menambah subkategori artikel'),
  ('item_subcategories.edit',   'Edit Subkategori',   'procurement', 'Mengubah subkategori artikel'),
  ('item_subcategories.delete', 'Hapus Subkategori',  'procurement', 'Menghapus subkategori artikel'),
  ('item_subcategories.export', 'Export Subkategori', 'procurement', 'Export daftar subkategori ke Excel'),
  -- Master: Items
  ('items.create',        'Tambah Artikel',         'procurement', 'Menambah artikel barang'),
  ('items.edit',          'Edit Artikel',           'procurement', 'Mengubah artikel barang'),
  ('items.delete',        'Hapus Artikel',          'procurement', 'Menghapus artikel barang'),
  ('items.export',        'Export Artikel',         'procurement', 'Export daftar artikel ke Excel'),
  -- Master: Settlement Methods
  ('settlement_method.create', 'Tambah Metode Penyelesaian', 'procurement', 'Menambah metode penyelesaian'),
  ('settlement_method.edit',   'Edit Metode Penyelesaian',   'procurement', 'Mengubah metode penyelesaian'),
  ('settlement_method.delete', 'Hapus Metode Penyelesaian',  'procurement', 'Menghapus metode penyelesaian'),
  ('settlement_method.export', 'Export Metode Penyelesaian', 'procurement', 'Export daftar metode penyelesaian'),
  -- Transaksi: Purchase Orders
  ('purchase_order.create',            'Buat PO',               'procurement', 'Membuat purchase order baru'),
  ('purchase_order.edit_draft',        'Edit Draft PO',         'procurement', 'Mengubah draft purchase order'),
  ('purchase_order.delete_draft',      'Hapus Draft PO',        'procurement', 'Menghapus draft purchase order'),
  ('purchase_order.open',              'Buka PO',               'procurement', 'Membuka/mengaktifkan PO'),
  ('purchase_order.cancel',            'Batalkan PO',           'procurement', 'Membatalkan PO'),
  ('purchase_order.close_outstanding', 'Tutup Sisa PO',         'procurement', 'Menutup outstanding PO'),
  ('purchase_order.print',             'Cetak PO',              'procurement', 'Cetak purchase order'),
  ('purchase_order.export',            'Export PO',             'procurement', 'Export daftar PO ke Excel'),
  ('purchase_order.view_supplier',     'Lihat Info Supplier',   'procurement', 'Melihat kolom info supplier'),
  ('purchase_order.manage_supplier',   'Kelola Info Supplier',  'procurement', 'Mengelola info supplier di PO'),
  ('purchase_order.view_financial',    'Lihat Nilai Finansial', 'procurement', 'Melihat nilai finansial PO'),
  -- Transaksi: Receiving
  ('receiving.create',      'Buat Penerimaan',      'procurement', 'Membuat draft penerimaan barang'),
  ('receiving.edit_draft',  'Edit Draft Penerimaan','procurement', 'Mengubah draft penerimaan'),
  ('receiving.delete_draft','Hapus Draft Penerimaan','procurement','Menghapus draft penerimaan'),
  ('receiving.post',        'Posting Penerimaan',   'procurement', 'Memposting penerimaan ke stok'),
  ('receiving.print',       'Cetak Penerimaan',     'procurement', 'Cetak bukti penerimaan'),
  ('receiving.export',      'Export Penerimaan',    'procurement', 'Export daftar penerimaan ke Excel'),
  -- Transaksi: Supplier Invoice
  ('ap_invoice.export',               'Export Faktur Supplier',  'procurement', 'Export daftar faktur supplier'),
  -- Transaksi: Pengajuan Pembayaran
  ('ap_payment_request.create',  'Ajukan Pembayaran',   'procurement', 'Mengajukan pembayaran faktur'),
  ('ap_payment_request.detail',  'Detail Pengajuan',    'procurement', 'Melihat detail pengajuan pembayaran'),
  ('ap_payment_request.approve', 'Setujui Pengajuan',   'procurement', 'Menyetujui pengajuan pembayaran'),
  ('ap_payment_request.cancel',  'Batalkan Pengajuan',  'procurement', 'Membatalkan pengajuan pembayaran'),
  ('ap_payment_request.export',  'Export Pengajuan',    'procurement', 'Export daftar pengajuan ke Excel'),
  -- Transaksi: Pembayaran
  ('ap_payment.create',   'Proses Pembayaran',     'procurement', 'Memproses pembayaran ke supplier'),
  ('ap_payment.edit',     'Edit Pembayaran',       'procurement', 'Mengubah pembayaran'),
  ('ap_payment.delete',   'Hapus Pembayaran',      'procurement', 'Menghapus pembayaran'),
  ('ap_payment.export',   'Export Pembayaran',     'procurement', 'Export daftar pembayaran ke Excel'),
  -- Transaksi: Inventory Requests
  ('inventory_request.create',  'Buat Store Request',   'procurement', 'Membuat permintaan barang'),
  ('inventory_request.edit',    'Edit Permintaan',      'procurement', 'Mengubah draft permintaan'),
  ('inventory_request.delete',  'Hapus Permintaan',     'procurement', 'Menghapus draft permintaan'),
  ('inventory_request.submit',  'Kirim Permintaan',     'procurement', 'Mengajukan permintaan barang'),
  ('inventory_request.approve', 'Setujui Permintaan',   'procurement', 'Menyetujui permintaan barang'),
  ('inventory_request.transfer','Transfer Permintaan',  'procurement', 'Memproses transfer permintaan'),
  ('inventory_request.print',   'Cetak Permintaan',     'procurement', 'Cetak permintaan barang'),
  ('inventory_request.export',  'Export Permintaan',    'procurement', 'Export daftar permintaan ke Excel'),
  -- Transaksi: Storekeeper
  ('storekeeper.view',    'Lihat Storekeeper',     'procurement', 'Melihat dashboard storekeeper'),
  ('storekeeper.print',   'Cetak Stok',            'procurement', 'Cetak laporan stok'),
  ('storekeeper.export',  'Export Stok',           'procurement', 'Export laporan stok ke Excel')
ON CONFLICT (code) DO NOTHING;

-- Berikan semua permission procurement ke role & user Administrator
DO $$
DECLARE
    accs text[];
BEGIN
    SELECT array_agg(code) INTO accs FROM public.permissions WHERE module = 'procurement';

    UPDATE public.custom_roles SET access = access || accs
    WHERE name = 'Administrator'
      AND NOT (access @> accs);

    UPDATE public.custom_users SET access = access || accs
    WHERE role = 'Administrator'
      AND NOT (access @> accs);
END $$;

NOTIFY pgrst, 'reload schema';
