import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { FiEdit, FiTrash2, FiPlus, FiX, FiDownload } from "react-icons/fi";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface RuteData {
  id: number;
  status: string;
  nama_rute: string;
  jam_berangkat: string;
  kode_rute: string;
}

export default function Rute() {
  const [data, setData] = useState<RuteData[]>([]);
  const [filtered, setFiltered] = useState<RuteData[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("SEMUA");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const emptyRute: RuteData = {
    id: 0,
    status: "AKTIF",
    nama_rute: "",
    jam_berangkat: "",
    kode_rute: "",
  };

  const [formData, setFormData] = useState({
    nama_rute: "",
    jam_berangkat: "",
    status: "AKTIF",
    kode_rute: "",
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rute")
      .select("*")
      .order("id", { ascending: false }); // INI TIDAK DIHAPUS (biarkan sesuai permintaan)

    if (error) console.error("Gagal ambil data:", error.message);
    else {
      const sorted = sortRute(data as RuteData[]);  // ⬅️ Urutkan setelah fetch
      setData(sorted);
      setFiltered(sorted);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Tambahkan ini di bawah fetchData
  const sortRute = (list: RuteData[]) => {
    return [...list].sort((a, b) => {
      // Pisah nama rute dan jam berangkat
      const [namaA] = a.kode_rute.split(" - ");
      const [namaB] = b.kode_rute.split(" - ");

      const jamA = a.jam_berangkat;
      const jamB = b.jam_berangkat;

      // 1. Urut nama rute (abjad)
      const cmpNama = namaA.localeCompare(namaB, "id");
      if (cmpNama !== 0) return cmpNama;

      // 2. Jika nama sama → urutkan jam terkecil
      return jamA.localeCompare(jamB);
    });
  };

  // Tutup popup saat tekan ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowForm(false);
        setEditId(null);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);


  // Filtering
  useEffect(() => {
    let filteredData = [...data];

    if (statusFilter !== "SEMUA") {
      filteredData = filteredData.filter((d) => d.status === statusFilter);
    }

    if (search.trim() !== "") {
      filteredData = filteredData.filter((d) =>
        d.kode_rute.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFiltered(filteredData);
    setCurrentPage(1);
  }, [statusFilter, search, data]);

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage);

  const handleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Centang / hapus centang semua di halaman aktif
  const handleSelectAll = () => {
    const allIds = paginatedData.map((item) => item.id);
    const isAllSelected = allIds.every((id) => selected.includes(id));

    if (isAllSelected) {
      // Kosongkan semua dari halaman aktif
      setSelected((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      // Tambahkan semua dari halaman aktif
      setSelected((prev) => Array.from(new Set([...prev, ...allIds])));
    }
  };

    const handleDeleteSelected = async () => {
      if (selected.length === 0) return alert("Pilih data terlebih dahulu!");
      if (!confirm("Yakin ingin hapus data terpilih?")) return;
      const { error } = await supabase.from("rute").delete().in("id", selected);
      if (error) alert("Gagal hapus: " + error.message);
      else {
        setSelected([]);
        fetchData();
      }
    };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filtered.map((d) => ({
        "Kode Rute": d.kode_rute,
        "Nama Rute": d.nama_rute,
        "Jam Berangkat": d.jam_berangkat,
        Status: d.status,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Rute");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "DataRute.xlsx");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let updatedForm = { ...formData, [name]: value };

    // Generate kode otomatis "Nama Rute - Jam"
    if (name === "nama_rute" || name === "jam_berangkat") {
      const nama = name === "nama_rute" ? value : updatedForm.nama_rute;
      const jam = name === "jam_berangkat" ? value : updatedForm.jam_berangkat;
      if (nama && jam) {
        updatedForm.kode_rute = `${nama} - ${jam}`;
      }
    }

    setFormData(updatedForm);
  };

  const handleToggleStatus = () => {
    setFormData({
      ...formData,
      status: formData.status === "AKTIF" ? "NON-AKTIF" : "AKTIF",
    });
  };

  const handleAdd = () => {
    setFormData({ ...emptyRute });
    setEditId(null);
    setShowForm(true);
  };

  // Format jam dari "HH:MM:SS" → "HH:MM"
  const formatDisplayTime = (time: string) => {
    return time ? time.slice(0, 5) : "";
  };

  const handleEdit = (item: RuteData) => {
    setFormData({
      nama_rute: item.nama_rute,
      jam_berangkat: formatDisplayTime(item.jam_berangkat),
      status: item.status,
      kode_rute: item.kode_rute,
    });
    setEditId(item.id); // 🟢 penting untuk update
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin hapus data ini?")) return;
    const { error } = await supabase.from("rute").delete().eq("id", id);
    if (error) alert("Gagal hapus: " + error.message);
    else fetchData();
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  const { nama_rute, jam_berangkat, status } = formData;

  // Validasi wajib
  if (!nama_rute) {
    alert("❗Nama Rute wajib diisi");
    return;
  }
  if (!jam_berangkat) {
    alert("❗Jam Berangkat wajib diisi");
    return;
  }

  // 🔹 Format jam agar selalu HH:MM:SS untuk Supabase
  const jam_simpan =
    jam_berangkat.includes(":") && jam_berangkat.length === 5
      ? `${jam_berangkat}:00`
      : jam_berangkat;

  // 🔹 Generate kode otomatis
  const kode_rute = `${nama_rute.replace(/\s+/g, " ").trim()} - ${jam_berangkat.trim()}`;

  // 🔹 Cek duplikasi berdasarkan kode_rute
  const { data: existing, error: checkError } = await supabase
    .from("rute")
    .select("id, kode_rute")
    .eq("kode_rute", kode_rute);

  if (checkError) {
    console.error("❌ Gagal cek duplikasi:", checkError);
    alert("Terjadi kesalahan saat memeriksa kode rute.");
    return;
  }

  if (existing && existing.length > 0) {
    const duplicate = existing.find((item) => item.id !== editId);
    if (duplicate) {
      alert("⚠️ Kode Rute sudah digunakan!");
      return;
    }
  }

  // 🔹 Simpan data
  if (editId) {
    // === UPDATE ===
    const { error } = await supabase
      .from("rute")
      .update({
        nama_rute,
        jam_berangkat: jam_simpan,
        kode_rute,
        status,
      })
      .eq("id", editId);

    if (error) {
      console.error("❌ Gagal update:", error);
      alert("Gagal memperbarui data. Silakan coba lagi.");
      return;
    }

    alert("✅ Data rute berhasil diperbarui!");
  } else {
    // === INSERT ===
    const { error } = await supabase.from("rute").insert([
      {
        nama_rute,
        jam_berangkat: jam_simpan,
        kode_rute,
        status: status || "AKTIF",
      },
    ]);

    if (error) {
      console.error("❌ Gagal menyimpan:", error);
      alert("Gagal menyimpan data. Silakan coba lagi.");
      return;
    }

    alert("✅ Rute baru berhasil disimpan!");
  }

  // 🔹 Reset form, tutup popup, refresh tabel
  setFormData({
    nama_rute: "",
    jam_berangkat: "",
    status: "AKTIF",
    kode_rute: "",
  });
  setEditId(null);
  setShowForm(false); // otomatis tutup popup
  fetchData();
};


  return (
    <div className="p-4 bg-white rounded shadow">
      {/* Pop-up Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-lg shadow-2xl p-6 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
              onClick={() => setShowForm(false)}
            >
              <FiX size={20} />
            </button>
            <h2 className="text-2xl font-semibold mb-6 text-center">
              {editId === 0 ? "Tambah Rute" : "Edit Rute"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Status */}
              <button
                type="button"
                onClick={handleToggleStatus}
                className={`w-full py-2 rounded font-semibold ${
                  formData.status === "AKTIF"
                    ? "bg-green-500 text-white"
                    : "bg-red-500 text-white"
                }`}
              >
                {formData.status}
              </button>

              {/* Nama Rute */}
              <div>
                <label className="block text-sm font-semibold mb-1">Nama Rute</label>
                <input
                  type="text"
                  name="nama_rute"
                  value={formData.nama_rute || ""}
                  onChange={(e) => setFormData({ ...formData, nama_rute: e.target.value })}
                  className="border border-gray-300 rounded px-3 py-2 w-full"
                />
              </div>

              {/* Jam Berangkat */}
              <div>
                <label className="block text-sm font-semibold mb-1">Jam Berangkat</label>
                <input
                  type="time"
                  name="jam_berangkat"
                  value={formData.jam_berangkat || ""}
                  onChange={handleChange}
                  className="border border-gray-300 rounded px-3 py-2 w-full cursor-pointer"
                />
              </div>

              {/* Kode Rute */}
              <div>
                <label className="block text-sm font-semibold mb-1">Kode Rute</label>
                <input
                  type="text"
                  name="kode_rute"
                  value={formData.kode_rute || ""}
                  readOnly
                  className="border border-gray-300 bg-gray-100 rounded px-3 py-2 w-full text-gray-600"
                />
              </div>

              {/* Tombol Simpan */}
              <button
                type="submit"
                disabled={checking}
                className={`w-full py-2 rounded text-white ${
                  checking
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {checking ? "Memeriksa..." : "Simpan"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tombol & Filter */}
      <div className="w-full pr-8 flex flex-wrap justify-between items-center mb-4 gap-3">
        {/* Kiri */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleAdd}
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

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="SEMUA">Semua Status</option>
            <option value="AKTIF">AKTIF</option>
            <option value="NON-AKTIF">NON-AKTIF</option>
          </select>
        </div>

        {/* Kanan (Pencarian) */}
        <div className="relative w-[220px]">
          <input
            type="text"
            placeholder="Cari Kode Rute..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-2 w-full pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              title="Hapus pencarian"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabel */}
      <div className="w-full pr-8">
        <table className="w-full table-auto border border-gray-300 text-sm">
          <thead>
            <tr className="bg-gray-400 text-white">
              <th className="border p-2 text-center">
                <input
                  type="checkbox"
                  checked={
                    paginatedData.length > 0 &&
                    paginatedData.every((item) => selected.includes(item.id))
                  }
                  onChange={handleSelectAll}
                />
              </th>
              <th className="border p-2 text-center">Status</th>
              <th className="border p-2 text-center">Kode Rute</th>
              <th className="border p-2 text-center w-[60px]">Aksi</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center p-3">
                  Memuat data...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center p-3 text-gray-500">
                  Data kosong
                </td>
              </tr>
            ) : (
              paginatedData.map((item) => (
                <tr
                  key={item.id}
                  className={`transition-all ${
                    item.status === "NON-AKTIF"
                      ? "bg-red-500 text-white"
                      : "hover:bg-yellow-300 transition-all duration-150"
                  }`}
                >
                  <td className="border text-center">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={() => handleSelect(item.id)}
                    />
                  </td>
                  <td className="border text-center">{item.status}</td>
                  <td className="border text-center">{item.kode_rute}</td>
                  <td className="border text-center">
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center items-center mt-4 gap-2 text-sm">
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
