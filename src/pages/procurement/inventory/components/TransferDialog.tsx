import type {
  InventoryRequest,
  InventoryRequestLineForm,
  ItemOption,
} from "../types";

interface Props {
  open: boolean;
  request: InventoryRequest | null;
  details: InventoryRequestLineForm[];
  items: ItemOption[];
  onQtyChange: (index: number, qty: number) => void;
  onClose: () => void;
  onTransfer: () => void;
  saving?: boolean;
}

export default function TransferDialog({
  open,
  request,
  details,
  items,
  onQtyChange,
  onClose,
  onTransfer,
  saving = false,
}: Props) {
  if (!open || !request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[900px] rounded-lg bg-white shadow-lg">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Transfer Inventory</h2>
        </div>

        {/* Body */}
        <div className="space-y-4 p-6">
          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <b>No :</b> {request.request_no}
            </div>
            <div>
              <b>Tanggal :</b> {request.request_date}
            </div>
            <div>
              <b>Asal :</b> {request.source_store_name}
            </div>
            <div>
              <b>Tujuan :</b> {request.destination_store_name}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-auto rounded border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2">Item</th>
                  <th className="p-2 text-right">Approved</th>
                  <th className="p-2">Transfer</th>
                </tr>
              </thead>
              <tbody>
                {details.map((row, index) => {
                  const item = items.find((x) => x.id === row.item_id);
                  return (
                    <tr key={index} className="border-t">
                      <td className="p-2">
                        {item?.code} - {item?.name}
                      </td>
                      <td className="p-2 text-right">{row.qty_approved}</td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.0001"
                          value={row.qty_transfer}
                          onChange={(e) =>
                            onQtyChange(index, Number(e.target.value))
                          }
                          className="w-28 rounded border px-2 py-1 text-right"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded border px-4 py-2"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              for (const row of details) {
                if (row.qty_transfer <= 0) {
                  alert("Qty Transfer harus lebih dari 0.");
                  return;
                }

                if (row.qty_transfer > row.qty_approved) {
                  alert("Qty Transfer tidak boleh melebihi Qty Approved.");
                  return;
                }
              }
              onTransfer();
            }}
            className="rounded bg-green-600 px-4 py-2 text-white"
          >
            Transfer
          </button>
        </div>
      </div>
    </div>
  );
}
