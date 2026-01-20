import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { FiPlus, FiX } from "react-icons/fi";

interface EntityRow {
  id: string;
  kode: string;
  nama: string;
  tipe: "pusat" | "outlet";
  created_at: string;
}

interface EntityForm {
  kode: string;
  nama: string;
  tipe: "pusat" | "outlet";
}

export default function EntityPage() {
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);

  const [form, setForm] = useState<EntityForm>({
    kode: "",
    nama: "",
    tipe: "outlet",
  });

  // =========================
  // FETCH ENTITY
  // =========================
  const fetchEntities = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("entities")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      alert("Gagal ambil entity: " + error.message);
    } else {
      setEntities(data as EntityRow[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchEntities();
  }, []);

  // =========================
  // SAVE ENTITY
  // =========================
  const handleSave = async () => {
    if (!form.kode.trim() || !form.nama.trim()) {
      alert("Kode dan Nama wajib diisi");
      return;
    }

    const { error } = await supabase.from("entities").insert({
      kode: form.kode.toUpperCase(),
      nama: form.nama.trim(),
      tipe: form.tipe,
    });

    if (error) {
      alert("Gagal simpan entity: " + error.message);
      return;
    }

    setShowForm(false);
    setForm({ kode: "", nama: "", tipe: "outlet" });
    fetchEntities();
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      {/* HEADER */}
      <div className="pr-8 flex justify-between items-center mb-4">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1 rounded"
        >
          <FiPlus /> Tambah Entity
        </button>
      </div>

      {/* TABLE */}
      <div className="w-full pr-8">
        <table className="w-full table-auto border border-gray-300 text-sm">
            <thead className="bg-gray-200">
            <tr>
                <th className="border p-2">Kode</th>
                <th className="border p-2">Nama</th>
                <th className="border p-2">Tipe</th>
                <th className="border p-2">Created At</th>
            </tr>
            </thead>
            <tbody>
            {loading ? (
                <tr>
                <td colSpan={4} className="text-center p-3">
                    Memuat data...
                </td>
                </tr>
            ) : entities.length === 0 ? (
                <tr>
                <td colSpan={4} className="text-center p-3">
                    Belum ada entity
                </td>
                </tr>
            ) : (
                entities.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                    <td className="border p-2 text-center">{row.kode}</td>
                    <td className="border p-2">{row.nama}</td>
                    <td className="border p-2 text-center capitalize">
                    {row.tipe}
                    </td>
                    <td className="border p-2 text-center">
                    {new Date(row.created_at).toLocaleString("id-ID")}
                    </td>
                </tr>
                ))
            )}
            </tbody>
        </table>

      {/* MODAL FORM */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-start pt-24">
          <div className="bg-white w-full max-w-md rounded shadow-lg p-6 relative">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
            >
              <FiX size={20} />
            </button>

            <h2 className="text-lg font-semibold mb-4">
              Tambah Entity Baru
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold">Kode</label>
                <input
                  type="text"
                  value={form.kode}
                  onChange={(e) =>
                    setForm({ ...form, kode: e.target.value })
                  }
                  className="w-full border rounded px-3 py-2"
                  placeholder="SMG"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold">Nama</label>
                <input
                  type="text"
                  value={form.nama}
                  onChange={(e) =>
                    setForm({ ...form, nama: e.target.value })
                  }
                  className="w-full border rounded px-3 py-2"
                  placeholder="Outlet Semarang"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold">Tipe</label>
                <select
                  value={form.tipe}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tipe: e.target.value as "pusat" | "outlet",
                    })
                  }
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="outlet">Outlet</option>
                  <option value="pusat">Pusat</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
</div>
  );
}
