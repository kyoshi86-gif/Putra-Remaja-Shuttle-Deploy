import { useRef, useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { FiEdit, FiTrash2, FiPlus, FiX, FiDownload, FiPrinter } from "react-icons/fi";
import { exportTableToExcel } from "../utils/exportTableToExcel";
import { getCustomUserId } from "../lib/authUser";
import { insertWithAutoNomor } from "../lib/dbUtils";
import { hasAccess } from "../lib/hasAccess";
import { getWIBTimestampFromUTC } from "../utils/time";


interface SuratJalanData {
  id: number;
  tanggal_berangkat: string;
  tanggal_kembali: string;
  driver: string;
  crew: string;
  no_surat_jalan: string;
  no_polisi: string;
  unit: string;
  kode_unit: string;
  kode_rute: string;
  km_berangkat: number | null | undefined;
  km_kembali: number | null | undefined;
  snack_berangkat: number | null | undefined;
  snack_kembali: number | null | undefined;
  keterangan: string;
  user_id?: string;
  updated_at?: string;
  perpal_1x_tanggal?: string | null;
  perpal_1x_rute?: string | null;
  perpal_1x_keterangan?: string | null;
  perpal_2x_tanggal?: string | null;
  perpal_2x_rute?: string | null;
  perpal_2x_keterangan?: string | null;
  [key: string]: unknown;
}

// === Di luar semua fungsi ===
export const toDate = (v: unknown): Date | "" => {
  if (typeof v === "string" || typeof v === "number" || v instanceof Date) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? "" : d;
  }
  return "";
};

