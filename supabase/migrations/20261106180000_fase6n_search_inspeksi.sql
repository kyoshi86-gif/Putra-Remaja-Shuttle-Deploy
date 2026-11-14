-- ============================================================
-- FASE 6n — RPC PENCARIAN + PAGINATION SERVER-SIDE INSPEKSI
-- ============================================================
create or replace function public.search_inspeksi(
  q text default '',
  d_from date default null,
  d_to date default null,
  p_limit int default 20,
  p_offset int default 0
) returns json
language plpgsql
as $$
declare
  cond text := 'i.status <> ''DRAFT''';
  total bigint;
  rows json;
begin
  if length(coalesce(q, '')) > 0 then
    cond := cond || format(
      ' and (i.inspection_no ilike %L or a.kode ilike %L or a.plat ilike %L'
      || ' or exists (select 1 from public.maintenance_records m where m.inspection_id = i.id and m.spk_no ilike %L))',
      '%' || q || '%', '%' || q || '%', '%' || q || '%', '%' || q || '%');
  end if;

  if d_from is not null then
    cond := cond || format(' and i.inspection_date >= %L', d_from);
  end if;

  if d_to is not null then
    cond := cond || format(' and i.inspection_date <= %L', d_to);
  end if;

  execute format('select count(*) from public.unit_inspections i left join public.armada a on a.id = i.unit_id where %s', cond) into total;

  execute format(
    'select coalesce(json_agg(row_to_json(t)), ''[]'') from ('
    || ' select i.*,'
    || '  json_build_object(''kode'', a.kode, ''plat'', a.plat, ''tipe'', a.tipe) as armada,'
    || '  (select coalesce(json_agg(m2), ''[]'') from (select spk_no, status from public.maintenance_records where inspection_id = i.id order by created_at) m2) as maintenance_records'
    || ' from public.unit_inspections i left join public.armada a on a.id = i.unit_id'
    || ' where %s order by i.inspection_date desc, i.created_at desc limit %s offset %s'
    || ' ) t',
    cond, p_limit, p_offset
  ) into rows;

  return json_build_object('rows', coalesce(rows::json, '[]'::json), 'total', total);
end $$;

grant execute on function public.search_inspeksi(text, date, date, int, int) to anon, authenticated;
