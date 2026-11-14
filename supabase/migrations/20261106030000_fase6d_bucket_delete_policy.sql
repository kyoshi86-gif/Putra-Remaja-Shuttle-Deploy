-- ============================================================
-- FASE 6d — STORAGE POLICY DELETE: izinkan klien hapus objek
-- ============================================================
-- Perbaikan: tombol hapus draft/foto tak berfungsi karena tidak ada
-- policy DELETE (RLS menolak storage.remove). Tambahkan sekarang.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'public_delete_inspection_images'
    ) THEN
        CREATE POLICY "public_delete_inspection_images"
        ON storage.objects
        FOR DELETE
        TO anon, authenticated
        USING (bucket_id = 'inspection-images');
    END IF;
END $$;
