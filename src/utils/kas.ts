import { supabase } from "../lib/supabaseClient"; // sesuaikan path

export const saveKasFromUangSaku = async ({
  tanggal,
  no_uang_saku,
  no_surat_jalan,
  jumlah,
}: {
  tanggal: string;
  no_uang_saku: string;
  no_surat_jalan: string;
  jumlah: number;
}) => {
  try {
    const now = new Date();
    const waktu = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const { data: lastRow } = await supabase
      .from("kas_harian")
      .select("*")
      .order("tanggal", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .single();

    const saldoAwal = lastRow?.saldo_akhir ?? 0;
    const nominal = Number(jumlah) || 0;
    const saldoAkhir = saldoAwal - nominal;

    const payload = {
      tanggal,
      waktu,
      bukti_transaksi: no_uang_saku,
      keterangan: `Uang Saku Driver SJ-${no_surat_jalan}`,
      jenis_transaksi: "kredit",
      nominal,
      saldo_awal: saldoAwal,
      saldo_akhir: saldoAkhir,
      user_nama: null,
    };

    const { error } = await supabase.from("kas_harian").insert(payload);
    if (error) throw error;
    
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ Error saat proses kas:", message);
  }
};