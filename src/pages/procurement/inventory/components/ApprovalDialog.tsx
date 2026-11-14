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
  note: string;
  onNoteChange: (value: string) => void;
  onQtyChange: (index: number, qty: number) => void;
  onClose: () => void;
  onApprove: () => void;
  saving?: boolean;
}
export default function ApprovalDialog({
  open,
  request,
  details,
  items,
  note,
  onNoteChange,
  onQtyChange,
  onClose,
  onApprove,
  saving = false,
}: Props) {
  if (!open || !request) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[900px] rounded-lg bg-white shadow-lg">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Approval Inventory Request</h2>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <b>No Request :</b> {request.request_no}
            </div>
            <div>
              <b>Tanggal :</b> {request.request_date}
            </div>
            <div>
              <b>Gudang Asal :</b> {request.source_store_name}
            </div>
            <div>
              <b>Gudang Tujuan :</b> {request.destination_store_name}
            </div>
          </div>
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Item</th>
                  <th className="p-2 text-right">Request</th>
                  <th className="p-2 text-right">Approved</th>
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
                      <td className="p-2 text-right">{row.qty_request}</td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.0001"
                          value={row.qty_approved}
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
          <div>
            <label className="mb-1 block">Catatan</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              className="w-full rounded border p-2"
            />
          </div>
        </div>
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
                if (row.qty_approved <= 0) {
                  alert("Qty Approved harus lebih dari 0.");
                  return;
                }

                if (row.qty_approved > row.qty_request) {
                  alert("Qty Approved tidak boleh melebihi Qty Request.");
                  return;
                }
              }

              onApprove();
            }}
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
