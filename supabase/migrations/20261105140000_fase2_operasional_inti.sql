-- ============================================================
-- FASE 2 — OPERASIONAL SHUTLE INTI (PRShuttle Back Office)
-- ------------------------------------------------------------
-- Sifat: ADDITIVE & idempotent. Tidak menghapus/mengubah perilaku
-- tabel yang sudah berjalan. Reuse driver/armada/rute existing.
-- ============================================================

-- ------------------------------------------------------------
-- 1) ARMODA: tambah kolom status (aktif/maintenance/cadangan)
-- ------------------------------------------------------------
ALTER TABLE public.armada ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'AKTIF';
CREATE INDEX IF NOT EXISTS idx_armada_status ON public.armada (status);
COMMENT ON COLUMN public.armada.status IS 'AKTIF | MAINTENANCE | CADANGAN | NONAKTIF';

-- ------------------------------------------------------------
-- 2) Fungsi validasi eligibilitas driver & armada
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.driver_is_eligible(p_driver_id bigint)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
    SELECT (d.status = 'AKTIF')
       AND (d.sim_expired IS NULL OR d.sim_expired >= CURRENT_DATE)
    FROM public.driver d
    WHERE d.id = p_driver_id;
$$;
COMMENT ON FUNCTION public.driver_is_eligible IS
    'Driver eligible bila status AKTIF dan SIM masih berlaku.';

CREATE OR REPLACE FUNCTION public.vehicle_is_eligible(p_vehicle_id bigint)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
    SELECT COALESCE(v.status, 'AKTIF') IN ('AKTIF', 'CADANGAN')
    FROM public.armada v
    WHERE v.id = p_vehicle_id;
$$;
COMMENT ON FUNCTION public.vehicle_is_eligible IS
    'Armada eligible bila status AKTIF/CADANGAN (bukan maintenance/nonaktif).';

-- ------------------------------------------------------------
-- 3) TRIPS (jadwal keberangkatan)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trips (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id         uuid REFERENCES public.entities(id),
    trip_no           text,
    rute_id           bigint REFERENCES public.rute(id),
    tanggal_berangkat  date,
    jam_berangkat     time,
    vehicle_id        bigint REFERENCES public.armada(id),
    driver_id         bigint REFERENCES public.driver(id),
    co_driver_id      bigint REFERENCES public.driver(id),
    kapasitas         integer,
    tarif             numeric(18,2) NOT NULL DEFAULT 0,
    status            text NOT NULL DEFAULT 'PLANNED', -- PLANNED|READY|BOARDING|DEPARTED|ARRIVED|COMPLETED|CANCELLED|DELAYED
    actual_departure  timestamptz,
    actual_arrival    timestamptz,
    km_awal          numeric,
    km_akhir          numeric,
    notes             text,
    created_at        timestamptz DEFAULT now(),
    created_by        text,
    updated_at        timestamptz DEFAULT now(),
    updated_by        text
);
CREATE INDEX IF NOT EXISTS idx_trips_entity ON public.trips (entity_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips (status);
CREATE INDEX IF NOT EXISTS idx_trips_tanggal ON public.trips (tanggal_berangkat);
CREATE INDEX IF NOT EXISTS idx_trips_rute ON public.trips (rute_id);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON public.trips (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON public.trips (driver_id);
COMMENT ON TABLE public.trips IS 'Jadwal keberangkatan shuttle (trip).';

-- ------------------------------------------------------------
-- 4) DRIVER ASSIGNMENTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_assignments (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id     uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    driver_id   bigint NOT NULL REFERENCES public.driver(id),
    role        text NOT NULL DEFAULT 'UTAMA',  -- UTAMA | CO
    status      text NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | REPLACED | REMOVED
    assigned_at timestamptz DEFAULT now(),
    assigned_by text,
    changed_at  timestamptz,
    changed_by  text,
    reason      text,
    UNIQUE (trip_id, driver_id, role)
);
CREATE INDEX IF NOT EXISTS idx_driver_assignments_trip ON public.driver_assignments (trip_id);
CREATE INDEX IF NOT EXISTS idx_driver_assignments_driver ON public.driver_assignments (driver_id);

-- ------------------------------------------------------------
-- 5) VEHICLE ASSIGNMENTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_assignments (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id     uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    vehicle_id  bigint NOT NULL REFERENCES public.armada(id),
    status      text NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | REPLACED | REMOVED
    assigned_at timestamptz DEFAULT now(),
    assigned_by text,
    changed_at  timestamptz,
    changed_by  text,
    reason      text,
    UNIQUE (trip_id, vehicle_id)
);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_trip ON public.vehicle_assignments (trip_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_vehicle ON public.vehicle_assignments (vehicle_id);
