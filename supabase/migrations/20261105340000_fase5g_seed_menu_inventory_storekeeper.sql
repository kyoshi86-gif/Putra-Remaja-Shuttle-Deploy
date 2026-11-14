-- ============================================================
-- FASE 5g — SEED MENU: INVENTORY + STOREKEEPER
-- ============================================================
DO $$
DECLARE v_parent uuid;
BEGIN
    SELECT id INTO v_parent FROM public.menus WHERE label = 'Procurement' AND parent IS NULL LIMIT 1;
    IF v_parent IS NOT NULL THEN
        INSERT INTO public.menus (id, label, path, component, access, parent, order_index)
        SELECT gen_random_uuid(), v.label, v.path, v.component, v.access, v_parent, v.ord
        FROM (VALUES
            ('Inventory Requests', '/inventory-requests', 'procurement/inventory/InventoryRequestPage', 'Procurement -> Inventory Requests', 14),
            ('Opening Balance', '/opening-balances', 'procurement/inventory/OpeningBalancePage', 'Procurement -> Opening Balance', 15),
            ('Storekeeper Dashboard', '/storekeeper', 'procurement/storekeeper/StorekeeperPage', 'Procurement -> Storekeeper Dashboard', 16),
            ('Stock Mutation', '/stock-mutation', 'procurement/storekeeper/stock-mutation/StockMutationPage', 'Procurement -> Stock Mutation', 17),
            ('Adjustment Report', '/adjustment-report', 'procurement/storekeeper/adjustment-report/AdjustmentReportPage', 'Procurement -> Adjustment Report', 18),
            ('Opname Report', '/opname-report', 'procurement/storekeeper/opname-report/OpnameReportPage', 'Procurement -> Opname Report', 19),
            ('Transfer', '/transfer', 'procurement/storekeeper/transfer/TransferPage', 'Procurement -> Transfer', 20)
        ) AS v(label, path, component, access, ord)
        WHERE NOT EXISTS (
            SELECT 1 FROM public.menus m WHERE m.parent = v_parent AND m.label = v.label
        );
    END IF;
END $$;

DO $$
DECLARE accs text[] := ARRAY[
    'Procurement -> Inventory Requests',
    'Procurement -> Opening Balance',
    'Procurement -> Storekeeper Dashboard',
    'Procurement -> Stock Mutation',
    'Procurement -> Adjustment Report',
    'Procurement -> Opname Report',
    'Procurement -> Transfer'
];
BEGIN
    UPDATE public.custom_roles SET access = access || accs
    WHERE name = 'Administrator' AND NOT (access @> accs);
    UPDATE public.custom_users SET access = access || accs
    WHERE role = 'Administrator' AND NOT (access @> accs);
END $$;
