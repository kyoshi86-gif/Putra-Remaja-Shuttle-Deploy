import { supabase } from "./supabaseClient";

interface InsertWithAutoNomorParams {
  table: string;
  prefix: string;
  data: Record<string, unknown>;
  nomorField: string;
  entityId?: string;
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
  entityId,
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

    // Ambil nomor terakhir berdasarkan prefix + entity_id
    let query = supabase
      .from(table)
      .select(nomorField)
      .like(nomorField, `${prefix}%-${periodPart}`) // ✅ filter prefix + periode
      .order(nomorField, { ascending: false })
      .limit(1);

    if (entityId) {
      query = query.eq("entity_id", entityId);
    }

    console.log("DEBUG entityId:", entityId, "prefix:", prefix);

    const { data: lastRecords, error } = await query;

    if (error) {
      console.error("DEBUG Supabase error:", error);
      return { success: false, error: error.message };
    }

    console.log("DEBUG lastRecords:", lastRecords);

    if (lastRecords?.length > 0) {
      const firstRow = lastRecords[0] as unknown as Record<string, unknown>;
      const lastNomor = String(firstRow[nomorField] ?? "");
      console.log("DEBUG lastNomor:", lastNomor);

      const match = lastNomor.match(new RegExp(`^${prefix}(\\d+)-${periodPart}$`));
      if (match?.[1]) {
        nextSeq = parseInt(match[1], 10) + 1; // ✅ jadi 275
        if (resetAfterMax && nextSeq > maxSeq) nextSeq = 1;
      }
    }

    const nomorBaru = `${prefix}${String(nextSeq).padStart(digitCount, "0")}-${periodPart}`;
    console.log("DEBUG nomorBaru:", nomorBaru);

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
