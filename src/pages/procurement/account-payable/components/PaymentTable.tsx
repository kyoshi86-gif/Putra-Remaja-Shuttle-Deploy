import { Eye, Pencil, Trash2 } from "lucide-react";

import type { ApPayment } from "../types";

type PaymentRequestLookup = {
  id: string;
  payment_request_number?: string | null;
};

type PaymentMethodLookup = {
  id: string;
  code?: string | null;
  name?: string | null;
};

type PaymentTableProps = {
  payments: ApPayment[];

  // Tetap dipertahankan agar pemanggilan lama tidak langsung error.
  // Supplier tidak lagi ditampilkan di tabel utama.
  suppliers?: {
    id: string;
    code: string;
    name: string;
  }[];

  paymentRequests?: PaymentRequestLookup[];
  paymentMethods?: PaymentMethodLookup[];

  loading?: boolean;

  onDetail?: (payment: ApPayment) => void;
  onEdit?: (payment: ApPayment) => void;
  onDelete?: (payment: ApPayment) => void;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export default function PaymentTable({
  payments,
  paymentRequests = [],
  paymentMethods = [],
  loading = false,
  onDetail,
  onEdit,
  onDelete,
}: PaymentTableProps) {
  const getPaymentVoucher = (payment: ApPayment) => {
    if (!payment.payment_request_id) return "-";

    const request = paymentRequests.find(
      (item) => item.id === payment.payment_request_id,
    );

    return request?.payment_request_number ?? "-";
  };

  const getPaymentMethod = (payment: ApPayment) => {
    if (!payment.payment_method_id) return "-";

    const method = paymentMethods.find(
      (item) => item.id === payment.payment_method_id,
    );

    if (!method) return "-";

    if (method.code && method.name) {
      return `${method.code} — ${method.name}`;
    }

    return method.code ?? method.name ?? "-";
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-gray-500">
        Memuat data pembayaran...
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-gray-500">
        Belum ada transaksi AP Payment.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl border bg-white">
      <table className="min-w-[1180px] w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="px-4 py-3 text-left font-semibold">No. Payment</th>

            <th className="px-4 py-3 text-left font-semibold">
              Payment Voucher
            </th>

            <th className="px-4 py-3 text-left font-semibold">Tanggal</th>

            <th className="px-4 py-3 text-left font-semibold">
              Metode Pembayaran
            </th>

            <th className="px-4 py-3 text-left font-semibold">Reference</th>

            <th className="px-4 py-3 text-right font-semibold">
              Total Payment
            </th>

            <th className="w-[150px] px-4 py-3 text-center font-semibold">
              Aksi
            </th>
          </tr>
        </thead>

        <tbody>
          {payments.map((payment) => (
            <tr
              key={payment.id}
              className="border-b last:border-b-0 hover:bg-gray-50"
            >
              <td className="px-4 py-3 font-medium">
                {payment.payment_number || "-"}
              </td>

              <td className="px-4 py-3 font-medium">
                {getPaymentVoucher(payment)}
              </td>

              <td className="px-4 py-3">{formatDate(payment.payment_date)}</td>

              <td className="px-4 py-3">{getPaymentMethod(payment)}</td>

              <td className="px-4 py-3">{payment.reference_number || "-"}</td>

              <td className="px-4 py-3 text-right font-semibold">
                {formatCurrency(payment.amount)}
              </td>

              <td className="px-4 py-3">
                <div className="flex items-center justify-center gap-1">
                  {onDetail && (
                    <button
                      type="button"
                      onClick={() => onDetail(payment)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                      title="Detail"
                    >
                      <Eye size={16} />
                    </button>
                  )}

                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(payment)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                  )}

                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(payment)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50"
                      title="Hapus"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
