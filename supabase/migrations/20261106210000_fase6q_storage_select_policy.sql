-- ============================================================
-- FASE 6q — STORAGE POLICY SELECT untuk inspection-images
-- ============================================================
-- Masalah: storage.remove (hapus foto yatim saat pindah halaman)
-- gagal diam-diam karena tidak ada policy SELECT di bucket.
-- Storage API perlu SELECT untuk menemukan objek sebelum menghapus.
-- Tambahkan SELECT untuk anon/authenticated (konsisten dgn INSERT/DELETE).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'public_select_inspection_images'
    ) THEN
        CREATE POLICY "public_select_inspection_images"
        ON storage.objects
        FOR SELECT
        TO anon, authenticated
        USING (bucket_id = 'inspection-images');
    END IF;
END $$;
