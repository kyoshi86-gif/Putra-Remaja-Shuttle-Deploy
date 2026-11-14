import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { hasAccess } from "../../../lib/hasAccess";

const LS_KEY = "inspeksi_local_draft";

// ---------- Format tanggal dd/mm/yyyy ----------
function fmtTanggal(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ---------- Konversi client-side: file -> WebP blob (preservasi kualitas) ----------
function fileToWebp(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        // Longgar: hanya turunkan bila DI ATAS 1600px (foto ponsel 2000-4000px
        // tetap tajam; tidak ada pembesaran)
        if (w > 1600 || h > 1600) {
          const s = Math.min(1600 / w, 1600 / h);
          w = Math.round(w * s);
          h = Math.round(h * s);
        }
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext("2d");
        if (!ctx) throw new Error("canvas tidak didukung");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        cv.toBlob(
          (b) => {
            URL.revokeObjectURL(url);
            if (b) resolve(b);
            else reject(new Error("konversi WebP gagal"));
          },
          "image/webp",
          0.92
        );
      } catch (e: any) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("gagal membaca gambar"));
    };
    img.src = url;
  });
}

// ---------- Ilustrasi unit Hiace (gambar user dari public/images/hiace) ----------
type SiluetProps = { view: "front" | "rear" | "left" | "right" };

const HIA__IMAGES: Record<string, string> = {
  front: "/images/hiace/Hiace_depan.png",
  rear: "/images/hiace/Hiace_belakang.png",
  left: "/images/hiace/Hiace_kiri.png",
  right: "/images/hiace/Hiace_kanan.png",
};

function SiluetHiace({ view }: SiluetProps) {
  return (
    <img
      src={HIA__IMAGES[view]}
      alt={`Ilustrasi unit Hiace ${view}`}
      className="w-full h-full object-contain select-none pointer-events-none"
      draggable={false}
    />
  );
}

// ============ TIPE & KONSTAN ============
type SideKey = "front" | "rear" | "left" | "right";
interface SideState { note: string; imageUrl: string; uploading: boolean; }
const SIDE_LABEL: Record<SideKey, string> = { front: "Depan", rear: "Belakang", left: "Kiri", right: "Kanan" };
const SIDE_COL: Record<SideKey, string> = {
  front: "front_image_url", rear: "rear_image_url", left: "left_image_url", right: "right_image_url",
};
const EMPTY_SIDES: Record<SideKey, SideState> = {
  front: { note: "", imageUrl: "", uploading: false },
  rear: { note: "", imageUrl: "", uploading: false },
  left: { note: "", imageUrl: "", uploading: false },
  right: { note: "", imageUrl: "", uploading: false },
};

interface LocalDraft {
  unitId: string;
  inspectionDate: string;
  officer: string;
  odometer: string;
  actionRequired: string;
  workType: string;
  dateline: string;
  notes: string;
  sides: Record<SideKey, { note: string; imageUrl: string }>;
}

function readLocalDraft(): LocalDraft | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || !j.sides) return null;
    return j;
  } catch { return null; }
}

function writeLocalDraft(d: LocalDraft | null) {
  try {
    if (d) localStorage.setItem(LS_KEY, JSON.stringify(d));
    else localStorage.removeItem(LS_KEY);
  } catch { /* abaikan */ }
}

function storagePathFromUrl(url: string): string {
  const i = url.indexOf("/storage/v1/object/public/inspection-images/");
  if (i === -1) return url;
  return url.slice(i + "/storage/v1/object/public/inspection-images/".length);
}

// ============ SideCard: komponen level modul (stabil) ============
interface SideCardProps {
  side: SideKey;
  state: SideState;
  onNoteChange: (v: string) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.MutableRefObject<Record<SideKey, HTMLInputElement | null>>;
  cameraInputRef: React.MutableRefObject<Record<SideKey, HTMLInputElement | null>>;
}

function SideCard({ side, state, onNoteChange, onFileChange, fileInputRef, cameraInputRef }: SideCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="border rounded-lg p-3 bg-white flex flex-col">
      <div className="text-center font-bold mb-2 bg-gray-100 py-1 rounded">{SIDE_LABEL[side]}</div>
      <div className="h-40 border-2 border-dashed border-blue-300 rounded flex items-center justify-center overflow-hidden bg-gray-50">
        {state.imageUrl ? (
          <img src={state.imageUrl} alt={SIDE_LABEL[side]} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full"><SiluetHiace view={side} /></div>
        )}
      </div>
      <div className="relative mt-2">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          disabled={state.uploading}
          className="w-full border border-blue-400 text-blue-600 text-xs rounded py-1 hover:bg-blue-50 disabled:opacity-50"
        >
          {state.uploading ? "Mengonversi WebP..." : state.imageUrl ? "Ganti Foto" : `Upload Foto ${SIDE_LABEL[side]}`}
        </button>
        {menuOpen && !state.uploading && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-1 z-30 bg-white border rounded shadow-lg w-44 overflow-hidden text-xs">
              <button
                className="w-full text-left px-3 py-2 hover:bg-gray-50"
                onClick={() => { fileInputRef?.current?.[side]?.click(); setMenuOpen(false); }}
              >
                📁 Pilih File / Galeri
              </button>
              <button
                className="w-full text-left px-3 py-2 hover:bg-gray-50"
                onClick={() => { cameraInputRef?.current?.[side]?.click(); setMenuOpen(false); }}
              >
                📷 Buka Kamera
              </button>
            </div>
          </>
        )}
      </div>
      <input ref={(el) => { if (fileInputRef?.current) fileInputRef.current[side] = el; }} type="file" accept="image/*" hidden onChange={onFileChange} />
      <input ref={(el) => { if (cameraInputRef?.current) cameraInputRef.current[side] = el; }} type="file" accept="image/*" capture="environment" hidden onChange={onFileChange} />
      <textarea
        value={state.note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder={`Catatan ${SIDE_LABEL[side].toLowerCase()}...`}
        className="w-full border rounded px-2 py-1 text-xs mt-2"
        rows={2}
      />
    </div>
  );
}

