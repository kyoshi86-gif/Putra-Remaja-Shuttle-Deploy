import { useRef, useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import {FiEdit, FiTrash2, FiPlus, FiX, FiDownload, FiPrinter} from "react-icons/fi";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { insertWithAutoNomor } from "../lib/dbUtils";

interface UangSakuData {
  id: number;
  tanggal: string;
  no_surat_jalan: string;
  tanggal_berangkat: string;
  tanggal_kembali: string;
  driver: string;
  crew: string;
  no_polisi: string;
  kode_unit: string;
  kode_rute: string;
  bbm: number;
  uang_makan: number;
  parkir: number;
  jumlah: number;
  kartu_etoll: string;
  no_uang_saku: string;
}

export default function UangSakuDriver() {
  const [data, setData] = useState<UangSakuData[]>([]);
  const [filtered, setFiltered] = useState<UangSakuData[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UangSakuData>({
    id: 0,
    tanggal: "",
    no_surat_jalan: "",
    tanggal_berangkat: "",
    tanggal_kembali: "",
    driver: "",
    crew: "",
    no_polisi: "",
    kode_unit: "",
    kode_rute: "",
    bbm: 0,
    uang_makan: 0,
    parkir: 0,
    jumlah: 0,
    kartu_etoll: "",
    no_uang_saku: "",
  });

  const defaultFormData: UangSakuData= {
    id: 0,
    tanggal: "",
    no_surat_jalan: "",
    tanggal_berangkat: "",
    tanggal_kembali: "",
    driver: "",
    crew: "",
    no_polisi: "",
    kode_unit: "",
    kode_rute: "",
    bbm: 0,
    uang_makan: 0,
    parkir: 0,
    jumlah: 0,
    kartu_etoll: "",
    no_uang_saku: "",
  };  

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // --- FETCH DATA ---
  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("uang_saku_driver")
      .select("*")
      .order("id", { ascending: false });

    if (error) console.error("Gagal ambil data:", error.message);
    else {
      setData(data as UangSakuData[]);
      setFiltered(data as UangSakuData[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- SEARCH ---
  useEffect(() => {
    let filteredData = [...data];
    if (search.trim() !== "") {
      const keyword = search.toLowerCase();
      filteredData = filteredData.filter(
        (d) =>
          d.no_uang_saku?.toLowerCase().includes(keyword) ||
          d.no_surat_jalan?.toLowerCase().includes(keyword) ||
          d.driver?.toLowerCase().includes(keyword) ||
          d.no_polisi?.toLowerCase().includes(keyword)
      );
    }
    setFiltered(filteredData);
    setCurrentPage(1);
  }, [search, data]);

  // --- PAGINATION ---
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage);

  // --- Reset checkbox saat pindah halaman ---
  useEffect(() => {
    setSelected([]); // kosongkan semua checkbox setiap kali pindah halaman
  }, [currentPage]);

  // --- SELECT ALL CHECKBOX ---
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

  // --- DELETE SELECTED ---
  const handleDeleteSelected = async () => {
    if (selected.length === 0) return alert("Pilih data terlebih dahulu!");
    if (!confirm("Yakin ingin hapus data terpilih?")) return;

    const { error } = await supabase
      .from("uang_saku_driver")
      .delete()
      .in("id", selected);
    if (error) alert("Gagal hapus: " + error.message);
    else {
      setSelected([]);
      fetchData();
    }
  };

  // --- EXPORT EXCEL ---
  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Uang Saku Driver");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "UangSakuDriver.xlsx");
  };

  // --- Cetak Uang Saku ---
  const handlePrintSelected = () => {
    if (selected.length === 0) {
      alert("Pilih data Uang Saku yang ingin dicetak!");
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
      `/cetak-uang-saku?no=${dataCetak.no_uang_saku}&autoPrint=true`,
      "_blank"
    );

    if (!printWindow) {
      alert("Gagal membuka jendela cetak. Periksa popup blocker browser kamu.");
    }
  };

  // --- EDIT ---
  const handleEdit = (item: UangSakuData) => {
    setFormData(item);
    setShowForm(true);
  };

  // --- DELETE ROW ---
  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin hapus data ini?")) return;
    const { error } = await supabase
      .from("uang_saku_driver")
      .delete()
      .eq("id", id);
    if (!error) fetchData();
  };

  // --- Submit ---
const handleSubmit = async (e?: any) => {
  if (e) e.preventDefault();
  try {
    // Validasi wajib
    const wajibIsi = [
      { field: "no_surat_jalan", label: "No Surat Jalan" },
      { field: "driver", label: "Driver" },
      { field: "no_polisi", label: "Nomor Polisi" },
      { field: "kode_rute", label: "Kode Rute" },
      { field: "tanggal_berangkat", label: "Tanggal Berangkat" },
      { field: "tanggal_kembali", label: "Tanggal Kembali" },
    ];

    for (const { field, label } of wajibIsi) {
      if (
        !(formData as Record<string, any>)[field] ||
        (formData as Record<string, any>)[field].toString().trim() === ""
      ) {
        alert(`❌ ${label} wajib diisi.`);
        return;
      }
    }

    // Bersihkan numeric
    const numericFields = [
      "bbm", 
      "uang_makan", 
      "parkir", 
      "jumlah"
    ];

    const cleanedData: any = { ...formData };
    numericFields.forEach((f) => {
      const val = cleanedData[f];
      cleanedData[f] =
        val === "" || val === undefined || val === null
          ? null
          : Number(String(val).replace(/[^\d.-]/g, ""));
      if (Number.isNaN(cleanedData[f])) cleanedData[f] = null;
    });

    // --- Simpan atau update ---
    const isEdit = formData.id && Number(formData.id) !== 0;
    let finalNomor = formData.no_uang_saku?.trim();
      let dbError = null;

    if (isEdit) {
      // UPDATE
      const { error } = await supabase
        .from("uang_saku_driver")
        .update({ ...cleanedData, no_uang_saku: finalNomor })
        .eq("id", formData.id);
      dbError = error;
    } else {
      // INSERT BARU
      delete cleanedData.id; // ⬅️ WAJIB untuk mencegah konflik id=0

      const result = await insertWithAutoNomor({
        table: "uang_saku_driver",
        prefix: "US-",
        data: cleanedData,
        nomorField: "no_uang_saku",
        previewOnly: false,
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
    
    alert(`✅ Saku Driver ${finalNomor} berhasil disimpan.`);
    setShowForm(false);
    setFormData(defaultFormData);
    fetchData();
    return true;
  } catch (err: any) {
    alert("Terjadi kesalahan: " + (err?.message || err));
    return false;
  }
};

  // --- CHANGE HANDLER ---
  const handleChange = (e: any) => {
    const { name, value } = e.target;
    let numericFields = ["bbm", "uang_makan", "parkir"];
    if (numericFields.includes(name)) {
      const raw = value.replace(/[^\d]/g, "");
      setFormData((prev) => ({
        ...prev,
        [name]: raw === "" ? 0 : parseInt(raw),
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // --- AUTO HITUNG JUMLAH ---
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      jumlah: (prev.bbm || 0) + (prev.uang_makan || 0) + (prev.parkir || 0),
    }));
  }, [formData.bbm, formData.uang_makan, formData.parkir]);

  const formatRupiah = (num: number) =>
    "Rp " + (num ? num.toLocaleString("id-ID") : "0");

  // --- Tambahkan / ganti state & fetch di atas komponen ---
const [sjList, setSjList] = useState<any[]>([]);
const [highlightedIndex, setHighlightedIndex] = useState(-1);
const [sjSearch, setSjSearch] = useState("");
const [showDropdown, setShowDropdown] = useState(false);

const fetchSjList = async () => {
  const { data: sjData, error } = await supabase
    .from("surat_jalan")
    .select("*");
  if (error) {
    console.error("Gagal ambil SJ:", error.message);
  } else {
    // Pastikan sjData terurut unik jika perlu; setSJ
    setSjList(Array.isArray(sjData) ? sjData : []);
  }
};

useEffect(() => {
  fetchSjList();
}, []);

// --- Fungsi pilih SJ (ditrigger sebelum blur karena onMouseDown di item) ---
const handleSelectSj = (sj: any) => {
  // Pastikan field ada; gunakan empty string jika tidak
  const noSj = sj?.no_surat_jalan ?? "";
  const tBerangkat = sj?.tanggal_berangkat ?? "";
  const tKembali = sj?.tanggal_kembali ?? "";
  const driver = sj?.driver ?? "";
  const crew = sj?.crew ?? "";
  const noPol = sj?.no_polisi ?? "";
  const kodeUnit = sj?.kode_unit ?? "";
  const kodeRute = sj?.kode_rute ?? "";

  // AUTO SEARCH DI SURAT JALAN
  setFormData((prev) => ({
    ...prev,
    no_surat_jalan: noSj,
    tanggal_berangkat: tBerangkat,
    tanggal_kembali: tKembali,
    driver,
    crew,
    no_polisi: noPol,
    kode_unit: kodeUnit,
    kode_rute: kodeRute,
  }));

  setSjSearch(noSj);
  setShowDropdown(false);

  // opsional: fokus kembali ke input jika butuh
  // inputRef?.current?.focus();
};

  // --- Escape key untuk tutup form ---
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => e.key === "Escape" && setShowForm(false);
    setFormData(defaultFormData); // <-- reset
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  
  // --- Auto isi NO USD saat klik Tambah (preview saja) ---
const handleTambah = async () => {
  try {
    // Pastikan semua state form benar-benar bersih
    setFormData({ ...defaultFormData });
    setSjSearch("");
    setShowDropdown(false);
    setHighlightedIndex(-1);

    // Buat nomor baru (preview, belum insert)
    const { success, nomor, error } = await insertWithAutoNomor({
      table: "uang_saku_driver",
      prefix: "US-",
      data: {},
      nomorField: "no_uang_saku",
      previewOnly: true, // hanya preview, tidak insert
    });

    if (!success || !nomor) throw new Error(error || "Gagal buat nomor baru");

    // Set nomor baru ke form
    setFormData((prev) => ({ ...prev, no_uang_saku: nomor }));

    // Tampilkan popup form
    setShowForm(true);
  } catch (err: any) {
    alert("❌ Terjadi kesalahan saat membuat nomor uang saku: " + err.message);
  }
};

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
            onClick={handleCloseForm}
          >
            <FiX size={22} />
          </button>

          <h2 className="text-2xl font-semibold mb-4 text-center">
            Form Uang Saku Driver
          </h2>

          <form
            onSubmit={async (e) => {
                e.preventDefault();

                const success = await handleSubmit(); // handleSubmit return true jika berhasil simpan/update
                if (!success) return; // kalau gagal, stop

                const confirmPrint = window.confirm("Cetak Bukti Uang Saku?");
                if (confirmPrint) {
                  // Langsung buka tab cetak dan auto print tanpa popup ukuran
                  window.open(
                    `/cetak-uang-saku?no=${formData.no_uang_saku}&autoPrint=true`,
                    "_blank"
                  );
                }

                // Tutup popup form setelah simpan
                setShowForm(false);
              }}
            className="grid grid-cols-2 gap-4 pb-6"
          >
          
          {/* No Saku Driver */}
          <div className="col-span-2">
            <label className="block mb-1 font-semibold">No Uang Saku Driver</label>
            <input
              type="text"
              name="no_uang_saku"
              required
              value={formData.no_uang_saku || ""}
              readOnly
              className="w-full border rounded px-3 py-2 bg-gray-100 cursor-not-allowed"
            />
          </div>

          {/* Tanggal Keluar */}
          <div>
            <label className="block mb-1 font-semibold">Tanggal Uang Saku</label>
            <input
              type="date"
              name="tanggal"
              value={formData.tanggal || ""}
              onChange={handleChange}
              onFocus={(e) => (e.target.showPicker ? e.target.showPicker() : null)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* No Surat Jalan (autocomplete) */}
          <div className="relative">
            <label className="block mb-1 font-semibold">No Surat Jalan</label>
            <input
              type="text"
              name="no_surat_jalan"
              value={sjSearch || formData.no_surat_jalan || ""}
              onChange={(e) => {
                const value = e.target.value;
                setSjSearch(value);
                setShowDropdown(true);
                setHighlightedIndex(-1);
                setFormData((prev) => ({ ...prev, no_surat_jalan: value }));
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => {
                setTimeout(() => setShowDropdown(false), 150);
              }}
              onKeyDown={(e) => {
                const filtered = sjList.filter((sj) =>
                  sj.no_surat_jalan
                    ?.toLowerCase()
                    .includes(sjSearch.toLowerCase())
                );

                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightedIndex((prev) => {
                    const next = prev < filtered.length - 1 ? prev + 1 : 0;
                    const el = document.getElementById(`sj-item-${next}`);
                    if (el) el.scrollIntoView({ block: "nearest" });
                    return next;
                  });
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightedIndex((prev) => {
                    const next = prev > 0 ? prev - 1 : filtered.length - 1;
                    const el = document.getElementById(`sj-item-${next}`);
                    if (el) el.scrollIntoView({ block: "nearest" });
                    return next;
                  });
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
                    handleSelectSj(filtered[highlightedIndex]);
                  }
                } else if (e.key === "Escape") {
                  setShowDropdown(false);
                }
              }}
              placeholder="Cari No Surat Jalan..."
              className="w-full border rounded px-3 py-2"
              autoComplete="off"
            />

            {showDropdown && (
              <ul
                id="sj-list"
                className="absolute z-50 w-full max-h-60 overflow-auto bg-white border rounded mt-1 shadow-lg"
              >
                {sjList
                  .filter((sj) =>
                    sj.no_surat_jalan
                      ?.toLowerCase()
                      .includes(sjSearch.toLowerCase())
                  )
                  .map((sj, idx) => (
                    <li
                      key={sj.id ?? `${sj.no_surat_jalan}-${idx}`}
                      id={`sj-item-${idx}`}
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        handleSelectSj(sj);
                      }}
                      className={`px-3 py-2 cursor-pointer ${
                        highlightedIndex === idx ? "bg-blue-100" : "hover:bg-gray-200"
                      }`}
                    >
                      {sj.no_surat_jalan}
                    </li>
                  ))}

                {sjList.filter((sj) =>
                  sj.no_surat_jalan
                    ?.toLowerCase()
                    .includes(sjSearch.toLowerCase())
                ).length === 0 && (
                  <li className="px-3 py-2 text-gray-400">Tidak ditemukan</li>
                )}
              </ul>
            )}
          </div>

          {/* Tanggal Berangkat */}
          <div>
            <label className="block mb-1 font-semibold">Tanggal Berangkat & Kembali</label>
            <input
              type="text"
              readOnly
              value={
                formData.tanggal_berangkat && formData.tanggal_kembali
                  ? `${new Date(formData.tanggal_berangkat)
                      .toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                      .replaceAll("/", "-")} s/d ${new Date(formData.tanggal_kembali)
                      .toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                      .replaceAll("/", "-")}`
                  : ""
              }
              className="w-full border rounded px-3 py-2 bg-gray-100"
            />
          </div>

          {/* Driver / Crew */}
          <div>
            <label className="block mb-1 font-semibold">Driver / Crew</label>
            <input
              type="text"
              readOnly
              name="driver"
              value={formData.driver || ""}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 bg-gray-100"
              placeholder="Nama Driver / Crew"
            />
          </div>

          {/* No Polisi */}
          <div>
            <label className="block mb-1 font-semibold">No Polisi</label>
            <input
              type="text"
              readOnly
              name="no_polisi"
              value={formData.no_polisi || ""}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 bg-gray-100"
            />
          </div>

          {/* Kode Unit */}
          <div>
            <label className="block mb-1 font-semibold">Kode Unit</label>
            <input
              type="text"
              readOnly
              name="kode_unit"
              value={formData.kode_unit || ""}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 bg-gray-100"
            />
          </div>

          {/* Kode Rute */}
          <div>
            <label className="block mb-1 font-semibold">Kode Rute</label>
            <input
              type="text"
              readOnly
              name="kode_rute"
              value={formData.kode_rute || ""}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 bg-gray-100"
            />
          </div>

          {/* Uang Input */}
          <div>
            <label className="block mb-1 font-semibold">BBM</label>
            <input
              type="text"
              name="bbm"
              value={formatRupiah(formData.bbm)}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 text-left"
            />
          </div>

          <div>
            <label className="block mb-1 font-semibold">Uang Makan</label>
            <input
              type="text"
              name="uang_makan"
              value={formatRupiah(formData.uang_makan) || ""}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 text-left"
            />
          </div>

          <div>
            <label className="block mb-1 font-semibold">Parkir</label>
            <input
              type="text"
              name="parkir"
              value={formatRupiah(formData.parkir)}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 text-left"
            />
          </div>

          <div>
            <label className="block mb-1 font-semibold">Jumlah</label>
            <input
              type="text"
              name="jumlah"
              value={formatRupiah(formData.jumlah)}
              readOnly
              className="w-full border rounded px-3 py-2 bg-gray-100 text-center"
            />
          </div>

          {/* Kartu Etoll */}
          <div className="col-span-2">
            <label className="block mb-1 font-semibold">Kartu Etoll</label>
            <input
              type="text"
              name="kartu_etoll"
              value={formData.kartu_etoll || ""}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="col-span-2 mt-3 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Simpan
          </button>
        </form>
      </div>
    </div>
  )}

      {/* BUTTONS */}
      <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleTambah}
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
            placeholder="Cari Tanggal / No SJ / Driver / Nopol..."
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

      {/* TABLE */}
      <div className="overflow-x-auto">
      <table className="min-w-full table-auto border border-gray-300 text-sm">
        <thead className="bg-gray-500 text-white">
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
            <th className="border border-gray-300 p-2 text-center w-[100px]">Tanggal</th>
            <th className="border border-gray-300 p-2 text-center w-[140px]">No Kas Keluar / USD</th>
            <th className="border border-gray-300 p-2 text-center w-[140px]">No Surat Jalan</th>
            <th className="border border-gray-300 p-2 text-center w-[120px]">Tgl Berangkat & Kembali</th>
            <th className="border border-gray-300 p-2 text-center w-[150px]">Driver</th>
            <th className="border border-gray-300 p-2 text-center w-[150px]">Crew</th>
            <th className="border border-gray-300 p-2 text-center w-[100px]">No Polisi</th>
            <th className="border border-gray-300 p-2 text-center w-[90px]">Kode Unit</th>
            <th className="border border-gray-300 p-2 text-center w-[90px]">Kode Rute</th>
            <th className="border border-gray-300 p-2 text-center w-[100px]">BBM</th>
            <th className="border border-gray-300 p-2 text-center w-[100px]">Uang Makan</th>
            <th className="border border-gray-300 p-2 text-center w-[90px]">Parkir</th>
            <th className="border border-gray-300 p-2 text-center w-[110px]">Jumlah</th>
            <th className="border border-gray-300 p-2 text-center w-[130px]">Kartu Etoll</th>
            <th className="border border-gray-300 p-2 text-center w-[80px]">Aksi</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={16} className="text-center p-3">Memuat data...</td>
            </tr>
          ) : paginatedData.length === 0 ? (
            <tr>
              <td colSpan={16} className="text-center p-3 text-gray-500">Data kosong</td>
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
                  className="hover:bg-gray-100 transition-all duration-150"
                >
                  <td className="border border-gray-300 text-center">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={() => handleSelect(item.id)}
                    />
                  </td>
                  <td className="border border-gray-300 text-center">
                    {formatTanggal(item.tanggal)}
                  </td>
                   <td className="border border-gray-300 text-center">
                    {item.no_uang_saku}
                  </td>
                  <td className="border border-gray-300 text-center">
                    {item.no_surat_jalan}
                  </td>

                  {/* ✅ Gabungan tanggal berangkat & kembali */}
                  <td className="border border-gray-300 text-center">
                    {item.tanggal_berangkat && item.tanggal_kembali
                      ? `${formatTanggal(item.tanggal_berangkat)} s/d ${formatTanggal(item.tanggal_kembali)}`
                      : formatTanggal(item.tanggal_berangkat || item.tanggal_kembali)}
                  </td>

                  <td className="border border-gray-300 text-left px-2">
                    {item.driver}
                  </td>
                  <td className="border border-gray-300 text-left px-2">
                    {item.crew}
                  </td>
                  <td className="border border-gray-300 text-center">
                    {item.no_polisi}
                  </td>
                  <td className="border border-gray-300 text-center">
                    {item.kode_unit}
                  </td>
                  <td className="border border-gray-300 text-center">
                    {item.kode_rute}
                  </td>
                  <td className="border border-gray-300 text-right pr-2">
                    {formatRupiah(item.bbm)}
                  </td>
                  <td className="border border-gray-300 text-right pr-2">
                    {formatRupiah(item.uang_makan)}
                  </td>
                  <td className="border border-gray-300 text-right pr-2">
                    {formatRupiah(item.parkir)}
                  </td>
                  <td className="border border-gray-300 text-right font-semibold pr-2">
                    {formatRupiah(item.jumlah)}
                  </td>
                  <td className="border border-gray-300 text-center">
                    {item.kartu_etoll}
                  </td>
                  <td className="border border-gray-300 text-center">
                    <button
                      onClick={() => handleEdit(item)}
                      className="text-blue-600 hover:text-blue-800 mr-2"
                      title="Edit"
                    >
                      <FiEdit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Hapus"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </td>
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