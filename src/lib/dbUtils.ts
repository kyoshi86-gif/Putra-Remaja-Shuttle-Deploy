import { supabase } from "./supabaseClient";

interface InsertWithAutoNomorParams {
  table: string;
  prefix: string;
  data: Record<string, unknown>;
  nomorField: string;
  previewOnly?: boolean;
  tanggal?: string; // opsional, default: hari ini
  excludeFields?: string[]; // opsional: kolom yang harus dihapus dari payload
}

export async function insertWithAutoNomor({
  table,
  prefix,
  data,
  nomorField,
  previewOnly = false,
  tanggal,
  excludeFields = [],
}: InsertWithAutoNomorParams) {
  try {
    const today = tanggal ? new Date(tanggal) : new Date();
    const yy = String(today.getFullYear()).slice(2);
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const datePart = `${yy}${mm}${dd}`;

    let nextSeq = "001";

    const { data: lastRecords, error } = await supabase
      .from(table)
      .select(nomorField)
      .like(nomorField, `${prefix}${datePart}-%`)
      .order(nomorField, { ascending: false })
      .limit(1);

    if (error) {
      return { success: false, error: error.message };
    }

    if (lastRecords && lastRecords.length > 0) {
      const firstRow = lastRecords[0] as unknown as Record<string, unknown>;
      const rawNomor = firstRow?.[nomorField];
      const lastNomor = typeof rawNomor === "string" ? rawNomor : "";
      const parts = lastNomor.split("-");
      const lastSeqNum = parseInt(parts[2]);
      nextSeq = (lastSeqNum + 1).toString().padStart(3, "0");
    }

    const nextNomor = `${prefix}${datePart}-${nextSeq}`;

    if (previewOnly) {
      return { success: true, nomor: nextNomor };
    }

    // Bersihkan payload
    const rawData = { ...data, [nomorField]: nextNomor };
    excludeFields.forEach((field) => delete rawData[field]);

    const safeData = Object.fromEntries(
      Object.entries(rawData).filter(([, v]) => v !== undefined)
    );

    console.log("✅ Final safeData yang dikirim ke Supabase:", JSON.stringify(safeData, null, 2));

    const { data: insertedRows, error: insertError } = await supabase
      .from(table)
      .insert([safeData])
      .select("id"); // ✅ ambil id dari hasil insert

    if (insertError) return { success: false, error: insertError.message };

    return { success: true, nomor: nextNomor, id: insertedRows?.[0]?.id ?? null, };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}