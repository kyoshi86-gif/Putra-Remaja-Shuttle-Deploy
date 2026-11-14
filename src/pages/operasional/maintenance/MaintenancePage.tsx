import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { hasAccess } from "../../../lib/hasAccess";

interface UnitOption { id: number; kode: string; plat: string; tipe: string; }

interface SpkForm {
  unit_id: string;
  work_type: string;
  mechanic: string;
  work_date: string;
  odometer: string;
  vendor: string;
  schedule_date: string;
  notes: string;
}

interface PartRow { part_name: string; quantity: string; unit_cost: string; }

const empty: SpkForm = {
  unit_id: "", work_type: "corrective", mechanic: "",
  work_date: new Date().toISOString().slice(0, 10),
  odometer: "", vendor: "", schedule_date: "", notes: "",
};

const fmtTanggal = (d: any): string => {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${dt.getFullYear()}`;
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Menunggu",
  IN_PROGRESS: "Sedang Dikerjakan",
  DONE: "Selesai",
  CANCELLED: "Dibatalkan",
};

const fmtNum = (v: string) => {
  const d = (v || "").replace(/\D/g, "");
  return d ? Number(d).toLocaleString("id-ID") : "";
};

export default function MaintenancePage() {
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [form, setForm] = useState<SpkForm>(empty);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [list, setList] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState<string>("");
  const [perm, setPerm] = useState({ start: true, edit: true, finish: true, cancel: true });
  const [inspNotes, setInspNotes] = useState("");

  useEffect(() => {
    loadUnits(); loadList();
    hasAccess("maintenance.start").then((v) => setPerm((p) => ({ ...p, start: v })));
    hasAccess("maintenance.edit").then((v) => setPerm((p) => ({ ...p, edit: v })));
    hasAccess("maintenance.finish").then((v) => setPerm((p) => ({ ...p, finish: v })));
    hasAccess("maintenance.cancel").then((v) => setPerm((p) => ({ ...p, cancel: v })));
    // eslint-disable-next-line
  }, []);

  const loadUnits = async () => {
    const { data } = await supabase.from("armada").select("id, kode, plat, tipe").order("kode");
    if (data) setUnits(data);
  };
  const loadList = async () => {
    const { data } = await supabase.from("maintenance_records").select("*, armada(kode, plat), unit_inspections(action_required, dateline, notes), maintenance_spareparts(part_name, quantity, unit_cost, total)").order("created_at", { ascending: false }).limit(50);
    if (data) setList(data);
  };

  const set = (k: keyof SpkForm, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setPart = (i: number, k: string, v: string) =>
    setParts((p) => p.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  const addPart = () => setParts((p) => [...p, { part_name: "", quantity: "1", unit_cost: "0" }]);
  const removePart = (i: number) => setParts((p) => p.filter((_, idx) => idx !== i));

  const saveSpk = async () => {
    setMsg("");
    if (!editingId) return;
    if (!form.unit_id) return setMsg("Pilih unit");
    if (!form.odometer.trim()) return setMsg("Odometer wajib diisi sebelum menyimpan SPK");
    const body = {
      unit_id: Number(form.unit_id),
      work_type: form.work_type,
      mechanic: form.mechanic || null,
      work_date: form.work_date || null,
      odometer: form.odometer ? Number(form.odometer) : null,
      vendor: form.vendor || null,
      schedule_date: form.schedule_date || null,
      notes: form.notes || null,
    };
    const { error } = await supabase.from("maintenance_records").update(body).eq("id", editingId);
    if (error) return setMsg("Gagal update SPK: " + error.message);
    // ganti spare part: hapus lama, sisipkan baru
    await supabase.from("maintenance_spareparts").delete().eq("maintenance_record_id", editingId);
    for (const p of parts) {
      if (!p.part_name.trim()) continue;
      const qty = Number(p.quantity) || 1;
      const uc = Number(p.unit_cost) || 0;
      await supabase.from("maintenance_spareparts").insert({
        maintenance_record_id: editingId,
        part_name: p.part_name,
        quantity: qty,
        unit_cost: uc,
        total: qty * uc,
      });
    }
    setEditingId(""); setForm(empty); setParts([]); setInspNotes(""); setMsg("SPK diperbarui"); loadList();
  };

  // Edit SPK: isi form + muat spare part yang sudah ada
  const beginEdit = async (r: any) => {
    setEditingId(r.id);
    setInspNotes(r.unit_inspections?.notes || "");
    setForm({
      unit_id: r.unit_id ? String(r.unit_id) : "",
      work_type: r.work_type || "corrective",
      mechanic: r.mechanic || "",
      work_date: r.work_date ? String(r.work_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
      odometer: r.odometer != null ? String(r.odometer) : "",
      vendor: r.vendor || "",
      schedule_date: r.schedule_date ? String(r.schedule_date).slice(0, 10) : "",
      notes: r.notes || "",
    });
    const { data } = await supabase.from("maintenance_spareparts").select("part_name, quantity, unit_cost").eq("maintenance_record_id", r.id);
    setParts(data && data.length ? data.map((x: any) => ({ part_name: x.part_name, quantity: String(x.quantity), unit_cost: String(x.unit_cost) })) : []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const batalEdit = () => {
    setEditingId(""); setForm(empty); setParts([]); setInspNotes(""); setMsg("");
  };

  const mulai = async (id: string) => {
    const { error } = await supabase.from("maintenance_records").update({ status: "IN_PROGRESS", started_at: new Date().toISOString() }).eq("id", id);
    if (!error) loadList(); else setMsg("Gagal mulai: " + error.message);
  };

  const selesai = async (id: string) => {
    const { data: rec } = await supabase.from("maintenance_records").select("odometer, unit_inspections(dateline)").eq("id", id).single();
    if (!rec?.odometer) return setMsg("Odometer belum terisi — klik Edit dulu untuk mengisi odometer sebelum Selesai.");
    // Kunci evaluasi dateline pada saat ini (tidak berubah lagi)
    let evalDays: number | null = null;
    const dl = rec.unit_inspections?.dateline;
    if (dl) {
      const d = new Date(dl);
      const now = new Date();
      const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      evalDays = Math.round((a.getTime() - b.getTime()) / 86400000);
    }
    const { error } = await supabase.from("maintenance_records").update({ status: "DONE", finished_at: new Date().toISOString(), eval_days: evalDays }).eq("id", id);
    if (!error) loadList(); else setMsg("Gagal selesai: " + error.message);
  };

  const batalkan = async (r: any) => {
    if (r.status === "CANCELLED") return;
    const alasan = window.prompt("Alasan pembatalan (wajib diisi):", "");
    if (alasan === null) return;
    if (!alasan.trim()) return setMsg("Alasan pembatalan wajib diisi");
    const { error } = await supabase.from("maintenance_records").update({ status: "CANCELLED", cancel_reason: alasan.trim(), finished_at: new Date().toISOString() }).eq("id", r.id);
    if (!error) { setMsg("SPK dibatalkan"); loadList(); } else setMsg("Gagal batal: " + error.message);
  };

  const sisaHari = (dl: any, ev: any, status?: string) => {
    // Sudah selesai (DONE) & terkunci → bandingkan dengan tanggal selesai
    if (status === "DONE" && ev != null) {
      const n = Number(ev);
      if (n > 0) return { txt: `Lebih awal ${n} hari`, cls: "text-emerald-600 font-medium" };
      if (n < 0) return { txt: `Lambat ${Math.abs(n)} hari`, cls: "text-red-600 font-semibold" };
      return { txt: "Tepat waktu", cls: "text-orange-500 font-semibold" };
    }
    // Belum selesai → dinamis terhadap hari ini
    if (!dl) return null;
    const d = new Date(dl);
    const now = new Date();
    const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((a.getTime() - b.getTime()) / 86400000);
    if (diff < 0) return { txt: `Terlewat ${Math.abs(diff)} hari`, cls: "text-red-600 font-semibold" };
    if (diff === 0) return { txt: "Hari ini", cls: "text-orange-500 font-semibold" };
    return { txt: `${diff} hari lagi`, cls: "text-emerald-600 font-medium" };
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Maintenance Unit (SPK)</h1>

      {/* FORM EDIT — hanya muncul saat edit (setelah Mulai) */}
      {editingId && (
        <div className="border rounded-lg p-4 bg-white shadow-sm mb-4">
          <h2 className="font-semibold mb-3">Edit SPK</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs mb-1">Unit *</label>
              <select value={form.unit_id} disabled className="w-full border rounded px-2 py-1 bg-gray-100 text-gray-600">
                <option value="">-- pilih --</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.kode} - {u.plat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">Tanggal Kerja *</label>
              <input type="date" value={form.work_date} readOnly className="w-full border rounded px-2 py-1 bg-gray-100 text-gray-600" />
            </div>
            <div>
              <label className="block text-xs mb-1">Jenis Pekerjaan</label>
              <select value={form.work_type} disabled className="w-full border rounded px-2 py-1 bg-gray-100 text-gray-600">
                <option value="preventive">Preventive Maintenance</option>
                <option value="corrective">Corrective (Perbaikan)</option>
                <option value="berkala">Pemeriksaan Berkala</option>
                <option value="pajak">Pajak/STNK/KIR/Asuransi</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">Mekanik</label>
              <input value={form.mechanic} readOnly className="w-full border rounded px-2 py-1 bg-gray-100 text-gray-600" />
            </div>
            <div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1">Odometer (km)</label>
                  <input inputMode="numeric" value={fmtNum(form.odometer)} onChange={(e) => set("odometer", e.target.value.replace(/\D/g, ""))} className="w-full border rounded px-2 py-1" />
                </div>
                <div>
                  <label className="block text-xs mb-1">Jadwal Maintenance Berikutnya</label>
                  <input type="date" value={form.schedule_date} onChange={(e) => set("schedule_date", e.target.value)} className="w-full border rounded px-2 py-1" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1">Vendor/Bengkel</label>
              <input value={form.vendor} onChange={(e) => set("vendor", e.target.value)} className="w-full border rounded px-2 py-1" />
            </div>
          </div>

          {inspNotes && (
            <div className="mb-3 border border-red-200 bg-red-50 rounded px-3 py-2">
              <div className="text-xs font-semibold text-red-700 mb-1">Catatan Inspeksi (keluhan)</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{inspNotes}</div>
            </div>
          )}

          <div className="mt-2">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold">Spare Part / Perbaikan</label>
              <button onClick={addPart} className="text-blue-600 text-sm">+ Tambah</button>
            </div>
            {parts.length === 0 && <div className="text-xs text-gray-400">Belum ada spare part</div>}
            {parts.map((p, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input value={p.part_name} onChange={(e) => setPart(i, "part_name", e.target.value)} placeholder="Nama part" className="flex-1 border rounded px-2 py-1 text-sm" />
                <input value={p.quantity} onChange={(e) => setPart(i, "quantity", e.target.value)} placeholder="Qty" className="w-14 border rounded px-2 py-1 text-sm" />
                <input value={fmtNum(p.unit_cost)} onChange={(e) => setPart(i, "unit_cost", e.target.value.replace(/\D/g, ""))} placeholder="Harga" className="w-24 border rounded px-2 py-1 text-sm" />
                <button onClick={() => removePart(i)} className="text-red-500 text-sm">Hapus</button>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <label className="block text-xs mb-1">Catatan</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className="w-full border rounded px-2 py-1" rows={2} />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={saveSpk} className="bg-blue-600 text-white px-4 py-2 rounded flex-1">Perbarui SPK</button>
            <button onClick={batalEdit} className="border border-gray-400 text-gray-600 px-4 py-2 rounded">Batal</button>
          </div>
          {msg && <div className="mt-2 text-sm text-blue-700">{msg}</div>}
        </div>
      )}

      {/* DAFTAR SPK */}
      <h2 className="font-semibold mb-3">Daftar SPK</h2>
      {list.length === 0 && <div className="text-sm text-gray-400">Belum ada SPK</div>}
      {list.map((r) => (
        <div key={r.id} className="border rounded-lg p-3 mb-2 bg-white shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* KIRI: info SPK + aksi */}
            <div className="min-w-0">
              <div className="flex justify-between text-xs gap-2 flex-wrap">
                <span className="font-semibold">{r.armada?.kode} {r.armada?.plat}</span>
                <span className={"px-2 py-0.5 rounded text-xs whitespace-nowrap " + (r.status === "DONE" ? "bg-green-100 text-green-800" : r.status === "IN_PROGRESS" ? "bg-yellow-100 text-yellow-800" : r.status === "CANCELLED" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700")}>{STATUS_LABEL[r.status] || r.status}</span>
              </div>
              <div className="text-xs text-gray-600 mt-1 flex justify-between gap-2 items-center flex-wrap">
                <span>SPK: <b>{r.spk_no || "-"}</b> · Mekanik: {r.mechanic || "-"} · {r.work_type}</span>
                {(() => { const s = sisaHari(r.unit_inspections?.dateline, r.eval_days, r.status); return s ? <span className={s.cls}>{s.txt}</span> : null; })()}
              </div>
              <div className="text-xs text-gray-600 mt-1">Tgl SPK: {fmtTanggal(r.work_date)} · Dateline: {r.unit_inspections?.dateline ? fmtTanggal(r.unit_inspections.dateline) : "-"}</div>
              {r.unit_inspections?.notes && (
                <div className="text-xs mt-1 border border-red-200 bg-red-50 rounded px-2 py-1">
                  <span className="font-semibold text-red-700">Catatan Inspeksi (keluhan): </span>
                  <span className="text-gray-700 whitespace-pre-wrap">{r.unit_inspections.notes}</span>
                </div>
              )}
              {r.started_at && <div className="text-xs text-gray-500 mt-1">Mulai: {fmtTanggal(r.started_at)}</div>}
              {r.finished_at && <div className="text-xs text-gray-500">Selesai: {fmtTanggal(r.finished_at)}</div>}
              {r.cancel_reason && <div className="text-xs text-red-600 mt-1">Alasan batal: {r.cancel_reason}</div>}

              <div className="flex gap-3 mt-2 flex-wrap">
                {r.status === "OPEN" && perm.start && (
                  <button onClick={() => mulai(r.id)} className="text-xs text-yellow-700 underline">Mulai</button>
                )}
                {r.status === "IN_PROGRESS" && (
                  <>
                    {perm.edit && <button onClick={() => beginEdit(r)} className="text-xs text-blue-700 underline">Edit</button>}
                    {perm.finish && <button onClick={() => selesai(r.id)} className="text-xs text-green-700 underline">Selesai</button>}
                  </>
                )}
                {r.status !== "CANCELLED" && r.status !== "DONE" && perm.cancel && (
                  <button onClick={() => batalkan(r)} className="text-xs text-red-600 underline">Batalkan</button>
                )}
              </div>
            </div>

            {/* KANAN: sparepart + catatan (sejajar, hemat space) */}
            <div className="min-w-0 border-t md:border-t-0 md:border-l md:pl-3 pt-2 md:pt-0">
              {r.maintenance_spareparts && r.maintenance_spareparts.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Spare Part / Perbaikan</div>
                  {r.maintenance_spareparts.map((sp: any, i: number) => (
                    <div key={i} className="text-xs text-gray-600 flex justify-between gap-2">
                      <span className="whitespace-normal break-words">{sp.part_name}</span>
                      <span className="whitespace-nowrap text-gray-400">x{sp.quantity} · {Number(sp.unit_cost || 0).toLocaleString("id-ID")}</span>
                    </div>
                  ))}
                  <div className="mt-1.5 pt-1 border-t border-gray-300 flex justify-between gap-2 text-xs font-bold text-gray-900">
                    <span>Total</span>
                    <span className="whitespace-nowrap">Rp {r.maintenance_spareparts.reduce((s: number, sp: any) => s + (Number(sp.total) || 0), 0).toLocaleString("id-ID")}</span>
                  </div>
                </div>
              )}
              {r.notes && (
                <div className={r.maintenance_spareparts && r.maintenance_spareparts.length > 0 ? "mt-2" : ""}>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Catatan</div>
                  <div className="text-xs text-gray-600 whitespace-normal break-words">{r.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
