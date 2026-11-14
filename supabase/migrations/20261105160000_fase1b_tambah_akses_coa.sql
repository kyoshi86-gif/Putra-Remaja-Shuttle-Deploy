-- Tambah hak akses Chart of Accounts ke Administrator (role + user)
DO $$
BEGIN
    -- role Administrator
    IF EXISTS (SELECT 1 FROM public.custom_roles WHERE name = 'Administrator')
       AND NOT EXISTS (SELECT 1 FROM public.custom_roles
                        WHERE name = 'Administrator'
                          AND access @> ARRAY['Accounting -> Chart of Accounts']) THEN
        UPDATE public.custom_roles
           SET access = access || ARRAY['Accounting -> Chart of Accounts']
         WHERE name = 'Administrator';
    END IF;

    -- semua custom_users ber-role Administrator
    IF EXISTS (SELECT 1 FROM public.custom_users WHERE role = 'Administrator')
       AND NOT EXISTS (SELECT 1 FROM public.custom_users
                        WHERE role = 'Administrator'
                          AND access @> ARRAY['Accounting -> Chart of Accounts']) THEN
        UPDATE public.custom_users
           SET access = access || ARRAY['Accounting -> Chart of Accounts']
         WHERE role = 'Administrator'
           AND NOT (access @> ARRAY['Accounting -> Chart of Accounts']);
    END IF;
END $$;
