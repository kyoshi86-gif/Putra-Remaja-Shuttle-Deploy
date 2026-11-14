import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCustomUser } from "@/lib/authUser";

import type { ApInvoice, ApPaymentRequestFormData } from "../types";

type PaymentRequestItemRow = {
  id: string;
  payment_request_id: string;
  ap_invoice_id: string | null;
  receiving_record_id: string | null;
  requested_amount: number;
  notes: string | null;
};

export type PaymentRequestDetailItem = {
  id: string;
  payment_request_id: string;
  ap_invoice_id: string | null;
  receiving_record_id: string | null;
  requested_amount: number;
  notes: string | null;

  supplier_name: string | null;
  supplier_code: string | null;

  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;

  receiving_number: string | null;
  receiving_date: string | null;

  grand_total: number;
  paid_amount: number;
  remaining_amount: number;
};

export type PaymentRequestRow = {
  id: string;
  entity_id: string;
  payment_request_number: string;
  request_date: string;
  supplier_id: string;
  supplier_name?: string | null;
  supplier_code?: string | null;

  total_amount: number;
  status: "DRAFT" | "APPROVED" | "CANCELLED" | "PAID";

  payment_id?: string | null;
  payment_number?: string | null;
  payment_date?: string | null;
  payment_method_id?: string | null;
  payment_method_name?: string | null;
  payment_method_code?: string | null;

  notes: string | null;

  created_by: string | null;
  updated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;

  created_at: string;
  updated_at: string;
};

