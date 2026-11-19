-- Fase 7b: permission opening_balance.* untuk halaman Saldo Awal Persediaan
-- Pelengkap fase7a (66 permission procurement). Dieksekusi manual di lokal.
INSERT INTO permissions (code, module, description) VALUES
 ('opening_balance.create','procurement','Membuat saldo awal persediaan'),
 ('opening_balance.edit','procurement','Mengubah saldo awal persediaan'),
 ('opening_balance.delete','procurement','Menghapus saldo awal persediaan'),
 ('opening_balance.post','procurement','Posting saldo awal persediaan')
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
  v_role text;
BEGIN
  -- grant ke role Administrator (custom_roles)
  UPDATE custom_roles
     SET access = (SELECT array_agg(DISTINCT x)
                   FROM unnest(access || (
                     SELECT array_agg(code) FROM permissions WHERE code LIKE 'opening_balance.%'
                   )) x)
   WHERE name = 'Administrator';

  -- grant ke SEMUA user ber-role Administrator (custom_users)
  UPDATE custom_users
     SET access = (SELECT array_agg(DISTINCT x)
                   FROM unnest(access || (
                     SELECT array_agg(code) FROM permissions WHERE code LIKE 'opening_balance.%'
                   )) x)
   WHERE role = 'Administrator';
END $$;

NOTIFY pgrst, 'reload schema';
