import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import Pagination from "@/components/common/Pagination";
import { createPaginationMeta } from "@/lib/pagination/types";
import { hasAccess } from "@/lib/hasAccess";
import { getCustomUser } from "@/lib/authUser";
import { supabase } from "@/lib/supabaseClient";
import { formatReportDateRange } from "@/utils/exportReport";
import { useApPayments } from "./hooks/useApPayments";
import type {
  ApPayment,
  ApPaymentFormData,
  ApprovedPaymentRequest,
} from "./types";

/**
 * ============================================================
 * HELPERS
 * ============================================================
 */

function todayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;

  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

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

/**
 * ============================================================
 * PAYMENT DETAIL
 * ============================================================
 */

type PaymentDetail = {
  payment: ApPayment;

  allocations: {
    invoice_id: string;
    invoice_number: string;
    invoice_date: string;
    grand_total: number;
    amount: number;

    supplier_name: string;
    supplier_code: string;
    receiving_number: string;
  }[];
};

/**
 * ============================================================
 * PAGE
 * ============================================================
 */

export function PaymentPage() {
  const {
    payments,

    settlementMethods,

    saving,
    error,

    approvedPaymentRequests,
    loadingPaymentRequests,
    paymentRequests,

    createPayment,
    updatePayment,
    deletePayment,
    fetchPayments,
    fetchPaymentsForExport,
    paymentsTotalCount,
  } = useApPayments();

  /**
   * ==========================================================
   * ACCESS
   * ==========================================================
   */

  const [access, setAccess] = useState({
    create: false,
    edit: false,
    delete: false,
    export: false,
  });

  /**
   * ==========================================================
   * STATE
   * ==========================================================
   */

  const [search, setSearch] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [selectedPaymentRequestId, setSelectedPaymentRequestId] = useState("");

  const [formData, setFormData] = useState<ApPaymentFormData | null>(null);

  const [detailPayment, setDetailPayment] = useState<PaymentDetail | null>(
    null,
  );

  const [loadingDetail, setLoadingDetail] = useState(false);

  const [editingPayment, setEditingPayment] = useState<ApPayment | null>(null);

  const [editForm, setEditForm] = useState<{
    payment_date: string;
    payment_method_id: string;
    reference_number: string;
    notes: string;
    allocations: {
      invoice_id: string;
      amount: number;
      deposit_id: string | null;
    }[];
  } | null>(null);

  /**
   * ==========================================================
   * ACCESS
   * ==========================================================
   */

  useEffect(() => {
    async function loadAccess() {
      const [create, edit, remove, exportExcel] = await Promise.all([
        hasAccess("ap_payment.create"),
        hasAccess("ap_payment.edit"),
        hasAccess("ap_payment.delete"),
        hasAccess("ap_payment.export"),
      ]);

      setAccess({
        create,
        edit,
        delete: remove,
        export: exportExcel,
      });
    }

    void loadAccess();
  }, []);

  /**
   * ==========================================================
   * SERVER-SIDE PAYMENT LIST
   * ==========================================================
   */

  const loadPaymentPage = async (
    targetPage = page,
    targetPageSize = pageSize,
  ) => {
    await fetchPayments(search, dateFrom, dateTo, targetPage, targetPageSize);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPaymentPage(page, pageSize);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search, dateFrom, dateTo, page, pageSize, fetchPayments]);

  const paginationMeta = useMemo(
    () => createPaginationMeta(page, pageSize, paymentsTotalCount),
    [page, pageSize, paymentsTotalCount],
  );

  /**
   * ==========================================================
   * SELECTED PV
   * ==========================================================
   */

  const selectedPaymentRequest = useMemo<ApprovedPaymentRequest | null>(() => {
    if (!selectedPaymentRequestId) {
      return null;
    }

    return (
      approvedPaymentRequests.find(
        (request) => request.id === selectedPaymentRequestId,
      ) ?? null
    );
  }, [approvedPaymentRequests, selectedPaymentRequestId]);

  /**
   * ==========================================================
   * PV ITEMS
   * ==========================================================
   */

  const selectedItems = selectedPaymentRequest?.items ?? [];

  /**
   * ==========================================================
   * TOTAL
   * ==========================================================
   */

  const selectedTotal = selectedItems.reduce(
    (total, item) => total + Number(item.requested_amount || 0),
    0,
  );

  /**
   * ==========================================================
   * PAYMENT METHODS FOR AP PAYMENT
   * ==========================================================
   *
   * DEPOSIT tidak digunakan di Payment Page.
   * Deposit sudah diproses pada Receiving.
   *
   * Jangan filter settlementMethods dari hook karena
   * data tersebut juga dapat digunakan oleh proses lain.
   */
  const paymentSettlementMethods = useMemo(
    () =>
      settlementMethods.filter(
        (method) => method.settlement_type !== "DEPOSIT",
      ),
    [settlementMethods],
  );

  /**
   * ==========================================================
   * INITIAL FORM
   * ==========================================================
   */

  const createInitialForm = (): ApPaymentFormData => ({
    entity_id: getCustomUser()?.entity_id ?? null,

    supplier_id: null,

    payment_request_id: null,

    payment_date: todayInputValue(),

    payment_method_id: "",

    reference_number: "",

    notes: "",

    allocations: [],
  });

  /**
   * ==========================================================
   * OPEN PAYMENT
   * ==========================================================
   */

  const openPaymentForm = () => {
    setDetailPayment(null);

    setSelectedPaymentRequestId("");

    setFormData(createInitialForm());
  };

  /**
   * ==========================================================
   * CANCEL PAYMENT FORM
   * ==========================================================
   */

  const cancelPaymentForm = () => {
    setSelectedPaymentRequestId("");

    setFormData(null);
  };

  /**
   * ==========================================================
   * SELECT PV
   * ==========================================================
   */

  const handlePaymentRequestChange = (paymentRequestId: string) => {
    setSelectedPaymentRequestId(paymentRequestId);

    if (!paymentRequestId) {
      setFormData(createInitialForm());

      return;
    }

    const request = approvedPaymentRequests.find(
      (item) => item.id === paymentRequestId,
    );

    if (!request) {
      setFormData(createInitialForm());

      return;
    }

    /**
     * --------------------------------------------------------
     * Allocation otomatis dari PV.
     *
     * Tidak ada lagi user memilih invoice.
     * --------------------------------------------------------
     */

    const allocations = request.items
      .filter((item) => Boolean(item.ap_invoice_id))
      .map((item) => ({
        invoice_id: item.ap_invoice_id!,
        amount: Number(item.requested_amount || 0),
        deposit_id: null,
      }));

    setFormData({
      entity_id: request.entity_id,

      supplier_id: null,

      payment_request_id: request.id,

      payment_date: todayInputValue(),

      payment_method_id: "",

      reference_number: "",

      notes: request.notes ?? "",

      allocations,
    });
  };

  /**
   * ==========================================================
   * SUBMIT PAYMENT
   * ==========================================================
   */

  const handleSubmit = async () => {
    if (!formData) {
      return;
    }

    if (!formData.payment_request_id) {
      window.alert("Payment Voucher wajib dipilih.");

      return;
    }

    if (!formData.payment_method_id) {
      window.alert("Metode pembayaran wajib dipilih.");

      return;
    }

    if (formData.allocations.length === 0) {
      window.alert(
        "Payment Voucher tidak memiliki invoice yang dapat dibayar.",
      );

      return;
    }

    /**
     * Pastikan allocation =
     * total PV.
     */

    const allocationTotal = formData.allocations.reduce(
      (total, item) => total + Number(item.amount || 0),
      0,
    );

    if (allocationTotal !== selectedTotal) {
      window.alert(
        `Total allocation ${formatCurrency(
          allocationTotal,
        )} tidak sama dengan total Payment Voucher ${formatCurrency(
          selectedTotal,
        )}.`,
      );

      return;
    }

    console.log("=== PAYMENT SUBMIT ===");

    console.log("formData:", formData);

    console.log("payment_request_id:", formData.payment_request_id);

    console.log("payment_date:", formData.payment_date);

    console.log("payment_method_id:", formData.payment_method_id);

    console.log("supplier_id:", formData.supplier_id);

    console.log("allocations:", formData.allocations);

    const result = await createPayment(formData);

    if (!result?.success) {
      return;
    }

    window.alert(`Pembayaran ${result.payment_number ?? ""} berhasil dibuat.`);

    /**
     * --------------------------------------------------------
     * Reset.
     * --------------------------------------------------------
     */

    setFormData(null);

    setSelectedPaymentRequestId("");

    /*
     * createPayment() sudah melakukan refresh payment dan
     * Payment Voucher setelah RPC berhasil. Jangan fetch ulang
     * di sini karena bisa membuat dua request bersamaan dan
     * menimpa state/error dari hook.
     */
  };

  /**
   * ==========================================================
   * LOAD PAYMENT DETAIL
   * ==========================================================
   */

  const loadPaymentDetail = async (payment: ApPayment) => {
    setLoadingDetail(true);
    setDetailPayment(null);

    /**
     * ------------------------------------------------------
     * Ambil allocation
     * ------------------------------------------------------
     */

    const { data, error: detailError } = await supabase
      .from("ap_payment_allocations")
      .select(
        `
          invoice_id:ap_invoice_id,
          amount,
          ap_invoices:ap_invoice_id (
            invoice_number,
            invoice_date,
            grand_total,
            supplier_id,
            receiving_record_id
          )
        `,
      )
      .eq("ap_payment_id", payment.id);

    if (detailError) {
      window.alert(detailError.message);

      setLoadingDetail(false);

      return;
    }

    const rows = data ?? [];

    /**
     * ------------------------------------------------------
     * Supplier
     * ------------------------------------------------------
     */

    const invoiceSupplierIds = rows
      .map((row) => {
        const relation = row.ap_invoices;

        const invoice = Array.isArray(relation)
          ? (relation[0] ?? null)
          : (relation ?? null);

        return invoice?.supplier_id;
      })
      .filter((id): id is string => Boolean(id));

    let supplierData: {
      id: string;
      code: string | null;
      name: string | null;
    }[] = [];

    if (invoiceSupplierIds.length > 0) {
      const { data: suppliers, error: supplierError } = await supabase
        .from("suppliers")
        .select("id, code, name")
        .in("id", invoiceSupplierIds);

      if (supplierError) {
        window.alert(supplierError.message);

        setLoadingDetail(false);

        return;
      }

      supplierData = suppliers ?? [];
    }

    /**
     * ------------------------------------------------------
     * Receiving
     * ------------------------------------------------------
     */

    const receivingIds = rows
      .map((row) => {
        const relation = row.ap_invoices;

        const invoice = Array.isArray(relation)
          ? (relation[0] ?? null)
          : (relation ?? null);

        return invoice?.receiving_record_id;
      })
      .filter((id): id is string => Boolean(id));

    let receivingData: {
      id: string;
      receiving_number: string | null;
    }[] = [];

    if (receivingIds.length > 0) {
      const { data: receivings, error: receivingError } = await supabase
        .from("receiving_records")
        .select("id, receiving_number")
        .in("id", receivingIds);

      if (receivingError) {
        window.alert(receivingError.message);

        setLoadingDetail(false);

        return;
      }

      receivingData = receivings ?? [];
    }

    const supplierMap = new Map(
      supplierData.map((supplier) => [supplier.id, supplier]),
    );

    const receivingMap = new Map(
      receivingData.map((receiving) => [receiving.id, receiving]),
    );

    /**
     * ------------------------------------------------------
     * Mapping detail
     * ------------------------------------------------------
     */

    const allocations = rows.map((row) => {
      const relation = row.ap_invoices;

      const invoice = Array.isArray(relation)
        ? (relation[0] ?? null)
        : (relation ?? null);

      const supplier = invoice?.supplier_id
        ? supplierMap.get(invoice.supplier_id)
        : null;

      const receiving = invoice?.receiving_record_id
        ? receivingMap.get(invoice.receiving_record_id)
        : null;

      return {
        invoice_id: row.invoice_id,

        invoice_number: invoice?.invoice_number ?? "-",

        invoice_date: invoice?.invoice_date ?? "",

        grand_total: Number(invoice?.grand_total ?? 0),

        amount: Number(row.amount ?? 0),

        supplier_name: supplier?.name ?? "-",

        supplier_code: supplier?.code ?? "",

        receiving_number: receiving?.receiving_number ?? "-",
      };
    });

    setDetailPayment({
      payment,
      allocations,
    });

    setLoadingDetail(false);
  };

  /**
   * ==========================================================
   * EDIT PAYMENT
   * ==========================================================
   */

  const openEditPayment = async (payment: ApPayment) => {
    const { data, error: allocationError } = await supabase
      .from("ap_payment_allocations")
      .select("invoice_id:ap_invoice_id, amount")
      .eq("ap_payment_id", payment.id);

    if (allocationError) {
      window.alert(allocationError.message);
      return;
    }

    setEditingPayment(payment);
    setEditForm({
      payment_date: payment.payment_date,
      payment_method_id: payment.payment_method_id ?? "",
      reference_number: payment.reference_number ?? "",
      notes: payment.notes ?? "",
      allocations: (data ?? []).map((row) => ({
        invoice_id: row.invoice_id,
        amount: Number(row.amount ?? 0),
        deposit_id: null,
      })),
    });
  };

  const closeEditPayment = () => {
    setEditingPayment(null);
    setEditForm(null);
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment || !editForm) return;

    if (!editForm.payment_date || !editForm.payment_method_id) {
      window.alert("Tanggal dan metode pembayaran wajib diisi.");
      return;
    }

    const result = await updatePayment(editingPayment.id, {
      entity_id: editingPayment.entity_id,
      supplier_id: null,
      payment_request_id: editingPayment.payment_request_id ?? null,
      payment_date: editForm.payment_date,
      payment_method_id: editForm.payment_method_id,
      reference_number: editForm.reference_number,
      notes: editForm.notes,
      allocations: editForm.allocations,
    });

    if (!result?.success) return;

    window.alert("AP Payment berhasil diperbarui.");
    closeEditPayment();
  };

  /**
   * ==========================================================
   * DELETE
   *
   * PaymentPage baru tidak menyediakan edit.
   *
   * Payment yang sudah dibuat sebaiknya
   * tidak diubah sembarangan karena
   * sudah mempengaruhi invoice/jurnal.
   * ==========================================================
   */

  /**
   * ==========================================================
   * DELETE PAYMENT
   * ==========================================================
   */

  const handleDeletePayment = async (payment: ApPayment) => {
    const confirmed = window.confirm(
      `Hapus AP Payment ${payment.payment_number ?? ""}?\n\n` +
        "Transaksi yang sudah terhubung ke jurnal tidak dapat dihapus.",
    );

    if (!confirmed) return;

    const result = await deletePayment(payment.id);

    if (!result?.success) return;

    window.alert("AP Payment berhasil dihapus.");
  };

  /**
   * ==========================================================
   * EXPORT
   * ==========================================================
   */

  const exportExcel = () => {
    void runExport();
  };

  const runExport = async () => {
    try {
      const rowsToExport = await fetchPaymentsForExport(
        search,
        dateFrom,
        dateTo,
      );

      const requestIds = [
        ...new Set(
          rowsToExport
            .map((row) => row.payment_request_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const requestMap = new Map<string, string>();

      if (requestIds.length > 0) {
        const { data, error: requestError } = await supabase
          .from("ap_payment_requests")
          .select("id, payment_request_number")
          .in("id", requestIds);

        if (requestError) throw requestError;

        for (const request of data ?? []) {
          requestMap.set(request.id, request.payment_request_number ?? "");
        }
      }

      const methodMap = new Map(
        settlementMethods.map((method) => [method.id, method]),
      );

      const rows = rowsToExport.map((row) => {
        const method = row.payment_method_id
          ? methodMap.get(row.payment_method_id)
          : null;

        return {
          "No. Payment": row.payment_number ?? "",
          "Payment Voucher": row.payment_request_id
            ? (requestMap.get(row.payment_request_id) ?? "")
            : "",
          "Metode Pembayaran": method
            ? `${method.code ?? ""}${
                method.code && method.name ? " — " : ""
              }${method.name ?? ""}`
            : "",
          Tanggal: row.payment_date,
          "No. Referensi": row.reference_number ?? "",
          "Total Payment": Number(row.amount || 0),
          Catatan: row.notes ?? "",
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);

      ws["!cols"] = [
        { wch: 22 },
        { wch: 38 },
        { wch: 25 },
        { wch: 15 },
        { wch: 20 },
        { wch: 20 },
        { wch: 40 },
      ];

      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, ws, "AP Payment");

      const file = XLSX.write(wb, {
        bookType: "xlsx",
        type: "array",
      });

      saveAs(
        new Blob([file], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `AP-Payment${formatReportDateRange(
          dateFrom ? new Date(dateFrom) : null,
          dateTo ? new Date(dateTo) : null,
        )}.xlsx`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal export AP Payment.";

      window.alert(message);
    }
  };

  /**
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <div className="w-full pr-2 space-y-4">
      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">AP Payment</h1>

          <p className="text-sm text-gray-500">
            Proses pembayaran berdasarkan Payment Voucher yang telah disetujui.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            className="w-80 rounded border px-3 py-2 text-sm"
            placeholder="Cari nomor payment / PV / referensi..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />

          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            onClick={(event) => {
              const input = event.currentTarget as HTMLInputElement & {
                showPicker?: () => void;
              };

              input.showPicker?.();
            }}
            className="cursor-pointer rounded border px-3 py-2 text-sm"
            title="Tanggal mulai"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            onClick={(event) => {
              const input = event.currentTarget as HTMLInputElement & {
                showPicker?: () => void;
              };

              input.showPicker?.();
            }}
            className="cursor-pointer rounded border px-3 py-2 text-sm"
            title="Tanggal akhir"
          />

          {access.export && (
            <button
              type="button"
              onClick={exportExcel}
              className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white"
            >
              Export Excel
            </button>
          )}

          {access.create && (
            <button
              type="button"
              onClick={openPaymentForm}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              + Proses Pembayaran
            </button>
          )}
        </div>
      </div>

      {/* =====================================================
          ERROR
          ===================================================== */}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* =====================================================
          PAYMENT FORM
          ===================================================== */}

      {formData && (
        <div className="space-y-6 rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Proses Pembayaran</h2>

              <p className="text-sm text-gray-500">
                Pilih Payment Voucher yang sudah disetujui.
              </p>
            </div>

            <button
              type="button"
              onClick={cancelPaymentForm}
              className="rounded border px-4 py-2 text-sm"
            >
              Batal
            </button>
          </div>

          {/* =================================================
              PILIH PV
              ================================================= */}

          <div className="rounded-lg border bg-gray-50 p-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Payment Voucher
            </label>

            <select
              value={selectedPaymentRequestId}
              onChange={(event) =>
                handlePaymentRequestChange(event.target.value)
              }
              disabled={saving || loadingPaymentRequests}
              className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="">-- Pilih Payment Voucher --</option>

              {approvedPaymentRequests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.payment_request_number}
                  {" — "}
                  {formatCurrency(Number(request.total_amount))}
                </option>
              ))}
            </select>

            {loadingPaymentRequests && (
              <p className="mt-2 text-xs text-gray-500">
                Memuat Payment Voucher...
              </p>
            )}

            {!loadingPaymentRequests &&
              approvedPaymentRequests.length === 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  Tidak ada Payment Voucher yang siap diproses.
                </p>
              )}
          </div>

          {/* =================================================
              DETAIL PV
              ================================================= */}

          {selectedPaymentRequest && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 rounded-lg border bg-white p-4 md:grid-cols-4">
                <div>
                  <div className="text-xs text-gray-500">
                    No. Payment Voucher
                  </div>

                  <div className="mt-1 font-semibold">
                    {selectedPaymentRequest.payment_request_number}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Tanggal Pengajuan</div>

                  <div className="mt-1 font-semibold">
                    {formatDate(selectedPaymentRequest.request_date)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Status</div>

                  <div className="mt-1">
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                      APPROVED
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Total PV</div>

                  <div className="mt-1 text-lg font-bold">
                    {formatCurrency(selectedTotal)}
                  </div>
                </div>
              </div>

              {/* =================================================
                  ITEM PV
                  ================================================= */}

              <div className="overflow-hidden rounded-lg border">
                <div className="border-b bg-gray-50 px-4 py-3">
                  <h3 className="text-sm font-semibold">
                    Detail Invoice Payment Voucher
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left">Supplier</th>

                        <th className="px-4 py-3 text-left">Invoice</th>

                        <th className="px-4 py-3 text-left">No. RR</th>

                        <th className="px-4 py-3 text-left">Tgl Invoice</th>

                        <th className="px-4 py-3 text-left">Jatuh Tempo</th>

                        <th className="px-4 py-3 text-right">Nominal</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {selectedItems.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {item.ap_invoice?.supplier?.name ?? "-"}
                            </div>

                            <div className="text-xs text-gray-500">
                              {item.ap_invoice?.supplier?.code ?? ""}
                            </div>
                          </td>

                          <td className="px-4 py-3 font-medium">
                            {item.ap_invoice?.invoice_number ?? "-"}
                          </td>

                          <td className="px-4 py-3">
                            {item.ap_invoice?.receiving_record
                              ?.receiving_number ?? "-"}
                          </td>

                          <td className="px-4 py-3">
                            {formatDate(item.ap_invoice?.invoice_date)}
                          </td>

                          <td className="px-4 py-3">
                            {formatDate(item.ap_invoice?.due_date)}
                          </td>

                          <td className="px-4 py-3 text-right font-semibold">
                            {formatCurrency(Number(item.requested_amount || 0))}
                          </td>
                        </tr>
                      ))}

                      {selectedItems.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-8 text-center text-gray-500"
                          >
                            Payment Voucher tidak memiliki item.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    <tfoot>
                      <tr className="border-t bg-gray-50">
                        <td
                          colSpan={5}
                          className="px-4 py-3 text-right font-semibold"
                        >
                          Total
                        </td>

                        <td className="px-4 py-3 text-right text-base font-bold">
                          {formatCurrency(selectedTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* =================================================
                  PAYMENT INPUT
                  ================================================= */}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Tanggal Pembayaran
                  </label>

                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(event) =>
                      setFormData((current) =>
                        current
                          ? {
                              ...current,
                              payment_date: event.target.value,
                            }
                          : current,
                      )
                    }
                    disabled={saving}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Metode Pembayaran
                  </label>

                  <select
                    value={formData.payment_method_id}
                    onChange={(event) =>
                      setFormData((current) =>
                        current
                          ? {
                              ...current,
                              payment_method_id: event.target.value,
                            }
                          : current,
                      )
                    }
                    disabled={saving}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">-- Pilih Metode Pembayaran --</option>

                    {paymentSettlementMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    No. Referensi
                  </label>

                  <input
                    type="text"
                    value={formData.reference_number}
                    onChange={(event) =>
                      setFormData((current) =>
                        current
                          ? {
                              ...current,
                              reference_number: event.target.value,
                            }
                          : current,
                      )
                    }
                    placeholder="No. transfer / cek / referensi"
                    disabled={saving}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Catatan
                  </label>

                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(event) =>
                      setFormData((current) =>
                        current
                          ? {
                              ...current,
                              notes: event.target.value,
                            }
                          : current,
                      )
                    }
                    placeholder="Catatan pembayaran"
                    disabled={saving}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* =================================================
                  SAVE
                  ================================================= */}

              <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-4">
                <div>
                  <div className="text-xs text-gray-500">
                    Total yang akan dibayar
                  </div>

                  <div className="text-xl font-bold">
                    {formatCurrency(selectedTotal)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={
                    saving ||
                    !formData.payment_request_id ||
                    !formData.payment_method_id ||
                    formData.allocations.length === 0
                  }
                  className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Menyimpan..." : "Simpan Pembayaran"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================
          PAYMENT TABLE
          ===================================================== */}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Pembayaran Sudah Diproses</h2>

              <p className="text-xs text-gray-500">
                Daftar pembayaran AP yang sudah dibuat.
              </p>
            </div>

            <div className="text-sm text-gray-500">
              {paymentsTotalCount} pembayaran
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b">
                <th className="px-4 py-3 font-medium">No. Payment</th>
                <th className="px-4 py-3 font-medium">Payment Voucher</th>
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-4 py-3 font-medium">Metode Pembayaran</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium text-right">
                  Total Payment
                </th>
                <th className="w-[150px] px-4 py-3 font-medium text-center">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-500">
                    Tidak ada transaksi AP Payment.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => {
                  const request = paymentRequests.find(
                    (item) => item.id === payment.payment_request_id,
                  );

                  const method = settlementMethods.find(
                    (item) => item.id === payment.payment_method_id,
                  );

                  return (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        {payment.payment_number ?? "-"}
                      </td>

                      <td className="px-4 py-3 font-medium">
                        {request?.payment_request_number ?? "-"}
                      </td>

                      <td className="px-4 py-3">
                        {formatDate(payment.payment_date)}
                      </td>

                      <td className="px-4 py-3">
                        {method
                          ? `${method.code ?? ""}${method.code && method.name ? " — " : ""}${method.name ?? ""}`
                          : "-"}
                      </td>

                      <td className="px-4 py-3">
                        {payment.reference_number ?? "-"}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(Number(payment.amount ?? 0))}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="Detail"
                            onClick={() => void loadPaymentDetail(payment)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                          >
                            <Eye
                              size={16}
                              width={16}
                              height={16}
                              strokeWidth={2}
                              className="h-4 w-4 shrink-0"
                              style={{
                                width: "16px",
                                height: "16px",
                                minWidth: "16px",
                                minHeight: "16px",
                                display: "block",
                              }}
                            />
                          </button>

                          {access.edit && (
                            <button
                              type="button"
                              title="Edit"
                              onClick={() => void openEditPayment(payment)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                            >
                              <Pencil
                                size={16}
                                width={16}
                                height={16}
                                strokeWidth={2}
                                className="h-4 w-4 shrink-0"
                                style={{
                                  width: "16px",
                                  height: "16px",
                                  minWidth: "16px",
                                  minHeight: "16px",
                                  display: "block",
                                }}
                              />
                            </button>
                          )}

                          {access.delete && (
                            <button
                              type="button"
                              title={
                                payment.journal_id
                                  ? "Sudah terhubung jurnal"
                                  : "Hapus"
                              }
                              disabled={Boolean(payment.journal_id)}
                              onClick={() => void handleDeletePayment(payment)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2
                                size={16}
                                width={16}
                                height={16}
                                strokeWidth={2}
                                className="h-4 w-4 shrink-0"
                                style={{
                                  width: "16px",
                                  height: "16px",
                                  minWidth: "16px",
                                  minHeight: "16px",
                                  display: "block",
                                }}
                              />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="border-t bg-white px-4 py-3">
            <Pagination
              meta={paginationMeta}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* =====================================================
          DETAIL PAYMENT
          ===================================================== */}

      {loadingDetail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
          <div className="rounded-lg bg-white px-6 py-4 shadow-lg">
            Memuat detail pembayaran...
          </div>
        </div>
      )}

      {detailPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white shadow-xl">
            {/* HEADER */}

            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold">Detail AP Payment</h2>

                <p className="text-sm text-gray-500">
                  {detailPayment.payment.payment_number}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDetailPayment(null)}
                className="rounded border px-3 py-2 text-sm"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-6 p-6">
              {/* HEADER INFO */}

              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <div>
                  <div className="text-xs text-gray-500">No. Payment</div>

                  <div className="mt-1 font-semibold">
                    {detailPayment.payment.payment_number ?? "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Payment Voucher</div>

                  <div className="mt-1 font-semibold">
                    {paymentRequests.find(
                      (request) =>
                        request.id === detailPayment.payment.payment_request_id,
                    )?.payment_request_number ?? "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Tanggal</div>

                  <div className="mt-1 font-semibold">
                    {formatDate(detailPayment.payment.payment_date)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Referensi</div>

                  <div className="mt-1 font-semibold">
                    {detailPayment.payment.reference_number ?? "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Total</div>

                  <div className="mt-1 text-lg font-bold">
                    {formatCurrency(Number(detailPayment.payment.amount))}
                  </div>
                </div>
              </div>

              {/* DETAIL INVOICE */}

              <div className="overflow-hidden rounded-lg border">
                <div className="border-b bg-gray-50 px-4 py-3">
                  <h3 className="text-sm font-semibold">
                    Detail Invoice yang Dibayar
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 font-medium">Supplier</th>

                        <th className="px-4 py-3 font-medium">Invoice</th>

                        <th className="px-4 py-3 font-medium">No. RR</th>

                        <th className="px-4 py-3 font-medium">Tanggal</th>

                        <th className="px-4 py-3 text-right font-medium">
                          Grand Total
                        </th>

                        <th className="px-4 py-3 text-right font-medium">
                          Dibayar
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {detailPayment.allocations.map((allocation) => (
                        <tr
                          key={`${detailPayment.payment.id}-${allocation.invoice_id}`}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {allocation.supplier_name}
                            </div>

                            <div className="text-xs text-gray-500">
                              {allocation.supplier_code}
                            </div>
                          </td>

                          <td className="px-4 py-3 font-medium">
                            {allocation.invoice_number}
                          </td>

                          <td className="px-4 py-3">
                            {allocation.receiving_number}
                          </td>

                          <td className="px-4 py-3">
                            {formatDate(allocation.invoice_date)}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {formatCurrency(allocation.grand_total)}
                          </td>

                          <td className="px-4 py-3 text-right font-semibold">
                            {formatCurrency(allocation.amount)}
                          </td>
                        </tr>
                      ))}

                      {detailPayment.allocations.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-8 text-center text-gray-500"
                          >
                            Tidak ada invoice yang dialokasikan.
                          </td>
                        </tr>
                      )}
                    </tbody>

                    <tfoot>
                      <tr className="border-t bg-gray-50">
                        <td
                          colSpan={5}
                          className="px-4 py-3 text-right font-semibold"
                        >
                          Total Dibayar
                        </td>

                        <td className="px-4 py-3 text-right text-base font-bold">
                          {formatCurrency(
                            detailPayment.allocations.reduce(
                              (total, row) => total + Number(row.amount || 0),
                              0,
                            ),
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* CATATAN */}

              {detailPayment.payment.notes && (
                <div className="rounded-lg border bg-gray-50 p-4">
                  <div className="mb-1 text-xs font-medium text-gray-500">
                    Catatan
                  </div>

                  <div className="text-sm">{detailPayment.payment.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editingPayment && editForm && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold">Edit AP Payment</h2>
                <p className="text-sm text-gray-500">
                  {editingPayment.payment_number ?? "-"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditPayment}
                className="rounded border px-3 py-2 text-sm"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Tanggal Pembayaran
                </label>
                <input
                  type="date"
                  value={editForm.payment_date}
                  onChange={(e) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, payment_date: e.target.value }
                        : current,
                    )
                  }
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Metode Pembayaran
                </label>
                <select
                  value={editForm.payment_method_id}
                  onChange={(e) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, payment_method_id: e.target.value }
                        : current,
                    )
                  }
                  className="w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="">-- Pilih Metode Pembayaran --</option>
                  {paymentSettlementMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.code ?? ""}
                      {method.code && method.name ? " — " : ""}
                      {method.name ?? ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Reference
                </label>
                <input
                  value={editForm.reference_number}
                  onChange={(e) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, reference_number: e.target.value }
                        : current,
                    )
                  }
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Catatan
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm((current) =>
                      current ? { ...current, notes: e.target.value } : current,
                    )
                  }
                  rows={3}
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEditPayment}
                  className="rounded border px-4 py-2 text-sm"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => void handleUpdatePayment()}
                  disabled={saving}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentPage;