export function useApInvoices() {
  const [invoices, setInvoices] = useState<ApInvoice[]>([]);

  const [paymentRequests, setPaymentRequests] = useState<PaymentRequestRow[]>(
    [],
  );

  const [invoiceTotal, setInvoiceTotal] = useState(0);

  const [paymentRequestTotal, setPaymentRequestTotal] = useState(0);

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const user = getCustomUser();

  const entityId = user?.entity_id ?? null;

  const createdBy = user?.id ?? null;

  /**
   * ============================================================
   * FETCH AP INVOICES - SERVER SIDE
   * ============================================================
   */
  const fetchInvoices = useCallback(
    async (keyword = "", page = 1, pageSize = 25) => {
      if (!entityId) {
        setInvoices([]);
        setInvoiceTotal(0);

        return {
          invoices: [],
          total: 0,
        };
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc(
          "get_available_ap_invoices_paginated",
          {
            p_entity_id: entityId,
            p_keyword: keyword.trim(),
            p_page: page,
            p_page_size: pageSize,
          },
        );

        if (rpcError) {
          throw rpcError;
        }

        const rows = (data ?? []) as Array<{
          data: ApInvoice;
          total_count: number | string | null;
        }>;

        const total = Number(rows[0]?.total_count ?? 0);

        const result = rows.map((row) => row.data);

        setInvoices(result);
        setInvoiceTotal(total);

        return {
          invoices: result,
          total,
        };
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Gagal mengambil data Supplier Invoice.";

        console.error("AP Invoice fetch error:", err);

        setError(message);
        setInvoices([]);
        setInvoiceTotal(0);

        return {
          invoices: [],
          total: 0,
        };
      } finally {
        setLoading(false);
      }
    },
    [entityId],
  );

  /**
   * ============================================================
   * FETCH PAYMENT REQUEST - SERVER SIDE
   * ============================================================
   */
  const fetchPaymentRequests = useCallback(
    async (keyword = "", page = 1, pageSize = 25) => {
      if (!entityId) {
        setPaymentRequests([]);
        setPaymentRequestTotal(0);

        return {
          requests: [],
          total: 0,
        };
      }

      try {
        const { data, error: rpcError } = await supabase.rpc(
          "get_ap_payment_requests_paginated",
          {
            p_entity_id: entityId,

            p_keyword: keyword.trim(),

            p_page: page,

            p_page_size: pageSize,
          },
        );

        if (rpcError) {
          throw rpcError;
        }

        const rows = (data ?? []) as Array<{
          data: PaymentRequestRow;
          total_count: number | string | null;
        }>;

        const total = Number(rows[0]?.total_count ?? 0);

        const requests = rows.map((row) => row.data);

        setPaymentRequests(requests);

        setPaymentRequestTotal(total);

        return {
          requests,
          total,
        };
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Gagal mengambil Payment Request.";

        console.error("Payment Request fetch error:", err);

        setError(message);
        setPaymentRequests([]);
        setPaymentRequestTotal(0);

        return {
          requests: [],
          total: 0,
        };
      }
    },
    [entityId],
  );

  /**
   * ============================================================
   * FETCH PAYMENT REQUEST ITEMS
   *
   * HANYA dipanggil saat:
   * - Detail
   * - Print
   *
   * Tidak lagi dipanggil untuk seluruh Payment Request
   * hanya untuk kebutuhan search.
   * ============================================================
   */
  const fetchPaymentRequestItems = useCallback(
    async (paymentRequestId: string): Promise<PaymentRequestDetailItem[]> => {
      const { data: itemData, error: itemError } = await supabase
        .from("ap_payment_request_items")
        .select(
          `
            id,
            payment_request_id,
            ap_invoice_id,
            receiving_record_id,
            requested_amount,
            notes
          `,
        )
        .eq("payment_request_id", paymentRequestId)
        .order("id", {
          ascending: true,
        });

      if (itemError) {
        throw itemError;
      }

      const items = (itemData ?? []) as PaymentRequestItemRow[];

      if (items.length === 0) {
        return [];
      }

      const invoiceIds = Array.from(
        new Set(
          items
            .map((item) => item.ap_invoice_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      type PaymentInvoiceRow = {
        id: string;
        supplier_id: string;
        receiving_record_id: string | null;
        invoice_number: string;
        invoice_date: string;
        due_date: string | null;
        grand_total: number;
        paid_amount: number;
        remaining_amount: number;
      };

      const invoiceMap = new Map<string, PaymentInvoiceRow>();

      if (invoiceIds.length > 0) {
        const { data: invoiceData, error: invoiceError } = await supabase
          .from("ap_invoices")
          .select(
            `
              id,
              supplier_id,
              receiving_record_id,
              invoice_number,
              invoice_date,
              due_date,
              grand_total,
              paid_amount,
              remaining_amount
            `,
          )
          .in("id", invoiceIds);

        if (invoiceError) {
          throw invoiceError;
        }

        for (const invoice of (invoiceData ?? []) as PaymentInvoiceRow[]) {
          invoiceMap.set(invoice.id, invoice);
        }
      }

      const receivingIds = Array.from(
        new Set(
          [
            ...items.map((item) => item.receiving_record_id),

            ...Array.from(invoiceMap.values()).map(
              (invoice) => invoice.receiving_record_id,
            ),
          ].filter((id): id is string => Boolean(id)),
        ),
      );

      type PaymentReceivingRow = {
        id: string;
        receiving_number: string;
        receiving_date: string;
      };

      const receivingMap = new Map<string, PaymentReceivingRow>();

      if (receivingIds.length > 0) {
        const { data: receivingData, error: receivingError } = await supabase
          .from("receiving_records")
          .select(
            `
              id,
              receiving_number,
              receiving_date
            `,
          )
          .in("id", receivingIds);

        if (receivingError) {
          throw receivingError;
        }

        for (const receiving of (receivingData ??
          []) as PaymentReceivingRow[]) {
          receivingMap.set(receiving.id, receiving);
        }
      }

      const supplierIds = Array.from(
        new Set(
          Array.from(invoiceMap.values()).map((invoice) => invoice.supplier_id),
        ),
      );

      type PaymentSupplierRow = {
        id: string;
        code: string;
        name: string;
      };

      const supplierMap = new Map<string, PaymentSupplierRow>();

      if (supplierIds.length > 0) {
        const { data: supplierData, error: supplierError } = await supabase
          .from("suppliers")
          .select(
            `
              id,
              code,
              name
            `,
          )
          .in("id", supplierIds);

        if (supplierError) {
          throw supplierError;
        }

        for (const supplier of (supplierData ?? []) as PaymentSupplierRow[]) {
          supplierMap.set(supplier.id, supplier);
        }
      }

      return items.map((item): PaymentRequestDetailItem => {
        const invoice = item.ap_invoice_id
          ? invoiceMap.get(item.ap_invoice_id)
          : undefined;

        const receivingId =
          item.receiving_record_id ?? invoice?.receiving_record_id ?? null;

        const receiving = receivingId
          ? receivingMap.get(receivingId)
          : undefined;

        const supplier = invoice
          ? supplierMap.get(invoice.supplier_id)
          : undefined;

        return {
          id: item.id,

          payment_request_id: item.payment_request_id,

          ap_invoice_id: item.ap_invoice_id,

          receiving_record_id: item.receiving_record_id,

          requested_amount: Number(item.requested_amount),

          notes: item.notes,

          supplier_name: supplier?.name ?? null,

          supplier_code: supplier?.code ?? null,

          invoice_number: invoice?.invoice_number ?? null,

          invoice_date: invoice?.invoice_date ?? null,

          due_date: invoice?.due_date ?? null,

          receiving_number: receiving?.receiving_number ?? null,

          receiving_date: receiving?.receiving_date ?? null,

          grand_total: Number(invoice?.grand_total ?? 0),

          paid_amount: Number(invoice?.paid_amount ?? 0),

          remaining_amount: Number(invoice?.remaining_amount ?? 0),
        };
      });
    },
    [],
  );

  /**
   * ============================================================
   * CREATE PAYMENT REQUEST
   * ============================================================
   */
  const createPaymentRequest = useCallback(
    async (payload: ApPaymentRequestFormData) => {
      if (!entityId) {
        setError("Entity user tidak ditemukan.");
        return null;
      }

      if (!createdBy) {
        setError("User pembuat tidak ditemukan.");
        return null;
      }

      if (payload.items.length === 0) {
        setError("Minimal satu invoice harus dipilih.");
        return null;
      }

      setSaving(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc(
          "create_ap_payment_request",
          {
            p_entity_id: entityId,

            p_request_date: payload.request_date,

            p_supplier_id: payload.supplier_id,

            p_items: payload.items,

            p_notes: payload.notes ?? null,

            p_created_by: null,
          },
        );

        if (rpcError) {
          console.error("=== CREATE PAYMENT REQUEST RPC ERROR ===", {
            code: rpcError.code,

            message: rpcError.message,

            details: rpcError.details,

            hint: rpcError.hint,
          });

          setError(
            [
              `Code: ${rpcError.code ?? "-"}`,
              `Message: ${rpcError.message ?? "-"}`,
              `Details: ${rpcError.details ?? "-"}`,
              `Hint: ${rpcError.hint ?? "-"}`,
            ].join(" | "),
          );

          return null;
        }

        return data as {
          success: boolean;
          payment_request_id: string;
          payment_request_number: string;
          supplier_id: string;
          request_date: string;
          total_amount: number;
          status: "DRAFT";
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Gagal membuat Payment Request.";

        setError(message);

        return null;
      } finally {
        setSaving(false);
      }
    },
    [entityId, createdBy],
  );

  /**
   * ============================================================
   * APPROVE
   * ============================================================
   */
  const approvePaymentRequest = useCallback(
    async (paymentRequestId: string) => {
      if (!createdBy) {
        setError("User pengguna tidak ditemukan.");
        return null;
      }

      setSaving(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc(
          "approve_ap_payment_request",
          {
            p_payment_request_id: paymentRequestId,

            p_approved_by: null,
          },
        );

        if (rpcError) {
          console.error("=== APPROVE PAYMENT REQUEST RPC ERROR ===", rpcError);

          setError(
            [
              `Code: ${rpcError.code ?? "-"}`,
              `Message: ${rpcError.message ?? "-"}`,
              `Details: ${rpcError.details ?? "-"}`,
              `Hint: ${rpcError.hint ?? "-"}`,
            ].join(" | "),
          );

          return null;
        }

        return data as {
          success: boolean;
          payment_request_id: string;
          payment_request_number: string;
          status: "APPROVED";
          total_amount: number;
          approved_at: string;
        };
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Gagal menyetujui Payment Request.";

        setError(message);

        return null;
      } finally {
        setSaving(false);
      }
    },
    [createdBy],
  );

  /**
   * ============================================================
   * CANCEL PAYMENT REQUEST
   * ============================================================
   */
  const cancelPaymentRequest = useCallback(
    async (paymentRequestId: string, reason: string) => {
      if (!createdBy) {
        setError("User pengguna tidak ditemukan.");
        return null;
      }

      setSaving(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc(
          "cancel_ap_payment_request",
          {
            p_payment_request_id: paymentRequestId,

            p_cancelled_by: null,

            p_cancel_reason: reason,
          },
        );

        if (rpcError) {
          throw rpcError;
        }

        return data;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Gagal membatalkan Payment Request.";

        setError(message);

        return null;
      } finally {
        setSaving(false);
      }
    },
    [createdBy],
  );

  /**
   * ============================================================
   * UPDATE INVOICE
   * ============================================================
   */
  const updateInvoice = useCallback(
    async (
      invoiceId: string,
      payload: {
        invoice_number: string;
        invoice_date: string;
        due_date: string | null;
        notes: string | null;
      },
    ) => {
      setSaving(true);
      setError(null);

      try {
        const { data, error: updateError } = await supabase.rpc(
          "update_ap_invoice",
          {
            p_invoice_id: invoiceId,

            p_invoice_number: payload.invoice_number,

            p_invoice_date: payload.invoice_date,

            p_due_date: payload.due_date || null,

            p_notes: payload.notes || null,
          },
        );

        if (updateError) {
          throw updateError;
        }

        return data;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Gagal memperbarui Supplier Invoice.";

        setError(message);

        return null;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  /**
   * ============================================================
   * DELETE INVOICE
   * ============================================================
   */
  const deleteInvoice = useCallback(async (invoiceId: string) => {
    setSaving(true);
    setError(null);

    try {
      const { data, error: deleteError } = await supabase.rpc(
        "delete_ap_invoice",
        {
          p_invoice_id: invoiceId,
        },
      );

      if (deleteError) {
        throw deleteError;
      }

      return data;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal menghapus Supplier Invoice.";

      setError(message);

      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  /**
   * ============================================================
   * OPEN INVOICE
   * ============================================================
   */
  const openInvoice = useCallback(async (invoiceId: string) => {
    setSaving(true);
    setError(null);

    try {
      const { data, error: openError } = await supabase.rpc("open_ap_invoice", {
        p_invoice_id: invoiceId,
      });

      if (openError) {
        throw openError;
      }

      return data;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal membuka Supplier Invoice.";

      setError(message);

      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  /**
   * ============================================================
   * CANCEL INVOICE
   * ============================================================
   */
  const cancelInvoice = useCallback(
    async (invoiceId: string, reason: string) => {
      setSaving(true);
      setError(null);

      try {
        const { data, error: cancelError } = await supabase.rpc(
          "cancel_ap_invoice",
          {
            p_invoice_id: invoiceId,

            p_cancel_reason: reason,
          },
        );

        if (cancelError) {
          throw cancelError;
        }

        return data;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Gagal membatalkan Supplier Invoice.";

        setError(message);

        return null;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return {
    invoices,
    paymentRequests,

    invoiceTotal,
    paymentRequestTotal,

    loading,
    saving,
    error,

    entityId,
    createdBy,

    fetchInvoices,
    fetchPaymentRequests,
    fetchPaymentRequestItems,

    updateInvoice,
    deleteInvoice,
    openInvoice,
    cancelInvoice,

    createPaymentRequest,
    approvePaymentRequest,
    cancelPaymentRequest,
  };
}