// ============ HALAMAN ============
interface UnitOption { id: number; kode: string; plat: string; tipe: string; status: string; }
interface DraftRow {
  id: string;
  unit_id: number | null;
  inspection_date: string | null;
  officer: string | null;
  action_required: string | null;
  work_type: string | null;
  dateline: string | null;
  notes: string | null;
  front_note: string | null; rear_note: string | null;
  left_note: string | null; right_note: string | null;
  front_image_url: string | null; rear_image_url: string | null;
  left_image_url: string | null; right_image_url: string | null;
}

function initialFromLocal(): {
  unitId: string; inspectionDate: string; officer: string; odometer: string; actionRequired: string; workType: string; dateline: string; notes: string; sides: Record<SideKey, SideState>;
} {
  const ld = readLocalDraft();
  return {
    unitId: ld?.unitId ?? "",
    inspectionDate: ld?.inspectionDate ?? new Date().toISOString().slice(0, 10),
    officer: ld?.officer ?? "",
    odometer: ld?.odometer ?? "",
    actionRequired: ld?.actionRequired ?? "TIDAK",
    workType: ld?.workType ?? "corrective",
    dateline: ld?.dateline ?? "",
    notes: ld?.notes ?? "",
    sides: ld
      ? {
          front: { note: ld.sides.front?.note ?? "", imageUrl: ld.sides.front?.imageUrl ?? "", uploading: false },
          rear: { note: ld.sides.rear?.note ?? "", imageUrl: ld.sides.rear?.imageUrl ?? "", uploading: false },
          left: { note: ld.sides.left?.note ?? "", imageUrl: ld.sides.left?.imageUrl ?? "", uploading: false },
          right: { note: ld.sides.right?.note ?? "", imageUrl: ld.sides.right?.imageUrl ?? "", uploading: false },
        }
      : EMPTY_SIDES,
  };
}

const fmtNum = (v: string) => {
  const d = (v || "").replace(/\D/g, "");
  return d ? Number(d).toLocaleString("id-ID") : "";
};

