// dbUtils.ts
import { supabase } from "./supabaseClient";

interface InsertWithAutoNomorParams {
  table: string;
  prefix: string;
  data: Record<string, any>;
  nomorField: string;
  previewOnly?: boolean;
  tanggal?: string; // opsional, default: hari ini
}

export async function insertWithAutoNomor({
  table,
  prefix,
  data,
  nomorField,
  previewOnly = false,
  tanggal,
}: InsertWithAutoNomorParams) {
  try {
    // Tentukan tanggal sekarang jika tidak diberikan
    const today = tanggal ? new Date(tanggal) : new Date();
    const yy = String(today.getFullYear()).slice(2);
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const datePart = `${yy}${mm}${dd}`;

    // Ambil nomor terakhir untuk hari ini
    const { data: lastRecords, error } = await supabase
      .from(table)
      .select(nomorField)
      .like(nomorField, `${prefix}${datePart}-%`)
      .order(nomorField, { ascending: false })
      .limit(1);

    if (error) {
      return { success: false, error: error.message };
    }

    // Hitung nomor urut
    let nextSeq = "001";
    if (lastRecords && lastRecords.length > 0) {
      const lastNomor: string = (lastRecords[0] as Record<string, any>)[nomorField];
      const parts = lastNomor.split("-");
      const lastSeqNum = parseInt(parts[2]);
      nextSeq = (lastSeqNum + 1).toString().padStart(3, "0");
    }

    const nextNomor = `${prefix}${datePart}-${nextSeq}`;

    if (previewOnly) {
      return { success: true, nomor: nextNomor };
    }

    // Insert ke DB
    const { error: insertError } = await supabase
      .from(table)
      .insert([{ ...data, [nomorField]: nextNomor }]);

    if (insertError) return { success: false, error: insertError.message };

    return { success: true, nomor: nextNomor };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}
