-- ============================================================
-- FASE 6o — AWALAN NOMOR INSPEKSI: INSP -> INS
-- ============================================================
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
        v_seq := public.next_document_number(v_entity, 'INS', v_period);
        NEW.inspection_no := 'INS-' || v_period || '-' || lpad(v_seq::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unit_inspections_set_no ON public.unit_inspections;
CREATE TRIGGER trg_unit_inspections_set_no
BEFORE INSERT ON public.unit_inspections
FOR EACH ROW EXECUTE FUNCTION public.set_inspection_no();

NOTIFY pgrst, 'reload schema';
