export interface KasRow {
  id: number;
  tanggal: string;
  waktu: string;
  bukti_transaksi: string;
  keterangan: string;
  jenis_transaksi: "debet" | "kredit" | string;
  nominal: number | null;
  saldo_awal: number | null;
  saldo_akhir: number | null;
  user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  sumber_id?: string | null;      // ✅ tambahkan ini
  sumber_tabel?: string | null; 
  // ✅ Tambahan field dari uang_saku_driver
  bbm?: number | null;
  uang_makan?: number | null;
  parkir?: number | null;
  kartu_etoll?: number | null;
  no_surat_jalan?: string | null;
  jumlah?: number | null;
  [key: string]: unknown;
}