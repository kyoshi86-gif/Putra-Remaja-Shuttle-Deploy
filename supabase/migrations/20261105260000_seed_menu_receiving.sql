DO $$
DECLARE v_parent uuid;
BEGIN
    SELECT id INTO v_parent FROM public.menus WHERE label = 'Procurement' AND parent IS NULL LIMIT 1;
    IF v_parent IS NOT NULL THEN
        INSERT INTO public.menus (id, label, path, component, access, parent, order_index)
        SELECT gen_random_uuid(), 'Receiving', '/receiving',
               'procurement/receiving/ReceivingPage', 'Procurement -> Receiving', v_parent, 9
        WHERE NOT EXISTS (SELECT 1 FROM public.menus m WHERE m.parent = v_parent AND m.label = 'Receiving');
    END IF;
END $$;

DO $$
DECLARE accs text[] := ARRAY['Procurement -> Receiving'];
BEGIN
    UPDATE public.custom_roles SET access = access || accs
    WHERE name = 'Administrator' AND NOT (access @> accs);
    UPDATE public.custom_users SET access = access || accs
    WHERE role = 'Administrator' AND NOT (access @> accs);
END $$;
