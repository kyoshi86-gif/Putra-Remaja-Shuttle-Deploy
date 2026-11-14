import { useEffect, useMemo, useState } from "react";
import { usePurchaseSettlementMethods } from "./hooks/usePurchaseSettlementMethods";
import type {
  PurchaseSettlementMethod,
  PurchaseSettlementMethodFormData,
  SettlementType,
} from "./types";

interface PurchaseSettlementMethodPageProps {
  entityId?: string | null;
}

const settlementTypeLabels: Record<SettlementType, string> = {
  CREDIT_TERM: "Tempo / Hutang Usaha",
  DEPOSIT: "Deposit Supplier",
  CASH_BANK: "Kas / Bank",
  OTHER: "Metode Lain",
};

const initialForm: PurchaseSettlementMethodFormData = {
  entity_id: null,
  code: "",
  name: "",
  settlement_type: "CASH_BANK",
  account_id: "",
  requires_amount: true,
  is_active: true,
};

export function PurchaseSettlementMethodPage({
  entityId = null,
}: PurchaseSettlementMethodPageProps) {
  const {
    methods,
    accounts,
    loading,
    loadingAccounts,
    saving,
    error,
    createMethod,
    updateMethod,
    deleteMethod,
  } = usePurchaseSettlementMethods(entityId);

  const [formData, setFormData] =
    useState<PurchaseSettlementMethodFormData>(initialForm);

  const [editingMethod, setEditingMethod] =
    useState<PurchaseSettlementMethod | null>(null);

  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!editingMethod) {
      setFormData({
        ...initialForm,
        entity_id: entityId,
      });
      return;
    }

    setFormData({
      entity_id: editingMethod.entity_id,
      code: editingMethod.code,
      name: editingMethod.name,
      settlement_type: editingMethod.settlement_type,
      account_id: editingMethod.account_id ?? "",
      requires_amount: editingMethod.requires_amount,
      is_active: editingMethod.is_active,
    });
  }, [editingMethod, entityId]);

  const filteredMethods = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return methods;

    return methods.filter((method) => {
      return (
        method.code.toLowerCase().includes(keyword) ||
        method.name.toLowerCase().includes(keyword) ||
        method.settlement_type.toLowerCase().includes(keyword) ||
        (method.account?.code ?? "").toLowerCase().includes(keyword) ||
        (method.account?.name ?? "").toLowerCase().includes(keyword)
      );
    });
  }, [methods, search]);

  const updateField = (
    field: keyof PurchaseSettlementMethodFormData,
    value: string | boolean,
  ) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleTypeChange = (value: SettlementType) => {
    setFormData((previous) => ({
      ...previous,
      settlement_type: value,
      requires_amount:
        value === "CREDIT_TERM" ? false : previous.requires_amount,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      window.alert("Nama metode settlement wajib diisi.");
      return;
    }

    if (!editingMethod && !formData.code.trim()) {
      window.alert("Kode metode settlement wajib diisi.");
      return;
    }

    if (!formData.account_id) {
      window.alert("Akun COA wajib dipilih.");
      return;
    }

    const success = editingMethod
      ? await updateMethod(editingMethod, formData)
      : await createMethod(formData);

    if (success) {
      setEditingMethod(null);
      setFormData({
        ...initialForm,
        entity_id: entityId,
      });
    }
  };

  const handleEdit = (method: PurchaseSettlementMethod) => {
    setEditingMethod(method);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (method: PurchaseSettlementMethod) => {
    if (method.is_system) {
      window.alert("Metode sistem tidak boleh dihapus.");
      return;
    }

    const confirmed = window.confirm(
      `Hapus metode ${method.code} - ${method.name}?`,
    );

    if (!confirmed) return;

    await deleteMethod(method);
  };

  return (
    <div className="w-full pr-2 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Settlement Pembelian
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Atur metode pembayaran Receiving dan hubungan langsung ke COA.
          </p>
        </div>

        <div className="w-full md:w-80">
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari metode atau akun..."
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
          Memuat daftar akun COA...
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {editingMethod
                ? "Edit Metode Settlement"
                : "Tambah Metode Settlement"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Metode sistem tetap dapat diperbaiki akun COA-nya, tetapi tidak
              dapat dihapus atau dinonaktifkan.
            </p>
          </div>

          {editingMethod && (
            <button
              type="button"
              onClick={() => setEditingMethod(null)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Batal Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Kode Metode
            </label>
            <input
              value={formData.code}
              disabled={editingMethod?.is_system}
              onChange={(event) => updateField("code", event.target.value)}
              placeholder="Contoh: BANK_BCA"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nama Metode
            </label>
            <input
              value={formData.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Contoh: Transfer Bank BCA"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Jenis Settlement
            </label>
            <select
              value={formData.settlement_type}
              disabled={editingMethod?.is_system}
              onChange={(event) =>
                handleTypeChange(event.target.value as SettlementType)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            >
              {Object.entries(settlementTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Akun COA
            </label>
            <select
              value={formData.account_id}
              onChange={(event) =>
                updateField("account_id", event.target.value)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Pilih akun COA</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formData.requires_amount}
                disabled={
                  editingMethod?.settlement_type === "CREDIT_TERM" ||
                  formData.settlement_type === "CREDIT_TERM"
                }
                onChange={(event) =>
                  updateField("requires_amount", event.target.checked)
                }
                className="h-4 w-4"
              />
              Nominal wajib diisi
            </label>
          </div>

          <div>
            <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={editingMethod?.is_system ? true : formData.is_active}
                disabled={editingMethod?.is_system}
                onChange={(event) =>
                  updateField("is_active", event.target.checked)
                }
                className="h-4 w-4"
              />
              Metode aktif
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
              : editingMethod
                ? "Simpan Perubahan"
                : "Simpan Metode"}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">
            Daftar Metode Settlement
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">Kode</th>
                <th className="px-4 py-3 font-medium text-gray-600">Metode</th>
                <th className="px-4 py-3 font-medium text-gray-600">Jenis</th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Akun COA
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">Nominal</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Memuat metode settlement...
                  </td>
                </tr>
              ) : filteredMethods.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Belum ada metode settlement.
                  </td>
                </tr>
              ) : (
                filteredMethods.map((method) => (
                  <tr key={method.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {method.code}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{method.name}</div>
                      {method.is_system && (
                        <div className="mt-1 text-xs text-blue-600">
                          Metode sistem
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {settlementTypeLabels[method.settlement_type]}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {method.account
                        ? `${method.account.code} - ${method.account.name}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {method.requires_amount ? "Wajib" : "Tidak wajib"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          method.is_active
                            ? "rounded-full bg-green-100 px-2 py-1 text-xs text-green-700"
                            : "rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
                        }
                      >
                        {method.is_active ? "Aktif" : "Tidak Aktif"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleEdit(method)}
                        className="mr-3 text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>

                      {!method.is_system && (
                        <button
                          type="button"
                          onClick={() => handleDelete(method)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Hapus
                        </button>
                      )}
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

export default PurchaseSettlementMethodPage;
