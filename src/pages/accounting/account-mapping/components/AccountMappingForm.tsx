import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { CoaNode } from "../../coa/types";
import type {
  AccountMappingFormData,
  AccountMappingWithAccount,
  MappingKey,
  MappingModuleCode,
  MappingTransactionCode,
} from "../types";

const moduleOptions: MappingModuleCode[] = [
  "CASH_DAILY",
  "SALES",
  "PURCHASE",
  "RECEIVING",
  "PAYMENT",
  "ADJUSTMENT",
];

const transactionOptions: MappingTransactionCode[] = [
  "CASH_RECEIPT",
  "CASH_EXPENSE",
  "INVOICE",
  "BILL",
  "RECEIVE_ITEM",
  "CUSTOMER_PAYMENT",
  "SUPPLIER_PAYMENT",
  "MANUAL_ADJUSTMENT",
];

const mappingKeyOptions: MappingKey[] = [
  "CASH_ACCOUNT",
  "BANK_ACCOUNT",
  "REVENUE_ACCOUNT",
  "DISCOUNT_ACCOUNT",
  "COGS_ACCOUNT",
  "EXPENSE_ACCOUNT",
  "AR_ACCOUNT",
  "AP_ACCOUNT",
  "INVENTORY_ACCOUNT",
  "TAX_ACCOUNT",
  "ROUNDING_ACCOUNT",
];

const initialFormData: AccountMappingFormData = {
  module_code: "CASH_DAILY",
  transaction_code: "CASH_RECEIPT",
  name: "",
  description: null,
  entity_id: null,
  is_active: true,
  mapping_key: "CASH_ACCOUNT",
  account_id: "",
};

interface AccountMappingFormProps {
  accounts: CoaNode[];
  initialValue?: AccountMappingWithAccount | null;
  entityId?: string | null;
  saving?: boolean;
  onSubmit: (payload: AccountMappingFormData) => Promise<boolean> | boolean;
  onCancel?: () => void;
}

export function AccountMappingForm({
  accounts,
  initialValue = null,
  entityId = null,
  saving = false,
  onSubmit,
  onCancel,
}: AccountMappingFormProps) {
  const [formData, setFormData] =
    useState<AccountMappingFormData>(initialFormData);

  const isEditing = Boolean(initialValue?.id);

  useEffect(() => {
    if (initialValue) {
      setFormData({
        id: initialValue.id,
        module_code: initialValue.module_code,
        transaction_code: initialValue.transaction_code,
        name: initialValue.name,
        description: initialValue.description,
        entity_id: initialValue.entity_id,
        is_active: initialValue.is_active ?? true,
        mapping_key: initialValue.mapping_key ?? "CASH_ACCOUNT",
        account_id: initialValue.account_id ?? "",
      });
      return;
    }

    setFormData({
      ...initialFormData,
      entity_id: entityId,
    });
  }, [initialValue, entityId]);

  const activePostingAccounts = useMemo(() => {
    return accounts
      .filter((account) => account.is_active && account.is_posting)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts]);

  const updateField = <Key extends keyof AccountMappingFormData>(
    key: Key,
    value: AccountMappingFormData[Key],
  ) => {
    setFormData((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const success = await onSubmit({
      ...formData,
      entity_id: entityId,
      description: formData.description?.trim() || null,
    });

    if (success && !isEditing) {
      setFormData({
        ...initialFormData,
        entity_id: entityId,
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-md border border-gray-200 bg-white p-4"
    >
      <div>
        <h2 className="text-base font-semibold text-gray-900">
          {isEditing ? "Edit Mapping Akun" : "Tambah Mapping Akun"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Hubungkan proses ERP dengan akun COA.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Module</label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={formData.module_code}
            onChange={(event) =>
              updateField(
                "module_code",
                event.target.value as MappingModuleCode,
              )
            }
          >
            {moduleOptions.map((moduleCode) => (
              <option key={moduleCode} value={moduleCode}>
                {moduleCode}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">
            Transaction
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={formData.transaction_code}
            onChange={(event) =>
              updateField(
                "transaction_code",
                event.target.value as MappingTransactionCode,
              )
            }
          >
            {transactionOptions.map((transactionCode) => (
              <option key={transactionCode} value={transactionCode}>
                {transactionCode}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">
            Mapping Key
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={formData.mapping_key}
            onChange={(event) =>
              updateField("mapping_key", event.target.value as MappingKey)
            }
          >
            {mappingKeyOptions.map((mappingKey) => (
              <option key={mappingKey} value={mappingKey}>
                {mappingKey}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Akun COA</label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={formData.account_id}
            onChange={(event) => updateField("account_id", event.target.value)}
            required
          >
            <option value="">Pilih akun</option>
            {activePostingAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-sm font-medium text-gray-700">Nama</label>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={formData.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Contoh: Pendapatan Tiket Shuttle"
            required
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-sm font-medium text-gray-700">Deskripsi</label>
          <textarea
            className="min-h-20 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={formData.description ?? ""}
            onChange={(event) =>
              updateField("description", event.target.value || null)
            }
            placeholder="Catatan penggunaan mapping ini"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={formData.is_active}
          onChange={(event) => updateField("is_active", event.target.checked)}
        />
        Aktif
      </label>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700"
            onClick={onCancel}
            disabled={saving}
          >
            Batal
          </button>
        )}

        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-blue-300"
          disabled={saving}
        >
          {saving ? "Menyimpan..." : isEditing ? "Update" : "Simpan"}
        </button>
      </div>
    </form>
  );
}
