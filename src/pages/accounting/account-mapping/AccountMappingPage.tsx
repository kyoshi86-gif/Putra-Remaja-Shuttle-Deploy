import { useState } from "react";
import { AccountMappingForm } from "./components/AccountMappingForm";
import { AccountMappingTable } from "./components/AccountMappingTable";
import { useAccountMapping } from "./hooks/useAccountMapping";
import { useCoa } from "../coa/hooks/useCoa";
import Pagination from "@/components/common/Pagination";
import type {
  AccountMappingFormData,
  AccountMappingWithAccount,
} from "./types";

interface AccountMappingPageProps {
  entityId?: string | null;
}

export function AccountMappingPage({
  entityId = null,
}: AccountMappingPageProps) {
  const {
    mappings,
    loading,
    saving,
    error,

    createMapping,
    updateMapping,
    deleteMapping,

    page,
    pageSize,
    total,
    totalPages,

    setPage,
    setPageSize,

    search,
    setSearch,
  } = useAccountMapping(entityId);

  const { accounts, loading: loadingAccounts } = useCoa(entityId);

  const [editingMapping, setEditingMapping] =
    useState<AccountMappingWithAccount | null>(null);

  const handleSubmit = async (payload: AccountMappingFormData) => {
    if (editingMapping) {
      const success = await updateMapping(editingMapping.id, payload);

      if (success) {
        setEditingMapping(null);
      }

      return success;
    }

    return createMapping(payload);
  };

  const handleDelete = async (mapping: AccountMappingWithAccount) => {
    const confirmed = window.confirm(
      `Hapus mapping ${mapping.module_code} - ${
        mapping.mapping_key ?? mapping.name
      }?`,
    );

    if (!confirmed) {
      return;
    }

    await deleteMapping(mapping.id);
  };

  return (
    <div className="p-4 bg-white rounded shadow space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Account Mapping ERP
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Hubungkan transaksi operasional dengan akun COA.
          </p>
        </div>

        <div className="w-full md:w-80">
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari module, transaksi, akun..."
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

      <AccountMappingForm
        accounts={accounts}
        initialValue={editingMapping}
        entityId={entityId}
        saving={saving}
        onSubmit={handleSubmit}
        onCancel={editingMapping ? () => setEditingMapping(null) : undefined}
      />

      <AccountMappingTable
        mappings={mappings}
        loading={loading}
        onEdit={setEditingMapping}
        onDelete={handleDelete}
      />

      <Pagination
        meta={{
          page,
          pageSize,
          total,
          totalPages,
          from: total === 0 ? 0 : (page - 1) * pageSize + 1,
          to: total === 0 ? 0 : Math.min(page * pageSize, total),
          hasPreviousPage: page > 1,
          hasNextPage: page < totalPages,
        }}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}

export default AccountMappingPage;
