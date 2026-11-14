-- ============================================================
-- FASE 6a — OPERASIONAL SHUTTLE: INSPEKSI UNIT + MAINTENANCE (SPK)
-- ============================================================
-- Additive & idempotent. Sesuai docs 06 (Operasional Shuttle) & alur user:
--   unit datang -> inspeksi (depan/belakang/kiri/kanan + tindakan)
--   -> SPK maintenance oleh mekanik -> spare part -> supervisi (jadwal, waktu, validasi)

-- ------------------------------------------------------------------
-- 1) Tabel unit_inspections (inspeksi saat unit datang)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.unit_inspections (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id     uuid REFERENCES public.entities(id) ON DELETE CASCADE,
    inspection_no text,                                -- nomor auto (diisi RPC)
    unit_id       bigint NOT NULL REFERENCES public.armada(id),
    inspection_date date,
    officer       text,                                -- petugas inspeksi
    -- catatan teks per bagian kendaraan (ilustrasi Hiace)
    front_note    text,
    rear_note     text,
    left_note     text,
    right_note    text,
    action_required text DEFAULT 'TIDAK',               -- PERBAIKAN / TIDAK
    notes         text,
    status        text DEFAULT 'OPEN',                   -- OPEN / DONE
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    created_by    text,
    updated_by    text
);

-- ------------------------------------------------------------------
-- 2) Tabel maintenance_records (SPK maintenance unit)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.maintenance_records (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id     uuid REFERENCES public.entities(id) ON DELETE CASCADE,
    spk_no        text,                                -- nomor SPK auto
    unit_id       bigint NOT NULL REFERENCES public.armada(id),
    inspection_id uuid REFERENCES public.unit_inspections(id) ON DELETE SET NULL,
    work_type     text DEFAULT 'corrective',            -- preventive/corrective/berkala/pajak
    mechanic      text,                                -- mekanik
    work_date     date,
    odometer      numeric,
    vendor        text,                                -- bengkel/vendor
    schedule_date date,                                -- jadwal maintenance berikutnya
    start_time    time,
    end_time      time,
    status        text DEFAULT 'OPEN',                   -- OPEN / IN_PROGRESS / DONE
    supervised_by text,                                -- supervisi (who validated)
    supervised_at timestamptz,
    validated     boolean DEFAULT false,                -- validasi selesai oleh supervisi
    notes         text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    created_by    text,
    updated_by    text
);

-- ------------------------------------------------------------------
-- 3) Tabel maintenance_spareparts (spare part / perbaikan)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.maintenance_spareparts (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_record_id uuid NOT NULL REFERENCES public.maintenance_records(id) ON DELETE CASCADE,
    part_name          text NOT NULL,
    quantity           numeric DEFAULT 1,
    unit_cost          numeric DEFAULT 0,
    total              numeric DEFAULT 0,
    created_at         timestamptz NOT NULL DEFAULT now()
);

-- index & unik helper
CREATE INDEX IF NOT EXISTS idx_maint_spk_unit ON public.maintenance_records(unit_id);
CREATE INDEX IF NOT EXISTS idx_maint_spk_ins ON public.maintenance_records(inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspeksi_unit ON public.unit_inspections(unit_id);

-- ============================================================
-- SEED MENU: grup "Operasional" + akses Administrator
-- ============================================================
DO $$
DECLARE v_group uuid;
BEGIN
    SELECT id INTO v_group FROM public.menus WHERE label = 'Operasional' AND parent IS NULL LIMIT 1;

    -- buat grup kalau belum ada
    IF v_group IS NULL THEN
        INSERT INTO public.menus (id, label, path, component, access, parent, order_index)
        VALUES (gen_random_uuid(), 'Operasional', NULL, NULL, NULL, NULL, 100)
        RETURNING id INTO v_group;
    END IF;

    IF v_group IS NOT NULL THEN
        INSERT INTO public.menus (id, label, path, component, access, parent, order_index)
        SELECT gen_random_uuid(), v.label, v.path, v.component, v.access, v_group, v.ord
        FROM (VALUES
            ('Inspeksi Unit',   '/inspeksi-unit',   'operasional/inspeksi/InspeksiUnitPage',   'Operasional -> Inspeksi Unit',   1),
            ('Maintenance (SPK)', '/maintenance',    'operasional/maintenance/MaintenancePage', 'Operasional -> Maintenance (SPK)', 2),
            ('Jadwal Maintenance', '/jadwal-maintenance', 'operasional/maintenance/JadwalMaintenancePage', 'Operasional -> Jadwal Maintenance', 3)
        ) AS v(label, path, component, access, ord)
        WHERE NOT EXISTS (
            SELECT 1 FROM public.menus m WHERE m.parent = v_group AND m.label = v.label
        );
    END IF;
END $$;

DO $$
DECLARE accs text[] := ARRAY[
    'Operasional -> Inspeksi Unit',
    'Operasional -> Maintenance (SPK)',
    'Operasional -> Jadwal Maintenance'
];
BEGIN
    UPDATE public.custom_roles SET access = access || accs
    WHERE name = 'Administrator' AND NOT (access @> accs);
    UPDATE public.custom_users SET access = access || accs
    WHERE role = 'Administrator' AND NOT (access @> accs);
END $$;
