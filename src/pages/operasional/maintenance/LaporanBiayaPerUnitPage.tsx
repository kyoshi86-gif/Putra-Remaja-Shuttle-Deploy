import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { hasAccess } from "../../../lib/hasAccess";

// ---------- Format tanggal dd/mm/yyyy ----------
function fmtTanggal(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// ---------- Format angka ribuan (id-ID: 125.000) ----------
function fmtUang(v: number): string {
  const n = Math.round(Number(v) || 0);
  return n.toLocaleString("id-ID");
}

// ---------- Default bulan berjalan (YYYY-MM-DD) ----------
function monthBounds() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(first), to: iso(last) };
}

interface UnitRow {
  kode: string;
  plat: string;
  tipe: string | null;
  spk_count: number;
  total_biaya: number;
}

export default function LaporanBiayaPerUnitPage() {
  const [perm, setPerm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [grand, setGrand] = useState(0);

  const def = monthBounds();
  const [fFrom, setFFrom] = useState(def.from);
  const [fTo, setFTo] = useState(def.to);
  const [fQ, setFQ] = useState("");
  const [units, setUnits] = useState<{ id: string; kode: string; plat: string }[]>([]);
  const [selUnit, setSelUnit] = useState("");

  const load = async (ov?: { q?: string; from?: string; to?: string }) => {
    const q = (ov?.q ?? fQ).trim();
    const from = ov?.from ?? fFrom;
    const to = ov?.to ?? fTo;
    setLoading(true);
    setMsg("");
    const { data, error } = await supabase.rpc("laporan_biaya_per_unit", {
      p_from: from || null,
      p_to: to || null,
      p_q: q,
    });
    setLoading(false);
    if (error) {
      setMsg("Gagal memuat laporan: " + error.message);
      return;
    }
    const r = data as { rows: UnitRow[]; grand_total: number } | null;
    setRows(r?.rows ?? []);
    setGrand(r?.grand_total ?? 0);
  };

  useEffect(() => {
    hasAccess("laporan.biaya_per_unit").then(setPerm);
  }, []);

  useEffect(() => {
    if (perm) load();
    // eslint-disable-next-line
  }, [perm]);

  useEffect(() => {
    if (!perm) return;
    supabase
      .from("armada")
      .select("id,kode,plat")
      .order("kode")
      .then(({ data }) => setUnits(data ?? []));
  }, [perm]);

  if (!perm) {
    return <div className="text-sm text-red-600">Kamu tidak punya akses untuk halaman ini.</div>;
  }

  return (
    <div>
      <h1 className="text-lg font-semibold mb-3">Laporan Biaya Per Unit</h1>

      {/* Filter */}
      <div className="bg-white shadow-sm border rounded-lg p-3 mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs mb-1">Dari tanggal</label>
          <input
            type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs mb-1">Sampai tanggal</label>
          <input
            type="date" value={fTo} onChange={(e) => setFTo(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs mb-1">Unit</label>
          <select
            value={selUnit}
            onChange={(e) => {
              const v = e.target.value;
              setSelUnit(v);
              load({ q: v });
            }}
            className="border rounded px-2 py-1.5 text-sm bg-white"
          >
            <option value="">Semua Unit</option>
            {units.map((u) => (
              <option key={u.id} value={u.kode}>
                {u.kode} - {u.plat}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1 max-w-xs">
          <label className="block text-xs mb-1">Cari (nopol / kode / no SPK)</label>
          <input
            value={fQ} onChange={(e) => setFQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
            placeholder="cth: AB 7022 / PR104 / SPK-2611-00002"
            className="border rounded px-2 py-1.5 text-sm w-full"
          />
        </div>
        <button
          onClick={load} disabled={loading}
          className="text-sm bg-blue-600 text-white rounded px-4 py-1.5 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Memuat…" : "Cari"}
        </button>
        <button
          onClick={() => { const d = monthBounds(); setFFrom(d.from); setFTo(d.to); setFQ(""); setSelUnit(""); load({ q: "", from: d.from, to: d.to }); }}
          className="text-sm border rounded px-4 py-1.5 hover:bg-gray-50"
        >
          Reset
        </button>
      </div>

      {msg && <div className="text-sm text-red-600 mb-3">{msg}</div>}

      {/* Tabel */}
      <div className="bg-white shadow-sm border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs uppercase text-gray-600">
                <th className="px-3 py-2">Kode</th>
                <th className="px-3 py-2">Nopol</th>
                <th className="px-3 py-2">Tipe</th>
                <th className="px-3 py-2 text-right">Jumlah SPK</th>
                <th className="px-3 py-2 text-right">Total Biaya</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                    Tidak ada data untuk periode/filter ini.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.kode} className="border-t">
                  <td className="px-3 py-2 font-medium">{r.kode}</td>
                  <td className="px-3 py-2">{r.plat}</td>
                  <td className="px-3 py-2">{r.tipe || "-"}</td>
                  <td className="px-3 py-2 text-right">{fmtUang(r.spk_count)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmtUang(r.total_biaya)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-gray-50 font-semibold">
                <td colSpan={4} className="px-3 py-2 text-right">Total Keseluruhan</td>
                <td className="px-3 py-2 text-right text-blue-700">{fmtUang(grand)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="text-xs text-gray-400 mt-2">
        Periode: {fmtTanggal(fFrom)} — {fmtTanggal(fTo)} · Biaya = total spare part/perbaikan dari SPK (di luar SPK dibatalkan).
      </div>
    </div>
  );
}
