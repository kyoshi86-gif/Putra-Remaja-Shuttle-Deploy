import { supabase } from "../lib/supabaseClient";

/**
 * Ambil saldo terakhir dari kas_harian
 */
export async function getSaldoTerakhir(): Promise<number> {
  const { data, error } = await supabase
    .from("kas_harian")
    .select("saldo_akhir")
    .order("tanggal", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .single();

  if (error) return 0;
  return Number(data?.saldo_akhir ?? 0);
}

/**
 * Validasi saldo sebelum transaksi
 */
export async function cekSaldoTidakMinus(
  jenis: "debet" | "kredit",
  nominal: number
): Promise<{ ok: boolean; saldoAkhir: number; saldoAwal: number }> {
  const saldoAwal = await getSaldoTerakhir();
  const saldoAkhir =
    jenis === "debet"
      ? saldoAwal + nominal
      : saldoAwal - nominal;

  if (saldoAkhir < 0) {
    return { ok: false, saldoAwal, saldoAkhir };
  }

  return { ok: true, saldoAwal, saldoAkhir };
}
