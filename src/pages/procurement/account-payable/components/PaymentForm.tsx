import { useMemo, useState } from "react";

import type {
  ApPaymentFormData,
  ApPaymentAllocation,
  SupplierOption,
} from "../types";

import type { ApOutstandingInvoice, ApPaymentSettlementMethod } from "../types";

type SupplierDeposit = {
  id: string;
  supplier_id: string;
  reference: string | null;
  description: string | null;
  original_amount: number;
  allocated_amount: number;
  status: string;
};

type PaymentFormProps = {
  suppliers: SupplierOption[];

  settlementMethods: ApPaymentSettlementMethod[];

  outstandingInvoices: ApOutstandingInvoice[];

  deposits?: SupplierDeposit[];

  loadingInvoices?: boolean;

  saving?: boolean;

  initialData?: ApPaymentFormData | null;

  onSupplierChange: (supplierId: string) => void;

  onSubmit: (data: ApPaymentFormData) => Promise<void>;

  onCancel: () => void;
};

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export default function PaymentForm({
  suppliers,
  settlementMethods,
  outstandingInvoices,
  deposits = [],
  loadingInvoices = false,
  saving = false,
  initialData = null,
  onSupplierChange,
  onSubmit,
  onCancel,
}: PaymentFormProps) {
  const [supplierId, setSupplierId] = useState(initialData?.supplier_id ?? "");

  const [paymentDate, setPaymentDate] = useState(
    initialData?.payment_date ?? new Date().toISOString().slice(0, 10),
  );

  const [paymentMethodId, setPaymentMethodId] = useState(
    initialData?.payment_method_id ?? "",
  );

  const [referenceNumber, setReferenceNumber] = useState(
    initialData?.reference_number ?? "",
  );

  const [notes, setNotes] = useState(initialData?.notes ?? "");

  const [allocations, setAllocations] = useState<
    Record<
      string,
      {
        checked: boolean;
        amount: number;
        depositId: string;
      }
    >
  >(() => {
    const result: Record<
      string,
      {
        checked: boolean;
        amount: number;
        depositId: string;
      }
    > = {};

    for (const item of initialData?.allocations ?? []) {
      result[item.invoice_id] = {
        checked: true,
        amount: Number(item.amount),
        depositId: item.deposit_id ?? "",
      };
    }

    return result;
  });

  const selectedMethod = settlementMethods.find(
    (item) => item.id === paymentMethodId,
  );

  const isDeposit = selectedMethod?.settlement_type === "DEPOSIT";

  const selectedInvoices = useMemo(() => {
    return outstandingInvoices.filter(
      (invoice) => allocations[invoice.id]?.checked,
    );
  }, [outstandingInvoices, allocations]);

  const totalAmount = useMemo(() => {
    return selectedInvoices.reduce((total, invoice) => {
      return total + Number(allocations[invoice.id]?.amount ?? 0);
    }, 0);
  }, [selectedInvoices, allocations]);

  const handleSupplierChange = (value: string) => {
    setSupplierId(value);

    setAllocations({});

    onSupplierChange(value);
  };

  const toggleInvoice = (invoiceId: string, checked: boolean) => {
    const invoice = outstandingInvoices.find((item) => item.id === invoiceId);

    if (!invoice) return;

    setAllocations((current) => ({
      ...current,

      [invoiceId]: {
        checked,
        amount: checked
          ? Number(current[invoiceId]?.amount ?? invoice.remaining_amount)
          : 0,
        depositId: current[invoiceId]?.depositId ?? "",
      },
    }));
  };

  const changeAmount = (invoiceId: string, value: string) => {
    const amount = Number(value);

    setAllocations((current) => ({
      ...current,

      [invoiceId]: {
        checked: current[invoiceId]?.checked ?? true,
        amount: Number.isFinite(amount) ? amount : 0,
        depositId: current[invoiceId]?.depositId ?? "",
      },
    }));
  };

  const changeDeposit = (invoiceId: string, depositId: string) => {
    setAllocations((current) => ({
      ...current,

      [invoiceId]: {
        checked: current[invoiceId]?.checked ?? true,
        amount: current[invoiceId]?.amount ?? 0,
        depositId,
      },
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!supplierId) {
      alert("Supplier wajib dipilih.");
      return;
    }

    if (!paymentDate) {
      alert("Tanggal pembayaran wajib diisi.");
      return;
    }

    if (!paymentMethodId) {
      alert("Metode pembayaran wajib dipilih.");
      return;
    }

    if (selectedInvoices.length === 0) {
      alert("Pilih minimal satu invoice.");
      return;
    }

    const finalAllocations: ApPaymentAllocation[] = [];

    for (const invoice of selectedInvoices) {
      const amount = Number(allocations[invoice.id]?.amount ?? 0);

      if (amount <= 0) {
        alert(
          `Nominal pembayaran invoice ${invoice.invoice_number} harus lebih dari 0.`,
        );
        return;
      }

      if (amount > Number(invoice.remaining_amount)) {
        alert(
          `Nominal pembayaran invoice ${invoice.invoice_number} melebihi outstanding.`,
        );
        return;
      }

      const depositId = allocations[invoice.id]?.depositId ?? "";

      if (isDeposit && !depositId) {
        alert(`Pilih Deposit untuk invoice ${invoice.invoice_number}.`);
        return;
      }

      finalAllocations.push({
        invoice_id: invoice.id,
        amount,
        deposit_id: isDeposit ? depositId : null,
      });
    }

    await onSubmit({
      supplier_id: supplierId,

      payment_date: paymentDate,

      payment_method_id: paymentMethodId,

      reference_number: referenceNumber.trim(),

      notes: notes.trim(),

      allocations: finalAllocations,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* HEADER */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Supplier</label>

          <select
            value={supplierId}
            onChange={(event) => handleSupplierChange(event.target.value)}
            disabled={saving}
            className="w-full rounded-lg border px-3 py-2"
          >
            <option value="">Pilih Supplier</option>

            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} - {supplier.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Tanggal Pembayaran
          </label>

          <input
            type="date"
            value={paymentDate}
            onChange={(event) => setPaymentDate(event.target.value)}
            disabled={saving}
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Metode Pembayaran
          </label>

          <select
            value={paymentMethodId}
            onChange={(event) => setPaymentMethodId(event.target.value)}
            disabled={saving}
            className="w-full rounded-lg border px-3 py-2"
          >
            <option value="">Pilih Metode Pembayaran</option>

            {settlementMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            No. Referensi
          </label>

          <input
            type="text"
            value={referenceNumber}
            onChange={(event) => setReferenceNumber(event.target.value)}
            placeholder="No. transfer / referensi"
            disabled={saving}
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">Catatan</label>

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            disabled={saving}
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>
      </div>

      {/* INVOICE */}
      <div className="rounded-xl border">
        <div className="border-b bg-gray-50 px-4 py-3">
          <div className="font-semibold">Invoice Outstanding</div>

          <div className="text-xs text-gray-500">
            Pilih satu atau beberapa invoice yang akan dibayar.
          </div>
        </div>

        {loadingInvoices ? (
          <div className="p-6 text-center text-gray-500">Memuat invoice...</div>
        ) : !supplierId ? (
          <div className="p-6 text-center text-gray-500">
            Pilih supplier terlebih dahulu.
          </div>
        ) : outstandingInvoices.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            Tidak ada invoice outstanding.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b bg-white">
                  <th className="w-12 px-3 py-3 text-center">Pilih</th>

                  <th className="px-3 py-3 text-left">Invoice</th>

                  <th className="px-3 py-3 text-left">Tanggal</th>

                  <th className="px-3 py-3 text-left">Jatuh Tempo</th>

                  <th className="px-3 py-3 text-right">Grand Total</th>

                  <th className="px-3 py-3 text-right">Outstanding</th>

                  <th className="px-3 py-3 text-right">Dibayar</th>

                  {isDeposit && (
                    <th className="px-3 py-3 text-left">Deposit</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {outstandingInvoices.map((invoice) => {
                  const state = allocations[invoice.id];

                  const checked = state?.checked ?? false;

                  return (
                    <tr key={invoice.id} className="border-b last:border-b-0">
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            toggleInvoice(invoice.id, event.target.checked)
                          }
                          disabled={saving}
                        />
                      </td>

                      <td className="px-3 py-3 font-medium">
                        {invoice.invoice_number}
                      </td>

                      <td className="px-3 py-3">{invoice.invoice_date}</td>

                      <td className="px-3 py-3">{invoice.due_date || "-"}</td>

                      <td className="px-3 py-3 text-right">
                        {formatCurrency(invoice.grand_total)}
                      </td>

                      <td className="px-3 py-3 text-right font-semibold">
                        {formatCurrency(invoice.remaining_amount)}
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min={0}
                          max={invoice.remaining_amount}
                          step={1}
                          value={state?.amount ?? 0}
                          onChange={(event) =>
                            changeAmount(invoice.id, event.target.value)
                          }
                          disabled={saving || !checked}
                          className="w-40 rounded-lg border px-3 py-2 text-right"
                        />
                      </td>

                      {isDeposit && (
                        <td className="px-3 py-3">
                          <select
                            value={state?.depositId ?? ""}
                            onChange={(event) =>
                              changeDeposit(invoice.id, event.target.value)
                            }
                            disabled={saving || !checked}
                            className="w-56 rounded-lg border px-3 py-2"
                          >
                            <option value="">Pilih Deposit</option>

                            {deposits
                              .filter(
                                (deposit) =>
                                  deposit.supplier_id === supplierId &&
                                  ["OPEN", "PARTIAL"].includes(deposit.status),
                              )
                              .map((deposit) => {
                                const available =
                                  Number(deposit.original_amount) -
                                  Number(deposit.allocated_amount);

                                return (
                                  <option key={deposit.id} value={deposit.id}>
                                    {deposit.reference || "Deposit"} -{" "}
                                    {formatCurrency(available)}
                                  </option>
                                );
                              })}
                          </select>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TOTAL */}
      <div className="flex items-center justify-between rounded-xl border bg-gray-50 px-5 py-4">
        <div>
          <div className="text-sm text-gray-500">Total Pembayaran</div>

          <div className="text-2xl font-bold">
            {formatCurrency(totalAmount)}
          </div>
        </div>

        <div className="text-right text-sm text-gray-500">
          {selectedInvoices.length} invoice dipilih
        </div>
      </div>

      {/* ACTION */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border px-5 py-2.5 hover:bg-gray-50"
        >
          Batal
        </button>

        <button
          type="submit"
          disabled={saving || selectedInvoices.length === 0 || totalAmount <= 0}
          className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan Pembayaran"}
        </button>
      </div>
    </form>
  );
}
