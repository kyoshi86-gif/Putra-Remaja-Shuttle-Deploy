import { useRef, useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { FiEdit, FiTrash2, FiPlus, FiX, FiDownload, FiPrinter } from "react-icons/fi";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { insertWithAutoNomor } from "../lib/dbUtils";

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
  km_berangkat: number;
  km_kembali: number;
  snack_berangkat: number;
  snack_kembali: number;
  keterangan: string;
}

export default function SuratJalan() {
  const [data, setData] = useState<SuratJalanData[]>([]);
  const [filtered, setFiltered] = useState<SuratJalanData[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
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
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

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
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Surat Jalan");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "SuratJalan.xlsx");
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
    setFormData(item);
    setShowForm(true);
    checkIfUsedInUangSaku(item.no_surat_jalan); // ⬅️ cek apakah sudah dipakai
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

  // --- Submit ---
  const handleSubmit = async () => {
  try {
    // --- Validasi wajib ---
    const wajibIsi: Array<{ field: keyof SuratJalanData; label: string }> = [
      { field: "driver", label: "Driver" },
      { field: "no_polisi", label: "Nomor Polisi" },
      { field: "kode_rute", label: "Rute" },
      { field: "tanggal_berangkat", label: "Tanggal Berangkat" },
      { field: "tanggal_kembali", label: "Tanggal Kembali" },
    ];

    for (const { field, label } of wajibIsi) {
      const value = formData[field];
      if (!value || value.toString().trim() === "") {
        alert(`❌ ${label} wajib diisi sebelum menyimpan.`);
        return false;
      }
    }

    // --- Bersihkan data numeric sesuai kolom baru ---
    const numericFields = [
      "km_berangkat",
      "km_kembali",
      "snack_berangkat",
      "snack_kembali",
    ];

    const cleanedData: Partial<Record<keyof SuratJalanData, string | number | null>> = { ...formData };
    numericFields.forEach((f) => {
      const key = f as keyof SuratJalanData;
      const val = cleanedData[key];

      const parsed =
        val === "" || val === undefined || val === null
          ? null
          : Number(String(val).replace(/[^\d.-]/g, ""));

      cleanedData[key] = Number.isNaN(parsed) ? null : parsed;
    });

    // --- Simpan atau update ---
    const isEdit = formData.id && Number(formData.id) !== 0;
    let finalNomor = formData.no_surat_jalan?.trim();
    let dbError = null;

    if (isEdit) {
      const { error } = await supabase
        .from("surat_jalan")
        .update({ ...cleanedData, no_surat_jalan: finalNomor })
        .eq("id", formData.id);
      dbError = error;
    } else {
      delete cleanedData.id; // ⬅️ Wajib untuk mencegah konflik id=0

      const result = await insertWithAutoNomor({
          table: "surat_jalan",
          prefix: "SJ-",
          data: cleanedData,
          nomorField: "no_surat_jalan",
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

  // --- FUNGSI PENGECEKAN ---
  const checkIfUsedInUangSaku = async (no_surat_jalan: string) => {
    const { data } = await supabase
      .from("uang_saku_driver")
      .select("id")
      .eq("no_surat_jalan", no_surat_jalan)
      .limit(1);

    setIsLocked(Array.isArray(data) && data.length > 0);
  };

  //-- reset --
   const handleCloseForm = () => {
    setFormData(defaultFormData); // reset semua isi form
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
                  value={formData.driver}
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
                  value={formData.crew}
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
              {/* No Polisi */}
              <div>
                <label className="block mb-1 font-semibold">No Polisi</label>
                <select
                  name="no_polisi"
                  value={formData.no_polisi}
                  onChange={handleChange}
                  className={`w-full border rounded px-3 py-2 ${
                    isLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                  }`}
                  disabled={isLocked}
                >
                  <option value="">Pilih Nopol</option>
                  {armada.map((a) => (
                    <option key={a.id} value={a.plat}>
                      {a.plat}
                    </option>
                  ))}
                </select>
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

              <div>
                <label className="block mb-1 font-semibold">Kode Rute</label>
                <select
                  name="kode_rute"
                  value={formData.kode_rute}
                  onChange={handleChange}
                  className={`w-full border rounded px-3 py-2 ${
                    isLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                  }`}
                  disabled={isLocked}
                >
                  <option value="">Pilih Rute</option>
                  {rute.map((r) => (
                    <option key={r.id} value={r.kode_rute}>
                      {r.kode_rute}
                    </option>
                  ))}
                </select>
              </div>

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
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOMBOL */}
      <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={async () => {
              try {
                const now = new Date();
                const yy = String(now.getFullYear()).slice(2);
                const mm = String(now.getMonth() + 1).padStart(2, "0");
                const dd = String(now.getDate()).padStart(2, "0");
                const tanggal = `${yy}${mm}${dd}`; // ⬅️ Format: YYMMDD
                const prefix = `SJ-${tanggal}-`;

                // Ambil urutan maksimum dari Supabase
                const { data, error } = await supabase.rpc("get_max_sj_urutan", {
                  tanggal_prefix: prefix,
                });

                if (error) throw error;

                const maxUrutan = typeof data === "number" && !isNaN(data) ? data : 0;
                const nextUrutan = String(maxUrutan + 1).padStart(3, "0");
                const nomorBaru = `${prefix}${nextUrutan}`; // Contoh: SJ-251024-001

                setFormData({
                  ...defaultFormData,
                  no_surat_jalan: nomorBaru,
                });

                setShowForm(true);
              } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                console.error("Gagal membuat nomor SJ:", message);
                alert("Terjadi kesalahan saat membuat nomor surat jalan.");
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
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border border-gray-300 text-sm">
          <thead className="bg-gray-400 text-white">
            <tr>
              <th className="p-2 border text-center">
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
              <th className="border p-2 text-center w-[120px]">No Surat Jalan</th>
              <th className="border p-2 text-center w-[90px]">No Polisi</th>
              <th className="border p-2 text-center w-[120px]">Kode Rute</th>
              <th className="border p-2 text-center w-[80px]">KM Berangkat</th>
              <th className="border p-2 text-center w-[80px]">KM Kembali</th>
              <th className="border p-2 text-center w-[80px]">Snack Berangkat</th>
              <th className="border p-2 text-center w-[80px]">Snack Kembali</th>
              <th className="border p-2 text-center w-[210px]">Keterangan</th>
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
              paginatedData.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-100 text-center border"
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
                  <td className="p-2 border">{item.tanggal_berangkat}</td>
                  <td className="p-2 border">{item.tanggal_kembali}</td>
                  <td className="p-2 border">{item.driver}</td>
                  <td className="p-2 border">{item.crew}</td>
                  <td className="p-2 border">{item.no_surat_jalan}</td>
                  <td className="p-2 border">{item.no_polisi}</td>
                  <td className="p-2 border">{item.kode_rute}</td>
                  <td className="p-2 border">{item.km_berangkat ? Number(item.km_berangkat).toLocaleString("id-ID") : ""}</td>
                  <td className="p-2 border">{item.km_kembali ? Number(item.km_kembali).toLocaleString("id-ID") : ""}</td>
                  <td className="p-2 border">{item.snack_berangkat}</td>
                  <td className="p-2 border">{item.snack_kembali}</td>
                  <td className="p-2 border text-left">{item.keterangan}</td>
                </tr>
              ))
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
