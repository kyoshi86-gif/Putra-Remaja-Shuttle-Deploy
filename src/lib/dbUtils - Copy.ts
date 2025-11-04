import { supabase } from "./supabaseClient";

export async function insertWithAutoNomor({
  table,
  prefix,
  data,
  nomorField = "no_surat_jalan",
  maxRetries = 5,
}: {
  table: string;
  prefix: string;
  data: Record<string, any>;
  nomorField?: string;
  maxRetries?: number;
}): Promise<{ success: boolean; nomor?: string; error?: string }> {
  const today = new Date();
  const tanggal = today.toISOString().slice(0, 10).replace(/-/g, "");
  const fullPrefix = `${prefix}${tanggal}-`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { data: maxData, error: maxErr } = await supabase.rpc("get_max_sj_urutan", {
      tanggal_prefix: fullPrefix,
    });

    if (maxErr) {
      return { success: false, error: "Gagal ambil urutan nomor: " + maxErr.message };
    }

    const maxUrutan = typeof maxData === "number" && !isNaN(maxData) ? maxData : 0;
    const nextUrutan = String(maxUrutan + 1).padStart(3, "0");
    const nomorBaru = `${fullPrefix}${nextUrutan}`;

    // 🔍 Cek duplikat eksplisit
    const { data: dupData, error: dupErr } = await supabase
      .from(table)
      .select("id")
      .eq(nomorField, nomorBaru)
      .limit(1);

    if (dupErr) {
      return { success: false, error: "Gagal cek duplikat: " + dupErr.message };
    }

    if (dupData && dupData.length > 0) {
      console.warn(`Percobaan ${attempt}: Nomor ${nomorBaru} sudah ada, coba ulang...`);
      continue;
    }

    // ✅ Insert jika nomor belum ada
    const insertData = { ...data, [nomorField]: nomorBaru };
    const { error: insertErr } = await supabase.from(table).insert([insertData]);

    if (!insertErr) {
      return { success: true, nomor: nomorBaru };
    }

    console.error("Insert error detail:", insertErr);

    if (!insertErr.message.includes("duplicate")) {
      return { success: false, error: "Gagal insert: " + insertErr.message };
    }
  }

  return { success: false, error: "Gagal menyimpan setelah beberapa percobaan." };
}