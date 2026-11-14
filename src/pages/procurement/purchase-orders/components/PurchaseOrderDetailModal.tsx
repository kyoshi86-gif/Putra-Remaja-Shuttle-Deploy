import type {
  PurchaseOrder,
  PurchaseOrderLineForm,
} from "../types";

interface PurchaseOrderDetailModalProps {
  open: boolean;

  purchaseOrder: PurchaseOrder | null;

  lines: PurchaseOrderLineForm[];

  onClose: () => void;

  canViewSupplier: boolean;

  canManageSupplier: boolean;

  canViewFinancial: boolean;
}

function formatCurrency(
  value: number | null | undefined,
) {
  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    },
  ).format(
    Number(value ?? 0),
  );
}

function formatNumber(
  value: number | null | undefined,
) {
  return new Intl.NumberFormat(
    "id-ID",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    },
  ).format(
    Number(value ?? 0),
  );
}

function formatDate(
  value: string | null | undefined,
) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "id-ID",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  ).format(
    new Date(
      `${value}T00:00:00`,
    ),
  );
}

export default function PurchaseOrderDetailModal({
  open,
  purchaseOrder,
  lines,
  onClose,
  canViewSupplier,
  canManageSupplier,
  canViewFinancial,
}: PurchaseOrderDetailModalProps) {
  if (
    !open ||
    !purchaseOrder
  ) {
    return null;
  }

  const lineCount =
    canViewFinancial
      ? 9
      : 5;

  const detailSubtotal = lines.reduce(
    (total, line) =>
      total + Number(line.quantity_ordered ?? 0) * Number(line.unit_price ?? 0),
    0,
  );

  const detailDiscount = lines.reduce(
    (total, line) => total + Number(line.discount_amount ?? 0),
    0,
  );

  const detailTax = lines.reduce(
    (total, line) => total + Number(line.tax_amount ?? 0),
    0,
  );

  const detailGrandTotal = detailSubtotal - detailDiscount + detailTax;

 return (
  <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 sm:p-6 md:p-10">
    <div className="flex w-full max-w-[1100px] max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-lg bg-white shadow-xl sm:max-h-[calc(100vh-3rem)] md:max-h-[calc(100vh-5rem)]">
  
        {/* ==============================================
            HEADER
        =============================================== */}

        <div className="flex shrink-0 items-center justify-between border-b p-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Detail Purchase Order</h2>
            <p className="mt-1 text-sm text-gray-500">{purchaseOrder.po_number}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ✕
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-6">
            {/* INFORMASI PO */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <InfoItem label="Nomor PO" value={purchaseOrder.po_number} />
              <InfoItem label="Tanggal PO" value={formatDate(purchaseOrder.order_date)} />
              <InfoItem label="Status" value={purchaseOrder.status} />

              {/* SUPPLIER */}
              {canViewSupplier && (
                <InfoItem label="Supplier" value={purchaseOrder.supplier_name_snapshot ?? "-"} />
              )}

              <InfoItem label="Store Tujuan" value={purchaseOrder.store_name ?? "-"} />

              {/* ESTIMASI BARANG DATANG */}
              {canManageSupplier && (
                <InfoItem
                  label="Estimasi Barang Datang"
                  value={formatDate(purchaseOrder.expected_delivery_date)}
                />
              )}
            </div>

            {/* ==========================================
                DETAIL ITEM
            =========================================== */}

            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Detail Item</h3>
              <span className="text-sm text-gray-500">{lines.length} Item</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border-b px-3 py-3">No</th>
                    <th className="border-b px-3 py-3">Kode</th>
                    <th className="border-b px-3 py-3">Artikel</th>
                    <th className="border-b px-3 py-3 text-right">Qty</th>
                    <th className="border-b px-3 py-3">Satuan</th>
                    {canViewFinancial && (
                      <>
                        <th className="border-b px-3 py-3 text-right">Harga</th>
                        <th className="border-b px-3 py-3 text-right">Diskon</th>
                        <th className="border-b px-3 py-3 text-right">Pajak</th>
                        <th className="border-b px-3 py-3 text-right">Total</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={lineCount}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        Detail item tidak ditemukan.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line, index) => {
                      const quantity = Number(line.quantity_ordered ?? 0);
                      const unitPrice = Number(line.unit_price ?? 0);
                      const discount = Number(line.discount_amount ?? 0);
                      const tax = Number(line.tax_amount ?? 0);
                      const lineSubtotal = quantity * unitPrice;
                      const lineTotal = lineSubtotal - discount + tax;

                      return (
                        <tr key={`${line.item_id}-${index}`} className="hover:bg-gray-50">
                          <td className="border-b px-3 py-3 text-center">{index + 1}</td>
                          <td className="border-b px-3 py-3">{line.item_code_snapshot ?? "-"}</td>
                          <td className="border-b px-3 py-3">{line.item_name_snapshot ?? "-"}</td>
                          <td className="border-b px-3 py-3 text-right">{formatNumber(quantity)}</td>
                          <td className="border-b px-3 py-3">{line.unit_code_snapshot ?? "-"}</td>
                          {canViewFinancial && (
                            <>
                              <td className="border-b px-3 py-3 text-right">{formatCurrency(unitPrice)}</td>
                              <td className="border-b px-3 py-3 text-right">{formatCurrency(discount)}</td>
                              <td className="border-b px-3 py-3 text-right">{formatCurrency(tax)}</td>
                              <td className="border-b px-3 py-3 text-right font-medium">
                                {formatCurrency(lineTotal)}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>


            {/* ==========================================
                TOTAL
                TIDAK ADA SAMA SEKALI BAGI USER BIASA
            =========================================== */}

            {canViewFinancial && (
              <div className="flex justify-end">
                <div className="w-full max-w-sm space-y-2 rounded-lg border bg-gray-50 p-4">
                  <TotalRow label="Subtotal" value={formatCurrency(detailSubtotal)} />
                  <TotalRow label="Diskon" value={formatCurrency(detailDiscount)} />
                  <TotalRow label="Pajak" value={formatCurrency(detailTax)} />

                  <div className="flex justify-between border-t pt-3 font-semibold">
                    <span>Grand Total</span>
                    <span>{formatCurrency(detailGrandTotal)}</span>
                  </div>
                </div>
              </div>
            )}
            {/* ==========================================
                CATATAN
            =========================================== */}

            <div>
              <div className="text-sm font-medium text-gray-700">Catatan</div>
                <div className="mt-1 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                  {purchaseOrder.notes || "-"}
                </div>
            </div>
          </div>
        </div>

        {/* ==============================================
            FOOTER
        =============================================== */}

        <div className="flex shrink-0 justify-end border-t p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 font-medium text-gray-900">{value}</div>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
