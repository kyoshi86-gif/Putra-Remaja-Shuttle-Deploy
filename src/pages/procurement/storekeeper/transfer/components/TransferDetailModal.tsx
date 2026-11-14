import { useEffect } from "react";
import { getWIBTimestampFromUTC } from "@/utils/time";
import { money, quantity } from "../../../utils/format";
import { useMovementDetail } from "../../hooks/useMovementDetail";
import type { TransferDocument } from "../types";

interface Props {
  open: boolean;
  row: TransferDocument | null;
  onClose: () => void;
}

export default function TransferDetailModal({ open, row, onClose }: Props) {
  const { rows, loadDetail } = useMovementDetail();

  useEffect(() => {
    if (!open || !row?.reference) return;
    loadDetail(row.reference);
  }, [open, row?.reference, loadDetail]);

  if (!open || !row) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 px-4 py-10">
     <div className="mx-auto my-4 w-full max-w-[1100px] max-h-[calc(100vh-7rem)] overflow-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Detail Transfer</h2>
          <button onClick={onClose} className="rounded border px-3 py-1">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5 p-5">
          {/* Info Grid */}
          <div className="grid grid-cols-3 gap-4">
            <Info label="No Transfer" value={row.reference} />
            <Info label="Tanggal" value={row.movement_date} />
            <Info
              label="Posting"
              value={getWIBTimestampFromUTC(row.created_at)}
            />
            <Info label="User" value={row.created_by ?? "-"} />
            <Info
              label="Gudang Asal"
              value={
                row.fromStore
                  ? `${row.fromStore.code} - ${row.fromStore.name}`
                  : "-"
              }
            />
            <Info
              label="Gudang Tujuan"
              value={
                row.toStore ? `${row.toStore.code} - ${row.toStore.name}` : "-"
              }
            />
          </div>

          {/* Items Table */}
          <Table
            headers={["No", "Kode", "Artikel", "Satuan", "Qty", "Nilai"]}
            rows={row.items.map((item, i) => [
              i + 1,
              item.code,
              item.name,
              item.unit_code ?? "-",
              quantity(item.qty),
              money(item.value),
            ])}
          />

          {/* Movement History */}
          <h3 className="font-semibold">Riwayat Movement</h3>
          <Table
            headers={["Movement", "Store", "Qty", "Saldo", "Avg Cost"]}
            rows={rows.map((line) => [
              line.movement_type,
              `${line.store?.code} - ${line.store?.name}`,
              quantity(
                Number(line.quantity_in ?? 0) > 0
                  ? Number(line.quantity_in ?? 0)
                  : Number(line.quantity_out ?? 0),
              ),
              quantity(line.quantity_after),
              money(line.average_cost_after),
            ])}
          />

          {/* Footer Actions */}
          <div className="flex justify-end border-t pt-4 gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(row.reference)}
              className="rounded border px-4 py-2"
            >
              Copy Reference
            </button>
            <button
              onClick={onClose}
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

/* Helper Components */
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full border">
      <thead>
        <tr className="bg-slate-100">
          {headers.map((h, i) => (
            <th
              key={i}
              className={`border p-2 ${i >= headers.length - 2 ? "text-right" : ""}`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td
                key={j}
                className={`border p-2 ${j === 0 ? "text-center" : j >= headers.length - 2 ? "text-right" : ""}`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