export default function SuratJalan() {
  const [data, setData] = useState<SuratJalanData[]>([]);
  const [filtered, setFiltered] = useState<SuratJalanData[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setIsUsedInSaku] = useState(false);
  const [isUsedInPremi, setIsUsedInPremi] = useState(false);
  const [canTambahPerpal, setCanTambahPerpal] = useState(false);

  // --- TYPES ---
interface Armada {
  id: number;
  plat: string;
  merk?: string;
  status?: string;
}

interface Rute {
  id: number;
  kode_rute: string;
  status?: string;
}

// --- NO POLISI ---
const [npSearch, setNpSearch] = useState("");
const [showNpDropdown, setShowNpDropdown] = useState(false);
const [highlightNp, setHighlightNp] = useState(-1);

// --- KODE RUTE ---
const [rtSearch, setRtSearch] = useState("");
const [showRtDropdown, setShowRtDropdown] = useState(false);
const [highlightRt, setHighlightRt] = useState(-1);

const handleSelectNoPolisi = (item: Armada) => {
  setFormData((prev) => ({
    ...prev,
    no_polisi: item.plat,
  }));
  setNpSearch(item.plat);
  setShowNpDropdown(false);
};

const handleSelectKodeRute = (item: Rute) => {
  setFormData((prev) => ({
    ...prev,
    kode_rute: item.kode_rute,
  }));
  setRtSearch(item.kode_rute);
  setShowRtDropdown(false);
};

// -- cek akses tambah perpal ---
  useEffect(() => {
    hasAccess("surat_jalan.tambah_perpal").then((result) => {
      setCanTambahPerpal(result);
    });
  }, []);

  const [formData, setFormData] = useState<SuratJalanData>({
    id: 0,
    tanggal_berangkat: "",
    tanggal_kembali: "",
    driver: "",
    crew: "",
    no_surat_jalan: "",
    no_polisi: "",
    unit: "",
    kode_unit: "",
    kode_rute: "",
    km_berangkat: 0,
    km_kembali: 0,
    snack_berangkat: 0,
    snack_kembali: 0,
    keterangan: "",
  });

  interface DriverRow {
    id: number;
    nama: string;
    status: string;
  }

  const [drivers, setDrivers] = useState<DriverRow[]>([]);

  interface ArmadaRow {
    id: number;
    plat: string;
    tipe: string;
    kode: string;
  }

  const [armada, setArmada] = useState<ArmadaRow[]>([]);

  interface RuteRow {
    id: number;
    kode_rute: string;
    status: string;
  }

  const [rute, setRute] = useState<RuteRow[]>([]);

  const defaultFormData: SuratJalanData = {
    id: 0,
    tanggal_berangkat: "",
    tanggal_kembali: "",
    driver: "",
    crew: "",
    no_surat_jalan: "",
    no_polisi: "",
    unit: "",
    kode_rute: "",
    km_berangkat: 0,
    km_kembali: 0,
    snack_berangkat: 0,
    snack_kembali: 0,
    keterangan: "",
    kode_unit: "",
    perpal_1x_keterangan: "",
    perpal_2x_keterangan: "",
    perpal_1x_tanggal: undefined,
    perpal_1x_rute: undefined,
    perpal_2x_tanggal: undefined,
    perpal_2x_rute: undefined,
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // --- Fetch data ---
  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("surat_jalan")
      .select("*")
      .order("id", { ascending: false });
    if (error) console.error("Gagal ambil data:", error.message);
    else {
      setData(data as SuratJalanData[]);
      setFiltered(data as SuratJalanData[]);
    }
    setLoading(false);
  };

  // --- Fetch Dropdown Data ---
  const fetchDropdownData = async () => {
    const { data: drv } = await supabase
      .from("driver")
      .select("*")
      .eq("status", "AKTIF");
    setDrivers(drv || []);
    const { data: arm } = await supabase.from("armada").select("*");
    setArmada(arm || []);
    const { data: rt } = await supabase
      .from("rute")
      .select("*")
      .eq("status", "AKTIF");
    setRute(rt || []);
  };

  useEffect(() => {
    fetchData();
    fetchDropdownData();
  }, []);

  // --- Search Filter ---
  useEffect(() => {
    let filteredData = [...data];
    if (search.trim() !== "") {
      filteredData = filteredData.filter(
        (d) =>
          d.no_surat_jalan?.toLowerCase().includes(search.toLowerCase()) ||
          d.no_polisi?.toLowerCase().includes(search.toLowerCase()) ||
          d.driver?.toLowerCase().includes(search.toLowerCase())
      );
    }
    setFiltered(filteredData);
    setCurrentPage(1);
  }, [search, data]);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage);

  // --- Reset checkbox saat pindah halaman ---
  useEffect(() => {
    setSelected([]); // kosongkan semua checkbox setiap kali pindah halaman
  }, [currentPage]);

  // --- Checkbox di HEADER (baru ditambahkan)
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const handleSelectAll = () => {
    if (selected.length === paginatedData.length) setSelected([]);
    else setSelected(paginatedData.map((item) => item.id));
  };

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selected.length > 0 && selected.length < paginatedData.length;
    }
  }, [selected, paginatedData]);

  const handleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // --- Delete Selected ---
  const handleDeleteSelected = async () => {
    if (selected.length === 0) return alert("Pilih data terlebih dahulu!");

    // Cek apakah ada yang sudah dipakai di uang_saku_driver
    const selectedSJ = data.filter((d) => selected.includes(d.id));
    const nomorTerpakai: string[] = [];

    for (const item of selectedSJ) {
      const { data: used } = await supabase
        .from("uang_saku_driver")
        .select("id")
        .eq("no_surat_jalan", item.no_surat_jalan)
        .limit(1);

      if (used && used.length > 0) {
        nomorTerpakai.push(item.no_surat_jalan);
      }
    }

    if (nomorTerpakai.length > 0) {
      alert(
        `Surat Jalan berikut sudah diproses Uang Saku Driver:\n\n${nomorTerpakai.join(
          "\n"
        )}`
      );
      return;
    }

    if (!confirm("Yakin ingin hapus data terpilih?")) return;

    const { error } = await supabase
      .from("surat_jalan")
      .delete()
      .in("id", selected);

    if (error) alert("Gagal hapus: " + error.message);
    else {
      setSelected([]);
      fetchData();
    }
  };

  // --- Export Excel ---
  const handleExportExcel = () => {
    exportTableToExcel(filtered, {
      filename: "SuratJalan.xlsx",
      sheetName: "Surat Jalan",
      columns: [
        { label: "Tanggal Berangkat", key: "tanggal_berangkat", type: "date", format: toDate },
        { label: "Tanggal Kembali", key: "tanggal_kembali", type: "date", format: toDate },
        { label: "Driver", key: "driver" },
        { label: "Crew", key: "crew" },
        { label: "No Surat Jalan", key: "no_surat_jalan" },
        { label: "Kode Unit", key: "kode_unit" },
        { label: "No Polisi", key: "no_polisi" },
        { label: "Kode Rute", key: "kode_rute" },
        { label: "KM Berangkat", key: "km_berangkat" },
        { label: "KM Kembali", key: "km_kembali" },
        { label: "Snack Berangkat", key: "snack_berangkat" },
        { label: "Snack Kembali", key: "snack_kembali" },
        { label: "Keterangan", key: "keterangan" },
        { label: "Created At", key: "created_at", type: "date", format: toDate },
        { label: "User ID", key: "user_id" },
        { label: "Updated At", key: "updated_at", type: "date", format: toDate },
      ],
    });
  };

  // --- Cetak Surat Jalan ---
  const handlePrintSelected = () => {
    if (selected.length === 0) {
      alert("Pilih data surat jalan yang ingin dicetak!");
      return;
    }

    // Ambil hanya ID pertama (atau bisa ubah jadi multiple print)
    const idCetak = selected[0];
    const dataCetak = data.find((d) => d.id === idCetak);

    if (!dataCetak) {
      alert("Data tidak ditemukan!");
      return;
    }

    // Buka halaman print-ready
    const printWindow = window.open(
      `/cetak-surat-jalan?no=${dataCetak.no_surat_jalan}&autoPrint=true`,
      "_blank"
    );

    if (!printWindow) {
      alert("Gagal membuka jendela cetak. Periksa popup blocker browser kamu.");
    }
  };

  // --- Edit ---
  const handleEdit = (item: SuratJalanData) => {
    const cleanItem = {
      ...defaultFormData,
      ...item,
      perpal_1x_tanggal: item.perpal_1x_tanggal ?? undefined,
      perpal_2x_tanggal: item.perpal_2x_tanggal ?? undefined,
      perpal_1x_rute: item.perpal_1x_rute ?? "",
      perpal_2x_rute: item.perpal_2x_rute ?? "",
    };

    setFormData(cleanItem);
    setShowForm(true);
    checkIfUsedInModules(item.no_surat_jalan);
  };

  // --- Delete ---
  const handleDelete = async (id: number) => {
    const item = data.find((d) => d.id === id);
    if (!item) return;

    // Cek apakah sudah dipakai di uang_saku_driver
    const { data: used } = await supabase
      .from("uang_saku_driver")
      .select("id")
      .eq("no_surat_jalan", item.no_surat_jalan)
      .limit(1);

    if (used && used.length > 0) {
      alert("Surat Jalan sudah diproses Uang Saku Driver!");
      return;
    }

    if (!confirm("Yakin ingin hapus data ini?")) return;

    const { error } = await supabase.from("surat_jalan").delete().eq("id", id);
    if (!error) fetchData();
  };

  const parseNumber = (val: string | number | null | undefined): number | null => {
    const parsed = Number(String(val).replace(/[^\d.-]/g, ""));
    return Number.isNaN(parsed) ? null : parsed;
  };

  const cleanPerpalFields = (data: Partial<SuratJalanData>) => {
    const cleaned = { ...data };

    if (!data.perpal_1x_tanggal || data.perpal_1x_tanggal.trim() === "") {
      cleaned.perpal_1x_tanggal = undefined;
      cleaned.perpal_1x_rute = undefined;
      cleaned.perpal_1x_keterangan = undefined;
    }

    if (!data.perpal_2x_tanggal || data.perpal_2x_tanggal.trim() === "") {
      cleaned.perpal_2x_tanggal = undefined;
      cleaned.perpal_2x_rute = undefined;
      cleaned.perpal_2x_keterangan = undefined;
    }

    return cleaned;
  };

  // --- Submit ---
  const handleSubmit = async () => {
    if (isSubmitting) return false; // ⛔ cegah submit ganda
    setIsSubmitting(true);

  const userId = await getCustomUserId();  

  try {
    // --- Validasi wajib ---
    const wajibIsi: Array<{ field: keyof SuratJalanData; label: string }> = [
      { field: "driver", label: "Driver" },
      { field: "no_polisi", label: "Nomor Polisi" },
      { field: "kode_rute", label: "Rute" },
      { field: "tanggal_berangkat", label: "Tanggal Berangkat" },
      { field: "tanggal_kembali", label: "Tanggal Kembali" },
    ];

    // === VALIDASI WAJIB KETERANGAN JIKA ADA PERPAL ===
    const adaPerpal1 =
      formData.perpal_1x_tanggal &&
      formData.perpal_1x_tanggal.toString().trim() !== "" &&
      formData.perpal_1x_rute &&
      formData.perpal_1x_rute.toString().trim() !== "";

    const adaPerpal2 =
      formData.perpal_2x_tanggal &&
      formData.perpal_2x_tanggal.toString().trim() !== "" &&
      formData.perpal_2x_rute &&
      formData.perpal_2x_rute.toString().trim() !== "";

    // Jika ada perpal, wajib isi keterangan
    if ((adaPerpal1 || adaPerpal2) && (!formData.keterangan || formData.keterangan.trim() === "")) {
      alert("❌ Wajib mengisi KETERANGAN karena ada Perpal.");
      return false;
    }

    for (const { field, label } of wajibIsi) {
      const value = formData[field];
      if (!value || value.toString().trim() === "") {
        alert(`❌ ${label} wajib diisi sebelum menyimpan.`);
        return false;
      }
    }

    // ✅ Validasi format nomor SJ
    if (!/^SJ\d{3}-\d{4}$/.test(formData.no_surat_jalan)) {
      alert("Format nomor surat jalan tidak valid!");
      return false;
    }

    // --- Bersihkan data numeric sesuai kolom baru ---
    const rawData = Object.fromEntries(
      Object.entries(formData).filter(([key]) => key !== "perpalAktif")
    ) as Partial<SuratJalanData>;

    let cleanedData: Partial<SuratJalanData> = {
      ...rawData,
      km_berangkat: parseNumber(formData.km_berangkat),
      km_kembali: parseNumber(formData.km_kembali),
      snack_berangkat: parseNumber(formData.snack_berangkat),
      snack_kembali: parseNumber(formData.snack_kembali),
    };

    cleanedData = cleanPerpalFields(cleanedData);

    if (isUsedInPremi) {
      cleanedData.perpal_1x_tanggal = null;
      cleanedData.perpal_1x_rute = null;
      cleanedData.perpal_1x_keterangan = null;
      cleanedData.perpal_2x_tanggal = null;
      cleanedData.perpal_2x_rute = null;
      cleanedData.perpal_2x_keterangan = null;
    }

    // Bersihkan angka
  const numericFields: Array<keyof SuratJalanData> = [
    "km_berangkat",
    "km_kembali",
    "snack_berangkat",
    "snack_kembali",
  ];

    numericFields.forEach((f) => {
      const key = f as keyof SuratJalanData;
      const val = cleanedData[key];
      const parsed =
        val === "" || val === undefined || val === null
          ? null
          : Number(String(val).replace(/[^\d.-]/g, ""));
      // set ke field yang sesuai (tidak selalu km_berangkat)
      (cleanedData as Partial<SuratJalanData>)[key] = Number.isNaN(parsed) ? undefined : parsed;
    });

    // Pastikan hanya satu jenis perpal yang disimpan (1x atau 2x)
    if (cleanedData.perpal_2x_tanggal && cleanedData.perpal_2x_tanggal.toString().trim() !== "") {
      // user memilih perpal 2x -> kosongkan perpal 1x
      cleanedData.perpal_1x_tanggal = null;
      cleanedData.perpal_1x_rute = null;
      cleanedData.perpal_1x_keterangan = null;
    } else if (cleanedData.perpal_1x_tanggal && cleanedData.perpal_1x_tanggal.toString().trim() !== "") {
      // user memilih perpal 1x -> kosongkan perpal 2x
      cleanedData.perpal_2x_tanggal = null;
      cleanedData.perpal_2x_rute = null;
      cleanedData.perpal_2x_keterangan = null;
    } else {
      // tidak ada perpal sama sekali
      cleanedData.perpal_1x_tanggal = null;
      cleanedData.perpal_1x_rute = null;
      cleanedData.perpal_1x_keterangan = null;
      cleanedData.perpal_2x_tanggal = null;
      cleanedData.perpal_2x_rute = null;
      cleanedData.perpal_2x_keterangan = null;
    }

    // --- Simpan atau update ---
    const isEdit = formData.id && Number(formData.id) !== 0;
    let finalNomor = formData.no_surat_jalan?.trim();
    let dbError = null;

    if (isEdit) {
      // === MODE EDIT ===
      const { error } = await supabase
        .from("surat_jalan")
        .update({ ...cleanedData, no_surat_jalan: finalNomor, user_id: userId, })
        .eq("id", formData.id);

      dbError = error;
    } else {
      // === MODE TAMBAH BARU ===
      delete cleanedData.id;

      const result = await insertWithAutoNomor({
        table: "surat_jalan",
        prefix: "SJ",
        nomorField: "no_surat_jalan",
        data: {
          ...cleanedData,
          user_id: userId,
        },
        monthlyReset: true,   // ✅ reset per bulan
        resetAfterMax: false, // ✅ tidak perlu reset setelah 999
        digitCount: 3,        // ✅ agar bisa sampai SJ999
      });

      if (!result.success) {
        alert("❌ Gagal menyimpan: " + result.error);
        return false;
      }

      finalNomor = result.nomor!;
    }

    if (dbError) {
      alert("❌ Gagal menyimpan: " + dbError.message);
      return false;
    }
    
    alert(`✅ Surat Jalan ${finalNomor} berhasil disimpan.`);
    setFormData((prev) => ({
      ...prev,
      no_surat_jalan: finalNomor, // ⬅️ update state agar bisa dipakai di onSubmit
    }));
    setShowForm(false);
    fetchData();
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    alert("Terjadi kesalahan: " + message);
    return false;
  } finally {
    setIsSubmitting(false); // ✅ kunci dibuka setelah selesai
  }
};

  // --- Escape key untuk tutup form ---
 useEffect(() => {
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowForm(false);
      setFormData(defaultFormData); // <-- reset form di sini
    }
  };

  window.addEventListener("keydown", handleEsc);
  return () => window.removeEventListener("keydown", handleEsc);
}, []);

  // --- Auto isi unit & kode unit sesuai nopol ---
  useEffect(() => {
    if (!formData.no_polisi || armada.length === 0) return;
    const found = armada.find((a) => a.plat === formData.no_polisi);
    setFormData((prev) => ({
      ...prev,
      unit: found?.tipe || "",
      kode_unit: found?.kode || "",
    }));
  }, [formData.no_polisi, armada]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // --- Handle Cancel Perpal ---
  const handleCancelPerpal = () => {
    setFormData((prev) => ({
      ...prev,
      perpal_1x_tanggal: undefined,
      perpal_1x_rute: undefined,
      perpal_2x_tanggal: undefined,
      perpal_2x_rute: undefined,
    }));
  };

  // --- FUNGSI PENGECEKAN: Apakah SJ sudah diproses di Uangsakudriver ---
  const checkIfUsedInModules = async (no_surat_jalan: string) => {
    if (!no_surat_jalan) {
      setIsUsedInSaku(false);
      setIsUsedInPremi(false);
      setIsLocked(false);
      return;
    }

    try {
      const [sakuRes, premiRes] = await Promise.all([
        supabase
          .from("uang_saku_driver")
          .select("id")
          .eq("no_surat_jalan", no_surat_jalan)
          .limit(1),
        supabase
          .from("premi_driver")
          .select("no_surat_jalan")
          .eq("no_surat_jalan", no_surat_jalan)
          .limit(1),
      ]);

      const usedInSaku = (sakuRes.data?.length ?? 0) > 0;
      const usedInPremi = (premiRes.data?.length ?? 0) > 0;

      setIsUsedInSaku(usedInSaku);
      setIsUsedInPremi(usedInPremi);
      setIsLocked(usedInSaku); // tetap kunci field utama
    } catch (err) {
      console.error("❌ Gagal cek SJ:", err);
      setIsUsedInSaku(false);
      setIsUsedInPremi(false);
      setIsLocked(false);
    }
  };

  //-- reset --
   const handleCloseForm = () => {
    setFormData(defaultFormData); // reset semua isi form
    setIsLocked(false);            // reset status kunci
    setShowForm(false);            // sembunyikan pop-up
    };

  return (
    <div className="p-4 bg-white rounded shadow">
      {/* POPUP FORM */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start pt-24 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-lg shadow-2xl p-6 relative mb-10">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
              onClick={() => {setShowForm(false);
              setFormData(defaultFormData);  // <-- reset
              }}
            >
              <FiX size={22} />
            </button>

            <h2 className="text-2xl font-semibold mb-4 text-center">
              Form Surat Jalan
            </h2>

            <form
               onSubmit={async (e) => {
                e.preventDefault();

                const success = await handleSubmit(); // handleSubmit return true jika berhasil simpan/update
                if (!success) return; // kalau gagal, stop

                const confirmPrint = window.confirm("Cetak Surat Jalan?");
                if (confirmPrint) {
                  // Langsung buka tab cetak dan auto print tanpa popup ukuran
                  window.open(
                    `/cetak-surat-jalan?no=${formData.no_surat_jalan}&autoPrint=true`,
                    "_blank"
                  );
                }

                // Tutup popup form setelah simpan
                setShowForm(false);
              }}
              className="grid grid-cols-2 gap-4 pb-6"
            >

               {/* === Nomor Surat Jalan Otomatis === */}
              <div className="col-span-2">
                <label className="block mb-1 font-semibold">No Surat Jalan</label>
                <input
                  type="text"
                  name="no_surat_jalan"
                  required
                  value={formData.no_surat_jalan || ""}
                  readOnly
                  className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
                />
              </div>
              
              {/* === Input Tanggal === */}
              <div>
                <label className="block mb-1 font-semibold">Tanggal Berangkat</label>
                <input
                  type="date"
                  name="tanggal_berangkat"
                  value={formData.tanggal_berangkat || ""}
                  disabled={isLocked}
                  readOnly={isLocked}
                  onChange={handleChange}
                  onFocus={(e) => (e.target.showPicker ? e.target.showPicker() : null)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold">Tanggal Kembali</label>
                <input
                  type="date"
                  name="tanggal_kembali"
                  value={formData.tanggal_kembali || ""}
                  onChange={handleChange}
                  onFocus={(e) => (e.target.showPicker ? e.target.showPicker() : null)}
                  className="w-full border rounded px-3 py-2"
                  disabled={isLocked}
                  readOnly={isLocked}
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold">Driver</label>
                <select
                  name="driver"
                  value={formData.driver ?? ""}
                  onChange={handleChange}
                  className={`w-full border rounded px-3 py-2 ${
                    isLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                  }`}
                  disabled={isLocked}
                >
                  <option value="">Pilih Driver</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.nama}>
                      {d.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 font-semibold">Crew</label>
                <select
                  name="crew"
                  value={formData.crew ?? ""}
                  onChange={handleChange}
                  className={`w-full border rounded px-3 py-2 ${
                    isLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                  }`}
                  disabled={isLocked}
                >
                  <option value="">Pilih Crew</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.nama}>
                      {d.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 grid grid-cols-[2.1fr_1fr_1fr] gap-4">
              {/* No Polisi (autocomplete) */}
              <div className="relative">
                <label className="block mb-1 font-semibold">No Polisi</label>
                <input
                  type="text"
                  value={npSearch || formData.no_polisi || ""}
                  disabled={isLocked}
                    readOnly={isLocked}
                    className={`w-full border rounded px-3 py-2 ${
                      isLocked ? "bg-gray-100 cursor-not-allowed text-gray-500" : ""
                    }`}
                    onChange={(e) => {
                      if (isLocked) return; // cegah ketik
                      const v = e.target.value;
                      setNpSearch(v);
                      setShowNpDropdown(true);
                      setHighlightNp(-1);
                      setFormData((prev) => ({ ...prev, no_polisi: v }));
                    }}
                    onFocus={() => !isLocked && setShowNpDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => {
                        setShowNpDropdown(false);
                        setNpSearch("");
                      }, 150);
                  }}
                  onKeyDown={(e) => {
                    const filtered = armada
                      .sort((a, b) => a.plat.localeCompare(b.plat))
                      .filter((a) => a.plat.toLowerCase().includes(npSearch.toLowerCase()));

                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightNp((prev) => {
                        const next = prev < filtered.length - 1 ? prev + 1 : 0;
                        document.getElementById(`np-item-${next}`)?.scrollIntoView({ block: "nearest" });
                        return next;
                      });
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightNp((prev) => {
                        const next = prev > 0 ? prev - 1 : filtered.length - 1;
                        document.getElementById(`np-item-${next}`)?.scrollIntoView({ block: "nearest" });
                        return next;
                      });
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (highlightNp >= 0) handleSelectNoPolisi(filtered[highlightNp]);
                    } else if (e.key === "Escape") {
                      setShowNpDropdown(false);
                      setNpSearch(""); // ⬅️ reset
                    }
                  }}
                  placeholder="Cari No Polisi..."
                  autoComplete="off"
                />

                {showNpDropdown && (
                  <ul className="absolute z-50 w-full max-h-60 overflow-auto bg-white border rounded mt-1 shadow-lg">
                    {armada
                      .sort((a, b) => a.plat.localeCompare(b.plat))
                      .filter((a) => a.plat.toLowerCase().includes(npSearch.toLowerCase()))
                      .map((item, idx) => (
                        <li
                          key={idx}
                          id={`np-item-${idx}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectNoPolisi(item);
                          }}
                          className={`px-3 py-2 cursor-pointer ${
                            highlightNp === idx ? "bg-blue-100" : "hover:bg-gray-200"
                          }`}
                        >
                          {item.plat}
                        </li>
                      ))}

                    {armada.filter((a) => a.plat.toLowerCase().includes(npSearch.toLowerCase())).length === 0 && (
                      <li className="px-3 py-2 text-gray-400">Tidak ditemukan</li>
                    )}
                  </ul>
                )}
              </div>

              {/* Kode Unit */}
              <div>
                <label className="block mb-1 font-semibold">Kode Unit</label>
                <input
                  type="text"
                  name="kode_unit"
                  value={formData.kode_unit || ""}
                  readOnly
                  className="w-full border rounded px-3 py-2 bg-gray-100"
                />
              </div>

              {/* Unit */}
              <div>
                <label className="block mb-1 font-semibold">Unit</label>
                <input
                  type="text"
                  name="unit"
                  value={formData.unit || ""}
                  readOnly
                  className="w-full border rounded px-3 py-2 bg-gray-100"
                />
              </div>
            </div>

            {/* === Kode Rute + Perpal === */}
            <div className="col-span-2 grid grid-cols-[2fr_1fr_1fr] gap-4">
              {/* Kode Rute (autocomplete) */}
              <div className="relative">
                <label className="block mb-1 font-semibold">Kode Rute</label>
                <input
                  type="text"
                  value={rtSearch || formData.kode_rute || ""}
                  disabled={isLocked}
                    readOnly={isLocked}
                    className={`w-full border rounded px-3 py-2 ${
                      isLocked ? "bg-gray-100 cursor-not-allowed text-gray-500" : ""
                    }`}
                    onChange={(e) => {
                      if (isLocked) return;
                      const v = e.target.value;
                      setRtSearch(v);
                      setShowRtDropdown(true);
                      setHighlightRt(-1);
                      setFormData((prev) => ({ ...prev, kode_rute: v }));
                    }}
                    onFocus={() => !isLocked && setShowRtDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => {
                        setShowRtDropdown(false);
                        setRtSearch("");
                      }, 150);
                  }}
                  onKeyDown={(e) => {
                    const filtered = rute
                      .sort((a, b) => a.kode_rute.localeCompare(b.kode_rute))
                      .filter((rt) => rt.kode_rute.toLowerCase().includes(rtSearch.toLowerCase()));

                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightRt((prev) => {
                        const next = prev < filtered.length - 1 ? prev + 1 : 0;
                        document.getElementById(`rt-item-${next}`)?.scrollIntoView({ block: "nearest" });
                        return next;
                      });
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightRt((prev) => {
                        const next = prev > 0 ? prev - 1 : filtered.length - 1;
                        document.getElementById(`rt-item-${next}`)?.scrollIntoView({ block: "nearest" });
                        return next;
                      });
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (highlightRt >= 0) handleSelectKodeRute(filtered[highlightRt]);
                    } else if (e.key === "Escape") {
                      setShowRtDropdown(false);
                      setRtSearch(""); // ⬅️ reset
                    }
                  }}
                  placeholder="Cari Kode Rute..."
                  autoComplete="off"
                />

                {showRtDropdown && (
                  <ul className="absolute z-50 w-full max-h-60 overflow-auto bg-white border rounded mt-1 shadow-lg">
                    {rute
                      .sort((a, b) => a.kode_rute.localeCompare(b.kode_rute))
                      .filter((rt) => rt.kode_rute.toLowerCase().includes(rtSearch.toLowerCase()))
                      .map((rt, idx) => (
                        <li
                          key={idx}
                          id={`rt-item-${idx}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectKodeRute(rt);
                          }}
                          className={`px-3 py-2 cursor-pointer ${
                            highlightRt === idx ? "bg-blue-100" : "hover:bg-gray-200"
                          }`}
                        >
                          {rt.kode_rute}
                        </li>
                      ))}

                    {rute.filter((rt) => rt.kode_rute.toLowerCase().includes(rtSearch.toLowerCase())).length === 0 && (
                      <li className="px-3 py-2 text-gray-400">Tidak ditemukan</li>
                    )}
                  </ul>
                )}
              </div>

              {/* === Tombol Perpal === */}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!canTambahPerpal || isUsedInPremi}
                  onClick={() =>
                    canTambahPerpal && !isUsedInPremi &&
                    setFormData((prev) => ({
                      ...prev,
                      perpal_1x_tanggal: "",
                      perpal_1x_rute: "",
                      perpal_2x_tanggal: undefined,
                      perpal_2x_rute: undefined,
                    }))
                  }
                  className={`px-2 py-1 rounded text-sm text-white ${
                    !canTambahPerpal || isUsedInPremi
                      ? "bg-gray-300 cursor-not-allowed"
                      : "bg-yellow-500 hover:bg-yellow-600"
                  }`}
                >
                  Tambah Perpal 1x
                </button>

                <button
                  type="button"
                  disabled={!canTambahPerpal || isUsedInPremi}
                  onClick={() =>
                    canTambahPerpal && !isUsedInPremi &&
                    setFormData((prev) => ({
                      ...prev,
                      perpal_2x_tanggal: "",
                      perpal_2x_rute: "",
                      perpal_1x_tanggal: undefined,
                      perpal_1x_rute: undefined,
                    }))
                  }
                  className={`px-2 py-1 rounded text-sm text-white ${
                    !canTambahPerpal || isUsedInPremi
                      ? "bg-gray-300 cursor-not-allowed"
                      : "bg-yellow-600 hover:bg-yellow-700"
                  }`}
                >
                  Tambah Perpal 2x
                </button>
              </div>
            </div>

            {/* === Input Keterangan Perpal === */}
           {formData.perpal_1x_tanggal !== undefined && (
            <div className="mb-2">
              <div className="flex gap-2 items-start">
                {/* Label Perpal 1x + input tanggal */}
                <div className="w-1/2">
                  <label className="block font-semibold mb-1">Perpal 1x</label>
                  <input
                    type="date"
                    value={formData.perpal_1x_tanggal ?? ""}
                    disabled={isUsedInPremi}
                    readOnly={isUsedInPremi}
                    className={`border px-2 py-1 text-sm w-full ${
                      isUsedInPremi ? "bg-gray-300 cursor-not-allowed text-gray-600" : ""
                    }`}
                    onChange={(e) =>
                      !isUsedInPremi &&
                      setFormData((prev) => ({ ...prev, perpal_1x_tanggal: e.target.value }))
                    }
                  />
                </div>

                {/* Kode Rute Baru */}
                <div className="w-1/3">
                  <label className="block font-semibold mb-1">Kode Rute Baru</label>
                  <select
                    value={formData.perpal_1x_rute ?? ""}
                    disabled={isUsedInPremi}
                    className={`border px-2 py-1 text-sm w-full ${
                      isUsedInPremi ? "bg-gray-300 cursor-not-allowed text-gray-600" : ""
                    }`}
                    onChange={(e) =>
                      !isUsedInPremi &&
                      setFormData((prev) => ({ ...prev, perpal_1x_rute: e.target.value }))
                    }
                  >
                    <option value="">Pilih Rute Aktif</option>
                    {rute.map((r) => (
                      <option key={r.id} value={r.kode_rute}>
                        {r.kode_rute}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tombol tong hanya muncul jika belum diproses */}
                {!isUsedInPremi && (
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={handleCancelPerpal}
                      className="text-red-500 text-sm hover:text-red-700"
                      title="Batalkan Perpal"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {formData.perpal_2x_tanggal !== undefined && (
          <div className="mb-2">
            <div className="flex gap-2 items-start">
              <div className="w-1/2">
                <label className="block font-semibold mb-1">Perpal 2x</label>
                <input
                  type="date"
                  value={formData.perpal_2x_tanggal ?? ""}
                   disabled={isUsedInPremi}
                   readOnly={isUsedInPremi}
                  className={`border px-2 py-1 text-sm w-full ${
                    isUsedInPremi ? "bg-gray-300 cursor-not-allowed text-gray-600" : ""
                  }`}
                  onChange={(e) =>
                    !isUsedInPremi &&
                    setFormData((prev) => ({ ...prev, perpal_2x_tanggal: e.target.value }))
                  }
                />
              </div>

              <div className="w-1/3">
                <label className="block font-semibold mb-1">Kode Rute Baru</label>
                <select
                  value={formData.perpal_2x_rute ?? ""}
                  disabled={isUsedInPremi}
                  className={`border px-2 py-1 text-sm w-full ${
                    isUsedInPremi ? "bg-gray-300 cursor-not-allowed text-gray-600" : ""
                  }`}
                  onChange={(e) =>
                    !isUsedInPremi &&
                    setFormData((prev) => ({ ...prev, perpal_2x_rute: e.target.value }))
                  }
                >
                  <option value="">Pilih Rute Aktif</option>
                  {rute.map((r) => (
                    <option key={r.id} value={r.kode_rute}>
                      {r.kode_rute}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tombol tong hanya muncul jika belum diproses */}
              {!isUsedInPremi && (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleCancelPerpal}
                    className="text-red-500 text-sm hover:text-red-700"
                    title="Batalkan Perpal"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
            
             <div className="col-span-2 grid grid-cols-2 gap-4">
              {/* KM Berangkat */}
              <div>
                <label className="block mb-1 font-semibold">KM Berangkat</label>
                <input
                  type="text"
                  name="km_berangkat"
                  value={
                    formData.km_berangkat
                      ? Number(formData.km_berangkat).toLocaleString("id-ID")
                      : ""
                  }
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    setFormData((prev) => ({
                      ...prev,
                      km_berangkat: raw === "" ? 0 : parseInt(raw),
                    }));
                  }}
                  className="w-full border rounded px-3 py-2 text-left"
                />
              </div>

              {/* KM Kembali */}
              <div>
                <label className="block mb-1 font-semibold">KM Kembali</label>
                <input
                  type="text"
                  name="km_kembali"
                  value={
                    formData.km_kembali
                      ? Number(formData.km_kembali).toLocaleString("id-ID")
                      : ""
                  }
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    setFormData((prev) => ({
                      ...prev,
                      km_kembali: raw === "" ? 0 : parseInt(raw),
                    }));
                  }}
                  className="w-full border rounded px-3 py-2 text-left"
                />
              </div>
            </div>

              <div>
                <label className="block mb-1 font-semibold">
                  Snack Berangkat
                </label>
                <input
                  type="number"
                  name="snack_berangkat"
                  value={formData.snack_berangkat || ""}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold">
                  Snack Kembali
                </label>
                <input
                  type="number"
                  name="snack_kembali"
                  value={formData.snack_kembali || ""}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div className="col-span-2">
                <label className="block mb-1 font-semibold">Keterangan</label>
                <textarea
                  name="keterangan"
                  value={formData.keterangan || ""}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div className="col-span-2 flex justify-end gap-4 mt-4">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="bg-red-400 text-white px-4 py-2 rounded hover:bg-red-500"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ${
                    isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOMBOL */}
      <div className="w-full pr-8 flex flex-wrap justify-between items-center mb-4 gap-3">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={async () => {
              try {
                // 🔹 Panggil fungsi auto nomor
                const result = await insertWithAutoNomor({
                  table: "surat_jalan",
                  prefix: "SJ",
                  nomorField: "no_surat_jalan",
                  data: {}, // belum insert, hanya preview
                  previewOnly: true, // hanya generate nomor
                });

                if (!result.success) {
                  alert("❌ Gagal membuat nomor otomatis: " + result.error);
                  return;
                }

                // 🔹 Tampilkan nomor baru ke form
                setFormData({
                  ...defaultFormData,
                  no_surat_jalan: result.nomor!,
                });

                setShowForm(true);
              } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                alert("Terjadi kesalahan saat membuat nomor Surat Jalan: " + message);
              }
            }}
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
            onClick={handlePrintSelected}
            className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
          >
            <FiPrinter /> Cetak
          </button>
        </div>

        <div className="relative w-[320px]">
          <input
            type="text"
            placeholder="Cari No Surat / Driver / Nopol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-2 w-full pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* TABEL */}
      <div className="w-full pr-8">
        <table className="min-w-[1590px] table-auto border border-gray-300 text-sm">
          <thead className="bg-gray-400 text-white">
            <tr>
              <th className="p-2 border text-center w-[40px]">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={
                    selected.length === paginatedData.length &&
                    paginatedData.length > 0
                  }
                  onChange={handleSelectAll}
                />
              </th>
              <th className="border p-2 text-center w-[60px]">Aksi</th>
              <th className="border p-2 text-center w-[90px]">Tanggal Berangkat</th>
              <th className="border p-2 text-centerw-[90px]">Tanggal Kembali</th>
              <th className="border p-2 text-center w-[90px]">Driver</th>
              <th className="border p-2 text-center w-[90px]">Crew</th>
              <th className="border p-2 text-center w-[100px]">No Surat Jalan</th>
              <th className="border p-2 text-center w-[60px]">Kode Unit</th>
              <th className="border p-2 text-center w-[90px]">No Polisi</th>
              <th className="border p-2 text-center w-[180px]">Kode Rute</th>
              <th className="border p-2 text-center w-[80px]">KM Berangkat</th>
              <th className="border p-2 text-center w-[80px]">KM Kembali</th>
              <th className="border p-2 text-center w-[60px]">Snack Berangkat</th>
              <th className="border p-2 text-center w-[60px]">Snack Kembali</th>
              <th className="border p-2 text-center w-[180px]">Keterangan</th>
              <th className="border p-2 text-center w-[40px]">User ID</th>
              <th className="border p-2 text-center w-[170px]">Updated At</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={14} className="text-center py-3">
                  Memuat data...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={14} className="text-center py-3">
                  Tidak ada data.
                </td>
              </tr>
            ) : (
              paginatedData.map((item) => {
                // Format tanggal ke dd-mm-yyyy
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
              return (
                <tr
                  key={item.id}
                  className="hover:bg-yellow-300 transition-all duration-150 text-center border"
                >
                  <td className="p-2 border">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={() => handleSelect(item.id)}
                    />
                  </td>
                  <td className="text-center py-0 px-0">
                      <div className="flex justify-center gap-[0.5px]">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-blue-600 hover:text-blue-800 px-[5px]"
                          title="Edit"
                        >
                          <FiEdit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-800 px-[5px]"
                          title="Hapus"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  <td className="p-2 border">{formatTanggal(item.tanggal_berangkat)}</td>
                  <td className="p-2 border">{formatTanggal(item.tanggal_kembali)}</td>
                  <td className="p-2 border">{item.driver}</td>
                  <td className="p-2 border">{item.crew}</td>
                  <td className="p-2 border">{item.no_surat_jalan}</td>
                  <td className="p-2 border">{item.kode_unit}</td>
                  <td className="p-2 border">{item.no_polisi}</td>
                  <td className="px-3 py-2">
                    {item.kode_rute}
                    {(
                      (item.perpal_1x_tanggal && item.perpal_1x_tanggal.trim() !== "") ||
                      (item.perpal_2x_tanggal && item.perpal_2x_tanggal.trim() !== "")
                    ) && (
                      <span
                        title="Ada Perpal"
                        className="ml-2 inline-block text-xs bg-yellow-500 text-white px-1.5 py-0.5 rounded font-bold"
                      >
                        🅿️
                      </span>
                    )}

                  </td>
                  <td className="p-2 border">{item.km_berangkat ? Number(item.km_berangkat).toLocaleString("id-ID") : ""}</td>
                  <td className="p-2 border">{item.km_kembali ? Number(item.km_kembali).toLocaleString("id-ID") : ""}</td>
                  <td className="p-2 border">{item.snack_berangkat}</td>
                  <td className="p-2 border">{item.snack_kembali}</td>
                  <td className="p-2 border text-left">{item.keterangan}</td>
                  <td className="border p-2">{item.user_id || "-"}</td>
                  <td className="border p-2">{item.updated_at ? getWIBTimestampFromUTC(item.updated_at) : ""}</td>
                </tr>
              );
             })
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="flex justify-center items-center mt-4 gap-2">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => p - 1)}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          ‹ Prev
        </button>
        <span>
          Halaman {currentPage} dari {totalPages || 1}
        </span>
        <button
          disabled={currentPage === totalPages || totalPages === 0}
          onClick={() => setCurrentPage((p) => p + 1)}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
