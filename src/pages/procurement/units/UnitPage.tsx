import { useEffect, useMemo, useState } from "react";
import { useUnits } from "./hooks/useUnits";
import type { Unit, UnitFormData } from "./types";

const initialForm: UnitFormData = {
  code: "",
  name: "",
  is_active: true,
};

export function UnitPage() {
  const { units, loading, saving, error, createUnit, updateUnit, deleteUnit } =
    useUnits();

  const [formData, setFormData] = useState<UnitFormData>(initialForm);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!editingUnit) {
      setFormData(initialForm);
      return;
    }

    setFormData({
      code: editingUnit.code,
      name: editingUnit.name,
      is_active: editingUnit.is_active,
    });
  }, [editingUnit]);

  const filteredUnits = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return units;

    return units.filter((unit) => {
      return (
        unit.code.toLowerCase().includes(keyword) ||
        unit.name.toLowerCase().includes(keyword)
      );
    });
  }, [units, search]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.code.trim() || !formData.name.trim()) {
      window.alert("Kode dan nama satuan wajib diisi.");
      return;
    }

    const success = editingUnit
      ? await updateUnit(editingUnit.id, formData)
      : await createUnit(formData);

    if (success) {
      setEditingUnit(null);
      setFormData(initialForm);
    }
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (unit: Unit) => {
    const confirmed = window.confirm(
      `Hapus satuan ${unit.code} - ${unit.name}?`,
    );

    if (!confirmed) return;

    await deleteUnit(unit.id);
  };

  return (
    <div className="w-full pr-2 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Master Satuan</h1>
          <p className="mt-1 text-sm text-gray-500">
            Kelola satuan yang digunakan oleh artikel barang dan transaksi
            procurement.
          </p>
        </div>

        <div className="w-full md:w-80">
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari kode atau nama satuan..."
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {editingUnit ? "Edit Satuan" : "Tambah Satuan"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Gunakan kode singkat dan konsisten, misalnya PCS atau KARTON.
            </p>
          </div>

          {editingUnit && (
            <button
              type="button"
              onClick={() => setEditingUnit(null)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Batal Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Kode Satuan
            </label>
            <input
              value={formData.code}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  code: event.target.value,
                }))
              }
              placeholder="Contoh: BOTOL"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nama Satuan
            </label>
            <input
              value={formData.name}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
              placeholder="Contoh: Botol"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    is_active: event.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
              Satuan aktif
            </label>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Menyimpan..."
              : editingUnit
                ? "Simpan Perubahan"
                : "Simpan Satuan"}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Daftar Satuan</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">Nama Satuan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Memuat satuan...
                  </td>
                </tr>
              ) : filteredUnits.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Belum ada satuan.
                  </td>
                </tr>
              ) : (
                filteredUnits.map((unit) => (
                  <tr key={unit.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {unit.code}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{unit.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          unit.is_active
                            ? "rounded-full bg-green-100 px-2 py-1 text-xs text-green-700"
                            : "rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
                        }
                      >
                        {unit.is_active ? "Aktif" : "Tidak Aktif"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleEdit(unit)}
                        className="mr-3 text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(unit)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default UnitPage;
