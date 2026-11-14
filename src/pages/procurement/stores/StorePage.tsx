import { useEffect, useMemo, useState } from "react";
import { useStores } from "./hooks/useStores";
import type { Store, StoreFormData, StoreType } from "./types";

interface StorePageProps {
  entityId?: string | null;
}

const storeTypeLabels: Record<StoreType, string> = {
  WAREHOUSE: "Gudang",
  STORE: "Store",
  BAR: "Bar",
  KITCHEN: "Kitchen",
  OUTLET: "Outlet",
};

const initialForm: StoreFormData = {
  entity_id: null,
  code: "",
  name: "",
  store_type: "STORE",
  address: "",
  is_active: true,
};

export function StorePage({ entityId = null }: StorePageProps) {
  const currentUser = JSON.parse(
    localStorage.getItem("custom_user") || "{}",
  );

  const currentEntityId =
    entityId ??
    currentUser?.entity_id ??
    null;

  const {
    stores,
    loading,
    saving,
    error,
    createStore,
    updateStore,
    deleteStore,
  } = useStores(currentEntityId);

  const [formData, setFormData] = useState<StoreFormData>(initialForm);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!editingStore) {
      setFormData({
        ...initialForm,
        entity_id: currentEntityId,
      });

      return;
    }

    setFormData({
      entity_id: editingStore.entity_id,
      code: editingStore.code,
      name: editingStore.name,
      store_type: editingStore.store_type,
      address: editingStore.address ?? "",
      is_active: editingStore.is_active,
    });
  }, [editingStore, currentEntityId]);

  const filteredStores = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return stores;

    return stores.filter((store) => {
      return (
        store.code.toLowerCase().includes(keyword) ||
        store.name.toLowerCase().includes(keyword) ||
        store.store_type.toLowerCase().includes(keyword) ||
        (store.address ?? "").toLowerCase().includes(keyword)
      );
    });
  }, [stores, search]);

  const updateField = (field: keyof StoreFormData, value: string | boolean) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSubmit = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    if (!currentEntityId) {
      window.alert(
        "Entity transaksi tidak ditemukan. Silakan login kembali.",
      );
      return;
    }

    if (!formData.code.trim() || !formData.name.trim()) {
      window.alert(
        "Kode dan nama store wajib diisi.",
      );
      return;
    }

    const payload: StoreFormData = {
      ...formData,
      entity_id: currentEntityId,
    };

    const success = editingStore
      ? await updateStore(
          editingStore.id,
          payload,
        )
      : await createStore(payload);

    if (success) {
      setEditingStore(null);

      setFormData({
        ...initialForm,
        entity_id: currentEntityId,
      });
    }
  };

  const handleEdit = (store: Store) => {
    setEditingStore(store);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (store: Store) => {
    const confirmed = window.confirm(
      `Hapus store ${store.code} - ${store.name}?`,
    );

    if (!confirmed) return;

    await deleteStore(store.id);
  };

  return (
    <div className="w-full pr-2 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Master Store / Gudang
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Tentukan lokasi penyimpanan dan penerimaan stok barang.
          </p>
        </div>

        <div className="w-full md:w-80">
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari kode, nama, atau lokasi..."
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
              {editingStore ? "Edit Store / Gudang" : "Tambah Store / Gudang"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Pilih tipe lokasi sesuai fungsi operasionalnya.
            </p>
          </div>

          {editingStore && (
            <button
              type="button"
              onClick={() => setEditingStore(null)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Batal Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Kode Store
            </label>
            <input
              value={formData.code}
              onChange={(event) => updateField("code", event.target.value)}
              placeholder="Contoh: BAR"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nama Store / Gudang
            </label>
            <input
              value={formData.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Contoh: Bar Utama"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Tipe Lokasi
            </label>
            <select
              value={formData.store_type}
              onChange={(event) =>
                updateField("store_type", event.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {Object.entries(storeTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
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
              Store aktif
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Alamat / Keterangan Lokasi
            </label>
            <textarea
              value={formData.address}
              onChange={(event) => updateField("address", event.target.value)}
              rows={2}
              placeholder="Contoh: Area Bar lantai 1"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
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
              : editingStore
                ? "Simpan Perubahan"
                : "Simpan Store"}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Daftar Store / Gudang</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">Nama Lokasi</th>
                <th className="px-4 py-3 font-medium">Tipe</th>
                <th className="px-4 py-3 font-medium">Keterangan</th>
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
                    Memuat data store...
                  </td>
                </tr>
              ) : filteredStores.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Belum ada store atau gudang.
                  </td>
                </tr>
              ) : (
                filteredStores.map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {store.code}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{store.name}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {storeTypeLabels[store.store_type]}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {store.address || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          store.is_active
                            ? "rounded-full bg-green-100 px-2 py-1 text-xs text-green-700"
                            : "rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
                        }
                      >
                        {store.is_active ? "Aktif" : "Tidak Aktif"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleEdit(store)}
                        className="mr-3 text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(store)}
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

export default StorePage;
