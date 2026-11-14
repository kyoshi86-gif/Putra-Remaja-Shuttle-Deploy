import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  AccountCategory,
  AccountType,
  CoaFormData,
  CoaNode,
} from "../types";
import { AccountSelector } from "./AccountSelector";

const accountCategories: AccountCategory[] = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "COGS",
  "EXPENSE",
  "OTHER_INCOME",
  "OTHER_EXPENSE",
];

const accountTypes: AccountType[] = [
  "CASH",
  "BANK",
  "ACCOUNT_RECEIVABLE",
  "ACCOUNT_PAYABLE",
  "INVENTORY",
  "FIXED_ASSET",
  "ACCUMULATED_DEPRECIATION",
  "REVENUE",
  "EXPENSE",
  "COGS",
  "EQUITY",
  "LIABILITY",
  "OTHER",
];

const initialFormData: CoaFormData = {
  code: "",
  name: "",
  parent_account_id: null,
  category_code: "ASSET",
  account_type: "OTHER",
  normal_balance: "D",
  is_posting: true,
  is_summary: false,
  is_active: true,
  entity_id: null,
};

interface CoaFormProps {
  accounts: CoaNode[];
  initialValue?: CoaNode | null;
  entityId?: string | null;
  saving?: boolean;
  onSubmit: (payload: CoaFormData) => Promise<boolean> | boolean;
  onCancel?: () => void;
}

export function CoaForm({
  accounts,
  initialValue = null,
  entityId = null,
  saving = false,
  onSubmit,
  onCancel,
}: CoaFormProps) {
  const [formData, setFormData] = useState<CoaFormData>(initialFormData);

  const isEditing = Boolean(initialValue?.id);

  useEffect(() => {
    if (initialValue) {
      setFormData({
        id: initialValue.id,
        code: initialValue.code,
        name: initialValue.name,
        parent_account_id: initialValue.parent_account_id,
        category_code: initialValue.category_code ?? "EXPENSE",
        account_type: initialValue.account_type ?? "OTHER",
        normal_balance: initialValue.normal_balance ?? "D",
        is_posting: initialValue.is_posting,
        is_summary: initialValue.is_summary,
        is_active: initialValue.is_active,
        entity_id: initialValue.entity_id,
      });
      return;
    }

    setFormData({
      ...initialFormData,
      entity_id: entityId,
    });
  }, [initialValue, entityId]);

  const parentOptions = useMemo(() => {
    return accounts.filter((account) => account.id !== initialValue?.id);
  }, [accounts, initialValue?.id]);

  const updateField = <Key extends keyof CoaFormData>(
    key: Key,
    value: CoaFormData[Key],
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
          {isEditing ? "Edit Account" : "Tambah Account"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Kelola struktur chart of accounts.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Kode</label>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={formData.code}
            onChange={(event) => updateField("code", event.target.value)}
            placeholder="Contoh: 101.001"
            maxLength={20}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">
            Nama Account
          </label>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={formData.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Contoh: Kas Operasional"
            required
          />
        </div>

        <AccountSelector
          accounts={parentOptions}
          value={formData.parent_account_id}
          onChange={(value) => updateField("parent_account_id", value)}
          disabledAccountId={initialValue?.id ?? null}
        />

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Kategori</label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={formData.category_code}
            onChange={(event) =>
              updateField(
                "category_code",
                event.target.value as AccountCategory,
              )
            }
          >
            {accountCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">
            Tipe Account
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={formData.account_type}
            onChange={(event) =>
              updateField("account_type", event.target.value as AccountType)
            }
          >
            {accountTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">
            Normal Balance
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={formData.normal_balance}
            onChange={(event) =>
              updateField("normal_balance", event.target.value as "D" | "C")
            }
          >
            <option value="D">Debit</option>
            <option value="C">Credit</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={formData.is_posting}
            onChange={(event) => {
              updateField("is_posting", event.target.checked);
              updateField("is_summary", !event.target.checked);
            }}
          />
          Posting Account
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={formData.is_summary}
            onChange={(event) => {
              updateField("is_summary", event.target.checked);
              updateField("is_posting", !event.target.checked);
            }}
          />
          Summary Account
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(event) => updateField("is_active", event.target.checked)}
          />
          Aktif
        </label>
      </div>

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
