import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCustomUser } from "@/lib/authUser";
import { useSuratJalanBarang } from "./hooks/useSuratJalanBarang";
import SearchableSelect, {
  type SearchableSelectOption,
} from "@/components/common/SearchableSelect";

import type {
  SjbStatus,
  SuratJalanBarang,
  SuratJalanBarangItem,
} from "./types";

interface Props {
  entityId?: string | null;
}

const statusLabels: Record<SjbStatus, string> = {
  DRAFT: "Draft",
  DIKIRIM: "Dalam Kirim",
  DITERIMA: "Diterima",
  DIBATALKAN: "Dibatalkan",
};

const statusClass: Record<SjbStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  DIKIRIM: "bg-yellow-100 text-yellow-700",
  DITERIMA: "bg-emerald-100 text-emerald-700",
  DIBATALKAN: "bg-gray-900 text-white",
};

interface LineForm {
  item_id: string;
  qty: string;
}

function today() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function fmtQty(n: number): string {
  return Number(n).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

/** Bersihkan input kuantitas: hanya angka, tanpa nol di depan ("021" → "21"). */
function sanitizeQty(v: string): string {
  return v.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

export default function SuratJalanBarangPage({ entityId: propEntityId = null }: Props) {
  const currentUser = getCustomUser();
  const entityId = propEntityId ?? currentUser?.entity_id ?? null;

  const {
    list,
    entities,
    stockItems,
    loading,
    loadingMasters,
    saving,
    error,
    createDraft,
    updateDraft,
    approve,
    removeDraft,
    receive,
  } = useSuratJalanBarang(entityId);

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entityTujuan, setEntityTujuan] = useState("");
  const [tanggal, setTanggal] = useState(() => today());
  const [catatan, setCatatan] = useState("");
  const [lines, setLines] = useState<LineForm[]>([{ item_id: "", qty: "" }]);
  const [loadEditLoading, setLoadEditLoading] = useState(false);

  const [detailOpen, setDetailOpen] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<SuratJalanBarangItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [receiveLines, setReceiveLines] = useState<Record<string, string>>({});

  // Cetak
  const [printItem, setPrintItem] = useState<{
    sjb: SuratJalanBarang;
    items: SuratJalanBarangItem[];
  } | null>(null);
  const [printLoading, setPrintLoading] = useState(false);

  const isPusat = useMemo(() => {
    const target = entities.find((e) => e.id === entityId);
    return !target || target.tipe === "pusat";
  }, [entities, entityId]);

  const entityOptions: SearchableSelectOption[] = useMemo(
    () =>
      entities
        .filter((e) => e.id !== entityId)
        .map((e) => ({ value: e.id, label: `${e.kode} — ${e.nama}` })),
    [entities, entityId],
  );

  const stockOptions: Record<string, SearchableSelectOption[]> = useMemo(() => {
    const map: Record<string, SearchableSelectOption[]> = {};
    for (const it of stockItems) {
      map[it.id] = [{ value: it.id, label: `${it.code} — ${it.name} (stok ${fmtQty(it.qty_on_hand)})` }];
    }
    return map;
  }, [stockItems]);

  const loadDetail = async (id: string): Promise<SuratJalanBarangItem[]> => {
    setDetailLoading(true);
    const { data, error } = await supabase
      .from("surat_jalan_barang_items")
      .select(
        `
        *,
        item:items(
          code,
          name,
          unit:units(code,name)
        )
        `,
      )
      .eq("sjb_id", id)
      .order("created_at");
    if (!error) {
      const rows = (data ?? []) as SuratJalanBarangItem[];
      setDetailItems(rows);
      const init: Record<string, string> = {};
      for (const r of rows) init[r.item_id] = String(Number(r.qty_kirim));
      setReceiveLines(init);
      return rows;
    }
    setDetailLoading(false);
    return [];
  };

  const openDetail = async (id: string) => {
    if (detailOpen === id) {
      setDetailOpen(null);
      return;
    }
    setDetailOpen(id);
    await loadDetail(id);
    setDetailLoading(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setEntityTujuan("");
    setTanggal(today());
    setCatatan("");
    setLines([{ item_id: "", qty: "" }]);
  };

  const openCreate = () => {
    if (showCreate) {
      setShowCreate(false);
      resetForm();
      return;
    }
    resetForm();
    setShowCreate(true);
  };

  const startEdit = async (sjb: SuratJalanBarang) => {
    setLoadEditLoading(true);
    setShowCreate(true);
    setEditingId(sjb.id);
    setEntityTujuan(sjb.entity_tujuan);
    setTanggal(sjb.tanggal || today());
    setCatatan(sjb.catatan ?? "");
    const rows = await loadDetail(sjb.id);
    const nextLines: LineForm[] = rows.length
      ? rows.map((r) => ({ item_id: r.item_id, qty: String(Number(r.qty_kirim)) }))
      : [{ item_id: "", qty: "" }];
    setLines(nextLines);
    setLoadEditLoading(false);
  };

  const loadPrintData = async (sjb: SuratJalanBarang) => {
    setPrintLoading(true);
    const rows = await loadDetail(sjb.id);
    setPrintItem({ sjb, items: rows });
    setPrintLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityTujuan) return alert("Pilih entitas tujuan.");
    const payloadLines = lines
      .map((l) => ({ item_id: l.item_id, qty: Number(l.qty) || 0 }))
      .filter((l) => l.item_id && l.qty > 0);
    if (payloadLines.length === 0) return alert("Tambah minimal satu item dengan kuantitas.");
    const userId = getCustomUser()?.id ?? null;

    const res = editingId
      ? await updateDraft(editingId, { entity_tujuan: entityTujuan, tanggal, catatan, lines: payloadLines }, userId)
      : await createDraft({ entity_tujuan: entityTujuan, tanggal, catatan, lines: payloadLines }, userId);

    if (res.success) {
      alert(editingId ? `Surat jalan barang ${res.nomor} berhasil diubah.` : `Surat jalan barang ${res.nomor} tersimpan sebagai Draft.`);
      setShowCreate(false);
      resetForm();
    } else {
      alert(res.error || "Gagal menyimpan.");
    }
  };

  const handleApprove = async (sjb: SuratJalanBarang) => {
    if (!confirm(`Setujui ${sjb.nomor}? Stok entity asal akan berkurang sesuai item.`)) return;
    const res = await approve(sjb.id, getCustomUser()?.id ?? null);
    if (res.success) {
      alert(`${sjb.nomor} disetujui. Stok dikirim ke entity tujuan.`);
    } else {
      alert(res.error || "Gagal menyetujui.");
    }
  };

  const handleRemove = async (sjb: SuratJalanBarang) => {
    if (!confirm(`Hapus draft ${sjb.nomor}?`)) return;
    const res = await removeDraft(sjb.id);
    if (res.success) {
      alert(`${sjb.nomor} dihapus.`);
      if (detailOpen === sjb.id) setDetailOpen(null);
    } else {
      alert(res.error || "Gagal menghapus.");
    }
  };

  const handleReceive = async (sjb: SuratJalanBarang, items: SuratJalanBarangItem[]) => {
    const payload = items.map((it) => ({
      item_id: it.item_id,
      qty_terima: Number(receiveLines[it.item_id] ?? 0),
    }));
    const res = await receive(sjb.id, payload, getCustomUser()?.id ?? null);
    if (res.success) {
      alert(`${sjb.nomor} diterima. Stok entity bertambah.`);
      setDetailOpen(null);
    } else {
      alert(res.error || "Gagal validasi.");
    }
  };

  const canReceive = (sjb: SuratJalanBarang) =>
    sjb.status === "DIKIRIM" && sjb.entity_tujuan === entityId;

  const findSjb = (id: string) => list.find((l) => l.id === id);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Surat Jalan Barang (Transfer Antar Entitas)</h2>
        {isPusat && (
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={openCreate}
            disabled={loadingMasters}
          >
            {showCreate ? "Tutup" : "+ Buat Surat Jalan"}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded mb-3">
          {error}
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleSubmit} className="border rounded p-4 mb-4 bg-gray-50">
          <h3 className="font-semibold mb-3">
            {editingId ? "Edit Surat Jalan Barang" : "Buat Surat Jalan Barang"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-sm mb-1">Entitas Tujuan</label>
              <SearchableSelect
                options={entityOptions}
                value={entityTujuan}
                onChange={setEntityTujuan}
                placeholder="-- Pilih Entitas Tujuan --"
                disabled={!entityOptions.length || loadEditLoading}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Tanggal</label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="border rounded px-2 py-1 w-full"
                disabled={loadEditLoading}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Catatan</label>
              <input
                type="text"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                className="border rounded px-2 py-1 w-full"
                placeholder="(opsional)"
                disabled={loadEditLoading}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-gray-500 px-1">
            <span className="flex-1">Item</span>
            <span className="w-20">Kuantitas</span>
            <span className="w-16">Satuan</span>
            <span className="w-16 text-right">Stok</span>
            <span className="w-8" />
          </div>
          {lines.map((line, idx) => {
            const opts = stockOptions[line.item_id] ?? stockItems.map((it) => ({
              value: it.id,
              label: `${it.code} — ${it.name} (stok ${fmtQty(it.qty_on_hand)})`,
            }));
            const selected = stockItems.find((it) => it.id === line.item_id);
            return (
              <div
                key={idx}
                className="flex items-center gap-2 mb-1.5"
              >
                <div className="flex-1 min-w-0">
                  <SearchableSelect
                    options={opts}
                    value={line.item_id}
                    onChange={(v) => {
                      const next = [...lines];
                      next[idx] = { ...next[idx], item_id: v };
                      setLines(next);
                    }}
                    placeholder="-- Pilih Item --"
                    disabled={!stockItems.length}
                  />
                </div>
                <div className="w-20">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={line.qty}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...next[idx], qty: sanitizeQty(e.target.value) };
                      setLines(next);
                    }}
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>
                <div className="w-16 text-sm text-gray-700">
                  {selected?.unit?.code ?? ""}
                </div>
                <div className="w-16 text-xs text-gray-500 text-right">
                  {selected ? fmtQty(selected.qty_on_hand) : ""}
                </div>
                <button
                  type="button"
                  title="Hapus baris"
                  className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded border border-red-200"
                  onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                  disabled={lines.length === 1}
                >
                  ✕
                </button>
              </div>
            );
          })}

          <button
            type="button"
            className="text-blue-600 text-sm mb-3"
            onClick={() => setLines([...lines, { item_id: "", qty: "" }])}
          >
            + Tambah Item
          </button>

          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded"
              disabled={saving || !entityTujuan || loadEditLoading}
            >
              {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Draft"}
            </button>
            {editingId && (
              <button
                type="button"
                className="bg-gray-300 px-4 py-2 rounded"
                onClick={() => {
                  setEditingId(null);
                  resetForm();
                }}
              >
                Batal Edit
              </button>
            )}
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="table-auto w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1 text-left">No.</th>
              <th className="border px-2 py-1 text-left">Nomor</th>
              <th className="border px-2 py-1 text-left">Tanggal</th>
              <th className="border px-2 py-1 text-left">Dari</th>
              <th className="border px-2 py-1 text-left">Ke</th>
              <th className="border px-2 py-1 text-left">Status</th>
              <th className="border px-2 py-1 text-left">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="border px-2 py-3 text-center">
                  Loading...
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={7} className="border px-2 py-3 text-center">
                  Belum ada surat jalan barang.
                </td>
              </tr>
            ) : (
              list.map((sjb, i) => (
                <tr key={sjb.id}>
                  <td className="border px-2 py-1">{i + 1}</td>
                  <td className="border px-2 py-1 font-mono">{sjb.nomor}</td>
                  <td className="border px-2 py-1">{sjb.tanggal}</td>
                  <td className="border px-2 py-1">
                    {sjb.entity_asal_info?.kode ?? "?"}
                  </td>
                  <td className="border px-2 py-1">
                    {sjb.entity_tujuan_info?.kode ?? "?"}
                  </td>
                  <td className="border px-2 py-1">
                    <span className={`px-2 py-0.5 rounded text-xs ${statusClass[sjb.status]}`}>
                      {statusLabels[sjb.status]}
                    </span>
                  </td>
                  <td className="border px-2 py-1">
                    <div className="flex items-center gap-1">
                      {sjb.status === "DRAFT" && isPusat && (
                        <>
                          <button
                            type="button"
                            className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => startEdit(sjb)}
                            disabled={saving}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="px-2 py-0.5 rounded text-xs font-semibold bg-green-600 text-white hover:bg-green-700"
                            onClick={() => handleApprove(sjb)}
                            disabled={saving}
                          >
                            Setujui
                          </button>
                          <button
                            type="button"
                            className="px-2 py-0.5 rounded text-xs font-semibold bg-red-500 text-white hover:bg-red-600"
                            onClick={() => handleRemove(sjb)}
                            disabled={saving}
                          >
                            Hapus
                          </button>
                        </>
                      )}
                      <button
                        className="text-blue-600 text-xs underline"
                        onClick={() => openDetail(sjb.id)}
                      >
                        {detailOpen === sjb.id ? "Tutup" : "Detail"}
                      </button>
                      <button
                        className="text-purple-600 text-xs underline"
                        onClick={() => loadPrintData(sjb)}
                        disabled={printLoading}
                      >
                        Cetak
                      </button>
                      {canReceive(sjb) && (
                        <span className="ml-1 text-green-700 font-semibold text-xs">
                          • untuk Anda
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detailOpen && (
        <div className="mt-4 border rounded p-4 bg-gray-50">
          <h3 className="font-semibold mb-3">
            Detail — {findSjb(detailOpen)?.nomor ?? ""}
          </h3>
          {detailLoading ? (
            <div>Loading...</div>
          ) : (
            <table className="table-auto w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2 py-1 text-left">Item</th>
                  <th className="border px-2 py-1 text-left">Satuan</th>
                  <th className="border px-2 py-1 text-right">Dikirim</th>
                  <th className="border px-2 py-1 text-right">
                    Diterima (Validasi)
                  </th>
                </tr>
              </thead>
              <tbody>
                {detailItems.map((it) => (
                  <tr key={it.id}>
                    <td className="border px-2 py-1">
                      {it.item?.code} — {it.item?.name}
                    </td>
                    <td className="border px-2 py-1">
                      {it.item?.unit?.code ?? ""}
                    </td>
                    <td className="border px-2 py-1 text-right">
                      {fmtQty(it.qty_kirim)}
                    </td>
                    <td className="border px-2 py-1 text-right">
                      {canReceive(findSjb(detailOpen)!) ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          value={receiveLines[it.item_id] ?? ""}
                          onChange={(e) =>
                            setReceiveLines({
                              ...receiveLines,
                              [it.item_id]: sanitizeQty(e.target.value),
                            })
                          }
                          className="border rounded px-2 py-0.5 w-24 text-right"
                          placeholder="0"
                        />
                      ) : (
                        <span>{it.qty_terima !== null ? fmtQty(it.qty_terima) : "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {canReceive(findSjb(detailOpen)!) && (
            <div className="mt-3">
              <button
                className="bg-green-600 text-white px-4 py-2 rounded"
                onClick={() => handleReceive(findSjb(detailOpen)!, detailItems)}
                disabled={saving || detailLoading}
              >
                {saving ? "Memproses..." : "Terima / Validasi"}
              </button>
            </div>
          )}
        </div>
      )}

      {printItem && <PrintModal item={printItem} onClose={() => setPrintItem(null)} />}
    </div>
  );
}

function PrintModal({
  item,
  onClose,
}: {
  item: { sjb: SuratJalanBarang; items: SuratJalanBarangItem[] };
  onClose: () => void;
}) {
  const { sjb, items } = item;
  const entityName = (info?: { kode: string; nama: string } | null) =>
    info ? `${info.kode} — ${info.nama}` : "";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded shadow-lg w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center border-b px-4 py-2 no-print">
          <h3 className="font-semibold">Cetak Surat Jalan Barang — {sjb.nomor}</h3>
          <div className="flex gap-2">
            <button
              className="bg-blue-600 text-white px-4 py-1.5 rounded"
              onClick={() => window.print()}
            >
              Cetak
            </button>
            <button
              className="bg-gray-300 px-4 py-1.5 rounded"
              onClick={onClose}
            >
              Tutup
            </button>
          </div>
        </div>

        <div className="print-area p-6">
          <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-3">
            <div>
              <img src="/logo.png" alt="Logo" className="h-12" />
              <p className="text-xs mt-1">Hotline: 081 1250 8818</p>
            </div>
            <div className="text-right text-xs">
              <p>Jl. Ringroad Barat No. 15 Demakijo</p>
              <p>Yogyakarta 55292</p>
            </div>
          </div>

          <h2 className="text-center font-bold underline mb-1">
            SURAT JALAN BARANG
          </h2>
          <p className="text-center font-semibold mb-4">
            NO. &nbsp;&nbsp;{sjb.nomor}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div>
              <p><strong>Dari:</strong> {entityName(sjb.entity_asal_info)}</p>
              <p><strong>Ke:</strong> {entityName(sjb.entity_tujuan_info)}</p>
            </div>
            <div>
              <p><strong>Tanggal:</strong> {sjb.tanggal}</p>
              <p><strong>Status:</strong> {statusLabels[sjb.status]}</p>
            </div>
          </div>

          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1 text-left">No.</th>
                <th className="border px-2 py-1 text-left">Kode</th>
                <th className="border px-2 py-1 text-left">Nama Item</th>
                <th className="border px-2 py-1 text-center">Satuan</th>
                <th className="border px-2 py-1 text-right">Kuantitas</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.id}>
                  <td className="border px-2 py-1">{idx + 1}</td>
                  <td className="border px-2 py-1">{it.item?.code}</td>
                  <td className="border px-2 py-1">{it.item?.name}</td>
                  <td className="border px-2 py-1 text-center">{it.item?.unit?.code ?? ""}</td>
                  <td className="border px-2 py-1 text-right">{fmtQty(it.qty_kirim)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {sjb.catatan && (
            <p className="mt-3 text-sm">
              <strong>Catatan:</strong> {sjb.catatan}
            </p>
          )}

          <div className="grid grid-cols-2 gap-8 mt-10 text-sm">
            <div className="text-center">
              <p>Dikirim Oleh,</p>
              <div className="h-16" />
              <p className="font-semibold">{getCustomUser()?.name || ""}</p>
            </div>
            <div className="text-center">
              <p>Diterima Oleh,</p>
              <div className="h-16" />
              <p className="font-semibold">&nbsp;</p>
            </div>
          </div>

          <p className="text-right text-xs mt-4 italic">
            Dicetak: {new Date().toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area {
            position: fixed;
            left: 0; top: 0;
            width: 100%;
            margin: 0;
            background: white;
          }
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 10mm; }
        }
      `}</style>
    </div>
  );
}
