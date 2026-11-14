import { useEffect, useMemo, useState } from "react";
import { useItemSubcategories } from "./hooks/useItemSubcategories";
import type {
  AccountOption,
  ItemSubcategory,
  ItemSubcategoryFormData,
} from "./types";

interface ItemSubcategoryPageProps {
  entityId?: string | null;
}

const initialForm: ItemSubcategoryFormData = {
  entity_id: null,

  category_id: "",
  code: "",
  name: "",
  description: "",

  inventory_account_id: "",
  expense_account_id: "",
  cogs_account_id: "",
  stock_adjustment_account_id: "",

  is_active: true,
};

function accountLabel(account?: AccountOption | null) {
  if (!account) return "Ikuti kategori";
  return `${account.code} - ${account.name}`;
}

export function ItemSubcategoryPage({
  entityId = null,
}: ItemSubcategoryPageProps) {
  const {
    subcategories,
    categories,
    accounts,
    loading,
    loadingMasters,
    saving,
    error,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
  } = useItemSubcategories(entityId);

  const [formData, setFormData] =
    useState<ItemSubcategoryFormData>(initialForm);

  const [editingSubcategory, setEditingSubcategory] =
    useState<ItemSubcategory | null>(null);

  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!editingSubcategory) {
      setFormData({
        ...initialForm,
        entity_id: entityId,
      });
      return;
    }

    setFormData({
      entity_id: editingSubcategory.entity_id,

      category_id: editingSubcategory.category_id,
      code: editingSubcategory.code,
      name: editingSubcategory.name,
      description: editingSubcategory.description ?? "",

      inventory_account_id: editingSubcategory.inventory_account_id ?? "",
      expense_account_id: editingSubcategory.expense_account_id ?? "",
      cogs_account_id: editingSubcategory.cogs_account_id ?? "",
      stock_adjustment_account_id:
        editingSubcategory.stock_adjustment_account_id ?? "",

      is_active: editingSubcategory.is_active,
    });
  }, [editingSubcategory, entityId]);

  const filteredSubcategories = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return subcategories;

    return subcategories.filter((subcategory) => {
      return (
        subcategory.code.toLowerCase().includes(keyword) ||
        subcategory.name.toLowerCase().includes(keyword) ||
        (subcategory.category?.code ?? "").toLowerCase().includes(keyword) ||
        (subcategory.category?.name ?? "").toLowerCase().includes(keyword)
      );
    });
  }, [subcategories, search]);

  const updateField = (
    field: keyof ItemSubcategoryFormData,
    value: string | boolean,
  ) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.category_id) {
      window.alert("Kategori barang wajib dipilih.");
      return;
    }

    if (!formData.code.trim() || !formData.name.trim()) {
      window.alert("Kode dan nama subkategori wajib diisi.");
      return;
    }

    const success = editingSubcategory
      ? await updateSubcategory(editingSubcategory.id, formData)
      : await createSubcategory(formData);

    if (success) {
      setEditingSubcategory(null);
      setFormData({
        ...initialForm,
        entity_id: entityId,
      });
    }
  };

  const handleEdit = (subcategory: ItemSubcategory) => {
    setEditingSubcategory(subcategory);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (subcategory: ItemSubcategory) => {
    const confirmed = window.confirm(
      `Hapus subkategori ${subcategory.code} - ${subcategory.name}?`,
    );

    if (!confirmed) return;

    await deleteSubcategory(subcategory.id);
  };

  return (
    <div className="w-full pr-2 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Master Subkategori Barang
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Rincikan kelompok item seperti Milk, Snack, Soft Drink, dan lainnya.
          </p>
        </div>

        <div className="w-full md:w-80">
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari kategori atau subkategori..."
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loadingMasters && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Memuat kategori dan akun COA...
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {editingSubcategory
                ? "Edit Subkategori Barang"
                : "Tambah Subkategori Barang"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Kosongkan akun override agar subkategori memakai akun dari
              kategori induknya.
            </p>
          </div>

          {editingSubcategory && (
            <button
              type="button"
              onClick={() => setEditingSubcategory(null)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Batal Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Kategori Induk
            </label>
            <select
              value={formData.category_id}
              onChange={(event) =>
                updateField("category_id", event.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Pilih kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.code} - {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Kode Subkategori
            </label>
            <input
              value={formData.code}
              onChange={(event) => updateField("code", event.target.value)}
              placeholder="Contoh: MILK"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nama Subkategori
            </label>
            <input
              value={formData.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Contoh: Milk"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Status
            </label>
            <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(event) =>
                  updateField("is_active", event.target.checked)
                }
                className="h-4 w-4"
              />
              Subkategori aktif
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Keterangan
            </label>
            <textarea
              value={formData.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              rows={2}
              placeholder="Keterangan (opsional)"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Override Akun Persediaan
            </label>
            <select
              value={formData.inventory_account_id}
              onChange={(event) =>
                updateField("inventory_account_id", event.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Ikuti akun kategori</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Override Akun Beban Non-Stok
            </label>
            <select
              value={formData.expense_account_id}
              onChange={(event) =>
                updateField("expense_account_id", event.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Ikuti akun kategori</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Override Akun HPP
            </label>
            <select
              value={formData.cogs_account_id}
              onChange={(event) =>
                updateField("cogs_account_id", event.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Ikuti akun kategori</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Override Akun Selisih Stok
            </label>
            <select
              value={formData.stock_adjustment_account_id}
              onChange={(event) =>
                updateField("stock_adjustment_account_id", event.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Ikuti akun kategori</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
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
              : editingSubcategory
                ? "Simpan Perubahan"
                : "Simpan Subkategori"}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">
            Daftar Subkategori Barang
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium">Kategori</th>
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">Nama Subkategori</th>
                <th className="px-4 py-3 font-medium">Override Persediaan</th>
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
                    Memuat subkategori...
                  </td>
                </tr>
              ) : filteredSubcategories.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Belum ada subkategori barang.
                  </td>
                </tr>
              ) : (
                filteredSubcategories.map((subcategory) => (
                  <tr key={subcategory.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">
                      {subcategory.category
                        ? `${subcategory.category.code} - ${subcategory.category.name}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {subcategory.code}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{subcategory.name}</div>
                      {subcategory.description && (
                        <div className="mt-1 text-xs text-gray-500">
                          {subcategory.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {accountLabel(subcategory.inventory_account)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          subcategory.is_active
                            ? "rounded-full bg-green-100 px-2 py-1 text-xs text-green-700"
                            : "rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
                        }
                      >
                        {subcategory.is_active ? "Aktif" : "Tidak Aktif"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleEdit(subcategory)}
                        className="mr-3 text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(subcategory)}
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

export default ItemSubcategoryPage;
