import type { AccountMappingWithAccount } from "../types";

interface AccountMappingTableProps {
  mappings: AccountMappingWithAccount[];
  loading?: boolean;
  onEdit: (mapping: AccountMappingWithAccount) => void;
  onDelete: (mapping: AccountMappingWithAccount) => void;
}

export function AccountMappingTable({
  mappings,
  loading = false,
  onEdit,
  onDelete,
}: AccountMappingTableProps) {
  if (loading) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        Memuat data mapping akun...
      </div>
    );
  }

  if (mappings.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
        Belum ada mapping akun.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Transaction</th>
              <th className="px-4 py-3">Mapping Key</th>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Akun COA</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 bg-white">
            {mappings.map((mapping) => (
              <tr key={mapping.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                  {mapping.module_code}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                  {mapping.transaction_code}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                  {mapping.mapping_key ?? "-"}
                </td>

                <td className="px-4 py-3 text-gray-700">
                  <div className="font-medium text-gray-900">
                    {mapping.name}
                  </div>
                  {mapping.description && (
                    <div className="mt-1 text-xs text-gray-500">
                      {mapping.description}
                    </div>
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                  {mapping.account ? (
                    <span>
                      <span className="font-medium">
                        {mapping.account.code}
                      </span>
                      <span className="ml-1">{mapping.account.name}</span>
                    </span>
                  ) : (
                    <span className="text-red-600">Belum dipilih</span>
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={[
                      "rounded-full px-2 py-1 text-xs font-medium",
                      mapping.is_active
                        ? "bg-blue-50 text-blue-700"
                        : "bg-red-50 text-red-700",
                    ].join(" ")}
                  >
                    {mapping.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      onClick={() => onEdit(mapping)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      onClick={() => onDelete(mapping)}
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
