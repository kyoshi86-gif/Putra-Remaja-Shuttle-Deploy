import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getEntityContext, type EntityContext } from "../lib/entityContext";
import { FiPlus, FiTrash2, FiEdit } from "react-icons/fi";

interface JenisPotongan {
  id: string;
  nama: string;
  kategori: string;
  entity_id: string;
}

export default function JenisPotonganPage() {
  const [entityCtx, setEntityCtx] = useState<EntityContext | null>(null);
  const [data, setData] = useState<JenisPotongan[]>([]);
  const [form, setForm] = useState({
    id: "",
    nama: "",
    kategori: "lain",
  });

  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadEntity();
  }, []);

  useEffect(() => {
    if (entityCtx) fetchData();
  }, [entityCtx]);

  async function loadEntity() {
    const storedUser = localStorage.getItem("custom_user");
    if (!storedUser) return;

    const parsed = JSON.parse(storedUser);
    const ctx = await getEntityContext(parsed.entity_id);
    setEntityCtx(ctx);
  }

  async function fetchData() {
    const { data, error } = await supabase
      .from("jenis_potongan")
      .select("*")
      .eq("entity_id", entityCtx?.entity_id)
      .order("nama");

    if (error) {
      console.error(error);
      return;
    }

    setData(data || []);
  }

  function resetForm() {
    setForm({
      id: "",
      nama: "",
      kategori: "lain",
    });
  }

  async function handleSubmit() {
    if (!form.nama) {
      alert("Nama wajib diisi");
      return;
    }

    if (form.id) {
      // EDIT
      const { error } = await supabase
        .from("jenis_potongan")
        .update({
          nama: form.nama,
          kategori: form.kategori,
        })
        .eq("id", form.id);

      if (error) return alert(error.message);
    } else {
      // INSERT
      const { error } = await supabase.from("jenis_potongan").insert({
        nama: form.nama,
        kategori: form.kategori,
        entity_id: entityCtx?.entity_id,
      });

      if (error) return alert(error.message);
    }

    resetForm();
    setShowForm(false);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus data ini?")) return;

    const { error } = await supabase
      .from("jenis_potongan")
      .delete()
      .eq("id", id);

    if (error) alert(error.message);
    fetchData();
  }

  return (
    <div className="p-4 bg-white rounded shadow max-w-[1600px] mx-auto">

      <button
        onClick={() => {
          resetForm();
          setShowForm(true);
        }}
        className="bg-blue-600 text-white px-3 py-2 rounded mb-4 flex items-center gap-2"
      >
        <FiPlus /> Tambah
      </button>

      {/* TABLE */}
      <div className="w-full pr-8">
        <table className="w-full table-auto border border-gray-300 text-sm">
          <thead className="bg-gray-400 text-white">
            <tr>
              <th className="border p-2">Nama</th>
              <th className="border p-2">Kategori</th>
              <th className="border p-2">Aksi</th>
            </tr>
          </thead>

          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <td className="border p-2">{row.nama}</td>
                <td className="border p-2">{row.kategori}</td>
                <td className="border p-2 flex justify-center">
                  <div className="flex gap-[0.5px]">
                    <button
                      onClick={() => {
                        setForm(row);
                        setShowForm(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 px-[5px]"
                      title="Edit"
                    >
                      <FiEdit size={16} />
                    </button>

                    <button
                      onClick={() => handleDelete(row.id)}
                      className="text-red-600 hover:text-red-800 px-[5px]"
                      title="Hapus"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {data.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-3 text-gray-400">
                  Belum ada data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-96">
            <h2 className="font-semibold mb-4">Form Jenis Potongan</h2>

            <input
              placeholder="Nama"
              value={form.nama}
              onChange={(e) =>
                setForm({ ...form, nama: e.target.value })
              }
              className="border w-full px-3 py-2 mb-2"
            />

            <select
              value={form.kategori}
              onChange={(e) =>
                setForm({ ...form, kategori: e.target.value })
              }
              className="border w-full px-3 py-2 mb-4"
            >
              <option value="jaminan">Jaminan</option>
              <option value="kasbon">Kasbon</option>
              <option value="lain">Lain</option>
            </select>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-3 py-1 bg-gray-300 rounded"
              >
                Batal
              </button>

              <button
                onClick={handleSubmit}
                className="px-3 py-1 bg-blue-600 text-white rounded"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}