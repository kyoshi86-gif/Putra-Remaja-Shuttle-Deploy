-- ============================================================
-- FASE 6e — RPC SERVER-SIDE: hapus foto inspeksi dari bucket
-- ============================================================
-- Delete storage dari klien rentan RLS (objuscated 404). Solusi:
-- RPC `security definer` (jalan sbg pemilik tabel = bebas RLS)
-- menghapus baris storage.objects utk bucket inspection-images.
-- Pemakaian: SELECT public.delete_inspection_images(ARRAY['a.webp','b.webp']);

CREATE OR REPLACE FUNCTION public.delete_inspection_images(p_paths text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = storage, public
AS $$
BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = 'inspection-images'
      AND name = ANY(p_paths);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_inspection_images(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_inspection_images(text[]) TO anon, authenticated;
