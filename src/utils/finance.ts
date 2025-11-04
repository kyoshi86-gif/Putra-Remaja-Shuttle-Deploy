import type { KasRow } from "../utils/types";
import { toWIBDateString } from "./time";

export interface Transaksi {
  id: number | string;
  tanggal: string;
  jenis_transaksi?: "debet" | "kredit" | string;
  nominal?: number | null;
  saldo_awal?: number | null;
  saldo_akhir?: number | null;
}

export function getSaldoAwalDariHistori(data: KasRow[], tanggalAwal: string): number {
  const sorted = [...data]
    .filter((r) => {
      const tgl = toWIBDateString(new Date(r.tanggal));
      return tgl < tanggalAwal;
    })
    .sort((a, b) =>
      toWIBDateString(new Date(a.tanggal)).localeCompare(toWIBDateString(new Date(b.tanggal)))
    );

  return sorted.length > 0 ? sorted.at(-1)?.saldo_akhir ?? 0 : 0;
}

export function getSaldoKemarin(data: KasRow[], tanggalAwal: string): number {
  const sebelumAwal = data
    .filter((r) => r.tanggal < tanggalAwal)
    .sort((a, b) => {
      const tA = a.tanggal + (a.waktu ?? "");
      const tB = b.tanggal + (b.waktu ?? "");
      return tB.localeCompare(tA); // urut mundur
    });

  return sebelumAwal[0]?.saldo_akhir ?? 0;
}

export function injectSaldoKeData(data: KasRow[], saldoAwal: number): KasRow[] {
  let saldo = saldoAwal;

  return [...data]
    .sort((a, b) => {
      const t1 = a.tanggal + (a.waktu ?? "");
      const t2 = b.tanggal + (b.waktu ?? "");
      return t1.localeCompare(t2);
    })
    .map((item) => {
      const nominal = Number(item.nominal) || 0;
      const isDebet = item.jenis_transaksi?.toLowerCase() === "debet";
      const saldo_awal = saldo;
      const saldo_akhir = isDebet ? saldo + nominal : saldo - nominal;
      saldo = saldo_akhir;

      return {
        ...item,
        saldo_awal,
        saldo_akhir,
      };
    });
}