import { useState, useEffect, useRef } from "react"; // ✅ tambahkan useRef di sini
import { supabase } from "../lib/supabaseClient";
import { FiEdit, FiTrash2, FiPlus, FiX, FiDownload } from "react-icons/fi";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface DriverData {
  id: number;
  status: string;
  nama: string;
  alamat: string;
  ktp: string;
  tgl_lahir: string;
  no_hp: string;
  sim_golongan: string;
  sim_expired: string;
  mulai_kerja: string;
  keluar_kerja: string;
}

export default function Driver() {
  const [data, setData] = useState<DriverData[]>([]);
  const [filtered, setFiltered] = useState<DriverData[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("SEMUA");
  const [simFilter, setSimFilter] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const emptyDriver: DriverData = {
    id: 0,
    status: "AKTIF",
    nama: "",
    alamat: "",
    ktp: "",
    tgl_lahir: "",
    no_hp: "",
    sim_golongan: "",
    sim_expired: "",
    mulai_kerja: "",
    keluar_kerja: "",
  };

  const [formData, setFormData] = useState<DriverData>({ ...emptyDriver });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("driver")
      .select("*")
      .order("id", { ascending: false });
    if (error) console.error("Gagal ambil data:", error.message);
    else {
      setData(data as DriverData[]);
      setFiltered(data as DriverData[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtering
  useEffect(() => {
    let filteredData = [...data];

    if (statusFilter !== "SEMUA") {
      filteredData = filteredData.filter((d) => d.status === statusFilter);
    }

    if (simFilter) {
      const now = new Date();
      const twoMonths = new Date();
      twoMonths.setMonth(now.getMonth() + 2);
      filteredData = filteredData.filter(
        (d) => d.sim_expired && new Date(d.sim_expired) <= twoMonths
      );
    }

    if (search.trim() !== "") {
      filteredData = filteredData.filter((d) =>
        d.nama.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFiltered(filteredData);
    setCurrentPage(1);
  }, [statusFilter, simFilter, search, data]);

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage);

  // --- Reset checkbox saat pindah halaman ---
  useEffect(() => {
    setSelected([]);
  }, [currentPage]);

  // --- Checkbox di HEADER ---
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const handleSelectAll = () => {
    if (selected.length === paginatedData.length) setSelected([]);
    else setSelected(paginatedData.map((item) => item.id));
  };

  const handleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // --- Delete Selected ---
  const handleDeleteSelected = async () => {
    if (selected.length === 0) return alert("Pilih data terlebih dahulu!");
    if (!confirm("Yakin ingin hapus data terpilih?")) return;
    const { error } = await supabase.from("driver").delete().in("id", selected);
    if (error) alert("Gagal hapus: " + error.message);
    else {
      setSelected([]);
      fetchData();
    }
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filtered.map((d) => ({
        Nama: d.nama,
        Status: d.status,
        Alamat: d.alamat,
        KTP: d.ktp,
        "Tanggal Lahir": d.tgl_lahir,
        "No HP": d.no_hp,
        "SIM Golongan": d.sim_golongan,
        "SIM Expired": d.sim_expired,
        "Mulai Kerja": d.mulai_kerja,
        "Keluar Kerja": d.keluar_kerja,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Driver");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "DataDriver.xlsx");
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleToggleStatus = () => {
    setFormData({
      ...formData,
      status: formData.status === "AKTIF" ? "NON-AKTIF" : "AKTIF",
    });
  };

  const handleAdd = () => {
    setFormData({ ...emptyDriver });
    setShowForm(true);
  };

  const handleEdit = (item: DriverData) => {
    setFormData({ ...item });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin hapus data ini?")) return;
    const { error } = await supabase.from("driver").delete().eq("id", id);
    if (error) alert("Gagal hapus: " + error.message);
    else fetchData();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = formData;

    if (!d.nama?.trim() || !d.ktp?.trim()) {
      alert("Nama dan KTP wajib diisi!");
      return;
    }

    const { id, ...dataToSend } = d;

    const safeData = {
      ...dataToSend,
      tgl_lahir: dataToSend.tgl_lahir || null,
      sim_expired: dataToSend.sim_expired || null,
      mulai_kerja: dataToSend.mulai_kerja || null,
      keluar_kerja: dataToSend.keluar_kerja || null,
    };

    if (!id || id === 0) {
      const { error } = await supabase.from("driver").insert([safeData]);
      if (error) {
        console.error("❌ Gagal tambah:", error);
        alert(`Gagal tambah: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase
        .from("driver")
        .update(safeData)
        .eq("id", id);
      if (error) {
        console.error("❌ Gagal update:", error);
        alert(`Gagal update: ${error.message}`);
        return;
      }
    }

    setShowForm(false);
    fetchData();
  };

  const handleCancel = () => {
    setFormData({ ...emptyDriver });
    setShowForm(false);
  };

  //-- HANDLE ESC --
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel(); // ⬅️ panggil fungsi batal
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <div className="p-4 bg-white rounded shadow">
      {/* Form Pop-up */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-lg shadow-2xl p-6 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
              onClick={() => setShowForm(false)}
            >
              <FiX size={20} />
            </button>
            <h2 className="text-2xl font-semibold mb-6 text-center">
              {formData.id === 0 ? "Tambah Driver" : "Edit Driver"}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              {/* Status */}
              <button
                type="button"
                onClick={handleToggleStatus}
                className={`col-span-2 py-2 rounded font-semibold ${
                  formData.status === "AKTIF"
                    ? "bg-green-500 text-white"
                    : "bg-red-500 text-white"
                }`}
              >
                {formData.status}
              </button>

              {/* Nama */}
              <div>
                <label className="block text-sm font-semibold mb-1">Nama</label>
                <input
                  type="text"
                  name="nama"
                  value={formData.nama || ""}
                  onChange={handleChange}
                  className="border border-gray-300 rounded px-3 py-2 w-full"
                />
              </div>

              {/* KTP */}
              <div>
                <label className="block text-sm font-semibold mb-1">No. KTP</label>
                <input
                  type="text"
                  name="ktp"
                  value={formData.ktp || ""}
                  onChange={handleChange}
                  className="border border-gray-300 rounded px-3 py-2 w-full"
                />
              </div>

              {/* Alamat */}
              <div className="col-span-2">
                <label className="block text-sm font-semibold mb-1">Alamat</label>
                <input
                  type="text"
                  name="alamat"
                  value={formData.alamat || ""}
                  onChange={handleChange}
                  className="border border-gray-300 rounded px-3 py-2 w-full"
                />
              </div>

              {/* Tanggal Lahir */}
              <div>
                <label className="block text-sm font-semibold mb-1">Tanggal Lahir</label>
                <input
                  type="date"
                  name="tgl_lahir"
                  value={formData.tgl_lahir || ""}
                  onChange={handleChange}
                  onFocus={(e) => e.target.showPicker?.()}
                  className="border border-gray-300 rounded px-3 py-2 w-full cursor-pointer"
                />
              </div>

              {/* No HP */}
              <div>
                <label className="block text-sm font-semibold mb-1">No. HP</label>
                <input
                  type="text"
                  name="no_hp"
                  value={formData.no_hp || ""}
                  onChange={handleChange}
                  className="border border-gray-300 rounded px-3 py-2 w-full"
                />
              </div>

              {/* SIM Golongan */}
              <div>
                <label className="block text-sm font-semibold mb-1">SIM Golongan</label>
                <select
                  name="sim_golongan"
                  value={formData.sim_golongan || ""}
                  onChange={handleChange}
                  className="border border-gray-300 rounded px-3 py-2 w-full bg-white"
                >
                  <option value="">Pilih Golongan</option>
                  <option value="A Umum">A Umum</option>
                  <option value="B1">B1</option>
                  <option value="B1 Umum">B1 Umum</option>
                  <option value="B2 Umum">B2 Umum</option>
                </select>
              </div>

              {/* SIM Expired */}
              <div>
                <label className="block text-sm font-semibold mb-1">SIM Expired</label>
                <input
                  type="date"
                  name="sim_expired"
                  value={formData.sim_expired || ""}
                  onChange={handleChange}
                  onFocus={(e) => e.target.showPicker?.()}
                  className="border border-gray-300 rounded px-3 py-2 w-full cursor-pointer"
                />
              </div>

              {/* Mulai Kerja */}
              <div>
                <label className="block text-sm font-semibold mb-1">Mulai Kerja</label>
                <input
                  type="date"
                  name="mulai_kerja"
                  value={formData.mulai_kerja || ""}
                  onChange={handleChange}
                  onFocus={(e) => e.target.showPicker?.()}
                  className="border border-gray-300 rounded px-3 py-2 w-full cursor-pointer"
                />
              </div>

              {/* Keluar Kerja */}
              <div>
                <label className="block text-sm font-semibold mb-1">Keluar Kerja</label>
                <input
                  type="date"
                  name="keluar_kerja"
                  value={formData.keluar_kerja || ""}
                  onChange={handleChange}
                  onFocus={(e) => e.target.showPicker?.()}
                  className="border border-gray-300 rounded px-3 py-2 w-full cursor-pointer"
                />
              </div>

              {/* Tombol Simpan */}
              <button
                type="submit"
                className="col-span-2 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                Simpan
              </button>

              <button
                type="button"
                onClick={handleCancel}
                className="col-span-2 bg-gray-400 text-white py-2 rounded hover:bg-gray-500"
              >
                Batal
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tombol Aksi, Filter, Search */}
      <div className="w-full pr-8 flex flex-wrap justify-between items-center mb-4 gap-3">
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
        >
          <FiPlus /> Tambah
        </button>

        <button
          onClick={handleDeleteSelected}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
        >
          <FiTrash2 /> Hapus
        </button>

        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
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

        <button
          onClick={() => setSimFilter(!simFilter)}
          className={`px-4 py-2 rounded border transition ${
            simFilter ? "bg-yellow-500 text-white" : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          SIM Expired ≤ 2 Bulan
        </button>

        <div className="relative flex-1 min-w-[220px]">
          <input
            type="text"
            placeholder="Cari Nama..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-2 w-full pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition"
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
              <th rowSpan={2} className="border p-2 text-center align-middle">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={
                    selected.length === paginatedData.length &&
                    paginatedData.length > 0
                  }
                  onChange={handleSelectAll}
                  className="cursor-pointer accent-blue-500"
                  title="Pilih Semua"
                />
              </th>
              <th rowSpan={2} className="border p-2 text-center align-middle">Status</th>
              <th rowSpan={2} className="border p-2 text-center align-middle">Nama</th>
              <th rowSpan={2} className="border p-2 text-center align-middle">Alamat</th>
              <th rowSpan={2} className="border p-2 text-center align-middle">KTP</th>
              <th rowSpan={2} className="border p-2 text-center align-middle">Tanggal Lahir</th>
              <th rowSpan={2} className="border p-2 text-center align-middle">No HP</th>
              <th colSpan={2} className="border p-2 text-center align-middle">SIM</th>
              <th colSpan={2} className="border p-2 text-center align-middle">Masa Kerja</th>
              <th rowSpan={2} className="border p-2 text-center align-middle">Aksi</th>
            </tr>
            <tr className="bg-gray-400 text-white">
              <th className="border p-1 text-center">Golongan</th>
              <th className="border p-1 text-center">Expired</th>
              <th className="border p-1 text-center">Mulai</th>
              <th className="border p-1 text-center">Keluar</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="text-center p-3">
                  Memuat data...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center p-3 text-gray-500">
                  Data kosong
                </td>
              </tr>
            ) : (
              paginatedData.map((item) => (
                <tr
                  key={item.id}
                  className={`transition-all duration-150 ${
                    item.status === "NON-AKTIF"
                      ? "bg-red-500 text-white hover:opacity-80"
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
                  <td className="border text-center">{item.nama}</td>
                  <td className="border text-center">{item.alamat}</td>
                  <td className="border text-center">{item.ktp}</td>
                  <td className="border text-center">{item.tgl_lahir}</td>
                  <td className="border text-center">{item.no_hp}</td>
                  <td className="border text-center">{item.sim_golongan}</td>
                  <td className="border text-center">{item.sim_expired}</td>
                  <td className="border text-center">{item.mulai_kerja}</td>
                  <td className="border text-center">{item.keluar_kerja}</td>
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
