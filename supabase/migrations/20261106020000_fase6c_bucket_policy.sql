-- ============================================================
-- FASE 6c — STORAGE POLICY: izinkan upload klien ke inspection-images
-- ============================================================
-- Konversi WebP dilakukan di client (canvas); server hanya menyimpan.
-- Maka klien (anon/authenticated) perlu izin INSERT ke bucket.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'public_insert_inspection_images'
    ) THEN
        CREATE POLICY "public_insert_inspection_images"
        ON storage.objects
        FOR INSERT
        TO anon, authenticated
        WITH CHECK (bucket_id = 'inspection-images');
    END IF;
END $$;
