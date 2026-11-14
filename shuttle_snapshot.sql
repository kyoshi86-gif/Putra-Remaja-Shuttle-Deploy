\pset footer off
\echo ============================================================
\echo SCHEMA NON-SISTEM
\echo ============================================================
SELECT n.nspname AS schema
FROM pg_namespace n
WHERE n.nspname NOT IN ('pg_catalog','information_schema','pg_toast','pg_temp_1','pg_toast_temp_1','auth','storage','realtime','supabase_migrations','vault','extensions','graphql','graphql_public','net','pgsodium','pgbouncer','supabase_functions')
ORDER BY 1;

\echo ============================================================
\echo TABEL + ESTIMASI BARIS (schema public)
\echo ============================================================
SELECT c.relname AS tabel,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS ukuran,
       (SELECT count(*) FROM pg_stat_user_tables s WHERE s.relid = c.oid) IS NOT NULL AS terlihat_stat
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','p') AND n.nspname = 'public'
ORDER BY 1;

\echo ============================================================
\echo KOLOM PER TABEL (public) - ringkas
\echo ============================================================
SELECT t.relname AS tabel,
       a.attnum AS pos,
       a.attname AS kolom,
       format_type(a.atttypid, a.atttypmod) AS tipe,
       a.attnotnull AS not_null,
       COALESCE(pg_get_expr(d.adbin, d.adrelid), '') AS default_val
FROM pg_attribute a
JOIN pg_class t ON t.oid = a.attrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY t.relname, a.attnum;

\echo ============================================================
\echo VIEW (public)
\echo ============================================================
SELECT c.relname AS view, pg_get_viewdef(c.oid) AS definisi
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v' AND n.nspname = 'public'
ORDER BY 1;

\echo ============================================================
\echo FUNCTIONS (public) - ringkas
\echo ============================================================
SELECT p.proname AS nama,
       pg_get_function_arguments(p.oid) AS argumen,
       pg_get_function_result(p.oid) AS hasil
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f'
ORDER BY 1;

\echo ============================================================
\echo TRIGGERS (public)
\echo ============================================================
SELECT tg.tgname AS nama,
       c.relname AS tabel,
       pg_get_triggerdef(tg.oid) AS definisi
FROM pg_trigger tg
JOIN pg_class c ON c.oid = tg.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT tg.tgisinternal
ORDER BY 1;

\echo ============================================================
\echo RLS POLICIES (public)
\echo ============================================================
SELECT c.relname AS tabel,
       polname AS policy,
       polcmd AS cmd,
       pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY c.relname, polname;

\echo ============================================================
\echo FOREIGN KEYS (public)
\echo ============================================================
SELECT con.conname AS nama,
       tbl.relname AS tabel,
       pg_get_constraintdef(con.oid) AS definisi
FROM pg_constraint con
JOIN pg_class tbl ON tbl.oid = con.conrelid
JOIN pg_namespace n ON n.oid = tbl.relnamespace
WHERE con.contype = 'f' AND n.nspname = 'public'
ORDER BY tbl.relname, con.conname;
