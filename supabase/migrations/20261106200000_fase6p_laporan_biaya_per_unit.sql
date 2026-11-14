-- ============================================================
-- FASE 6p — LAPORAN BIAYA PER UNIT (ringkasan biaya maintenance)
-- ============================================================

-- RPC agregasi server-side: per unit + total keseluruhan
CREATE OR REPLACE FUNCTION public.laporan_biaya_per_unit(
  p_from date DEFAULT NULL,
  p_to   date DEFAULT NULL,
  p_q    text DEFAULT ''
) RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  cond  text := 'mr.status <> ''CANCELLED''';
  grand numeric;
  rows  json;
BEGIN
  IF p_from IS NOT NULL THEN
    cond := cond || format(' AND mr.work_date >= %L', p_from);
  END IF;
  IF p_to IS NOT NULL THEN
    cond := cond || format(' AND mr.work_date <= %L', p_to);
  END IF;

  IF length(coalesce(p_q, '')) > 0 THEN
    cond := cond || format(
      ' AND (a.kode ilike %L OR a.plat ilike %L OR mr.spk_no ilike %L)',
      '%' || p_q || '%', '%' || p_q || '%', '%' || p_q || '%'
    );
  END IF;

  -- Grand total (jumlah semua biaya sparepart/perbaikan sesuai filter)
  EXECUTE format(
    'SELECT coalesce(SUM(sp.total), 0)'
    || ' FROM public.maintenance_records mr'
    || ' JOIN public.armada a ON a.id = mr.unit_id'
    || ' LEFT JOIN public.maintenance_spareparts sp ON sp.maintenance_record_id = mr.id'
    || ' WHERE %s', cond
  ) INTO grand;

  -- Ringkasan per unit
  EXECUTE format(
    'SELECT coalesce(json_agg(row_to_json(t)), ''[]'') FROM ('
    || ' SELECT a.kode, a.plat, a.tipe, count(DISTINCT mr.id) AS spk_count,'
    || '        coalesce(SUM(sp.total), 0) AS total_biaya'
    || ' FROM public.maintenance_records mr'
    || ' JOIN public.armada a ON a.id = mr.unit_id'
    || ' LEFT JOIN public.maintenance_spareparts sp ON sp.maintenance_record_id = mr.id'
    || ' WHERE %s'
    || ' GROUP BY a.kode, a.plat, a.tipe'
    || ' ORDER BY total_biaya DESC, a.kode'
    || ' ) t', cond
  ) INTO rows;

  RETURN json_build_object(
    'rows',       coalesce(rows::json, '[]'::json),
    'grand_total', coalesce(grand, 0)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.laporan_biaya_per_unit(date, date, text) TO anon, authenticated;

-- ============================================================
-- PERMISSION + AKSES MENU
-- ============================================================
INSERT INTO public.permissions (code, name, module, description) VALUES
    ('laporan.biaya_per_unit', 'Biaya Per Unit', 'laporan', 'Ringkasan biaya maintenance per unit (laporan)')
ON CONFLICT (code) DO NOTHING;

-- Berikan akses menu ke role & user Administrator
DO $$
DECLARE accs text[] := ARRAY['Laporan -> Biaya Per Unit'];
BEGIN
    UPDATE public.custom_roles SET access = access || accs
    WHERE name = 'Administrator' AND NOT (access @> accs);
    UPDATE public.custom_users SET access = access || accs
    WHERE role = 'Administrator' AND NOT (access @> accs);
END $$;

-- Daftarkan sub menu "Biaya Per Unit" ke group Laporan (tabel menus)
DO $$
DECLARE v_parent uuid;
BEGIN
    SELECT id INTO v_parent FROM public.menus WHERE label = 'Laporan' AND parent IS NULL LIMIT 1;
    IF v_parent IS NOT NULL THEN
        INSERT INTO public.menus (label, path, component, access, parent, "order")
        SELECT 'Biaya Per Unit', '/biaya-per-unit', 'operasional/maintenance/LaporanBiayaPerUnitPage', 'Laporan -> Biaya Per Unit', v_parent, 14
        WHERE NOT EXISTS (
            SELECT 1 FROM public.menus m WHERE m.parent = v_parent AND m.label = 'Biaya Per Unit'
        );
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
