import { useEffect, useMemo, useRef, useState } from "react";
import { CoaForm } from "./components/CoaForm";
import { CoaTable } from "./components/CoaTable";
import { useCoa } from "./hooks/useCoa";
import type { CoaFormData, CoaNode } from "./types";
import { scrollToElement } from "@/utils/scrollToElement";
import { exportReport, type ExportColumn } from "@/utils/exportReport";

interface CoaPageProps {
  entityId?: string | null;
}

export function CoaPage({ entityId = null }: CoaPageProps) {
  const {
    accounts,
    loading,
    saving,
    error,
    createAccount,
    updateAccount,
    deleteAccount,
  } = useCoa(entityId);

  const [editingAccount, setEditingAccount] = useState<CoaNode | null>(null);
  const [search, setSearch] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editingAccount) return;

    requestAnimationFrame(() => {
      scrollToElement(formRef.current, 24);
    });
  }, [editingAccount]);

  const filteredAccounts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return accounts;
    }

    return accounts.filter((account) => {
      return (
        account.code.toLowerCase().includes(keyword) ||
        account.name.toLowerCase().includes(keyword) ||
        (account.category_code ?? "").toLowerCase().includes(keyword) ||
        (account.account_type ?? "").toLowerCase().includes(keyword)
      );
    });
  }, [accounts, search]);

  const handleSubmit = async (payload: CoaFormData) => {
    if (editingAccount) {
      const success = await updateAccount(editingAccount.id, payload);

      if (success) {
        setEditingAccount(null);
      }

      return success;
    }

    return createAccount(payload);
  };

  const handleDelete = async (account: CoaNode) => {
    const confirmed = window.confirm(
      `Hapus akun ${account.code} - ${account.name}?`,
    );

    if (!confirmed) {
      return;
    }

    await deleteAccount(account.id);
  };

  const handleExportExcel = () => {
    const columns: ExportColumn[] = [
      {
        label: "Kode",
        key: "code",
      },
      {
        label: "Nama Account",
        key: "name",
      },
      {
        label: "Parent Account",
        key: "parent_account",
        format: (value: unknown): string =>
          value == null ? "" : String(value),
      },
      {
        label: "Kategori",
        key: "category_code",
      },
      {
        label: "Tipe Account",
        key: "account_type",
      },
      {
        label: "Normal Balance",
        key: "normal_balance",
      },
      {
        label: "Posting Account",
        key: "is_posting",
        format: (value: unknown) => (value ? "Ya" : "Tidak"),
      },
      {
        label: "Summary Account",
        key: "is_summary",
        format: (value: unknown) => (value ? "Ya" : "Tidak"),
      },
      {
        label: "Aktif",
        key: "is_active",
        format: (value: unknown) => (value ? "Ya" : "Tidak"),
      },
    ];

    const rows = filteredAccounts.map((account) => {
      const parent = accounts.find(
        (parentAccount) => parentAccount.id === account.parent_account_id,
      );

      return {
        code: account.code,
        name: account.name,
        parent_account: parent ? `${parent.code} - ${parent.name}` : "",
        category_code: account.category_code ?? "",
        account_type: account.account_type ?? "",
        normal_balance: account.normal_balance ?? "",
        is_posting: account.is_posting,
        is_summary: account.is_summary,
        is_active: account.is_active,
      };
    });

    exportReport({
      filename: "Chart_of_Accounts.xlsx",
      sheetName: "Chart of Accounts",
      columns,
      rows,
    });
  };

  return (
    <div className="p-4 bg-white rounded shadow space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Chart of Accounts
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Kelola daftar akun akuntansi perusahaan.
          </p>
        </div>

        <div className="flex w-full gap-2 md:w-auto">
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm md:w-80"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari kode, nama, kategori..."
          />

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={loading || filteredAccounts.length === 0}
            className="whitespace-nowrap rounded-md border border-green-600 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div ref={formRef}>
        <CoaForm
          accounts={accounts}
          initialValue={editingAccount}
          entityId={entityId}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={editingAccount ? () => setEditingAccount(null) : undefined}
        />
      </div>

      <CoaTable
        accounts={filteredAccounts}
        loading={loading}
        onEdit={setEditingAccount}
        onDelete={handleDelete}
      />
    </div>
  );
}

export default CoaPage;
