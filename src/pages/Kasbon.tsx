// src/pages/Kasbon.tsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { FiEdit, FiTrash2, FiPlus, FiX, FiDownload, FiPrinter } from "react-icons/fi";
import { exportTableToExcel } from "../utils/exportTableToExcel";
import { insertWithAutoNomor } from "../lib/dbUtils";
import { getCustomUserId } from "../lib/authUser";
import { toDate } from "./SuratJalan";


interface KasbonRow {
  id: number;
  tanggal: string; // yyyy-mm-dd
  tanggal_realisasi?: string | null;
  waktu?: string | null;
  no_kasbon: string;
  keterangan?: string | null;
  jumlah_kasbon: number;
  jumlah_realisasi: number;
  sisa?: number;
  status: string;
  user_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ---------- helper ----------

const fmtCurrency = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : "Rp " + Number(n).toLocaleString("id-ID");


// Format input → tampil Rp xxx.xxx
const formatRupiahInput = (value: string) => {
  const number = Number(value.replace(/[^\d]/g, ""));
  return number ? "Rp " + number.toLocaleString("id-ID") : "";
};

// Extract angka murni dari input Rp
const extractNumber = (value: string) => {
  return Number(value.replace(/[^\d]/g, "")) || 0;
};

// ---------- component ----------
export default function Kasbon() {
  // data
  const [data, setData] = useState<KasbonRow[]>([]);
  const [loading, setLoading] = useState(false);

  // pagination / search
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage =50;
  const [searchQ, setSearchQ] = useState("");

  // selection
  const [selected, setSelected] = useState<number[]>([]);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  // form add/edit kasbon
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const defaultForm: Partial<KasbonRow> = {
    tanggal: "",
    waktu: new Date().toTimeString().slice(0, 8),
    no_kasbon: "",
    keterangan: "",
    jumlah_kasbon: 0,
    jumlah_realisasi: 0,
    status: "BELUM REALISASI",
  };
  const [formData, setFormData] = useState<Partial<KasbonRow>>(defaultForm);

  // form realisasi
  const [showRealisasi, setShowRealisasi] = useState(false);
  const [realisasiKasbonList, setRealisasiKasbonList] = useState<KasbonRow[]>([]);
  const [selectedKasbonForRealisasi, setSelectedKasbonForRealisasi] = useState<Partial<KasbonRow> | null>(null);
  // rows of realisasi to add (temporary before saving)
  const [realisasiRows, setRealisasiRows] = useState<
    { id?: number; keterangan: string; nominal: number }[]
  >([]);

  // derived / pagination
  useEffect(() => {
    if (selectAllRef.current) {
      const pageItems = paginatedData;
      selectAllRef.current.indeterminate =
        selected.length > 0 && selected.length < pageItems.length;
    }
  }, [selected, data, currentPage]);

  // fetch kasbon
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("kasbon")
        .select("*")
        .order("tanggal", { ascending: false })
        .order("id", { ascending: false });

      if (error) throw error;
      setData((rows || []) as KasbonRow[]);
    } catch (err: unknown) {
      console.error("Gagal ambil kasbon:", err);
      alert("Gagal ambil data kasbon. Cek console.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // also listen refresh event in case other pages trigger changes
    const handler = () => fetchData();
    window.addEventListener("refresh-kasbon", handler);
    return () => window.removeEventListener("refresh-kasbon", handler);
  }, []);

