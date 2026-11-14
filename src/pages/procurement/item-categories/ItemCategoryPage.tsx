import { useEffect, useMemo, useState } from "react";
import { useItemCategories } from "./hooks/useItemCategories";
import type {
  AccountOption,
  ItemCategory,
  ItemCategoryFormData,
} from "./types";

interface ItemCategoryPageProps {
  entityId?: string | null;
}

const initialForm: ItemCategoryFormData = {
  entity_id: null,
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
  if (!account) return "-";
  return `${account.code} - ${account.name}`;
}

export function ItemCategoryPage({ entityId = null }: ItemCategoryPageProps) {
  const {
    categories,
    accounts,
    loading,
    loadingAccounts,
    saving,
    error,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useItemCategories(entityId);

  const [formData, setFormData] = useState<ItemCategoryFormData>(initialForm);

  const [editingCategory, setEditingCategory] = useState<ItemCategory | null>(
    null,
  );

  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!editingCategory) {
      setFormData({
        ...initialForm,
        entity_id: entityId,
      });
      return;
    }

    setFormData({
      entity_id: editingCategory.entity_id,
      code: editingCategory.code,
      name: editingCategory.name,
      description: editingCategory.description ?? "",

      inventory_account_id: editingCategory.inventory_account_id ?? "",
      expense_account_id: editingCategory.expense_account_id ?? "",
      cogs_account_id: editingCategory.cogs_account_id ?? "",
      stock_adjustment_account_id:
        editingCategory.stock_adjustment_account_id ?? "",

      is_active: editingCategory.is_active,
    });
  }, [editingCategory, entityId]);

  const filteredCategories = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return categories;

    return categories.filter((category) => {
      return (
        category.code.toLowerCase().includes(keyword) ||
        category.name.toLowerCase().includes(keyword) ||
        (category.description ?? "").toLowerCase().includes(keyword)
      );
    });
  }, [categories, search]);

  const updateField = (
    field: keyof ItemCategoryFormData,
    value: string | boolean,
  ) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.code.trim() || !formData.name.trim()) {
      window.alert("Kode dan nama kategori wajib diisi.");
      return;
    }

    if (!formData.inventory_account_id) {
      window.alert("Akun persediaan wajib dipilih.");
      return;
    }

    if (!formData.expense_account_id) {
      window.alert("Akun beban non-stok wajib dipilih.");
      return;
    }

    if (!formData.cogs_account_id) {
      window.alert("Akun HPP wajib dipilih.");
      return;
    }

    if (!formData.stock_adjustment_account_id) {
      window.alert("Akun beban selisih stok wajib dipilih.");
      return;
    }

    const success = editingCategory
      ? await updateCategory(editingCategory.id, formData)
      : await createCategory(formData);

    if (success) {
      setEditingCategory(null);
      setFormData({
        ...initialForm,
        entity_id: entityId,
      });
    }
  };

  const handleEdit = (category: ItemCategory) => {
    setEditingCategory(category);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
  };

  const handleDelete = async (category: ItemCategory) => {
    const confirmed = window.confirm(
      `Hapus kategori ${category.code} - ${category.name}?`,
    );

    if (!confirmed) return;

    await deleteCategory(category.id);
  };

  return (
    <div className="w-full pr-2 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Master Kategori Barang
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Kelompokkan barang dan tentukan akun otomatis saat receiving, stock
            opname, serta perhitungan HPP.
          </p>
        </div>

        <div className="w-full md:w-80">
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari kode atau nama kategori..."
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loadingAccounts && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Memuat akun COA...
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {editingCategory
                ? "Edit Kategori Barang"
                : "Tambah Kategori Barang"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Akun kategori akan menjadi default bagi item di dalamnya.
            </p>
          </div>

          {editingCategory && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Batal Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Kode Kategori
            </label>
            <input
              value={formData.code}
              onChange={(event) => updateField("code", event.target.value)}
              placeholder="Contoh: FOOD"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nama Kategori
            </label>
            <input
              value={formData.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Contoh: Food"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
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
              placeholder="Keterangan kategori (opsional)"
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Akun Persediaan
            </label>
            <select
              value={formData.inventory_account_id}
              onChange={(event) =>
                updateField("inventory_account_id", event.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Pilih akun persediaan</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Akun Beban Non-Stok
            </label>
            <select
              value={formData.expense_account_id}
              onChange={(event) =>
                updateField("expense_account_id", event.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Pilih akun beban non-stok</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Akun HPP
            </label>
            <select
              value={formData.cogs_account_id}
              onChange={(event) =>
                updateField("cogs_account_id", event.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Pilih akun HPP</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Akun Beban Selisih Stok
            </label>
            <select
              value={formData.stock_adjustment_account_id}
              onChange={(event) =>
                updateField("stock_adjustment_account_id", event.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Pilih akun beban selisih stok</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(event) =>
                  updateField("is_active", event.target.checked)
                }
                className="h-4 w-4"
              />
              Kategori aktif
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
              : editingCategory
                ? "Simpan Perubahan"
                : "Simpan Kategori"}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">
            Daftar Kategori Barang
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">Nama Kategori</th>
                <th className="px-4 py-3 font-medium">Akun Persediaan</th>
                <th className="px-4 py-3 font-medium">Akun HPP</th>
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
                    Memuat kategori...
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Belum ada kategori barang.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((category) => (
                  <tr key={category.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                      {category.code}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{category.name}</div>
                      {category.description && (
                        <div className="mt-1 text-xs text-gray-500">
                          {category.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {accountLabel(category.inventory_account)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {accountLabel(category.cogs_account)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          category.is_active
                            ? "rounded-full bg-green-100 px-2 py-1 text-xs text-green-700"
                            : "rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
                        }
                      >
                        {category.is_active ? "Aktif" : "Tidak Aktif"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleEdit(category)}
                        className="mr-3 text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(category)}
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

export default ItemCategoryPage;
