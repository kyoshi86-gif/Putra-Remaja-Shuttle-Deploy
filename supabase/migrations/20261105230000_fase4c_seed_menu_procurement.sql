-- Perbaikan seed menu Procurement (kolom menus: parent, order_index)
DO $$
DECLARE v_parent uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.menus WHERE label = 'Procurement' AND parent IS NULL) THEN
        INSERT INTO public.menus (id, label, path, component, access, parent, order_index)
        VALUES (gen_random_uuid(), 'Procurement', NULL, NULL, 'Procurement', NULL, 10);
    END IF;

    SELECT id INTO v_parent FROM public.menus WHERE label = 'Procurement' AND parent IS NULL LIMIT 1;

    INSERT INTO public.menus (id, label, path, component, access, parent, order_index)
    SELECT gen_random_uuid(), v.label, v.path, v.component, v.access, v_parent, v.ord
    FROM (VALUES
        ('Suppliers', '/suppliers', 'procurement/suppliers/SupplierPage', 'Procurement -> Suppliers', 1),
        ('Units', '/units', 'procurement/units/UnitPage', 'Procurement -> Units', 2),
        ('Stores', '/stores', 'procurement/stores/StorePage', 'Procurement -> Stores', 3),
        ('Item Categories', '/item-categories', 'procurement/item-categories/ItemCategoryPage', 'Procurement -> Item Categories', 4),
        ('Item Subcategories', '/item-subcategories', 'procurement/item-subcategories/ItemSubcategoryPage', 'Procurement -> Item Subcategories', 5),
        ('Items', '/items', 'procurement/items/ItemPage', 'Procurement -> Items', 6),
        ('Settlement Methods', '/purchase-settlement-methods', 'procurement/purchase-settlement-methods/PurchaseSettlementMethodPage', 'Procurement -> Settlement Methods', 7)
    ) AS v(label, path, component, access, ord)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.menus m WHERE m.parent = v_parent AND m.label = v.label
    );
END $$;

-- AKSES ADMINISTRATOR
DO $$
DECLARE accs text[] := ARRAY[
    'Procurement',
    'Procurement -> Suppliers',
    'Procurement -> Units',
    'Procurement -> Stores',
    'Procurement -> Item Categories',
    'Procurement -> Item Subcategories',
    'Procurement -> Items',
    'Procurement -> Settlement Methods'
];
BEGIN
    UPDATE public.custom_roles SET access = access || accs
    WHERE name = 'Administrator' AND NOT (access @> accs);
    UPDATE public.custom_users SET access = access || accs
    WHERE role = 'Administrator' AND NOT (access @> accs);
END $$;