  // ---------- table helpers ----------
  const filtered = data.filter((r) => {
    if (!searchQ.trim()) return true;
    const q = searchQ.toLowerCase();
    return (
      String(r.no_kasbon || "").toLowerCase().includes(q) ||
      String(r.keterangan || "").toLowerCase().includes(q) ||
      String(r.status || "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage);

  // selection
  const handleSelectAll = () => {
    const ids = paginatedData.map((d) => d.id);
    if (selected.length === ids.length) setSelected([]);
    else setSelected(ids);
  };
  const handleSelect = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // ---------- Export Excel ----------
  const handleExportExcel = () => {
    exportTableToExcel(data as unknown as Record<string, unknown>[], {
      filename: "Kasbon.xlsx",
      sheetName: "Kasbon",
      columns: [
        { label: "Tanggal", key: "tanggal", type: "date", format: toDate },
        { label: "Tanggal Realisasi", key: "tanggal_realisasi", type: "date", format: toDate },
        { label: "Waktu", key: "waktu" },
        { label: "No Kasbon", key: "no_kasbon" },
        { label: "Keterangan", key: "keterangan" },
        { label: "Jumlah Kasbon", key: "jumlah_kasbon", type: "currency" },
        { label: "Jumlah Realisasi", key: "jumlah_realisasi", type: "currency" },
        { label: "Status", key: "status" },
        { label: "User ID", key: "user_id" },
        { label: "Updated At", key: "updated_at", type: "date", format: toDate }
      ]
    });

  };

  // ---------- Print (simple) ----------
  const handlePrint = () => {
    const table = document.querySelector("table");
    if (!table) return alert("Tabel tidak ditemukan!");
    const w = window.open("", "_blank");
    if (!w) return alert("Pop-up diblokir");
    w.document.write("<html><head><title>Print Kasbon</title></head><body>");
    w.document.write("<h2>Kasbon</h2>");
    w.document.write(table.outerHTML);
    w.document.write("</body></html>");
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  // ---------- Add / Edit Kasbon ----------
  const openAddForm = async (row?: KasbonRow) => {
    if (row) {
      setIsEdit(true);
      setFormData({ ...row });
    } else {
      setIsEdit(false);
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")}`;
      setFormData({
        tanggal: today,
        waktu: now.toTimeString().slice(0, 8),
        no_kasbon: "",
        keterangan: "",
        jumlah_kasbon: 0,
        jumlah_realisasi: 0,
        status: "BELUM REALISASI",
      });
    }
    setShowForm(true);
  };

  const handleSaveKasbon = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      // basic validation
      if (!formData.tanggal || !formData.jumlah_kasbon) {
        alert("Tanggal dan Nominal Kasbon wajib diisi.");
        return;
      }
      const currentUser = String(await getCustomUserId() || "");

      if (isEdit && formData.id) {
        // update header
        const { error } = await supabase
          .from("kasbon")
          .update({
            tanggal: formData.tanggal,
            waktu: formData.waktu,
            keterangan: formData.keterangan,
            jumlah_kasbon: Number(formData.jumlah_kasbon),
            updated_at: new Date().toISOString(),
          })
          .eq("id", formData.id);

        if (error) throw error;

        // update kas_harian related debet row(s) that reference this kasbon (sumber_tabel = 'kasbon' and bukti_transaksi = no_kasbon)
        const { error: upkErr } = await supabase
          .from("kas_harian")
          .update({
            tanggal: formData.tanggal,
            waktu: formData.waktu,
            keterangan: formData.keterangan,
            nominal: Number(formData.jumlah_kasbon),
            updated_at: new Date().toISOString(),
          })
          .eq("sumber_tabel", "kasbon")
          .eq("bukti_transaksi", formData.no_kasbon);

        if (upkErr) console.warn("Gagal update kas_harian kasbon:", upkErr.message);

        alert("Kasbon berhasil diupdate.");
      } else {
        // insert new: generate nomor jika kosong
        let finalNo = (formData.no_kasbon || "").trim();
        if (!finalNo) {
          const res = await insertWithAutoNomor({
            table: "kasbon",
            prefix: "CA",
            nomorField: "no_kasbon",
            data: {},
            previewOnly: true, // ⬅ hanya generate nomor saja!
            tanggal: formData.tanggal,
            monthlyReset: true,
          });

          if (!res.success) throw new Error(res.error || "Gagal generate nomor kasbon");
          finalNo = res.nomor!;
        }

        // insert header
        const { data: insertData, error } = await supabase
          .from("kasbon")
          .insert({
            tanggal: formData.tanggal,
            waktu: formData.waktu,
            no_kasbon: finalNo,
            keterangan: formData.keterangan,
            jumlah_kasbon: Number(formData.jumlah_kasbon),
            jumlah_realisasi: 0,
            status: "BELUM REALISASI",
            user_id: String(currentUser),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select("*")
          .single();

        if (error) throw error;

        const newKasbon: KasbonRow = insertData as KasbonRow;

        // insert kas_harian debet row
        const payloadKas = {
          tanggal: formData.tanggal,
          waktu: formData.waktu,
          bukti_transaksi: newKasbon.no_kasbon,
          keterangan: `Kasbon: ${formData.keterangan || ""}`,
          jenis_transaksi: "kredit",
          nominal: Number(formData.jumlah_kasbon),
          saldo_awal: 0,
          saldo_akhir: 0,
          user_id: String(currentUser),
          sumber_id: newKasbon.id,
          sumber_tabel: "kasbon",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: insertKasErr } = await supabase.from("kas_harian").insert(payloadKas);
        if (insertKasErr) console.warn("Gagal simpan kas_harian saat tambah kasbon:", insertKasErr.message);

        alert(`Kasbon berhasil dibuat: ${newKasbon.no_kasbon}`);
      }

      setShowForm(false);
      setFormData(defaultForm);
      fetchData();
      // refresh kas harian consumer
      window.dispatchEvent(new Event("refresh-kas-harian"));
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      alert("Gagal simpan kasbon: " + message);
    } finally {
      setIsSaving(false);
    }
  };

    // ------------------------------------------------------------------------------------
  // Hapus kasbon banyak → realisasi → kas_harian lengkap
  // ------------------------------------------------------------------------------------
  const handleDeleteSelected = async () => {
    if (selected.length === 0) return alert("Pilih data terlebih dahulu!");
    if (!confirm("Yakin ingin hapus data terpilih?")) return;

    try {
      // 1️⃣ Ambil list kasbon terpilih
      const { data: kasbonRows } = await supabase
        .from("kasbon")
        .select("id")
        .in("id", selected);

      const kasbonIds = kasbonRows?.map((r) => r.id) ?? [];

      // 2️⃣ Ambil semua realisasi terkait
      const { data: realisasiRows } = await supabase
        .from("kasbon_realisasi")
        .select("id, kasbon_id")
        .in("kasbon_id", kasbonIds);

      const realIds = realisasiRows?.map((r) => r.id) ?? [];

      // 3️⃣ HAPUS REALISASI dari tabel kasbon_realisasi
      await supabase
        .from("kasbon_realisasi")
        .delete()
        .in("kasbon_id", kasbonIds);

      // 4️⃣ Hapus kas_harian → realisasi item
      if (realIds.length > 0) {
        await supabase
          .from("kas_harian")
          .delete()
          .eq("sumber_tabel", "kasbon_realisasi_item")
          .in("sumber_id", realIds);
      }

      // 5️⃣ Hapus kas_harian → realisasi header
      await supabase
        .from("kas_harian")
        .delete()
        .eq("sumber_tabel", "kasbon_realisasi_header")
        .in("sumber_id", kasbonIds);

      // 6️⃣ Hapus kas_harian → sisa kasbon
      await supabase
        .from("kas_harian")
        .delete()
        .eq("sumber_tabel", "kasbon_realisasi_sisa")
        .in("sumber_id", kasbonIds);

      // 7️⃣ Hapus kas_harian → header kasbon (kredit awal)
      await supabase
        .from("kas_harian")
        .delete()
        .eq("sumber_tabel", "kasbon")
        .in("sumber_id", kasbonIds);

      // 8️⃣ Hapus kasbon (header)
      await supabase.from("kasbon").delete().in("id", kasbonIds);

      alert("Kasbon berhasil dihapus.");

      setSelected([]);
      fetchData();
      window.dispatchEvent(new Event("refresh-kas-harian"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Gagal hapus: " + msg);
    }
  };

    // ------------------------------------------------------------------------------------
  // HAPUS KASBON → hapus realisasi → hapus kas_harian terkait semuanya
  // ------------------------------------------------------------------------------------
  const handleDeleteSingle = async (row: KasbonRow) => {
    if (!confirm("Yakin ingin hapus kasbon ini?")) return;

    try {
      // 1️⃣ Ambil semua realisasi yang terkait kasbon ini
      const { data: realisasiRows } = await supabase
        .from("kasbon_realisasi")
        .select("id")
        .eq("kasbon_id", row.id);

      const realIds = (realisasiRows || []).map((r) => r.id);

      // 2️⃣ Hapus realisasi dari tabel kasbon_realisasi
      await supabase.from("kasbon_realisasi").delete().eq("kasbon_id", row.id);

      // 3️⃣ Hapus baris kas_harian untuk setiap realisasi (item)
      await supabase
        .from("kas_harian")
        .delete()
        .eq("sumber_tabel", "kasbon_realisasi_item")
        .in("sumber_id", realIds);

      // 4️⃣ Hapus kas_harian realisasi header
      await supabase
        .from("kas_harian")
        .delete()
        .eq("sumber_tabel", "kasbon_realisasi_header")
        .eq("sumber_id", row.id);

      // 5️⃣ Hapus kas_harian untuk sisa kasbon
      await supabase
        .from("kas_harian")
        .delete()
        .eq("sumber_tabel", "kasbon_realisasi_sisa")
        .eq("sumber_id", row.id);

      // 6️⃣ Hapus kas_harian untuk header kasbon (debet awal kasbon)
      await supabase
        .from("kas_harian")
        .delete()
        .eq("sumber_tabel", "kasbon")
        .eq("sumber_id", row.id);

      // 7️⃣ Hapus record kasbon utama
      await supabase.from("kasbon").delete().eq("id", row.id);

      alert("Kasbon berhasil dihapus.");

      fetchData();
      window.dispatchEvent(new Event("refresh-kas-harian"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Gagal hapus kasbon: " + msg);
    }
  };

      //// ------------------------------------------------------------------------------------
    // HAPUS REALISASI KASBON → WAJIB hapus baris kas_harian yang terkait realisasi tsb
    // ------------------------------------------------------------------------------------

    //-- handlefetch --- //
    const fetchRealisasi = async (kasbonId: number) => {
    const { data: rows, error } = await supabase
      .from("kasbon_realisasi")
      .select("*")
      .eq("kasbon_id", kasbonId)
      .order("id"); // urut sesuai input

    if (error) {
      console.error("Gagal fetch realisasi:", error);
      return;
    }

    setRealisasiRows(
      (rows || []).map((r) => ({
        id: r.id,
        keterangan: r.keterangan || "",
        nominal: r.nominal,
      }))
    );
  };

  // ---------- REAlISASI ----------
  const openRealisasiForm = async () => {
    // load kasbon yang belum selesai
    try {
      const { data: rows, error } = await supabase
        .from("kasbon")
        .select("*")
        .neq("status", "SELESAI")
        .order("tanggal", { ascending: false });
      if (error) throw error;
      setRealisasiKasbonList((rows || []) as KasbonRow[]);
      setSelectedKasbonForRealisasi(null);
      setRealisasiRows([]);
      setShowRealisasi(true);
    } catch (err) {
      console.error(err);
      alert("Gagal ambil list kasbon untuk realisasi.");
    }
  };

  const addRealisasiRow = () => {
    setRealisasiRows((prev) => [...prev, { keterangan: "", nominal: 0 }]);
  };

  const updateRealisasiRow = (idx: number, data: Partial<{ keterangan: string; nominal: number; tanggal: string }>) => {
    setRealisasiRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...data } : r)));
  };

  const removeRealisasiRow = (idx: number) => {
    setRealisasiRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalRealisasi = realisasiRows.reduce((s, r) => s + (Number(r.nominal) || 0), 0);

  const [tanggalRealisasi, setTanggalRealisasi] = useState<string>("");

  //--- save ---
  const handleSaveRealisasi = async () => {
    if (isSaving) return;
    if (!selectedKasbonForRealisasi?.id) return alert("Pilih kasbon dulu.");
    if (realisasiRows.length === 0) return alert("Tambahkan baris realisasi.");

    setIsSaving(true);

    try {
      const kasbonId = selectedKasbonForRealisasi.id;
      const kasbonNo = selectedKasbonForRealisasi.no_kasbon!;
      const jumlahKasbon = selectedKasbonForRealisasi.jumlah_kasbon!;
      const totalRealisasi = realisasiRows.reduce((a, b) => a + (b.nominal || 0), 0);

      const now = new Date();
      const waktuNow = now.toTimeString().slice(0, 8);
      const userId = await getCustomUserId();

      const tanggalHeader = tanggalRealisasi;

      // ambil realisasi lama
      const { data: oldRows } = await supabase
        .from("kasbon_realisasi")
        .select("id")
        .eq("kasbon_id", kasbonId);

      const oldIds = oldRows?.map((x) => x.id) || [];

      // hapus realisasi lama
      await supabase.from("kasbon_realisasi").delete().eq("kasbon_id", kasbonId);

      // hapus kas_harian realisasi lama
      await supabase
        .from("kas_harian")
        .delete()
        .in("sumber_id", oldIds)
        .eq("sumber_tabel", "kasbon_realisasi_item");

      // hapus header kasbon & sisa kasbon lama
      await supabase
        .from("kas_harian")
        .delete()
        .eq("sumber_tabel", "kasbon_realisasi_header")
        .eq("sumber_id", kasbonId);

      await supabase
        .from("kas_harian")
        .delete()
        .eq("sumber_tabel", "kasbon_realisasi_sisa")
        .eq("sumber_id", kasbonId);

      // hitung kasbon - realisasi
      const debetKasbon = Math.min(jumlahKasbon, totalRealisasi);
      const sisaKasbon = Math.max(jumlahKasbon - totalRealisasi, 0);

      // ============================
      // 1️⃣ INSERT KASBON (DEBET)
      // ============================
      await supabase.from("kas_harian").insert({
        tanggal: tanggalHeader,
        waktu: waktuNow,
        bukti_transaksi: kasbonNo,
        keterangan: `Kasbon ${kasbonNo}`,
        jenis_transaksi: "debet",
        nominal: debetKasbon,
        user_id: String(userId),
        sumber_tabel: "kasbon_realisasi_header",
        sumber_id: kasbonId,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });

      // ============================
      // 2️⃣ INSERT SISA KASBON (DEBET)
      // ============================
      if (sisaKasbon > 0) {
        await supabase.from("kas_harian").insert({
          tanggal: tanggalHeader,
          waktu: waktuNow,
          bukti_transaksi: kasbonNo,
          keterangan: `Sisa Kasbon ${kasbonNo}`,
          jenis_transaksi: "debet",
          nominal: sisaKasbon,
          user_id: String(userId),
          sumber_tabel: "kasbon_realisasi_sisa",
          sumber_id: kasbonId,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        });
      }

      // ============================
      // 3️⃣ INSERT REALISASI (KREDIT)
      // ============================
      for (const r of realisasiRows) {
        const { data: inserted } = await supabase
          .from("kasbon_realisasi")
          .insert({
            kasbon_id: kasbonId,
            tanggal: tanggalHeader,
            keterangan: r.keterangan,
            nominal: r.nominal,
            no_kasbon: kasbonNo,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .select("*")
          .single();

        await supabase.from("kas_harian").insert({
          tanggal: tanggalHeader,
          waktu: waktuNow,
          bukti_transaksi: kasbonNo,
          keterangan: r.keterangan,
          jenis_transaksi: "kredit",
          nominal: r.nominal,
          user_id: String(userId),
          sumber_tabel: "kasbon_realisasi_item",
          sumber_id: inserted.id,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        });
      }

      // update header kasbon
      await supabase
        .from("kasbon")
        .update({
          jumlah_realisasi: totalRealisasi,
          tanggal_realisasi: tanggalHeader,
          waktu: waktuNow,
          status:
            totalRealisasi === 0
              ? "BELUM REALISASI"
              : totalRealisasi === jumlahKasbon
              ? "SELESAI"
              : "SELESAI",
          updated_at: now.toISOString(),
        })
        .eq("id", kasbonId);

      alert("Realisasi berhasil disimpan.");
      setShowRealisasi(false);
      fetchData();
      window.dispatchEvent(new Event("refresh-kas-harian"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Gagal simpan realisasi: " + msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- edit single kasbon: open in add form with row ----------
  const handleEdit = (row: KasbonRow) => {
    openAddForm(row);
  };

  // --- format ddmmyy ---
  const formatTanggal = (tgl: string | Date): string =>
    tgl
    ? new Date(tgl)
    .toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    })
    .replaceAll("/", "-")
  : "";

  // === HANDLE ESC KEY (TUTUP POPUP KASBON & REALISASI) ===
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      // ESC untuk form tambah/edit kasbon
      if (showForm) {
        setShowForm(false);
        setFormData(defaultForm);
        return;
      }

      // ESC untuk popup realisasi
      if (showRealisasi) {
        setShowRealisasi(false);
        setRealisasiKasbonList([]);
        setSelectedKasbonForRealisasi(null);
        return;
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showForm, showRealisasi]);

  // ---------- render ----------
  return (
    <div className="p-4 bg-white rounded shadow">
      {/* Buttons */}
      <div className="flex pr-8 items-center justify-between gap-3 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => openAddForm()}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            <FiPlus /> Tambah
          </button>

          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            <FiTrash2 /> Hapus
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            <FiDownload /> Export Excel
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
          >
            <FiPrinter /> Cetak
          </button>

          <button
            onClick={openRealisasiForm}
            className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
          >
            Realisasi
          </button>
        </div>

        <div className="w-[320px]">
          <input
            placeholder="Cari No Kasbon / Keterangan / Status..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      {/* Table */}
      <div className="w-full pr-8">
        <table className="w-full table-auto border border-gray-300 text-sm">
          <thead className="bg-gray-400 text-white">
            <tr>
              <th className="p-2 border text-center w-[40px]">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={selected.length === paginatedData.length && paginatedData.length > 0}
                />
              </th>
              <th className="p-2 border w-[60px]">Aksi</th>
              <th className="p-2 border">Tanggal</th>
              <th className="p-2 border">Tanggal Realisasi</th>
              <th className="p-2 border">Waktu</th>
              <th className="p-2 border">No Kasbon</th>
              <th className="p-2 border">Keterangan</th>
              <th className="p-2 border text-center">Jumlah Kasbon</th>
              <th className="p-2 border text-center">Jumlah Realisasi</th>
              <th className="p-2 border text-center">Sisa</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border">User ID</th>
              <th className="p-2 border">Updated At</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13} className="text-center p-4">
                  Memuat...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={13} className="text-center p-4">
                  Tidak ada data.
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => (
                <tr key={row.id} className="border hover:bg-yellow-300 transition-all duration-150 text-center border">
                  <td className="p-2 border text-center">
                    <input type="checkbox" checked={selected.includes(row.id)} onChange={() => handleSelect(row.id)} />
                  </td>
                  <td className="p-2 border text-center">
                    <div className="flex justify-center gap-1">
                      <button title="Edit" onClick={() => handleEdit(row)} className="text-blue-600">
                        <FiEdit />
                      </button>
                      <button title="Hapus" onClick={() => handleDeleteSingle(row)} className="text-red-600">
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                  <td className="p-2 border text-center">{formatTanggal(row.tanggal)}</td>
                  <td className="p-2 border text-center">
                    {row.tanggal_realisasi ? formatTanggal(row.tanggal_realisasi) : "-"}
                  </td>
                  <td className="p-2 border text-center">{row.waktu || "-"}</td>
                  <td className="p-2 border text-center">{row.no_kasbon}</td>
                  <td className="p-2 border">{row.keterangan}</td>
                  <td className="p-2 border text-right">{fmtCurrency(row.jumlah_kasbon)}</td>
                  <td className="p-2 border text-right">{fmtCurrency(row.jumlah_realisasi)}</td>
                  <td className="p-2 border text-right">{fmtCurrency(row.sisa ?? row.jumlah_kasbon - row.jumlah_realisasi)}</td>
                  <td className="p-2 border text-center">{row.status}</td>
                  <td className="p-2 border text-center">{row.user_id || "-"}</td>
                  <td className="p-2 border text-center">{row.updated_at ? new Date(row.updated_at).toLocaleString() : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center items-center gap-2 mt-3">
        <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded">
          ‹ Prev
        </button>
        <span>
          Halaman {currentPage} dari {totalPages}
        </span>
        <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded">
          Next ›
        </button>
      </div>

      {/* ---------- Popup Add/Edit Kasbon ---------- */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-start justify-center pt-20 overflow-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl relative">
            <button className="absolute top-3 right-3 text-gray-600" onClick={() => { setShowForm(false); setFormData(defaultForm); }}>
              <FiX />
            </button>
            <h3 className="text-xl font-semibold mb-4">{isEdit ? "Edit Kasbon" : "Tambah Kasbon"}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 font-semibold">Tanggal</label>
                <input type="date" name="tanggal" value={formData.tanggal || ""} onChange={(e) => setFormData((p) => ({ ...p, tanggal: e.target.value }))} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block mb-1 font-semibold">Waktu</label>
                <input readOnly type="text" value={formData.waktu || new Date().toTimeString().slice(0, 8)} className="w-full border rounded px-3 py-2 bg-gray-100" />
              </div>

              <div>
                <label className="block mb-1 font-semibold">No Kasbon</label>
                <input type="text" name="no_kasbon" value={formData.no_kasbon || ""} onChange={(e) => setFormData((p) => ({ ...p, no_kasbon: e.target.value }))} className="w-full border rounded px-3 py-2" />
                <p className="text-xs text-gray-500 mt-1">Biarkan kosong untuk auto-generate (CA-001-1125)</p>
              </div>

              <div>
                <label className="block mb-1 font-semibold">Keterangan</label>
                <input type="text" value={formData.keterangan || ""} onChange={(e) => setFormData((p) => ({ ...p, keterangan: e.target.value }))} className="w-full border rounded px-3 py-2" />
              </div>

              <div className="col-span-1">
                <label className="block mb-1 font-semibold">Nominal</label>
                <input
                  type="text"
                  value={formatRupiahInput(String(formData.jumlah_kasbon ?? ""))}
                  onChange={(e) => {
                    const num = extractNumber(e.target.value);
                    setFormData((p) => ({ ...p, jumlah_kasbon: num }));
                  }}
                  className="w-full border rounded px-3 py-2 text-right"
                />
              </div>

              <div className="col-span-2 flex justify-end gap-3 mt-3">
                <button onClick={() => { setShowForm(false); setFormData(defaultForm); }} className="bg-red-400 text-white px-4 py-2 rounded">Batal</button>
                <button onClick={handleSaveKasbon} disabled={isSaving} className={`bg-blue-600 text-white px-4 py-2 rounded ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}>Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Popup Realisasi ---------- */}
      {showRealisasi && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-start justify-center pt-12 overflow-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl relative">
            <button className="absolute top-3 right-3 text-gray-600" onClick={() => { setShowRealisasi(false); setRealisasiRows([]); setSelectedKasbonForRealisasi(null); }}>
              <FiX />
            </button>
            <h3 className="text-xl font-semibold mb-3">Realisasi Kasbon</h3>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block mb-1 font-semibold">Pilih No Kasbon</label>
                <select
                  value={selectedKasbonForRealisasi?.id ?? ""}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const found = realisasiKasbonList.find((r) => r.id === id) || null;
                    setSelectedKasbonForRealisasi(found ? { ...found } : null);
                  if (found) fetchRealisasi(found.id);
                  else setRealisasiRows([]);
                  }}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">-- Pilih Kasbon --</option>
                  {realisasiKasbonList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.no_kasbon} — {r.keterangan} — {fmtCurrency(r.jumlah_kasbon)} (sisa: {fmtCurrency(r.sisa ?? r.jumlah_kasbon - r.jumlah_realisasi)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 font-semibold">Tanggal Realisasi</label>
                <input
                  type="date"
                  value={tanggalRealisasi}
                  onChange={(e) => setTanggalRealisasi(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">Tanggal per baris dapat diatur pada masing-masing baris realisasi</p>
              </div>
            </div>

            <div className="mb-2">
              <div className="flex justify-between items-center mb-2">
                <div className="font-semibold">Daftar Realisasi</div>
                <div>
                  <button
                    onClick={addRealisasiRow}
                    className="text-white bg-green-600 px-3 py-1 rounded text-sm"
                  >
                    Tambah Baris
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-auto">
                {realisasiRows.length === 0 && <div className="text-gray-500">Belum ada baris realisasi.</div>}
                {realisasiRows.map((r, idx) => (
                  <div
                    key={r.id ?? idx} // ✅ tambahkan key unik
                    className="grid grid-cols-[3fr_2fr_40px] gap-2"
                  >
                    <input
                      type="text"
                      value={r.keterangan}
                      onChange={(e) => updateRealisasiRow(idx, { keterangan: e.target.value })}
                      className="border rounded px-2 py-1"
                    />
                    <input
                      type="text"
                      value={formatRupiahInput(String(r.nominal))}
                      onChange={(e) => updateRealisasiRow(idx, { nominal: extractNumber(e.target.value) })}
                      className="border rounded px-2 py-1 text-right"
                    />
                    <button onClick={() => removeRealisasiRow(idx)} className="text-red-600">
                      <FiTrash2 />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-3">
              <div>
                <label className="block mb-1 font-semibold">Total Realisasi</label>
                <input readOnly value={fmtCurrency(totalRealisasi)} className="w-full border rounded px-3 py-2 bg-green-400 font-bold text-center" />
              </div>
              <div>
                <label className="block mb-1 font-semibold">Sisa / Kurang</label>
                <input
                  readOnly
                  value={
                    selectedKasbonForRealisasi
                      ? fmtCurrency((selectedKasbonForRealisasi.jumlah_kasbon || 0) - totalRealisasi)
                      : ""
                  }
                  className="w-full border rounded px-3 py-2 bg-gray-100 text-right"
                />
              </div>
              <div className="flex items-end justify-end gap-3">
                <button onClick={() => { setShowRealisasi(false); setRealisasiRows([]); setSelectedKasbonForRealisasi(null); }} className="bg-red-400 text-white px-4 py-2 rounded">Batal</button>
                <button onClick={handleSaveRealisasi} disabled={isSaving || !selectedKasbonForRealisasi} className={`bg-blue-600 text-white px-4 py-2 rounded ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}>Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