export default function InspeksiUnitPage() {
  const init = initialFromLocal();
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [list, setList] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState<"info" | "warn">("info");
  const showMsg = (t: string, kind: "info" | "warn" = "info") => { setMsg(t); setMsgKind(kind); };
  const [detail, setDetail] = useState<any>(null);
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  // ---- Pencarian & pagination (server-side via RPC) ----
  const monthBounds = () => {
    const n = new Date();
    const e = new Date(n.getFullYear(), n.getMonth() + 1, 0);
    return {
      from: `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`,
      to: `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`,
    };
  };
  const [fQ, setFQ] = useState("");
  const [fFrom, setFFrom] = useState(() => monthBounds().from);
  const [fTo, setFTo] = useState(() => monthBounds().to);
  const [pag, setPag] = useState({ page: 1, pageSize: 6, total: 0 });
  const [officer, setOfficer] = useState(init.officer);
  const [odometer, setOdometer] = useState(init.odometer);
  const [unitId, setUnitId] = useState(init.unitId);
  const [inspectionDate, setInspectionDate] = useState(init.inspectionDate);
  const [actionRequired, setActionRequired] = useState(init.actionRequired);
  const [workType, setWorkType] = useState(init.workType);
  const [dateline, setDateline] = useState(init.dateline);
  const [notes, setNotes] = useState(init.notes);
  const [sides, setSides] = useState<Record<SideKey, SideState>>(init.sides);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [perm, setPerm] = useState({ create: true, edit: false, del: false });
  const fileRef = useRef<Record<SideKey, HTMLInputElement | null>>({ front: null, rear: null, left: null, right: null });
  const cameraRef = useRef<Record<SideKey, HTMLInputElement | null>>({ front: null, rear: null, left: null, right: null });
  // Draft lokal yang sudah ada SEBELUM halaman ini terbuka (sisa dari kunjungan sebelumnya)
  const initialLeftover = useRef<boolean>(!!readLocalDraft());
  const [bannerSeen, setBannerSeen] = useState(false);
  const firstSync = useRef(true);

  // ---- sinkronisasi draft lokal (localStorage) setiap ada perubahan ----
  useEffect(() => {
    // Begitu user mulai mengubah form (setelah render pertama), sembunyikan banner.
    if (firstSync.current) {
      firstSync.current = false;
    } else {
      setBannerSeen(true);
    }
    const hasContent =
      unitId || notes ||
      Object.values(sides).some((s) => s.note || s.imageUrl);
    if (hasContent) {
      writeLocalDraft({
        unitId, inspectionDate, officer, odometer, actionRequired, workType, dateline, notes,
        sides: {
          front: { note: sides.front.note, imageUrl: sides.front.imageUrl },
          rear: { note: sides.rear.note, imageUrl: sides.rear.imageUrl },
          left: { note: sides.left.note, imageUrl: sides.left.imageUrl },
          right: { note: sides.right.note, imageUrl: sides.right.imageUrl },
        },
      });
    } else {
      writeLocalDraft(null);
    }
  }, [unitId, inspectionDate, officer, odometer, actionRequired, workType, dateline, notes, sides]);

  useEffect(() => {
    loadUnits(); loadList(); loadUser(); loadDrafts();
    hasAccess("inspeksi.edit").then((v) => setPerm((p) => ({ ...p, edit: v })));
    hasAccess("inspeksi.delete").then((v) => setPerm((p) => ({ ...p, del: v })));
    hasAccess("inspeksi.create").then((v) => setPerm((p) => ({ ...p, create: v })));
    /* eslint-disable-next-line */
  }, []);

  const loadUser = () => {
    const u = localStorage.getItem("custom_user");
    if (u) { try { const j = JSON.parse(u); setOfficer((cur) => cur || j.name || j.email || ""); } catch {} }
  };

  const loadUnits = async () => {
    const { data } = await supabase.from("armada").select("id, kode, plat, tipe, status").order("kode");
    if (data) setUnits(data);
  };

  const loadList = async (opts?: { page?: number; q?: string; from?: string; to?: string }) => {
    const pg = opts?.page ?? pag.page;
    const qq = opts?.q !== undefined ? opts.q : fQ;
    const ff = opts?.from !== undefined ? opts.from : fFrom;
    const tt = opts?.to !== undefined ? opts.to : fTo;
    const { data, error } = await supabase.rpc("search_inspeksi", {
      q: qq.trim() || null,
      d_from: ff || null,
      d_to: tt || null,
      p_limit: pag.pageSize,
      p_offset: (pg - 1) * pag.pageSize,
    });
    if (error) { console.error(error); return; }
    const res: any = data;
    setList((res?.rows || []) as any[]);
    setPag((p) => ({ ...p, page: pg, total: Number(res?.total || 0) }));
  };

  const cari = () => loadList({ page: 1 });
  const resetFilter = () => {
    const b = monthBounds();
    setFQ(""); setFFrom(b.from); setFTo(b.to);
    loadList({ page: 1, q: "", from: b.from, to: b.to });
  };

  const loadDrafts = async () => {
    const { data } = await supabase
      .from("unit_inspections")
      .select("*")
      .eq("status", "DRAFT")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setDrafts(data);
  };

  const uploadImage = async (side: SideKey, file: File) => {
    setSides((s) => ({ ...s, [side]: { ...s[side], uploading: true } }));
    try {
      const blob = await fileToWebp(file);
      const name = `insp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.webp`;
      const { error } = await supabase.storage.from("inspection-images").upload(name, blob, { contentType: "image/webp", upsert: false });
      if (error) throw new Error(error.message);
      const { data: pub } = supabase.storage.from("inspection-images").getPublicUrl(name);
      setSides((s) => ({ ...s, [side]: { ...s[side], imageUrl: pub.publicUrl, uploading: false } }));
      setMsg("Foto terupload (belum disimpan — klik Simpan Inspeksi)");
    } catch (e: any) {
      setSides((s) => ({ ...s, [side]: { ...s[side], uploading: false } }));
      setMsg("Upload gagal: " + (e.message || e));
    }
  };

  const onFileChange = (side: SideKey, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) uploadImage(side, f);
  };

  const buildPayload = (status: string) => ({
    status,
    unit_id: unitId ? Number(unitId) : null,
    inspection_date: inspectionDate || null,
    officer: officer || "draft",
    front_note: sides.front.note || null,
    rear_note: sides.rear.note || null,
    left_note: sides.left.note || null,
    right_note: sides.right.note || null,
    front_image_url: sides.front.imageUrl || null,
    rear_image_url: sides.rear.imageUrl || null,
    left_image_url: sides.left.imageUrl || null,
    right_image_url: sides.right.imageUrl || null,
    action_required: actionRequired,
    odometer: odometer ? Number(odometer) : null,
    work_type: actionRequired === "PERBAIKAN" ? workType : null,
    dateline: actionRequired === "PERBAIKAN" ? dateline || null : null,
    notes: notes || null,
  });

  // ---- lanjutkan draft DB ----
  const continueDraft = (d: DraftRow) => {
    setDraftId(d.id);
    setUnitId(d.unit_id ? String(d.unit_id) : "");
    setInspectionDate(new Date().toISOString().slice(0, 10));
    setOfficer(d.officer || officer);
    setOdometer(d.odometer != null ? String(d.odometer) : "");
    setActionRequired(d.action_required || "TIDAK");
    setWorkType(d.work_type || "corrective");
    setDateline(d.dateline || "");
    setNotes(d.notes || "");
    setSides({
      front: { note: d.front_note || "", imageUrl: d.front_image_url || "", uploading: false },
      rear: { note: d.rear_note || "", imageUrl: d.rear_image_url || "", uploading: false },
      left: { note: d.left_note || "", imageUrl: d.left_image_url || "", uploading: false },
      right: { note: d.right_note || "", imageUrl: d.right_image_url || "", uploading: false },
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteBucketImages = async (urls: (string | null)[]) => {
    const paths = urls.filter(Boolean).map((u) => storagePathFromUrl(u!));
    if (paths.length) {
      // storage.remove langsung (policy DELETE sudah aktif; terverifikasi berhasil)
      const { error } = await supabase.storage.from("inspection-images").remove(paths);
      if (error) console.error("storage.remove error:", error.message);
    }
  };

  // State terbaru untuk dibaca di cleanup (hindari closure basi)
  const latestRef = useRef({ editingId: null as string | null, draftId: null as string | null, sides });
  latestRef.current = { editingId, draftId, sides };

  // Saat meninggalkan halaman (unmount) tanpa menyimpan:
  // - fresh creation (bukan edit, bukan lanjut draft DB): hapus foto orphan yang baru diupload + bersihkan draft
  // - edit/lanjut draft DB: hanya bersihkan draft (jangan hapus foto milik record DB)
  useEffect(() => {
    return () => {
      const l = latestRef.current;
      if (!l.editingId && !l.draftId) {
        const imgs = Object.values(l.sides).map((s: any) => s.imageUrl).filter(Boolean);
        if (imgs.length) deleteBucketImages(imgs);
      }
      writeLocalDraft(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tutup zoom foto dengan tombol Escape (sama seperti klik ✕; tidak menutup modal detail)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomImg(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- hapus draft DB + foto ----
  const deleteDraft = async (d: DraftRow) => {
    await deleteBucketImages([d.front_image_url, d.rear_image_url, d.left_image_url, d.right_image_url]);
    const { error } = await supabase.from("unit_inspections").delete().eq("id", d.id);
    if (!error) {
      if (draftId === d.id) { setDraftId(null); }
      setMsg("Draft + foto dihapus");
      loadDrafts();
    } else setMsg("Gagal hapus draft: " + error.message);
  };

  // ---- bersihkan form; simpan foto preview jika deletePhotos=false ----
  const cleanForm = async (deletePhotos: boolean) => {
    let nextSides = EMPTY_SIDES;
    if (!deletePhotos) {
      // hanya bersihkan teks; pertahankan preview foto
      nextSides = {
        front: { note: "", imageUrl: sides.front.imageUrl, uploading: false },
        rear: { note: "", imageUrl: sides.rear.imageUrl, uploading: false },
        left: { note: "", imageUrl: sides.left.imageUrl, uploading: false },
        right: { note: "", imageUrl: sides.right.imageUrl, uploading: false },
      };
    } else {
      const urls = [sides.front.imageUrl, sides.rear.imageUrl, sides.left.imageUrl, sides.right.imageUrl].filter(Boolean) as string[];
      await deleteBucketImages(urls);
    }
    writeLocalDraft(null);
    setUnitId(""); setNotes(""); setActionRequired("TIDAK"); setWorkType("corrective"); setDateline(""); setSides(nextSides);
    setEditingId(null);
    setInspectionDate(new Date().toISOString().slice(0, 10));
    setMsg(deletePhotos ? "Form dibersihkan + foto dihapus dari bucket" : "Form dibersihkan (foto tetap tampil)");
  };

  // ---- hapus draft lokal (localStorage) + foto bucket ----
  const discardLocalDraft = () => cleanForm(true);

  // ---- Simpan final (DB) ----
  const save = async () => {
    setMsg(""); setMsgKind("info");
    if (!unitId) { window.alert("⚠️ Unit belum dipilih — inspeksi tidak tersimpan.\nSilakan pilih unit terlebih dahulu."); return; }
    if (!odometer.trim()) { window.alert("⚠️ Odometer belum diisi — inspeksi TIDAK tersimpan.\nSilakan isi odometer untuk menyimpan."); return; }
    const payload = buildPayload("OPEN");
    let error: any = null;
    let inspectionId: string | null = null;
    if (editingId) {
      inspectionId = editingId;
      ({ error } = await supabase.from("unit_inspections").update(payload).eq("id", editingId));
    } else if (draftId) {
      inspectionId = draftId;
      ({ error } = await supabase.from("unit_inspections").update(payload).eq("id", draftId));
    } else {
      const { data: ins, error: insErr } = await supabase.from("unit_inspections").insert(payload).select("id").single();
      error = insErr;
      inspectionId = ins?.id || null;
    }
    if (error) return setMsg("Gagal simpan: " + error.message);

    // 🔹 Otomatis buat/update SPK bila inspeksi ber-perbaikan
    if (inspectionId && actionRequired === "PERBAIKAN") {
      const { data: existingSpk } = await supabase
        .from("maintenance_records")
        .select("id, status")
        .eq("inspection_id", inspectionId)
        .limit(1);
      if (existingSpk && existingSpk.length > 0) {
        // SPK sudah ada — perbarui isinya hanya bila masih OPEN (belum mulai);
        // setelah mulai, SPK terkunci dan tidak ikut berubah
        const spk = existingSpk[0];
        if (spk.status === "OPEN") {
          await supabase.from("maintenance_records").update({
            unit_id: Number(unitId),
            work_type: workType || "corrective",
            mechanic: officer || "draft",
            work_date: inspectionDate || null,
            odometer: odometer ? Number(odometer) : null,
          }).eq("id", spk.id);
        }
      } else {
        const { error: spkErr } = await supabase.from("maintenance_records").insert({
          unit_id: Number(unitId),
          inspection_id: inspectionId,
          work_type: workType || "corrective",
          mechanic: officer || "draft",
          work_date: inspectionDate || null,
          odometer: odometer ? Number(odometer) : null,
          status: "OPEN",
        });
        if (spkErr) console.error("auto-SPK error:", spkErr.message);
      }
    }

    writeLocalDraft(null);
    setDraftId(null); setEditingId(null);
    setUnitId(""); setActionRequired("TIDAK"); setNotes(""); setOdometer(""); setSides(EMPTY_SIDES);
    setInspectionDate(new Date().toISOString().slice(0, 10));
    setMsg(editingId ? "Inspeksi diperbarui" : "Inspeksi tersimpan (SPK otomatis dibuat)");
    loadList(); loadDrafts();
  };

  // ---- edit inspeksi tersimpan: isi ulang form dari record ----
  const beginEdit = (r: DraftRow) => {
    setDraftId(null);
    setEditingId(r.id);
    setUnitId(r.unit_id ? String(r.unit_id) : "");
    setInspectionDate(new Date().toISOString().slice(0, 10));
    setOfficer(r.officer || "");
    setOdometer(r.odometer != null ? String(r.odometer) : "");
    setActionRequired(r.action_required || "TIDAK");
    setWorkType(r.work_type || "corrective");
    setDateline(r.dateline || "");
    setNotes(r.notes || "");
    setSides({
      front: { note: r.front_note || "", imageUrl: r.front_image_url || "", uploading: false },
      rear: { note: r.rear_note || "", imageUrl: r.rear_image_url || "", uploading: false },
      left: { note: r.left_note || "", imageUrl: r.left_image_url || "", uploading: false },
      right: { note: r.right_note || "", imageUrl: r.right_image_url || "", uploading: false },
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---- batal mode edit: kembalikan form ke kosong ----
  const batalEdit = () => {
    setEditingId(null);
    setDraftId(null);
    writeLocalDraft(null);
    setUnitId(""); setNotes(""); setOdometer(""); setActionRequired("TIDAK"); setWorkType("corrective"); setDateline("");
    setSides(EMPTY_SIDES);
    setInspectionDate(new Date().toISOString().slice(0, 10));
    setMsg("Edit dibatalkan");
  };

  // ---- hapus inspeksi tersimpan + foto ----
  const deleteInspection = async (r: DraftRow) => {
    if (!confirm("Yakin hapus inspeksi ini + foto-fotonya?")) return;
    await deleteBucketImages([r.front_image_url, r.rear_image_url, r.left_image_url, r.right_image_url]);
    const { error } = await supabase.from("unit_inspections").delete().eq("id", r.id);
    if (error) return setMsg("Gagal hapus inspeksi: " + error.message);
    if (editingId === r.id) setEditingId(null);
    setMsg("Inspeksi + foto dihapus");
    loadList();
  };

  const localDraft = readLocalDraft();

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Inspeksi Unit</h1>

      {/* Warning/error di atas halaman (jelas, seperti "masukkan alasan batal" di maintenance) */}
      {msg && msgKind === "warn" && (
        <div className="mb-4 border-2 border-red-400 rounded-lg px-4 py-3 bg-red-50 text-red-700">
          <div className="flex items-start gap-2">
            <span className="text-lg leading-none">⚠️</span>
            <div className="text-sm font-semibold leading-snug">{msg}</div>
          </div>
        </div>
      )}

      {/* Draft lokal (belum disimpan ke DB) — hanya tampil saat kembali ke halaman, bukan saat mengisi form */}
      {initialLeftover.current && !bannerSeen && localDraft && (
        <div className="mb-5 border border-indigo-300 rounded-lg p-3 bg-indigo-50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-semibold text-indigo-800">Draft lokal (belum disimpan ke database)</div>
            <div className="flex gap-1">
              {Object.values(localDraft.sides).filter((s) => s.imageUrl).map((s, i) => (
                <img key={i} src={s.imageUrl} className="w-20 h-20 object-cover border rounded" alt="foto" />
              ))}
            </div>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => cleanForm(false)} className="text-xs text-indigo-700 border border-indigo-300 px-3 py-1 rounded hover:bg-indigo-100">
                Bersihkan Form
              </button>
              <button onClick={discardLocalDraft} className="bg-red-600 text-white text-xs px-3 py-1.5 rounded">Hapus draft + foto</button>
            </div>
          </div>
        </div>
      )}

      {/* Draft DB */}
      {drafts.length > 0 && (
        <div className="mb-5">
          <h2 className="font-semibold mb-2">Draft tersimpan (database)</h2>
          {drafts.map((d) => (
            <div key={d.id} className="border border-amber-300 rounded-lg p-3 mb-2 bg-amber-50 flex flex-wrap items-center gap-3">
              <div className="flex gap-1">
                {[d.front_image_url, d.rear_image_url, d.left_image_url, d.right_image_url].filter(Boolean).map((u, i) => (
                  <img key={i} src={u} className="w-20 h-20 object-cover border rounded" alt="bagian" />
                ))}
                {![d.front_image_url, d.rear_image_url, d.left_image_url, d.right_image_url].some(Boolean) && (
                  <span className="text-xs text-gray-400">belum ada foto</span>
                )}
              </div>
              <div className="text-xs flex-1 min-w-[160px]">
                <div>Unit: {d.unit_id || "-"} · {fmtTanggal(d.inspection_date)}</div>
                <div>Tindakan: {d.action_required || "-"}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => continueDraft(d)} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded">Lanjutkan</button>
                <button onClick={() => deleteDraft(d)} className="bg-red-600 text-white text-xs px-3 py-1.5 rounded">Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <h2 className="font-semibold mb-3">
            Form Inspeksi Unit{" "}
            {editingId && <span className="text-xs text-green-700 font-normal">(mengedit inspeksi)</span>}
            {draftId && <span className="text-xs text-amber-600 font-normal">(draft DB #{draftId.slice(0, 8)})</span>}
          </h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs mb-1">Unit (Armada) *</label>
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="w-full border rounded px-2 py-1">
                <option value="">-- pilih --</option>
                {units.map((u) => (<option key={u.id} value={u.id}>{u.kode} - {u.plat} ({u.tipe})</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">Tanggal (dd/mm/yyyy)</label>
              <input
                type="date"
                value={inspectionDate}
                readOnly
                disabled
                className="w-full border rounded px-2 py-1 bg-gray-100 text-gray-500 cursor-not-allowed"
              />
              <div className="text-[10px] text-gray-400 mt-0.5">Otomatis mengikuti tanggal hari ini</div>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs mb-1">Petugas Inspeksi</label>
            <input value={officer} readOnly className="w-full border rounded px-2 py-1 bg-gray-100 text-gray-600" placeholder="Nama petugas" />
            <div className="text-[10px] text-gray-400 mt-0.5">Otomatis mengikuti nama petugas/login</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SideCard side="front" state={sides.front} onNoteChange={(v) => setSides((p) => ({ ...p, front: { ...p.front, note: v } }))} onFileChange={(e) => onFileChange("front", e)} fileInputRef={fileRef} cameraInputRef={cameraRef} />
            <SideCard side="rear" state={sides.rear} onNoteChange={(v) => setSides((p) => ({ ...p, rear: { ...p.rear, note: v } }))} onFileChange={(e) => onFileChange("rear", e)} fileInputRef={fileRef} cameraInputRef={cameraRef} />
            <SideCard side="left" state={sides.left} onNoteChange={(v) => setSides((p) => ({ ...p, left: { ...p.left, note: v } }))} onFileChange={(e) => onFileChange("left", e)} fileInputRef={fileRef} cameraInputRef={cameraRef} />
            <SideCard side="right" state={sides.right} onNoteChange={(v) => setSides((p) => ({ ...p, right: { ...p.right, note: v } }))} onFileChange={(e) => onFileChange("right", e)} fileInputRef={fileRef} cameraInputRef={cameraRef} />
          </div>

          <div className="mt-3">
            <label className="block text-xs mb-1">Odometer (km) <span className="text-red-500">*</span></label>
            <input
              type="text"
              inputMode="numeric"
              min={0}
              value={fmtNum(odometer)}
              onChange={(e) => setOdometer(e.target.value.replace(/\D/g, ""))}
              className="w-full border rounded px-2 py-1"
              placeholder="Contoh: 125.000"
            />
          </div>

          <div className="mt-3">
            <label className="block text-xs mb-1">Tindakan</label>
            <select value={actionRequired} onChange={(e) => setActionRequired(e.target.value)} className="w-full border rounded px-2 py-1">
              <option value="TIDAK">Tidak ada perbaikan</option>
              <option value="PERBAIKAN">Perlu perbaikan (lanjut SPK)</option>
            </select>
          </div>
          <div className="mt-3">
            <label className="block text-xs mb-1">Jenis Pekerjaan (untuk SPK)</label>
            <select
              value={actionRequired === "PERBAIKAN" ? workType : ""}
              disabled={actionRequired !== "PERBAIKAN"}
              onChange={(e) => setWorkType(e.target.value)}
              className="w-full border rounded px-2 py-1 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <option value="">-- pilih jenis pekerjaan --</option>
              <option value="preventive">Preventive Maintenance</option>
              <option value="corrective">Corrective (Perbaikan)</option>
              <option value="berkala">Pemeriksaan Berkala</option>
              <option value="pajak">Pajak/STNK/KIR/Asuransi</option>
            </select>
            {actionRequired !== "PERBAIKAN" && (
              <div className="text-xs text-gray-400 mt-1">Isi dulu Tindakan = "Perlu perbaikan" untuk memilih jenis pekerjaan.</div>
            )}
          </div>
          <div className="mt-3">
            <label className="block text-xs mb-1">Dateline (Tenggat)</label>
            <input
              type="date"
              value={actionRequired === "PERBAIKAN" && workType ? dateline : ""}
              disabled={!(actionRequired === "PERBAIKAN" && workType)}
              onClick={(e) => { if (actionRequired === "PERBAIKAN" && workType) { try { (e.currentTarget as any).showPicker(); } catch {} } }}
              onChange={(e) => setDateline(e.target.value)}
              className="w-full border rounded px-2 py-1 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            />
            {!(actionRequired === "PERBAIKAN" && workType) && (
              <div className="text-xs text-gray-400 mt-1">Pilih dulu jenis pekerjaan di atas untuk mengaktifkan tenggat.</div>
            )}
          </div>
          <div className="mt-3">
            <label className="block text-xs mb-1">Catatan Umum</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border rounded px-2 py-1" rows={2} />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={!perm.create && !editingId} className="bg-blue-600 text-white px-4 py-2 rounded flex-1 disabled:opacity-50">
              {editingId ? "Perbarui Inspeksi" : "Simpan Inspeksi"}
            </button>
            {editingId && (
              <button onClick={batalEdit} className="border border-gray-400 text-gray-600 px-4 py-2 rounded hover:bg-gray-100">Batal</button>
            )}
          </div>
          {msg && msgKind !== "warn" && (
            <div className="mt-2 text-sm text-blue-700">{msg}</div>
          )}
        </div>

        <div>
          <h2 className="font-semibold mb-2">Inspeksi Tersimpan</h2>

          {/* Panel pencarian */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              value={fQ}
              onChange={(e) => setFQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") cari(); }}
              placeholder="Cari No inspeksi / unit / No SPK…"
              className="border rounded px-2 py-1.5 text-xs flex-1 min-w-[170px]"
            />
            <div className="flex items-center gap-1.5">
              <input
                type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)}
                title="Dari tanggal"
                onClick={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch {} }}
                className="border rounded px-2 py-1.5 text-xs"
              />
              <span className="text-xs text-gray-400">s.d.</span>
              <input
                type="date" value={fTo} onChange={(e) => setFTo(e.target.value)}
                title="Sampai tanggal"
                onClick={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch {} }}
                className="border rounded px-2 py-1.5 text-xs"
              />
            </div>
            <button onClick={cari} className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700">Cari</button>
            <button onClick={resetFilter} className="border border-gray-400 text-gray-600 text-xs px-3 py-1.5 rounded hover:bg-gray-100">Reset</button>
          </div>

          {list.length === 0 && <div className="text-sm text-gray-400">Tidak ada data sesuai pencarian</div>}
          {list.length > 0 && (
            <div className="overflow-x-auto overflow-y-auto max-h-[540px] border rounded-lg bg-white shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="border px-2 py-1.5 text-left">No Inspeksi</th>
                    <th className="border px-2 py-1.5 text-left">Unit</th>
                    <th className="border px-2 py-1.5 text-left">Tanggal</th>
                    <th className="border px-2 py-1.5 text-left">Tindakan</th>
                    <th className="border px-2 py-1.5 text-left">No SPK</th>
                    <th className="border px-2 py-1.5 text-left">Dateline</th>
                    <th className="border px-2 py-1.5 text-left">Catatan Umum</th>
                    <th className="border px-2 py-1.5 text-center w-[90px]">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id} className="hover:bg-yellow-50">
                      <td className="border px-2 py-1.5 font-semibold">{r.inspection_no || "-"}</td>
                      <td className="border px-2 py-1.5">{r.armada?.kode} {r.armada?.plat}</td>
                      <td className="border px-2 py-1.5">{fmtTanggal(r.inspection_date)}</td>
                      <td className="border px-2 py-1.5">
                        <span className={`px-2 py-0.5 rounded ${r.action_required === "PERBAIKAN" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {r.action_required}
                        </span>
                      </td>
                      <td className="border px-2 py-1.5">
                        {r.maintenance_records && r.maintenance_records.length > 0
                          ? r.maintenance_records.map((m: any) => m.spk_no).filter(Boolean).join(", ") || "-"
                          : "-"}
                      </td>
                      <td className="border px-2 py-1.5">{fmtTanggal(r.dateline)}</td>
                      <td className="border px-2 py-1.5 max-w-[220px] whitespace-normal break-words">{r.notes || "-"}</td>
                      <td className="border px-2 py-1.5">
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            onClick={() => setDetail(r)}
                            title="Lihat Detail"
                            className="w-7 h-7 inline-flex items-center justify-center text-base leading-none rounded hover:bg-gray-100 text-gray-600"
                          >
                            👁️
                          </button>
                          {perm.edit && (
                            (() => {
                              const spk = r.maintenance_records?.find((m: any) => m.spk_no);
                              const st = spk?.status;
                              if (st === "IN_PROGRESS") {
                                return <span title="Sedang dikerjakan" className="w-7 h-7 inline-flex items-center justify-center text-base leading-none text-yellow-600">🛠️</span>;
                              }
                              if (st === "DONE") {
                                return <span title="Selesai" className="w-7 h-7 inline-flex items-center justify-center text-base leading-none text-green-600">✅</span>;
                              }
                              return (
                                <button
                                  onClick={() => beginEdit(r)}
                                  title="Edit"
                                  className="w-7 h-7 inline-flex items-center justify-center text-base leading-none rounded hover:bg-gray-100 text-blue-600"
                                >
                                  ✏️
                                </button>
                              );
                            })()
                          )}
                          {perm.del && (
                            <button
                              onClick={() => deleteInspection(r)}
                              disabled={r.maintenance_records?.some((m: any) => m.status === "IN_PROGRESS" || m.status === "DONE")}
                              title="Hapus"
                              className="w-7 h-7 inline-flex items-center justify-center text-base leading-none rounded hover:bg-gray-100 text-red-600 disabled:text-gray-300 disabled:cursor-not-allowed"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination server-side */}
          {pag.total > 0 && (
            <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
              <span>{pag.total} data · hal {pag.page} / {Math.max(1, Math.ceil(pag.total / pag.pageSize))}</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => loadList({ page: pag.page - 1 })}
                  disabled={pag.page <= 1}
                  className="border border-gray-300 rounded px-2.5 py-1 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >‹ Sebelumnya</button>
                <button
                  onClick={() => loadList({ page: pag.page + 1 })}
                  disabled={pag.page * pag.pageSize >= pag.total}
                  className="border border-gray-300 rounded px-2.5 py-1 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >Berikutnya ›</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Detail Inspeksi (dapat di-zoom fotonya) */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base">Detail Inspeksi — {detail.inspection_no || "-"}</h3>
              <button onClick={() => setDetail(null)} className="text-gray-500 hover:text-gray-900 text-xl leading-none">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
              <div><span className="text-gray-500">Unit:</span> <b>{detail.armada?.kode} {detail.armada?.plat} {detail.armada?.tipe}</b></div>
              <div><span className="text-gray-500">Tanggal:</span> {fmtTanggal(detail.inspection_date)}</div>
              <div><span className="text-gray-500">Petugas:</span> {detail.officer || "-"}</div>
              <div><span className="text-gray-500">Odometer:</span> {detail.odometer != null ? Number(detail.odometer).toLocaleString("id-ID") + " km" : "-"}</div>
              <div><span className="text-gray-500">Tindakan:</span> {detail.action_required || "-"}</div>
              <div><span className="text-gray-500">Jenis Pekerjaan:</span> {detail.work_type || "-"}</div>
              <div><span className="text-gray-500">Dateline:</span> {fmtTanggal(detail.dateline)}</div>
              <div><span className="text-gray-500">SPK:</span> {detail.maintenance_records?.length ? detail.maintenance_records.map((m: any) => m.spk_no).filter(Boolean).join(", ") : "-"}</div>
            </div>

            {detail.notes && (
              <div className="mb-4">
                <div className="text-sm font-semibold text-gray-700 mb-1">Catatan Umum</div>
                <div className="text-sm text-gray-600 whitespace-normal break-words bg-gray-50 rounded p-2">{detail.notes}</div>
              </div>
            )}

            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Foto Inspeksi</div>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["Depan", detail.front_image_url, detail.front_note],
                    ["Belakang", detail.rear_image_url, detail.rear_note],
                    ["Kiri", detail.left_image_url, detail.left_note],
                    ["Kanan", detail.right_image_url, detail.right_note],
                  ] as [string, string | null, string | null][]
                ).map(([label, url, note]) => (
                  <div key={label} className="border rounded-lg p-2 bg-gray-50">
                    {url ? (
                      <img
                        src={url}
                        alt={label}
                        onClick={() => setZoomImg(url)}
                        className="w-full h-32 object-cover rounded border cursor-zoom-in"
                      />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center text-gray-400 text-xs border border-dashed rounded">Tidak ada foto</div>
                    )}
                    <div className="text-xs mt-1.5 gap-1">
                      <div className="font-semibold text-gray-600">{label}</div>
                      {note && <div className="text-gray-500 whitespace-normal break-words">{note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex gap-2 justify-end">
              {perm.edit && (
                <button
                  onClick={() => { setDetail(null); beginEdit(detail); }}
                  disabled={detail.maintenance_records?.some((m: any) => m.status === "IN_PROGRESS" || m.status === "DONE")}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Edit Inspeksi
                </button>
              )}
              <button onClick={() => setDetail(null)} className="border border-gray-400 text-gray-600 px-4 py-2 rounded text-sm">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom foto layar penuh */}
      {zoomImg && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-2" onClick={() => setZoomImg(null)}>
          <img src={zoomImg} alt="zoom" className="max-w-full max-h-full object-contain rounded" />
          <button onClick={() => setZoomImg(null)} className="absolute top-4 right-4 text-white text-2xl leading-none bg-black/40 rounded-full w-10 h-10">✕</button>
        </div>
      )}
    </div>
  );
}
