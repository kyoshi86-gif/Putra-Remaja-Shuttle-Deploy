import { supabase } from "./supabaseClient";

interface InsertWithAutoNomorParams {
  table: string;
  prefix: string;
  data: Record<string, unknown>;
  nomorField: string;
  previewOnly?: boolean;
  tanggal?: string; // opsional
  excludeFields?: string[];
  monthlyReset?: boolean; // ✅ reset per bulan
  digitCount?: number;    // jumlah digit urutan
  resetAfterMax?: boolean; // ✅ reset otomatis setelah max tercapai
  maxSeq?: number;        // ✅ batas maksimal urutan sebelum reset
}

export async function insertWithAutoNomor({
  table,
  prefix,
  data,
  nomorField,
  previewOnly = false,
  tanggal,
  excludeFields = [],
  monthlyReset = true,
  digitCount = 3,
  resetAfterMax = false,
  maxSeq = 999, // ✅ batas default
}: InsertWithAutoNomorParams) {
  try {
    const today = tanggal ? new Date(tanggal) : new Date();
    const yy = String(today.getFullYear()).slice(2);
    const mm = String(today.getMonth() + 1).padStart(2, "0");

    const periodPart = monthlyReset ? `${mm}${yy}` : `${mm}${yy}`; // tetap sertakan agar unik
    let nextSeq = 1;

    // 🔍 Ambil nomor terakhir
    const { data: lastRecords, error } = await supabase
      .from(table)
      .select(nomorField)
      .like(nomorField, `${prefix}%${periodPart}`)
      .order(nomorField, { ascending: false })
      .limit(1);

    if (error) return { success: false, error: error.message };

    if (lastRecords?.length > 0 && typeof lastRecords[0] === "object" && lastRecords[0] !== null) {
      const firstRow = lastRecords[0] as Record<string, unknown>;
      const lastNomor = String(firstRow[nomorField] ?? "");
      const match = lastNomor.match(new RegExp(`${prefix}(\\d{${digitCount}})`));
      if (match?.[1]) {
        nextSeq = parseInt(match[1]) + 1;
        if (resetAfterMax && nextSeq > maxSeq) nextSeq = 1;
      }
    }

    const nomorBaru = `${prefix}${String(nextSeq).padStart(digitCount, "0")}-${periodPart}`;

    if (previewOnly) return { success: true, nomor: nomorBaru };

    // 🧹 Bersihkan payload sebelum insert
    const rawData = { ...data, [nomorField]: nomorBaru };
    excludeFields.forEach((f) => delete rawData[f]);
    const safeData = Object.fromEntries(Object.entries(rawData).filter(([, v]) => v !== undefined));

    const { data: inserted, error: insertError } = await supabase
      .from(table)
      .insert([safeData])
      .select("id");

    if (insertError) return { success: false, error: insertError.message };

    return { success: true, nomor: nomorBaru, id: inserted?.[0]?.id ?? null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
