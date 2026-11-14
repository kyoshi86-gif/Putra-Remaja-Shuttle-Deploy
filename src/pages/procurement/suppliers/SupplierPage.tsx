import { useEffect, useMemo, useState } from "react";
import { useSuppliers } from "./hooks/useSuppliers";
import type { Supplier, SupplierFormData } from "./types";
import { getCustomUser } from "@/lib/authUser";

const initialForm: SupplierFormData = {
  entity_id: getCustomUser()?.entity_id ?? null,
  code: "",
  name: "",

  contact_person: "",
  phone: "",
  email: "",
  address: "",

  default_payment_term_days: 0,
  is_active: true,
};

export function SupplierPage() {
  const {
    suppliers,
    loading,
    saving,
    error,
    createSupplier,
    updateSupplier,
    deleteSupplier,
  } = useSuppliers();

  const [formData, setFormData] = useState<SupplierFormData>(initialForm);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!editingSupplier) {
      setFormData({
        ...initialForm,
      });
      return;
    }

    setFormData({
      entity_id: editingSupplier.entity_id,
      code: editingSupplier.code,
      name: editingSupplier.name,

      contact_person: editingSupplier.contact_person ?? "",
      phone: editingSupplier.phone ?? "",
      email: editingSupplier.email ?? "",
      address: editingSupplier.address ?? "",

      default_payment_term_days: editingSupplier.default_payment_term_days ?? 0,

      is_active: editingSupplier.is_active,
    });
  }, [editingSupplier]);

  const filteredSuppliers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return suppliers;

    return suppliers.filter((supplier) => {
      return (
        supplier.code.toLowerCase().includes(keyword) ||
        supplier.name.toLowerCase().includes(keyword) ||
        (supplier.contact_person ?? "").toLowerCase().includes(keyword) ||
        (supplier.phone ?? "").toLowerCase().includes(keyword) ||
        (supplier.email ?? "").toLowerCase().includes(keyword)
      );
    });
  }, [suppliers, search]);

  const updateField = (
    field: keyof SupplierFormData,
    value: string | boolean | number,
  ) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.code.trim() || !formData.name.trim()) {
      window.alert("Kode dan nama supplier wajib diisi.");
      return;
    }

    if (Number(formData.default_payment_term_days) < 0) {
      window.alert("Termin pembayaran tidak boleh bernilai negatif.");
      return;
    }

    const success = editingSupplier
      ? await updateSupplier(editingSupplier.id, formData)
      : await createSupplier(formData);

    if (success) {
      setEditingSupplier(null);
      setFormData({
        ...initialForm,
      });
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (supplier: Supplier) => {
    const confirmed = window.confirm(
      `Hapus supplier ${supplier.code} - ${supplier.name}?`,
    );

    if (!confirmed) return;

    await deleteSupplier(supplier.id);
  };

  return (
    <div className="w-full pr-2 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Master Supplier
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Kelola pemasok untuk Purchase Order, Receiving, Deposit Purchase,
            dan Hutang Usaha.
          </p>
        </div>

        <div className="w-full md:w-80">
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari kode, supplier, kontak..."
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
              {editingSupplier ? "Edit Supplier" : "Tambah Supplier"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Termin default akan otomatis muncul saat membuat Purchase Order.
            </p>
          </div>

          {editingSupplier && (
            <button
              type="button"
              onClick={() => setEditingSupplier(null)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Batal Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Kode Supplier
            </label>
            <input
              value={formData.code}
              onChange={(event) => updateField("code", event.target.value)}
              placeholder="Contoh: SUP-001"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nama Supplier
            </label>
            <input
              value={formData.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Contoh: PT Supplier Bahan Baku"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nama Kontak
            </label>
            <input
              value={formData.contact_person}
              onChange={(event) =>
                updateField("contact_person", event.target.value)
              }
              placeholder="Contoh: Budi"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nomor Telepon
            </label>
            <input
              value={formData.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              placeholder="Contoh: 081234567890"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="Contoh: purchasing@supplier.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Termin Pembayaran Default (hari)
            </label>
            <input
              type="number"
              min="0"
              value={formData.default_payment_term_days}
              onChange={(event) =>
                updateField(
                  "default_payment_term_days",
                  Number(event.target.value || 0),
                )
              }
              placeholder="0"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Isi 0 untuk pembayaran langsung atau tanpa tempo.
            </p>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Alamat
            </label>
            <textarea
              value={formData.address}
              onChange={(event) => updateField("address", event.target.value)}
              rows={2}
              placeholder="Alamat supplier"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(event) =>
                  updateField("is_active", event.target.checked)
                }
                className="h-4 w-4"
              />
              Supplier aktif
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
              : editingSupplier
                ? "Simpan Perubahan"
                : "Simpan Supplier"}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Daftar Supplier</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">Nama Supplier</th>
                <th className="px-4 py-3 font-medium">Kontak</th>
                <th className="px-4 py-3 font-medium">Termin</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Memuat supplier...
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Belum ada supplier.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {supplier.code}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{supplier.name}</div>
                      {supplier.address && (
                        <div className="mt-1 text-xs text-gray-500">
                          {supplier.address}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{supplier.contact_person || "-"}</div>
                      {supplier.phone && (
                        <div className="text-xs text-gray-500">
                          {supplier.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {supplier.default_payment_term_days} hari
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          supplier.is_active
                            ? "rounded-full bg-green-100 px-2 py-1 text-xs text-green-700"
                            : "rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
                        }
                      >
                        {supplier.is_active ? "Aktif" : "Tidak Aktif"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleEdit(supplier)}
                        className="mr-3 text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(supplier)}
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

export default SupplierPage;
