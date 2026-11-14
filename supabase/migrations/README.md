# supabase/migrations/ — Aturan Wajib

Folder ini adalah **version control untuk perubahan skema DB**. Gunakan dengan disiplin.

## Aturan inti
1. **Setiap perubahan skema = 1 file ` . di folder ini**, dengan nama timestamp:
   ```powershell
   npx supabase migration new <nama_perubahan>
   ```
   (menghasilkan `supabase/migrations/<timestamp>_<nama>.sql`)
2. **JANGAN pernah membaut file baseline/CREATE TABLE lengkap di folder ini.** Tabel produksi
   SUDAH ada di online. Kalau file CREATE TABLE ikut ke-`db push`, ia bentrok → error → risiko.
   - Skema lengkap online disimpan di `docs/ONLINE_SCHEMA_BASELINE.sql` (referensi & rebuild lokal).
3. Tulis SQL **idempotent / additive**:
   - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`
   - Beri default/backfill untuk kolom baru (data lama tetap valid).
   - Ubah fungsi/trigger dengan `CREATE OR REPLACE` — jangan duplikat.
4. **JANGAN** `DROP TABLE` / `DROP COLUMN` pada tabel produksi. Jika kolom tak terpakai: biarkan,
   atau hapus hanya setelah stabil & data dimigrasikan.

## Alur kerja
1. Tulis migration delta baru di folder ini.
2. Uji di LOKAL:
   - Untuk rebuild lokal penuh: terapkan `docs/ONLINE_SCHEMA_BASELINE.sql` lalu semua delta
     (atau cukup apply delta di atas skema yang sudah ada).
   - Jalankan app & test end-to-end.
3. **Backup ONLINE dulu** sebelum push: `D:\backup_supabase_shuttle.dump` (atau ambil ulang).
4. Push ke online (hanya delta):
   ```powershell
   npx supabase link --project-ref <PROJECT_REF>
   npx supabase db push
   ```
   CLI hanya menerapkan file yang belum tercatat di `supabase_migrations` online.

## Rollback cepat
- **Kode**: commit git kondisi stabil sebelum push → `git revert` / checkout jika bermasalah.
- **Database**: restore `D:\backup_supabase_shuttle.dump` (backup penuh online) ke project online,
  atau tulis migration koreksi (additive).
- Backup online tersimpan di `D:\backup_supabase_shuttle.dump` (pg_dump custom, divalidasi).
