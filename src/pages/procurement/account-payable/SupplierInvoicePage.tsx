import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Eye,
  Check,
  X,
  Printer,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { hasAccess } from "@/lib/hasAccess";
import { useApInvoices } from "./hooks/useApInvoices";
import type {
  ApInvoice,
  ApPaymentRequest,
  ApPaymentRequestFormData,
} from "./types";
import type { PaymentRequestDetailItem } from "./hooks/useApInvoices";

type PageTab = "BELUM_DIAJUKAN" | "PROSES_BAYAR";

type DetailTarget = ApInvoice | ApPaymentRequest | null;

function todayInputValue(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;

  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getDueDays(dueDate: string | null): number | null {
  if (!dueDate) {
    return null;
  }

  const today = new Date(`${todayInputValue()}T00:00:00`);

  const due = new Date(`${dueDate}T00:00:00`);

  if (Number.isNaN(today.getTime()) || Number.isNaN(due.getTime())) {
    return null;
  }

  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function dueLabel(dueDate: string | null): string {
  const days = getDueDays(dueDate);

  if (days === null) {
    return "-";
  }

  if (days < 0) {
    return `Terlambat ${Math.abs(days)} hari`;
  }

  if (days === 0) {
    return "Jatuh tempo hari ini";
  }

  return `${days} hari lagi`;
}

export function SupplierInvoicePage() {
  const {
    invoices,
    paymentRequests,
    loading,
    saving,
    error,
    createPaymentRequest,
    approvePaymentRequest,
    cancelPaymentRequest,
    fetchPaymentRequestItems,
    fetchInvoices,
    fetchPaymentRequests,
  } = useApInvoices();

  const [access, setAccess] = useState({
    export: false,

    paymentRequestCreate: false,
    paymentRequestDetail: false,
    paymentRequestApprove: false,
    paymentRequestCancel: false,
    paymentRequestExport: false,
  });

  const [tab, setTab] = useState<PageTab>("BELUM_DIAJUKAN");

  const [search, setSearch] = useState("");

  const [paymentSearch, setPaymentSearch] = useState("");

  // Pagination hanya untuk tampilan tabel.
  // Data tetap di-load penuh oleh useApInvoices.
  const PAGE_SIZE = 25;
  const [invoicePage, setInvoicePage] = useState(1);
  const [paymentRequestPage, setPaymentRequestPage] = useState(1);

  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(
    () => new Set<string>(),
  );

  const [selectedInvoiceMap, setSelectedInvoiceMap] = useState<
    Map<string, ApInvoice>
  >(() => new Map<string, ApInvoice>());

  const [invoiceTotal, setInvoiceTotal] = useState(0);

  const [paymentRequestTotal, setPaymentRequestTotal] = useState(0);

  const [showRequestForm, setShowRequestForm] = useState(false);

  const [requestDate, setRequestDate] = useState(todayInputValue());

  const [requestNotes, setRequestNotes] = useState("");

  const [detailTarget, setDetailTarget] = useState<DetailTarget>(null);

  const [paymentRequestDetailItems, setPaymentRequestDetailItems] = useState<
    PaymentRequestDetailItem[]
  >([]);

  const [paymentRequestDetailLoading, setPaymentRequestDetailLoading] =
    useState(false);

  const [cancelTarget, setCancelTarget] = useState<ApPaymentRequest | null>(
    null,
  );

  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadAccess() {
      const [
        exportExcel,

        paymentRequestCreate,
        paymentRequestDetail,
        paymentRequestApprove,
        paymentRequestCancel,
        paymentRequestExport,
      ] = await Promise.all([
        hasAccess("ap_invoice.export"),
        hasAccess("ap_payment_request.create"),
        hasAccess("ap_payment_request.detail"),
        hasAccess("ap_payment_request.approve"),
        hasAccess("ap_payment_request.cancel"),
        hasAccess("ap_payment_request.export"),
      ]);

      if (!mounted) {
        return;
      }

      setAccess({
        export: exportExcel,

        paymentRequestCreate,
        paymentRequestDetail,
        paymentRequestApprove,
        paymentRequestCancel,
        paymentRequestExport,
      });
    }

    void loadAccess();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * ==========================================================
   * SERVER-SIDE SEARCH + PAGINATION
   *
   * Tidak ada lagi filter/slice data besar di browser.
   * Search dan page dikirim ke useApInvoices -> RPC Supabase.
   * ==========================================================
   */

  useEffect(() => {
    setInvoicePage(1);
  }, [search]);

  useEffect(() => {
    setPaymentRequestPage(1);
  }, [paymentSearch]);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      const result = await fetchInvoices(search, invoicePage, PAGE_SIZE);

      if (cancelled || !result) {
        return;
      }

      setInvoiceTotal(result.total);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, invoicePage, fetchInvoices]);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      const result = await fetchPaymentRequests(
        paymentSearch,
        paymentRequestPage,
        PAGE_SIZE,
      );

      if (cancelled || !result) {
        return;
      }

      setPaymentRequestTotal(result.total);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [paymentSearch, paymentRequestPage, fetchPaymentRequests]);

  /*
   * Data dari hook sudah merupakan PAGE dari server.
   * Alias ini sengaja dipertahankan supaya bagian UI lama
   * tidak berubah struktur/fungsinya.
   */
  const filteredInvoices = invoices;
  const filteredPaymentRequests = paymentRequests;

  const invoiceTotalPages = Math.max(1, Math.ceil(invoiceTotal / PAGE_SIZE));

  const paymentRequestTotalPages = Math.max(
    1,
    Math.ceil(paymentRequestTotal / PAGE_SIZE),
  );

  const paginatedInvoices = invoices;

  const paginatedPaymentRequests = paymentRequests;

  const selectedInvoices = useMemo(
    () =>
      Array.from(selectedInvoiceIds)
        .map((id) => selectedInvoiceMap.get(id))
        .filter((invoice): invoice is ApInvoice => Boolean(invoice)),
    [selectedInvoiceIds, selectedInvoiceMap],
  );

  const selectedTotal = useMemo(
    () =>
      selectedInvoices.reduce(
        (total, invoice) => total + Number(invoice.remaining_amount || 0),
        0,
      ),
    [selectedInvoices],
  );

  /*
   * "Pilih semua" berlaku untuk data yang sedang
   * tampil pada page server-side saat ini.
   */
  const allFilteredSelected =
    paginatedInvoices.length > 0 &&
    paginatedInvoices.every((invoice) => selectedInvoiceIds.has(invoice.id));

  const toggleInvoice = (invoice: ApInvoice) => {
    setSelectedInvoiceIds((current) => {
      const next = new Set(current);

      if (next.has(invoice.id)) {
        next.delete(invoice.id);

        setSelectedInvoiceMap((map) => {
          const nextMap = new Map(map);

          nextMap.delete(invoice.id);

          return nextMap;
        });
      } else {
        next.add(invoice.id);

        setSelectedInvoiceMap((map) => {
          const nextMap = new Map(map);

          nextMap.set(invoice.id, invoice);

          return nextMap;
        });
      }

      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedInvoiceIds((current) => {
      const next = new Set(current);

      if (allFilteredSelected) {
        for (const invoice of paginatedInvoices) {
          next.delete(invoice.id);
        }

        setSelectedInvoiceMap((map) => {
          const nextMap = new Map(map);

          for (const invoice of paginatedInvoices) {
            nextMap.delete(invoice.id);
          }

          return nextMap;
        });
      } else {
        setSelectedInvoiceMap((map) => {
          const nextMap = new Map(map);

          for (const invoice of paginatedInvoices) {
            next.add(invoice.id);

            nextMap.set(invoice.id, invoice);
          }

          return nextMap;
        });
      }

      return next;
    });
  };

  /**
   * ==========================================================
   * AJUKAN PEMBAYARAN
   * ==========================================================
   */

  const openRequestForm = () => {
    if (selectedInvoices.length === 0) {
      return;
    }

    setRequestDate(todayInputValue());

    setRequestNotes("");

    setShowRequestForm(true);
  };

  const savePaymentRequest = async () => {
    if (selectedInvoices.length === 0) {
      return;
    }

    const payload: ApPaymentRequestFormData = {
      request_date: requestDate,
      supplier_id: null,
      notes: requestNotes,
      items: selectedInvoices.map((invoice) => ({
        ap_invoice_id: invoice.id,
        receiving_record_id: null,
        requested_amount: Number(invoice.remaining_amount),
        notes: "",
      })),
    };

    const result = await createPaymentRequest(payload);

    if (!result) {
      return;
    }

    setSelectedInvoiceIds(new Set<string>());

    setSelectedInvoiceMap(new Map<string, ApInvoice>());

    setShowRequestForm(false);

    setTab("PROSES_BAYAR");

    window.alert(
      `Payment Voucher ${result.payment_request_number} berhasil dibuat.`,
    );
  };

  const openPaymentRequestDetail = async (request: ApPaymentRequest) => {
    if (!access.paymentRequestDetail) {
      return;
    }

    setDetailTarget(request);
    setPaymentRequestDetailItems([]);
    setPaymentRequestDetailLoading(true);

    try {
      const items = await fetchPaymentRequestItems(request.id);

      setPaymentRequestDetailItems(items);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal mengambil detail Payment Request.";

      window.alert(message);

      setDetailTarget(null);
    } finally {
      setPaymentRequestDetailLoading(false);
    }
  };

  /**
   * ==========================================================
   * APPROVE
   * ==========================================================
   */

  const handleApprove = async (request: ApPaymentRequest) => {
    const confirmed = window.confirm(
      `Setujui Payment Voucher ${request.payment_request_number}?`,
    );

    if (!confirmed) {
      return;
    }

    const result = await approvePaymentRequest(request.id);

    if (!result) {
      return;
    }

    window.alert(
      `Payment Voucher ${result.payment_request_number} berhasil disetujui.`,
    );
  };

  /**
   * ==========================================================
   * CANCEL
   * ==========================================================
   */

  const handleCancel = async () => {
    if (!cancelTarget) {
      return;
    }

    if (!cancelReason.trim()) {
      window.alert("Alasan pembatalan wajib diisi.");

      return;
    }

    const result = await cancelPaymentRequest(
      cancelTarget.id,
      cancelReason.trim(),
    );

    if (!result) {
      return;
    }

    setCancelTarget(null);
    setCancelReason("");
  };

  /**
   * ==========================================================
   * PRINT PAYMENT REQUEST
   * ==========================================================
   */

  const printPaymentRequest = async (request: ApPaymentRequest) => {
    const printWindow = window.open("", "_blank", "width=1000,height=800");

    if (!printWindow) {
      return;
    }

    const escapeHtml = (value: string): string => {
      return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    };

    try {
      /*
       * =====================================================
       * AMBIL DETAIL ITEM PAYMENT REQUEST
       * =====================================================
       */

      type PrintPaymentRequestItem = {
        id: string;
        requested_amount: number | string;
        ap_invoice_id: string | null;
        receiving_record_id: string | null;
      };

      type PrintApInvoice = {
        id: string;
        invoice_number: string | null;
        invoice_date: string | null;
        due_date: string | null;
        supplier_id: string | null;
        receiving_record_id: string | null;
      };

      type PrintSupplier = {
        id: string;
        code: string | null;
        name: string | null;
      };

      type PrintReceivingRecord = {
        id: string;
        receiving_number: string | null;
      };

      /* =====================================================
        1. AMBIL ITEM PAYMENT REQUEST
        ===================================================== */

      const { data: itemData, error: itemError } = await supabase
        .from("ap_payment_request_items")
        .select(
          `
          id,
          requested_amount,
          ap_invoice_id,
          receiving_record_id
        `,
        )
        .eq("payment_request_id", request.id)
        .order("created_at", {
          ascending: true,
        });

      if (itemError) {
        throw itemError;
      }

      const items = (itemData ?? []) as unknown as PrintPaymentRequestItem[];

      /* =====================================================
        2. AMBIL ID AP INVOICE
        ===================================================== */

      const invoiceIds = Array.from(
        new Set(
          items
            .map((item) => item.ap_invoice_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      /* =====================================================
        3. AMBIL AP INVOICE
        ===================================================== */

      const invoices: PrintApInvoice[] =
        invoiceIds.length > 0
          ? (((
              await supabase
                .from("ap_invoices")
                .select(
                  `
                    id,
                    invoice_number,
                    invoice_date,
                    due_date,
                    supplier_id,
                    receiving_record_id
                  `,
                )
                .in("id", invoiceIds)
            ).data ?? []) as unknown as PrintApInvoice[])
          : [];

      /* =====================================================
        4. MAP INVOICE
        ===================================================== */

      const invoiceMap = new Map<string, PrintApInvoice>(
        invoices.map((invoice) => [invoice.id, invoice]),
      );

      /* =====================================================
        5. AMBIL SUPPLIER
        ===================================================== */

      const supplierIds = Array.from(
        new Set(
          invoices
            .map((invoice) => invoice.supplier_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      const suppliers: PrintSupplier[] =
        supplierIds.length > 0
          ? (((
              await supabase
                .from("suppliers")
                .select(
                  `
                    id,
                    code,
                    name
                  `,
                )
                .in("id", supplierIds)
            ).data ?? []) as unknown as PrintSupplier[])
          : [];

      /* =====================================================
        6. MAP SUPPLIER
        ===================================================== */

      const supplierMap = new Map<string, PrintSupplier>(
        suppliers.map((supplier) => [supplier.id, supplier]),
      );

      /* =====================================================
        7. AMBIL RECEIVING RECORD
        ===================================================== */

      const receivingIds = Array.from(
        new Set(
          items
            .map((item) => item.receiving_record_id)
            .filter((id): id is string => Boolean(id))
            .concat(
              invoices
                .map((invoice) => invoice.receiving_record_id)
                .filter((id): id is string => Boolean(id)),
            ),
        ),
      );

      const receivingRecords: PrintReceivingRecord[] =
        receivingIds.length > 0
          ? (((
              await supabase
                .from("receiving_records")
                .select(
                  `
                    id,
                    receiving_number
                  `,
                )
                .in("id", receivingIds)
            ).data ?? []) as unknown as PrintReceivingRecord[])
          : [];

      /* =====================================================
        8. MAP RECEIVING
        ===================================================== */

      const receivingMap = new Map<string, PrintReceivingRecord>(
        receivingRecords.map((receiving) => [receiving.id, receiving]),
      );

      /*
       * =====================================================
       * BARIS DETAIL
       * =====================================================
       */

      const detailRows = items
        .map((item, index) => {
          const invoice = item.ap_invoice_id
            ? invoiceMap.get(item.ap_invoice_id)
            : undefined;

          const supplier = invoice?.supplier_id
            ? supplierMap.get(invoice.supplier_id)
            : undefined;

          const receivingId =
            item.receiving_record_id ?? invoice?.receiving_record_id ?? null;

          const receiving = receivingId
            ? receivingMap.get(receivingId)
            : undefined;

          const supplierName = supplier?.name ?? "-";

          const invoiceNumber = invoice?.invoice_number ?? "-";

          const receivingNumber = receiving?.receiving_number ?? "-";

          const invoiceDate = invoice?.invoice_date
            ? formatDate(invoice.invoice_date)
            : "-";

          const dueDate = invoice?.due_date
            ? formatDate(invoice.due_date)
            : "-";

          const dueDays = invoice?.due_date
            ? getDueDays(invoice.due_date)
            : null;

          let dueDaysLabel = "-";

          if (dueDays !== null) {
            if (dueDays < 0) {
              dueDaysLabel = `Terlambat ${Math.abs(dueDays)} hari`;
            } else if (dueDays === 0) {
              dueDaysLabel = "Hari ini";
            } else {
              dueDaysLabel = `${dueDays} hari`;
            }
          }

          const requestedAmount = Number(item.requested_amount);

          return `
                <tr>
                  <td class="center">
                    ${index + 1}
                  </td>

                  <td>
                    <div class="supplier-name">
                      ${escapeHtml(supplierName)}
                    </div>
                  </td>

                  <td>
                    <strong>
                      ${escapeHtml(invoiceNumber)}
                    </strong>
                  </td>

                  <td>
                    ${escapeHtml(receivingNumber)}
                  </td>

                  <td class="center">
                    ${invoiceDate}
                  </td>

                  <td class="center">
                    ${dueDate}
                  </td>

                  <td class="center">
                    ${dueDaysLabel}
                  </td>

                  <td class="amount">
                    ${formatCurrency(requestedAmount)}
                  </td>
                </tr>
              `;
        })
        .join("");

      /*
       * =====================================================
       * HEADER INFORMATION
       * =====================================================
       */

      const notesHtml =
        request.notes && request.notes.trim()
          ? `
            <div class="notes">
              <div class="notes-title">
                Catatan
              </div>

              <div class="notes-content">
                ${escapeHtml(request.notes).replaceAll("\n", "<br>")}
              </div>
            </div>
          `
          : "";

      /*
       * =====================================================
       * PRINT DOCUMENT
       * =====================================================
       */

      printWindow.document.write(`
          <!DOCTYPE html>

          <html>
            <head>

              <meta
                charset="UTF-8"
              />

              <title>
                ${escapeHtml(request.payment_request_number)}
              </title>

              <style>

                @page {
                  size: A4 portrait;
                  margin: 14mm;
                }

                * {
                  box-sizing: border-box;
                }

                body {
                  margin: 0;
                  padding: 0;

                  font-family:
                    Arial,
                    Helvetica,
                    sans-serif;

                  color: #111827;
                  font-size: 12px;

                  background: white;
                }

                .document {
                  width: 100%;
                }

                .header {
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-start;

                  padding-bottom: 14px;

                  border-bottom:
                    2px solid #111827;
                }

                .title {
                  margin: 0;

                  font-size: 25px;
                  line-height: 1.1;

                  font-weight: 700;
                  letter-spacing: 0.3px;
                }

                .subtitle {
                  margin-top: 5px;

                  font-size: 12px;
                  color: #6b7280;
                }

                .document-number {
                  text-align: right;
                }

                .document-number-label {
                  font-size: 10px;
                  color: #6b7280;

                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                }

                .document-number-value {
                  margin-top: 3px;

                  font-size: 16px;
                  font-weight: 700;
                }

                .info {
                  display: grid;

                  grid-template-columns:
                    1fr
                    1fr
                    1fr;

                  gap: 12px;

                  margin-top: 16px;
                  margin-bottom: 18px;
                }

                .info-box {
                  border: 1px solid #d1d5db;

                  border-radius: 4px;

                  padding: 9px 10px;
                }

                .info-label {
                  margin-bottom: 4px;

                  font-size: 9px;
                  color: #6b7280;

                  text-transform: uppercase;
                  letter-spacing: 0.4px;
                }

                .info-value {
                  font-size: 12px;
                  font-weight: 600;
                }

                .status {
                  display: inline-block;

                  padding: 3px 8px;

                  border: 1px solid #9ca3af;
                  border-radius: 12px;

                  font-size: 10px;
                  font-weight: 700;
                }

                table {
                  width: 100%;

                  border-collapse:
                    collapse;

                  table-layout: fixed;
                }

                thead {
                  display: table-header-group;
                }

                th {
                  padding: 8px 6px;

                  border-top:
                    1px solid #111827;

                  border-bottom:
                    1px solid #111827;

                  background: #f3f4f6;

                  font-size: 9px;
                  font-weight: 700;

                  text-align: left;

                  text-transform: uppercase;
                }

                td {
                  padding: 8px 6px;

                  border-bottom:
                    1px solid #e5e7eb;

                  vertical-align: middle;

                  font-size: 10px;
                }

                tr {
                  page-break-inside: avoid;
                }

                .center {
                  text-align: center;
                }

                .amount {
                  text-align: right;

                  font-weight: 600;

                  white-space: nowrap;
                }

                .supplier-name {
                  font-weight: 600;
                }

                .total-row td {
                  padding-top: 10px;
                  padding-bottom: 10px;

                  border-top:
                    2px solid #111827;

                  border-bottom:
                    2px solid #111827;

                  font-size: 12px;
                  font-weight: 700;
                }

                .total-label {
                  text-align: right;
                }

                .notes {
                  margin-top: 18px;

                  border:
                    1px solid #d1d5db;

                  border-radius: 4px;

                  padding: 10px;
                }

                .notes-title {
                  margin-bottom: 5px;

                  font-size: 10px;
                  font-weight: 700;

                  text-transform: uppercase;
                }

                .notes-content {
                  font-size: 11px;
                  line-height: 1.5;
                }

                .approval {
                  display: grid;

                  grid-template-columns:
                    1fr
                    1fr;

                  gap: 60px;

                  margin-top: 45px;

                  page-break-inside: avoid;
                }

                .approval-box {
                  text-align: center;
                }

                .approval-title {
                  margin-bottom: 55px;

                  font-size: 10px;
                  font-weight: 700;

                  text-transform: uppercase;
                }

                .approval-line {
                  border-bottom:
                    1px solid #111827;

                  margin:
                    0 auto 5px;

                  width: 75%;
                }

                .approval-name {
                  font-size: 10px;
                  color: #6b7280;
                }

                .footer {
                  margin-top: 25px;

                  padding-top: 8px;

                  border-top:
                    1px solid #e5e7eb;

                  text-align: center;

                  font-size: 9px;
                  color: #9ca3af;
                }

                @media print {

                  body {
                    -webkit-print-color-adjust:
                      exact;

                    print-color-adjust:
                      exact;
                  }

                  .no-print {
                    display: none;
                  }

                }

              </style>

            </head>

            <body>

              <div class="document">

                <div class="header">

                  <div>
                    <h1 class="title">
                      PAYMENT VOUCHER
                    </h1>

                    <div class="subtitle">
                      Pengajuan pembayaran
                      hutang supplier
                    </div>
                  </div>

                  <div class="document-number">

                    <div class="document-number-label">
                      No. Payment Voucher
                    </div>

                    <div class="document-number-value">
                      ${escapeHtml(request.payment_request_number)}
                    </div>

                  </div>

                </div>


                <div class="info">

                  <div class="info-box">

                    <div class="info-label">
                      Tanggal Pengajuan
                    </div>

                    <div class="info-value">
                      ${formatDate(request.request_date)}
                    </div>

                  </div>


                  <div class="info-box">

                    <div class="info-label">
                      Status
                    </div>

                    <div class="info-value">
                      <span class="status">
                        ${escapeHtml(request.status)}
                      </span>
                    </div>

                  </div>


                  <div class="info-box">

                    <div class="info-label">
                      Jumlah Invoice
                    </div>

                    <div class="info-value">
                      ${items.length}
                      transaksi
                    </div>

                  </div>

                </div>


                <table>

                  <colgroup>
                    <col style="width: 5%">
                    <col style="width: 17%">
                    <col style="width: 16%">
                    <col style="width: 15%">
                    <col style="width: 11%">
                    <col style="width: 11%">
                    <col style="width: 10%">
                    <col style="width: 15%">
                  </colgroup>

                  <thead>

                    <tr>

                      <th class="center">
                        No
                      </th>

                      <th>
                        Supplier
                      </th>

                      <th>
                        Invoice
                      </th>

                      <th>
                        RR
                      </th>

                      <th class="center">
                        Tgl Invoice
                      </th>

                      <th class="center">
                        Jatuh Tempo
                      </th>

                      <th class="center">
                        Hari
                      </th>

                      <th style="text-align:right">
                        Nominal Diajukan
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    ${
                      detailRows ||
                      `
                        <tr>
                          <td
                            colspan="8"
                            class="center"
                          >
                            Tidak ada detail transaksi.
                          </td>
                        </tr>
                      `
                    }

                    <tr class="total-row">

                      <td
                        colspan="7"
                        class="total-label"
                      >
                        TOTAL
                      </td>

                      <td class="amount">
                        ${formatCurrency(Number(request.total_amount))}
                      </td>

                    </tr>

                  </tbody>

                </table>


                ${notesHtml}


                <div class="approval">

                  <div class="approval-box">

                    <div class="approval-title">
                      Dibuat Oleh
                    </div>

                    <div class="approval-line">
                    </div>

                    <div class="approval-name">
                      Pembuat Payment Voucher
                    </div>

                  </div>


                  <div class="approval-box">

                    <div class="approval-title">
                      Disetujui Oleh
                    </div>

                    <div class="approval-line">
                    </div>

                    <div class="approval-name">
                      Approver
                    </div>

                  </div>

                </div>


                <div class="footer">
                  Dokumen Payment Voucher
                  &nbsp;•&nbsp;
                  ${escapeHtml(request.payment_request_number)}
                </div>

              </div>


              <script>

                window.onload =
                  function () {

                    window.focus();

                    window.print();

                  };

              </script>

            </body>

          </html>
        `);

      printWindow.document.close();
    } catch (err) {
      printWindow.close();

      window.alert(
        err instanceof Error
          ? err.message
          : "Gagal mengambil detail Payment Voucher.",
      );
    }
  };

  /**
   * ==========================================================
   * EXPORT
   * ==========================================================
   */

  const exportExcel = () => {
    const rows = filteredInvoices.map((row: ApInvoice) => ({
      Supplier: row.supplier_name ?? "",
      Invoice: row.invoice_number,
      "No RR": row.receiving_number ?? "",
      "Tanggal Invoice": row.invoice_date,
      "Jatuh Tempo": row.due_date ?? "",
      Hari: dueLabel(row.due_date),
      Total: Number(row.grand_total),
      Terbayar: Number(row.paid_amount),
      Sisa: Number(row.remaining_amount),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    ws["!cols"] = [
      { wch: 25 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
    ];

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Supplier Invoice");

    const file = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array",
    });

    saveAs(
      new Blob([file], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `Supplier-Invoice-${todayInputValue()}.xlsx`,
    );
  };

  return (
    <div className="w-full pr-2 mb-6 space-y-5">
      {/* HEADER */}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Supplier Invoice</h1>

          <p className="text-sm text-gray-500">
            Kelola hutang supplier dan pengajuan pembayaran.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {access.export && (
            <button
              type="button"
              onClick={exportExcel}
              disabled={filteredInvoices.length === 0}
              className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Export Excel
            </button>
          )}
        </div>
      </div>

      {/* TAB */}

      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => {
            setTab("BELUM_DIAJUKAN");
            setInvoicePage(1);
          }}
          className={`border-b-2 px-5 py-3 text-sm font-medium ${
            tab === "BELUM_DIAJUKAN"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500"
          }`}
        >
          Belum Diajukan
        </button>

        <button
          type="button"
          onClick={() => {
            setTab("PROSES_BAYAR");
            setPaymentRequestPage(1);
          }}
          className={`border-b-2 px-5 py-3 text-sm font-medium ${
            tab === "PROSES_BAYAR"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500"
          }`}
        >
          Proses Bayar
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ======================================================
          TAB BELUM DIAJUKAN
          ====================================================== */}

      {tab === "BELUM_DIAJUKAN" && (
        <>
          <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Cari
              </label>

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Invoice / Supplier / RR..."
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">
                Tanggal Sekarang
              </label>

              <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm">
                {new Date().toLocaleDateString("id-ID", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-3">
            <div className="text-sm text-gray-600">
              {selectedInvoices.length} transaksi dipilih
              {" · "}
              <strong>{formatCurrency(selectedTotal)}</strong>
            </div>

            {access.paymentRequestCreate && (
              <button
                type="button"
                onClick={openRequestForm}
                disabled={selectedInvoices.length === 0 || saving}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Ajukan Pembayaran
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-12 px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleAllFiltered}
                      />
                    </th>

                    <th className="px-4 py-3 font-medium">Supplier</th>

                    <th className="px-4 py-3 font-medium">No Invoice</th>

                    <th className="px-4 py-3 font-medium">No RR</th>

                    <th className="px-4 py-3 font-medium">Tgl Invoice</th>

                    <th className="px-4 py-3 font-medium">Jatuh Tempo</th>

                    <th className="px-4 py-3 font-medium">Hari</th>

                    <th className="px-4 py-3 font-medium">Sisa</th>

                    <th className="px-4 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-8 text-center text-gray-500"
                      >
                        Memuat data...
                      </td>
                    </tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-8 text-center text-gray-500"
                      >
                        Tidak ada invoice outstanding.
                      </td>
                    </tr>
                  ) : (
                    paginatedInvoices.map((invoice: ApInvoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedInvoiceIds.has(invoice.id)}
                            onChange={() => toggleInvoice(invoice)}
                          />
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {invoice.supplier_name ?? "-"}
                          </div>

                          <div className="text-xs text-gray-500">
                            {invoice.supplier_code ?? ""}
                          </div>
                        </td>

                        <td className="px-4 py-3 font-medium">
                          {invoice.invoice_number}
                        </td>

                        <td className="px-4 py-3">
                          {invoice.receiving_number ?? "-"}
                        </td>

                        <td className="px-4 py-3">
                          {formatDate(invoice.invoice_date)}
                        </td>

                        <td className="px-4 py-3">
                          {formatDate(invoice.due_date)}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={
                              getDueDays(invoice.due_date) !== null &&
                              getDueDays(invoice.due_date)! < 0
                                ? "font-medium text-red-600"
                                : "text-gray-700"
                            }
                          >
                            {dueLabel(invoice.due_date)}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(Number(invoice.remaining_amount))}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {access.paymentRequestDetail && (
                            <button
                              type="button"
                              title="Detail"
                              onClick={() => setDetailTarget(invoice)}
                              className="rounded p-2 hover:bg-gray-100"
                            >
                              <Eye size={17} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {invoiceTotal > 0 && (
            <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-3">
              <div className="text-sm text-gray-500">
                Menampilkan {(invoicePage - 1) * PAGE_SIZE + 1}–
                {Math.min(invoicePage * PAGE_SIZE, invoiceTotal)} dari{" "}
                {invoiceTotal} data
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setInvoicePage((page) => Math.max(1, page - 1))
                  }
                  disabled={invoicePage === 1}
                  className="rounded border p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Halaman sebelumnya"
                >
                  <ChevronLeft size={17} />
                </button>

                <span className="min-w-[90px] text-center text-sm text-gray-600">
                  Halaman {invoicePage} / {invoiceTotalPages}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setInvoicePage((page) =>
                      Math.min(invoiceTotalPages, page + 1),
                    )
                  }
                  disabled={invoicePage === invoiceTotalPages}
                  className="rounded border p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Halaman berikutnya"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================
          TAB PROSES BAYAR
          ====================================================== */}

      {tab === "PROSES_BAYAR" && (
        <>
          <div className="mb-4 rounded-lg border bg-white p-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Cari Invoice / No RR
            </label>

            <input
              type="text"
              value={paymentSearch}
              onChange={(event) => setPaymentSearch(event.target.value)}
              placeholder="Cari No. Invoice Supplier / No. RR / No. PV..."
              className="w-full max-w-xl rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="overflow-hidden rounded-lg border bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-medium">No PV</th>

                    <th className="px-4 py-3 font-medium">Tanggal</th>

                    <th className="px-4 py-3 font-medium">Supplier</th>

                    <th className="px-4 py-3 font-medium text-right">Total</th>

                    <th className="px-4 py-3 font-medium">Status</th>

                    <th className="px-4 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-gray-500"
                      >
                        Memuat data...
                      </td>
                    </tr>
                  ) : filteredPaymentRequests.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-gray-500"
                      >
                        {paymentSearch.trim()
                          ? "Tidak ada Payment Voucher yang sesuai dengan pencarian."
                          : "Belum ada pengajuan pembayaran."}
                      </td>
                    </tr>
                  ) : (
                    paginatedPaymentRequests.map(
                      (request: ApPaymentRequest) => (
                        <tr key={request.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">
                            {request.payment_request_number}
                          </td>

                          <td className="px-4 py-3">
                            {formatDate(request.request_date)}
                          </td>

                          <td className="px-4 py-3">{request.supplier_id}</td>

                          <td className="px-4 py-3 text-right font-medium">
                            {formatCurrency(Number(request.total_amount))}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                request.status === "PAID"
                                  ? "bg-blue-100 text-blue-700"
                                  : request.status === "APPROVED"
                                    ? "bg-green-100 text-green-700"
                                    : request.status === "CANCELLED"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {request.status}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-1">
                              {access.paymentRequestDetail && (
                                <button
                                  type="button"
                                  title="Detail"
                                  onClick={() =>
                                    void openPaymentRequestDetail(request)
                                  }
                                  disabled={paymentRequestDetailLoading}
                                  className="rounded p-2 hover:bg-gray-100 disabled:opacity-50"
                                >
                                  <Eye size={17} />
                                </button>
                              )}

                              {request.status === "DRAFT" &&
                                access.paymentRequestApprove && (
                                  <button
                                    type="button"
                                    title="Approve"
                                    onClick={() => void handleApprove(request)}
                                    disabled={saving}
                                    className="rounded p-2 text-green-600 hover:bg-green-50 disabled:opacity-50"
                                  >
                                    <Check size={17} />
                                  </button>
                                )}

                              {request.status === "DRAFT" &&
                                access.paymentRequestCancel && (
                                  <button
                                    type="button"
                                    title="Batal"
                                    onClick={() => {
                                      setCancelTarget(request);
                                      setCancelReason("");
                                    }}
                                    disabled={saving}
                                    className="rounded p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    <X size={17} />
                                  </button>
                                )}

                              {access.paymentRequestExport && (
                                <button
                                  type="button"
                                  title="Print"
                                  onClick={() =>
                                    void printPaymentRequest(request)
                                  }
                                  className="rounded p-2 hover:bg-gray-100"
                                >
                                  <Printer size={17} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </div>

            {paymentRequestTotal > 0 && (
              <div className="flex items-center justify-between border-t bg-white px-4 py-3">
                <div className="text-sm text-gray-500">
                  Menampilkan {(paymentRequestPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(
                    paymentRequestPage * PAGE_SIZE,
                    paymentRequestTotal,
                  )}{" "}
                  dari {paymentRequestTotal} data
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentRequestPage((page) => Math.max(1, page - 1))
                    }
                    disabled={paymentRequestPage === 1}
                    className="rounded border p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Halaman sebelumnya"
                  >
                    <ChevronLeft size={17} />
                  </button>

                  <span className="min-w-[90px] text-center text-sm text-gray-600">
                    Halaman {paymentRequestPage} / {paymentRequestTotalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setPaymentRequestPage((page) =>
                        Math.min(paymentRequestTotalPages, page + 1),
                      )
                    }
                    disabled={paymentRequestPage === paymentRequestTotalPages}
                    className="rounded border p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Halaman berikutnya"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ======================================================
          FORM AJUKAN PEMBAYARAN
          ====================================================== */}

      {showRequestForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Ajukan Pembayaran</h2>

              <p className="text-sm text-gray-500">
                Transaksi yang dipilih akan dibuat menjadi Payment Voucher.
              </p>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Tanggal Pengajuan
                  </label>

                  <input
                    type="date"
                    value={requestDate}
                    onChange={(event) => setRequestDate(event.target.value)}
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    No Payment Voucher
                  </label>

                  <input
                    type="text"
                    value="Otomatis oleh sistem"
                    disabled
                    className="w-full rounded border bg-gray-100 px-3 py-2 text-sm text-gray-500"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded border">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 font-medium">Supplier</th>

                        <th className="px-4 py-3 font-medium">Invoice</th>

                        <th className="px-4 py-3 font-medium">RR</th>

                        <th className="px-4 py-3 font-medium">Jatuh Tempo</th>

                        <th className="px-4 py-3 font-medium text-right">
                          Sisa
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedInvoices.map((invoice: ApInvoice) => (
                        <tr key={invoice.id}>
                          <td className="px-3 py-2">{invoice.supplier_name}</td>

                          <td className="px-3 py-2">
                            {invoice.invoice_number}
                          </td>

                          <td className="px-3 py-2">
                            {invoice.receiving_number ?? "-"}
                          </td>

                          <td className="px-3 py-2">
                            {formatDate(invoice.due_date)}
                          </td>

                          <td className="px-3 py-2 text-right font-medium">
                            {formatCurrency(Number(invoice.remaining_amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    <tfoot className="border-t bg-gray-50">
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-3 text-right font-semibold"
                        >
                          Total
                        </td>

                        <td className="px-3 py-3 text-right font-bold">
                          {formatCurrency(selectedTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Catatan
                </label>

                <textarea
                  value={requestNotes}
                  onChange={(event) => setRequestNotes(event.target.value)}
                  rows={3}
                  className="w-full rounded border px-3 py-2 text-sm"
                  placeholder="Catatan pengajuan..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <button
                type="button"
                onClick={() => setShowRequestForm(false)}
                className="rounded border px-4 py-2 text-sm"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={() => void savePaymentRequest()}
                disabled={saving}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan Pengajuan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          DETAIL
          ====================================================== */}

      {detailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Detail Transaksi</h2>

              <button
                type="button"
                onClick={() => setDetailTarget(null)}
                className="rounded p-2 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              {"invoice_number" in detailTarget ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-gray-500">Supplier</div>

                    <div className="font-medium">
                      {detailTarget.supplier_name ?? "-"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">No Invoice</div>

                    <div className="font-medium">
                      {detailTarget.invoice_number}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">No Receiving</div>

                    <div className="font-medium">
                      {detailTarget.receiving_number ?? "-"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">
                      Tanggal Receiving
                    </div>

                    <div>{formatDate(detailTarget.receiving_date)}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Tanggal Invoice</div>

                    <div>{formatDate(detailTarget.invoice_date)}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Jatuh Tempo</div>

                    <div>{formatDate(detailTarget.due_date)}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Total</div>

                    <div className="font-medium">
                      {formatCurrency(Number(detailTarget.grand_total))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Sisa Hutang</div>

                    <div className="font-semibold">
                      {formatCurrency(Number(detailTarget.remaining_amount))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <div className="text-xs text-gray-500">
                        Tanggal Pengajuan
                      </div>

                      <div className="font-medium">
                        {formatDate(detailTarget.request_date)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500">
                        No Payment Voucher
                      </div>

                      <div className="font-medium">
                        {detailTarget.payment_request_number}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500">Status</div>

                      <div className="font-medium">{detailTarget.status}</div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded border">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">Supplier</th>

                            <th className="px-3 py-2 text-left">Invoice</th>

                            <th className="px-3 py-2 text-left">RR</th>

                            <th className="px-3 py-2 text-left">Jatuh Tempo</th>

                            <th className="px-3 py-2 text-right">Sisa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {paymentRequestDetailLoading ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="px-3 py-8 text-center text-gray-500"
                              >
                                Memuat detail...
                              </td>
                            </tr>
                          ) : paymentRequestDetailItems.length === 0 ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="px-3 py-8 text-center text-gray-500"
                              >
                                Tidak ada detail transaksi.
                              </td>
                            </tr>
                          ) : (
                            paymentRequestDetailItems.map(
                              (item: PaymentRequestDetailItem) => (
                                <tr key={item.id}>
                                  <td className="px-3 py-2">
                                    {item.supplier_name ?? "-"}
                                  </td>

                                  <td className="px-3 py-2 font-medium">
                                    {item.invoice_number ?? "-"}
                                  </td>

                                  <td className="px-3 py-2">
                                    {item.receiving_number ?? "-"}
                                  </td>

                                  <td className="px-3 py-2">
                                    {formatDate(item.due_date)}
                                  </td>

                                  <td className="px-3 py-2 text-right font-medium">
                                    {formatCurrency(item.requested_amount)}
                                  </td>
                                </tr>
                              ),
                            )
                          )}
                        </tbody>
                        <tfoot className="border-t bg-gray-50">
                          <tr>
                            <td
                              colSpan={4}
                              className="px-3 py-3 text-right font-semibold"
                            >
                              Total
                            </td>

                            <td className="px-3 py-3 text-right font-bold">
                              {formatCurrency(
                                paymentRequestDetailItems.reduce(
                                  (total, item) =>
                                    total + Number(item.requested_amount),
                                  0,
                                ),
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {detailTarget.notes && (
                    <div>
                      <div className="text-xs text-gray-500">Catatan</div>

                      <div className="mt-1 whitespace-pre-wrap">
                        {detailTarget.notes}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          CANCEL
          ====================================================== */}

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Batalkan Pengajuan</h2>

              <p className="text-sm text-gray-500">
                {cancelTarget.payment_request_number}
              </p>
            </div>

            <div className="p-6">
              <label className="mb-1 block text-sm font-medium">
                Alasan Pembatalan
              </label>

              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={4}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="rounded border px-4 py-2 text-sm"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={saving}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Memproses..." : "Batalkan Pengajuan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SupplierInvoicePage;
