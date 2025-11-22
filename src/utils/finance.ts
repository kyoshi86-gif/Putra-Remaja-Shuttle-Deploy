import type { KasRow } from "../utils/types";

// ======================================================================
// HELPER: tanggal + waktu → Date
// ======================================================================
export function toDateTime(tanggal: string, waktu?: string | null): Date {
  return new Date(tanggal + " " + (waktu && waktu !== "" ? waktu : "00:00:00"));
}

// ======================================================================
// SALDO AWAL DARI HISTORI  (transaksi sebelum hari ini)
// ======================================================================
export function getSaldoAwalDariHistori(data: KasRow[], tanggalAwal: string): number {
  const batas = new Date(`${tanggalAwal} 00:00:00`);

  const sorted = [...data]
    .filter((r) => toDateTime(r.tanggal, r.waktu) < batas)
    .sort((a, b) =>
      toDateTime(a.tanggal, a.waktu).getTime() -
      toDateTime(b.tanggal, b.waktu).getTime()
    );

  return sorted.length > 0 ? sorted.at(-1)?.saldo_akhir ?? 0 : 0;
}

// ======================================================================
// SALDO KEMARIN (transaksi terakhir sebelum tanggalAwal)
// ======================================================================
export function getSaldoKemarin(data: KasRow[], tanggalAwal: string): number {
  const batas = new Date(`${tanggalAwal} 00:00:00`);

  const sebelum = [...data]
    .filter((r) => toDateTime(r.tanggal, r.waktu) < batas)
    .sort((a, b) =>
      toDateTime(b.tanggal, b.waktu).getTime() -
      toDateTime(a.tanggal, a.waktu).getTime()
    );

  return sebelum[0]?.saldo_akhir ?? 0;
}

// ======================================================================
// INJECT SALDO KE DATA
// ======================================================================
export function injectSaldoKeData(data: KasRow[], saldoAwal: number): KasRow[] {
  let saldo = saldoAwal;

  return [...data]
    .sort(
      (a, b) =>
        toDateTime(a.tanggal, a.waktu).getTime() -
        toDateTime(b.tanggal, b.waktu).getTime()
    )
    .map((item) => {
      const nominal = Number(item.nominal) || 0;
      const isDebet = item.jenis_transaksi?.toLowerCase() === "debet";

      const saldo_awal = saldo;
      const saldo_akhir = isDebet ? saldo + nominal : saldo - nominal;

      saldo = saldo_akhir;

      return { ...item, saldo_awal, saldo_akhir };
    });
}
