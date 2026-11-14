import type { CoaNode } from "../types";

interface CoaTableProps {
  accounts: CoaNode[];
  loading?: boolean;
  onEdit: (account: CoaNode) => void;
  onDelete: (account: CoaNode) => void;
}

export function CoaTable({
  accounts,
  loading = false,
  onEdit,
  onDelete,
}: CoaTableProps) {
  if (loading) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        Memuat data akun...
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
        Belum ada data akun.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Nama Akun</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Tipe</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Normal</th>
              <th className="px-4 py-3">Posting</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 bg-white">
            {accounts.map((account) => (
              <tr key={account.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                  {account.code}
                </td>

                <td className="px-4 py-3 text-gray-700">
                  <div
                    style={{
                      paddingLeft: `${Math.max(account.account_level - 1, 0) * 16}px`,
                    }}
                  >
                    {account.name}
                  </div>
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                  {account.category_code ?? "-"}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                  {account.account_type ?? "-"}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                  {account.account_level}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                  {account.normal_balance === "D"
                    ? "Debit"
                    : account.normal_balance === "C"
                      ? "Credit"
                      : "-"}
                </td>

                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={[
                      "rounded-full px-2 py-1 text-xs font-medium",
                      account.is_posting
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-600",
                    ].join(" ")}
                  >
                    {account.is_posting ? "Posting" : "Summary"}
                  </span>
                </td>

                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={[
                      "rounded-full px-2 py-1 text-xs font-medium",
                      account.is_active
                        ? "bg-blue-50 text-blue-700"
                        : "bg-red-50 text-red-700",
                    ].join(" ")}
                  >
                    {account.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      onClick={() => onEdit(account)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      onClick={() => onDelete(account)}
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
