-- ============================================================
-- FASE 6h — NOMOR INSPEKSI OTOMATIS + PERMISSION GRANULAR
-- ============================================================
-- 1) Trigger: isi inspection_no otomatis (format INSP-YYMM-00001)
--    menggunakan next_document_number (atomik, anti-duplikat).
CREATE OR REPLACE FUNCTION public.set_inspection_no()
RETURNS trigger LANGUAGE plpgsql
AS $$
DECLARE
    v_period text := to_char(COALESCE(NEW.inspection_date, CURRENT_DATE), 'YYMM');
    v_seq    bigint;
    v_entity uuid;
BEGIN
    IF NEW.inspection_no IS NULL THEN
        v_entity := COALESCE(NEW.entity_id, '00000000-0000-0000-0000-000000000000');
        v_seq := public.next_document_number(v_entity, 'INSP', v_period);
        NEW.inspection_no := 'INSP-' || v_period || '-' || lpad(v_seq::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unit_inspections_set_no ON public.unit_inspections;
CREATE TRIGGER trg_unit_inspections_set_no
BEFORE INSERT ON public.unit_inspections
FOR EACH ROW EXECUTE FUNCTION public.set_inspection_no();

-- 2) Permission granular untuk Inspeksi (ditampilkan di halaman Role Akses/EditRole)
INSERT INTO public.permissions (code, name, module, description) VALUES
    ('inspeksi.view',   'Lihat Inspeksi',   'operasional', 'Melihat daftar inspeksi unit'),
    ('inspeksi.create', 'Buat Inspeksi',    'operasional', 'Membuat inspeksi baru'),
    ('inspeksi.edit',   'Edit Inspeksi',    'operasional', 'Mengubah inspeksi yang tersimpan'),
    ('inspeksi.delete', 'Hapus Inspeksi',   'operasional', 'Menghapus inspeksi tersimpan')
ON CONFLICT (code) DO NOTHING;

-- 3) Berikan semua permission inspeksi ke role & user Administrator
DO $$
DECLARE
    accs text[] := ARRAY['inspeksi.view','inspeksi.create','inspeksi.edit','inspeksi.delete'];
BEGIN
    UPDATE public.custom_roles SET access = access || accs
    WHERE name = 'Administrator' AND NOT (access @> accs);
    UPDATE public.custom_users SET access = access || accs
    WHERE role = 'Administrator' AND NOT (access @> accs);
END $$;

NOTIFY pgrst, 'reload schema';
