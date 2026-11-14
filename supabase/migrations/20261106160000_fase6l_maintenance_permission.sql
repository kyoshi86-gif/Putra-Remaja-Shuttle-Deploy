-- ============================================================
-- FASE 6l — PERMISSION GRANULAR MAINTENANCE (Jadwal + Unit)
-- ============================================================
-- Permission untuk halaman Maintenance Unit (SPK) & Jadwal/Validasi
-- Ditampilkan di halaman Role Akses (EditRole) & dicek via hasAccess.
INSERT INTO public.permissions (code, name, module, description) VALUES
    ('maintenance.view',      'Lihat Maintenance',   'operasional', 'Melihat daftar SPK & jadwal maintenance'),
    ('maintenance.start',     'Mulai SPK',           'operasional', 'Mengubah status SPK menjadi Sedang Dikerjakan'),
    ('maintenance.edit',      'Edit SPK',            'operasional', 'Mengubah data SPK & spare part'),
    ('maintenance.finish',    'Selesai SPK',         'operasional', 'Menyelesaikan SPK (wajib odometer)'),
    ('maintenance.cancel',    'Batalkan SPK',        'operasional', 'Membatalkan SPK dengan alasan'),
    ('maintenance.validate',   'Validasi Maintenance', 'operasional', 'Mengesahkan hasil maintenance (jadwal)')
ON CONFLICT (code) DO NOTHING;

-- Berikan semua permission maintenance ke role & user Administrator
DO $$
DECLARE
    accs text[] := ARRAY['maintenance.view','maintenance.start','maintenance.edit','maintenance.finish','maintenance.cancel','maintenance.validate'];
BEGIN
    UPDATE public.custom_roles SET access = access || accs
    WHERE name = 'Administrator' AND NOT (access @> accs);
    UPDATE public.custom_users SET access = access || accs
    WHERE role = 'Administrator' AND NOT (access @> accs);
END $$;

NOTIFY pgrst, 'reload schema';
