export interface EntityOption {
  id: string;
  kode: string;
  nama: string;
  tipe: string;
}

export interface ItemStockOption {
  id: string;
  code: string;
  name: string;
  item_type: "STOCK" | "NON_STOCK" | "SERVICE";
  standard_cost: number | null;
  is_active: boolean;
  qty_on_hand: number;
  avg_cost: number;
  unit?: { id?: string; code: string; name: string } | null;
  category?: { code: string; name: string } | null;
  subcategory?: { code: string; name: string } | null;
}

export type SjbStatus = "DRAFT" | "DIKIRIM" | "DITERIMA" | "DIBATALKAN";

export interface SuratJalanBarangItem {
  id: string;
  item_id: string;
  qty_kirim: number;
  qty_terima: number | null;
  avg_cost: number;
  item?: {
    code: string;
    name: string;
    unit?: { code: string; name: string } | null;
  } | null;
}

export interface SuratJalanBarang {
  id: string;
  nomor: string;
  entity_asal: string;
  entity_tujuan: string;
  tanggal: string;
  status: SjbStatus;
  catatan: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  entity_asal_info?: { kode: string; nama: string } | null;
  entity_tujuan_info?: { kode: string; nama: string } | null;
}

export interface SjbLineForm {
  item_id: string;
  qty: number;
}

export interface SjbFormData {
  entity_tujuan: string;
  tanggal: string;
  catatan: string;
  lines: SjbLineForm[];
}

export type SjbResult = {
  success: boolean;
  id?: string;
  nomor?: string;
  error?: string;
};
