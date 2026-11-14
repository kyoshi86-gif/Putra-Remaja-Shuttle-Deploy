import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { hasAccess } from "../../../lib/hasAccess";

export default function JadwalMaintenancePage() {
  const [list, setList] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [perm, setPerm] = useState({ validate: false, edit: true });

  useEffect(() => {
    loadList();
    hasAccess("maintenance.validate").then((v) => setPerm((p) => ({ ...p, validate: v })));
    hasAccess("maintenance.edit").then((v) => setPerm((p) => ({ ...p, edit: v })));
    /* eslint-disable-next-line */
  }, []);

  const loadList = async () => {
    const { data } = await supabase
      .from("maintenance_records")
      .select("*, armada(kode, plat), unit_inspections(action_required, dateline), maintenance_spareparts(part_name, quantity, total)")
      .order("created_at", { ascending: false });
    if (data) setList(data);
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
    let diff: number | null = null;
    if (dl) {
      const d = new Date(dl);
      const now = new Date();
      const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      diff = Math.round((a.getTime() - b.getTime()) / 86400000);
    }
    if (diff === null) return null;
    if (diff < 0) return { txt: `Terlewat ${Math.abs(diff)} hari`, cls: "text-red-600 font-semibold" };
    if (diff === 0) return { txt: "Hari ini", cls: "text-orange-500 font-semibold" };
    return { txt: `${diff} hari lagi`, cls: "text-emerald-600 font-medium" };
  };

  const update = async (id: string, patch: any) => {
    const { error } = await supabase.from("maintenance_records").update(patch).eq("id", id);
    if (error) return setMsg("Gagal: " + error.message);
    setMsg("Tersimpan");
    loadList();
  };

  const validate = async (id: string) => {
    const u = localStorage.getItem("custom_user");
    let supervisor = "supervisor";
    if (u) { try { const j = JSON.parse(u); supervisor = j.name || j.email || supervisor; } catch {} }
    const { error } = await supabase.from("maintenance_records").update({
      validated: true,
      supervised_by: supervisor,
      supervised_at: new Date().toISOString(),
      status: "DONE",
    }).eq("id", id);
    if (error) return setMsg("Gagal validasi: " + error.message);
    setMsg("Validasi selesai disimpan");
    loadList();
  };

  const fmtDt = (v: string) => {
    if (!v) return "-";
    const p = (n: number) => String(n).padStart(2, "0");
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, d] = v.split("-");
      return `${d}-${m}-${y}`;
    }
    const dt = new Date(v);
    return `${p(dt.getDate())}-${p(dt.getMonth() + 1)}-${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Jadwal & Validasi Maintenance</h1>
      {msg && <div className="mb-3 text-sm text-blue-700">{msg}</div>}

      {list.length === 0 && <div className="text-sm text-gray-400">Belum ada maintenance</div>}

      {list.map((r) => {
        const totalFix = (r.maintenance_spareparts || []).reduce((s: number, p: any) => s + (Number(p.total) || 0), 0);
        const sisa = sisaHari(r.unit_inspections?.dateline, r.eval_days, r.status);
        return (
        <div key={r.id} className="border rounded-lg p-4 mb-3 bg-white shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold">{r.armada?.kode} {r.armada?.plat} · <span className="text-gray-600 font-normal">{r.spk_no || "-"}</span></span>
            <span className={`px-2 py-0.5 rounded text-xs ${r.validated ? "bg-green-100 text-green-700" : r.status === "DONE" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100"}`}>
              {r.validated ? "VALIDASI SELESAI" : r.status}
            </span>
          </div>

          {/* EVALUASI — sejajar (grid), bukan menumpuk */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm mb-3">
            <div>
              <div className="text-xs text-gray-500">Odometer</div>
              <div className="font-medium">{r.odometer != null ? Number(r.odometer).toLocaleString("id-ID") + " km" : "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Total Perbaikan</div>
              <div className="font-medium">Rp {totalFix.toLocaleString("id-ID")}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Dateline / Evaluasi</div>
              <div className="font-medium">{r.unit_inspections?.dateline ? fmtDt(r.unit_inspections.dateline) : "-"} {sisa && <span className={sisa.cls}> · {sisa.txt}</span>}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Mekanik</div>
              <div className="font-medium">{r.mechanic || "-"}</div>
            </div>
          </div>

          {r.notes && (
            <div className="mb-2 text-xs">
              <span className="font-semibold text-gray-700">Catatan Mekanik: </span>
              <span className="text-gray-600 whitespace-normal break-words">{r.notes}</span>
            </div>
          )}

          {r.maintenance_spareparts?.length > 0 && (
            <div className="mb-2 text-xs">
              <div className="font-semibold text-gray-700 mb-1">Spare Part:</div>
              {r.maintenance_spareparts.map((p: any, i: number) => (
                <div key={i}>• {p.part_name} × {p.quantity} = Rp {Number(p.total).toLocaleString("id-ID")}</div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <label className="block">
              <span className="text-xs text-gray-500">Jadwal Berikutnya</span>
              <input
                type="date"
                defaultValue={r.schedule_date || ""}
                key={r.id + "-sched"}
                onBlur={(e) => perm.edit && update(r.id, { schedule_date: e.target.value || null })}
                disabled={!perm.edit}
                className="w-full border rounded px-2 py-1 disabled:bg-gray-100"
              />
            </label>
            <div className="block">
              <span className="text-xs text-gray-500">Validasi</span>
              <div className="border rounded px-2 py-1 bg-gray-50 text-xs text-gray-600">
                {r.validated
                  ? `Divalidasi ${fmtDt(r.supervised_at)} oleh ${r.supervised_by || "-"}`
                  : r.status === "DONE"
                    ? "Menunggu validasi (tanggal mengikuti sistem)"
                    : "Belum selesai dikerjakan"}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => validate(r.id)}
              disabled={!perm.validate || r.validated || r.status !== "DONE"}
              className="bg-green-600 text-white px-4 py-1.5 rounded text-sm disabled:opacity-40"
            >
              {r.validated
                ? "Sudah Divalidasi"
                : r.status !== "DONE"
                  ? "Menunggu Selesai"
                  : "Validasi Selesai"}
            </button>
            <span className="text-xs text-gray-500">Supervisi: {r.supervised_by || "-"}</span>
          </div>
        </div>
        );
      })}
    </div>
  );
}
