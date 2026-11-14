import { getWIBTimestampFromUTC } from "@/utils/time";
import { money, quantity } from "../../utils/format";
import { getMovementLabel } from "../../utils/movement";
import { useEffect } from "react";
import { useMovementDetail } from "../hooks/useMovementDetail";
import { printReport } from "@/utils/printReport";
import { getCustomUser } from "@/lib/authUser";

interface MovementDetailItem {
  code: string | null;
  name: string | null;
  unit_code: string | null;
  qty_in: number | string | null;
  qty_out: number | string | null;
  balance: number | string | null;
  cost: number | string | null;
}

interface MovementDetailStore {
  code: string | null;
  name: string | null;
}

interface MovementDetailRow {
  reference: string | null;
  movement_type: string;
  created_at: string;
  created_by: string | null;
  description: string | null;
  fromStore?: MovementDetailStore | null;
  toStore?: MovementDetailStore | null;
  items: MovementDetailItem[];
}

type MovementHistoryRow = ReturnType<typeof useMovementDetail>["rows"][number];

interface MovementDetailModalProps {
  open: boolean;
  row: MovementDetailRow | null;
  onClose: () => void;
}

export default function MovementDetailModal({
  open,
  row,
  onClose,
}: MovementDetailModalProps) {
  const { rows, loadDetail } = useMovementDetail();

  const handlePrintDetail = () => {
    if (!row) {
      return;
    }

    const currentUser = getCustomUser();

    const printedBy = currentUser?.name || "-";

    printReport({
      title: "DETAIL TRANSAKSI PERSEDIAAN",

      period: row.created_at ? getWIBTimestampFromUTC(row.created_at) : "-",

      printedBy,

      columns: [
        {
          label: "Movement",
          key: "movement",
        },

        {
          label: "Store",
          key: "store",
        },

        {
          label: "Kode",
          key: "code",
        },

        {
          label: "Artikel",
          key: "artikel",
        },

        {
          label: "Satuan",
          key: "unit",
        },

        {
          label: "Masuk",
          key: "qtyIn",
          align: "right",
          format: (value) => quantity(Number(value ?? 0)),
        },

        {
          label: "Keluar",
          key: "qtyOut",
          align: "right",
          format: (value) => quantity(Number(value ?? 0)),
        },

        {
          label: "Saldo",
          key: "balance",
          align: "right",
          format: (value) => quantity(Number(value ?? 0)),
        },

        {
          label: "Avg Cost",
          key: "cost",
          align: "right",
          format: (value) => money(Number(value ?? 0)),
        },
      ],

      rows: rows.map((line) => ({
        movement: getMovementLabel(line.movement_type),

        store: line.store ? `${line.store.code} - ${line.store.name}` : "-",

        code: line.item?.code ?? "-",

        artikel: line.item?.name ?? "-",

        unit: line.item?.unit?.code ?? "-",

        qtyIn: Number(line.quantity_in ?? 0),

        qtyOut: Number(line.quantity_out ?? 0),

        balance: Number(line.quantity_after ?? 0),

        cost: Number(line.average_cost_after ?? 0),
      })),

      footer: [
        {
          label: "Jumlah Movement",

          value: rows.length,
        },

        {
          label: "Total Qty",

          value: quantity(
            rows.reduce(
              (sum, line) =>
                sum +
                Number(line.quantity_in ?? 0) +
                Number(line.quantity_out ?? 0),
              0,
            ),
          ),
        },

        {
          label: "Total Nilai",

          value: money(
            row.items.reduce(
              (sum, item) =>
                sum +
                (Number(item.qty_in ?? 0) + Number(item.qty_out ?? 0)) *
                  Number(item.cost ?? 0),
              0,
            ),
          ),
        },
      ],
    });
  };

  useEffect(() => {
    if (!open || !row?.reference) {
      return;
    }

    loadDetail(row.reference);
  }, [open, row?.reference, loadDetail]);

  useEffect(() => {
    (rows[0], { depth: null });
  }, [rows]);
  if (!open || !row) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[900px] max-h-[85vh] overflow-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Detail Transaksi</h2>
          <button
            type="button"
            onClick={() => onClose()}
            className="rounded border px-3 py-1"
          >
            x
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500">Referensi</div>
              <div className="font-medium">{row.reference}</div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Mutasi</div>
              <div>
                <span
                  className={`rounded px-2 py-1 text-xs font-medium
                          ${
                            row.movement_type.includes("TRANSFER")
                              ? "bg-blue-100 text-blue-700"
                              : row.movement_type.includes("OPNAME")
                                ? "bg-orange-100 text-orange-700"
                                : "bg-purple-100 text-purple-700"
                          }`}
                >
                  {getMovementLabel(row.movement_type)}
                </span>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Tanggal Posting</div>
              <div>{getWIBTimestampFromUTC(row.created_at)}</div>
            </div>

            <div>
              <div className="text-xs text-gray-500">User</div>
              <div>{row.created_by ?? "-"}</div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Gudang Asal</div>

              <div>
                {row.fromStore
                  ? `${row.fromStore.code} - ${row.fromStore.name}`
                  : "-"}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Gudang Tujuan</div>
              <div>
                {row.toStore
                  ? `${row.toStore.code} - ${row.toStore.name}`
                  : "-"}
              </div>
            </div>

            <div className="col-span-3">
              <div className="text-xs text-gray-500">Keterangan</div>
              <div className="rounded border bg-gray-50 p-2">
                {row.description || "-"}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-slate-50 p-3">
            <div className="mb-2 text-sm font-semibold">Ringkasan</div>

            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Jumlah Artikel</div>
                <div className="font-semibold">{row.items.length}</div>
              </div>

              <div>
                <div className="text-gray-500">Total Qty</div>
                <div className="font-semibold">
                  {quantity(
                    row.items.reduce(
                      (a: number, b: MovementDetailItem) =>
                        a + Number(b.qty_in ?? 0) + Number(b.qty_out ?? 0),
                      0,
                    ),
                  )}
                </div>
              </div>

              <div>
                <div className="text-gray-500">Total Nilai</div>
                <div className="font-semibold">
                  {money(
                    row.items.reduce(
                      (a: number, b: MovementDetailItem) =>
                        a +
                        (Number(b.qty_in ?? 0) + Number(b.qty_out ?? 0)) *
                          Number(b.cost ?? 0),
                      0,
                    ),
                  )}
                </div>
              </div>

              <div>
                <div className="text-gray-500">Movement</div>
                <div className="font-semibold">{rows.length}</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-white">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Riwayat Movement</h3>

              <p className="mt-1 text-xs text-gray-500">
                Detail seluruh movement dalam transaksi ini.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border px-3 py-2 text-left">No</th>

                    <th className="border px-3 py-2 text-left">Movement</th>

                    <th className="border px-3 py-2 text-left">Store</th>

                    <th className="border px-3 py-2 text-left">Kode</th>

                    <th className="border px-3 py-2 text-left">Artikel</th>

                    <th className="border px-3 py-2 text-center">Satuan</th>

                    <th className="border px-3 py-2 text-right">Masuk</th>

                    <th className="border px-3 py-2 text-right">Keluar</th>

                    <th className="border px-3 py-2 text-right">Saldo</th>

                    <th className="border px-3 py-2 text-right">Avg Cost</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="border px-3 py-6 text-center text-gray-500"
                      >
                        Tidak ada riwayat movement.
                      </td>
                    </tr>
                  ) : (
                    rows.map((line: MovementHistoryRow, index) => {
                      const movementType = String(line.movement_type ?? "");

                      return (
                        <tr key={line.id}>
                          <td className="border px-3 py-2">{index + 1}</td>

                          <td className="border px-3 py-2">
                            <span
                              className={`inline-flex rounded px-2 py-1 text-xs font-medium ${
                                movementType.includes("IN")
                                  ? "bg-green-100 text-green-700"
                                  : movementType.includes("OUT")
                                    ? "bg-red-100 text-red-700"
                                    : "bg-orange-100 text-orange-700"
                              }`}
                            >
                              {getMovementLabel(movementType)}
                            </span>
                          </td>

                          <td className="border px-3 py-2">
                            {line.store
                              ? `${line.store.code} - ${line.store.name}`
                              : "-"}
                          </td>

                          <td className="border px-3 py-2">
                            {line.item?.code ?? "-"}
                          </td>

                          <td className="border px-3 py-2">
                            {line.item?.name ?? "-"}
                          </td>

                          <td className="border px-3 py-2 text-center">
                            {line.item?.unit?.code ?? "-"}
                          </td>

                          <td className="border px-3 py-2 text-right text-green-700">
                            {quantity(Number(line.quantity_in ?? 0))}
                          </td>

                          <td className="border px-3 py-2 text-right text-red-700">
                            {quantity(Number(line.quantity_out ?? 0))}
                          </td>

                          <td className="border px-3 py-2 text-right">
                            {quantity(Number(line.quantity_after ?? 0))}
                          </td>

                          <td className="border px-3 py-2 text-right">
                            {money(Number(line.average_cost_after ?? 0))}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <h3 className="mt-6 mb-2 text-sm font-semibold">Riwayat Movement</h3>

          <table className="w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Movement</th>
                <th className="border p-2">Store</th>
                <th className="border p-2">Qty</th>
                <th className="border p-2">Saldo</th>
                <th className="border p-2">Avg Cost</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((line: MovementHistoryRow) => (
                <tr key={line.id}>
                  <td className="border p-2">
                    <span
                      className={`rounded px-2 py-1 text-xs
                            ${
                              line.movement_type.includes("IN")
                                ? "bg-green-100 text-green-700"
                                : line.movement_type.includes("OUT")
                                  ? "bg-red-100 text-red-700"
                                  : "bg-orange-100 text-orange-700"
                            }`}
                    >
                      {getMovementLabel(line.movement_type)}
                    </span>
                  </td>

                  <td className="border p-2">
                    {line.store?.code} - {line.store?.name}
                  </td>

                  <td className="border p-2 text-right">
                    {quantity(
                      Number(line.quantity_in ?? 0) > 0
                        ? Number(line.quantity_in ?? 0)
                        : Number(line.quantity_out ?? 0),
                    )}
                  </td>

                  <td className="border p-2 text-right">
                    {quantity(line.quantity_after)}
                  </td>

                  <td className="border p-2 text-right">
                    {money(line.average_cost_after)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <table>
              <tbody>
                <tr>
                  <td className="pr-6 font-medium">Total Nilai</td>
                  <td className="text-right font-semibold">
                    {money(
                      row.items.reduce(
                        (sum: number, item: MovementDetailItem) =>
                          sum +
                          (Number(item.qty_in ?? 0) +
                            Number(item.qty_out ?? 0)) *
                            Number(item.cost ?? 0),
                        0,
                      ),
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <details className="mt-4 rounded border p-3">
            <summary className="cursor-pointer font-medium">Log Info</summary>

            <table className="mt-3 w-full border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">Movement ID</th>
                  <th className="border p-2">Reference</th>
                  <th className="border p-2">Created By</th>
                  <th className="border p-2">Created At</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((line: MovementHistoryRow) => (
                  <tr key={line.id}>
                    <td className="border p-2">{line.id}</td>
                    <td className="border p-2">{line.reference}</td>
                    <td className="border p-2">{line.created_by ?? "-"}</td>
                    <td className="border p-2">
                      {getWIBTimestampFromUTC(line.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <div className="flex justify-end gap-2 border-t p-4">
            <button
              type="button"
              onClick={handlePrintDetail}
              className="inline-flex items-center gap-2 rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              🖨 Print
            </button>

            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(row.reference ?? "")}
              className="rounded border px-4 py-2"
            >
              Copy Reference
            </button>

            <button
              type="button"
              onClick={() => onClose()}
              className="rounded bg-blue-600 px-4 py-2 text-white"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
