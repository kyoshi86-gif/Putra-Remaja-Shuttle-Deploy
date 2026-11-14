-- ============================================================
-- FASE 6i — SPK OTOMATIS: trigger set spk_no di maintenance_records
-- ============================================================
-- Saat inspeksi ber-perbaikan disimpan, frontend otomatis membuat baris
-- maintenance_records (SPK). Trigger ini mengisi spk_no otomatis
-- mengikuti pola `SPK-YYMM-00001` via next_document_number (atomik).

CREATE OR REPLACE FUNCTION public.set_spk_no()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_period text := to_char(COALESCE(NEW.work_date, CURRENT_DATE), 'YYMM');
    v_seq   bigint;
    v_entity uuid := COALESCE(NEW.entity_id, '00000000-0000-0000-0000-000000000000');
BEGIN
    IF NEW.spk_no IS NULL THEN
        v_seq := public.next_document_number(v_entity, 'SPK', v_period);
        NEW.spk_no := 'SPK-' || v_period || '-' || lpad(v_seq::text, 5, '0');
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_maintenance_records_set_spk ON public.maintenance_records;
CREATE TRIGGER trg_maintenance_records_set_spk
BEFORE INSERT ON public.maintenance_records
FOR EACH ROW EXECUTE FUNCTION public.set_spk_no();

NOTIFY pgrst, 'reload schema';
