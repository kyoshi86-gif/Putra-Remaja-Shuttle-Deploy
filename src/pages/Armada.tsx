import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { FiEdit, FiTrash2, FiPlus, FiX, FiDownload } from "react-icons/fi";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface ArmadaData {
  id: number;
  kode: string;
  plat: string;
  tipe: string;
  layanan: string;
}

export default function Armada() {
  const [data, setData] = useState<ArmadaData[]>([]);
  const [filtered, setFiltered] = useState<ArmadaData[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    id: 0,
    kode: "",
    plat: "",
    tipe: "",
    layanan: "",
  });
  const [loading, setLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("armada")
      .select("*")
      .order("id", { ascending: false });
    if (error) console.error("Gagal ambil data:", error.message);
    else {
      setData(data as ArmadaData[]);
      setFiltered(data as ArmadaData[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter by search
  useEffect(() => {
    let filteredData = [...data];
    if (search.trim() !== "") {
      filteredData = filteredData.filter((d) =>
        d.kode.toLowerCase().includes(search.toLowerCase()) ||
        d.plat.toLowerCase().includes(search.toLowerCase()) ||
        d.tipe.toLowerCase().includes(search.toLowerCase()) ||
        d.layanan.toLowerCase().includes(search.toLowerCase())
      );
    }
    setFiltered(filteredData);
    setCurrentPage(1);
  }, [search, data]);

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage);

  const handleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selected.length === 0) return alert("Pilih data terlebih dahulu!");
    if (!confirm("Yakin ingin hapus data terpilih?")) return;
    const { error } = await supabase.from("armada").delete().in("id", selected);
    if (error) alert("Gagal hapus: " + error.message);
    else {
      setSelected([]);
      fetchData();
    }
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filtered.map((d) => ({
        Kode: d.kode,
        Plat: d.plat,
        Tipe: d.tipe,
        Layanan: d.layanan,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Armada");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "DataArmada.xlsx");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAdd = () => {
    setFormData({ id: 0, kode: "", plat: "", tipe: "", layanan: "" });
    setShowForm(true);
  };

  const handleEdit = (item: ArmadaData) => {
    setFormData(item);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin hapus data ini?")) return;
    const { error } = await supabase.from("armada").delete().eq("id", id);
    if (error) alert("Gagal hapus: " + error.message);
    else fetchData();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { id, kode, plat, tipe, layanan } = formData;
    if (!kode || !plat || !tipe || !layanan) {
      alert("Semua field wajib diisi!");
      return;
    }

    if (id === 0) {
      const { error } = await supabase.from("armada").insert([{ kode, plat, tipe, layanan }]);
      if (error) alert("Gagal tambah: " + error.message);
    } else {
      const { error } = await supabase
        .from("armada")
        .update({ kode, plat, tipe, layanan })
        .eq("id", id);
      if (error) alert("Gagal update: " + error.message);
    }

    setShowForm(false);
    fetchData();
  };

  return (
    <div className="p-6 bg-white rounded shadow">
      {/* Pop-up Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-lg shadow-2xl p-6 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
              onClick={() => setShowForm(false)}
            >
              <FiX size={20} />
            </button>
            <h2 className="text-2xl font-semibold mb-6 text-center">
              {formData.id === 0 ? "Tambah Armada" : "Edit Armada"}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <input
                type="text"
                name="kode"
                placeholder="Kode Kendaraan"
                value={formData.kode}
                onChange={handleChange}
                className="col-span-2 border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                name="plat"
                placeholder="Plat Nomor"
                value={formData.plat}
                onChange={handleChange}
                className="border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                name="tipe"
                placeholder="Tipe Kendaraan"
                value={formData.tipe}
                onChange={handleChange}
                className="border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="text"
                name="layanan"
                placeholder="Layanan"
                value={formData.layanan}
                onChange={handleChange}
                className="col-span-2 border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="submit"
                className="col-span-2 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
              >
                Simpan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tombol Aksi & Pencarian */}
      <div className="flex flex-wrap gap-3 mb-4 justify-between">
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
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Cari Kode / Plat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <button
            onClick={() => {
              setSearch("");
              setSelected([]);
            }}
            className="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700"
          >
            Hapus
          </button>
        </div>
      </div>

      {/* Tabel Armada */}
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border border-gray-300">
          <thead className="bg-gray-200 text-sm">
            <tr>
              <th className="border p-2 text-center">✔</th>
              <th className="border p-2 text-center">No</th>
              <th className="border p-2 text-center">Kode</th>
              <th className="border p-2 text-center">Plat</th>
              <th className="border p-2 text-center">Tipe</th>
              <th className="border p-2 text-center">Layanan</th>
              <th className="border p-2 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center p-3">
                  Memuat data...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-3 text-gray-500">
                  Data kosong
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="border text-center">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={() => handleSelect(item.id)}
                    />
                  </td>
                  <td className="border text-center">{startIndex + index + 1}</td>
                  <td className="border text-center">{item.kode}</td>
                  <td className="border text-center">{item.plat}</td>
                  <td className="border text-center">{item.tipe}</td>
                  <td className="border text-center">{item.layanan}</td>
                  <td className="border text-center flex justify-center gap-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <FiEdit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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
