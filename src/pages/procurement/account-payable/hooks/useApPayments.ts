import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCustomUser, getCustomUserId } from "@/lib/authUser";

import type {
  ApPayment,
  ApPaymentFormData,
  ApPaymentAllocation,
  ApPaymentSettlementMethod,
  ApOutstandingInvoice,
  SupplierDepositOption,
  SupplierOption,
  ApprovedPaymentRequest,
  ApprovedPaymentRequestItem,
} from "../types";

/**
 * ============================================================
 * TYPES
 * ============================================================
 */

type ApPaymentResult = {
  success: boolean;
  payment_id?: string;
  payment_number?: string;
  entity_id?: string;
  supplier_id?: string;
  payment_date?: string;
  payment_method_id?: string;
  amount?: number;
  reference_number?: string | null;
  notes?: string | null;
  allocation_count?: number;
};

type DeleteApPaymentResult = {
  success: boolean;
  payment_id?: string;
  payment_number?: string;
  amount?: number;
  affected_invoice_count?: number;
  reversed_deposit_count?: number;
};

export type PaymentRequestLookup = {
  id: string;
  payment_request_number: string | null;
};

type ApInvoiceLookup = {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  supplier_id: string | null;
  receiving_record_id: string | null;
};

type SupplierLookup = {
  id: string;
  code: string | null;
  name: string | null;
};

type ReceivingLookup = {
  id: string;
  receiving_number: string | null;
};

/**
 * ============================================================
 * HOOK
 * ============================================================
 */

export function useApPayments() {
  const [payments, setPayments] = useState<ApPayment[]>([]);

  const [paymentsTotalCount, setPaymentsTotalCount] = useState(0);

  const [paymentRequests, setPaymentRequests] = useState<
    PaymentRequestLookup[]
  >([]);

  const [approvedPaymentRequests, setApprovedPaymentRequests] = useState<
    ApprovedPaymentRequest[]
  >([]);

  const [loadingPaymentRequests, setLoadingPaymentRequests] = useState(false);

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);

  const [settlementMethods, setSettlementMethods] = useState<
    ApPaymentSettlementMethod[]
  >([]);

  const [outstandingInvoices, setOutstandingInvoices] = useState<
    ApOutstandingInvoice[]
  >([]);

  const [deposits, setDeposits] = useState<SupplierDepositOption[]>([]);

  const [loadingDeposits, setLoadingDeposits] = useState(false);

  const [loading, setLoading] = useState(false);

  const [loadingMasters, setLoadingMasters] = useState(false);

  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const user = getCustomUser();

  const entityId = user?.entity_id ?? null;

  const customUserId = getCustomUserId();

  /**
   * ==========================================================
   * FETCH PAYMENTS
   * ==========================================================
   */

  const fetchPayments = useCallback(
    async (
      keyword = "",
      dateFrom = "",
      dateTo = "",
      page = 1,
      pageSize = 25,
    ) => {
      if (!entityId) {
        setPayments([]);
        setPaymentRequests([]);
        setPaymentsTotalCount(0);
        return { rows: [], totalCount: 0 };
      }

      setLoading(true);
      setError(null);

      try {
        const safePage = Math.max(1, page);
        const safePageSize = Math.max(1, pageSize);
        const from = (safePage - 1) * safePageSize;
        const to = from + safePageSize - 1;
        const normalizedKeyword = keyword.trim();

        let query = supabase
          .from("ap_payments")
          .select("*", { count: "exact" })
          .eq("entity_id", entityId)
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, to);

        if (dateFrom) {
          query = query.gte("payment_date", dateFrom);
        }

        if (dateTo) {
          query = query.lte("payment_date", dateTo);
        }

        if (normalizedKeyword) {
          const escaped = normalizedKeyword.replace(/[%_]/g, "\\$&");

          const { data: matchingRequests, error: matchingRequestError } =
            await supabase
              .from("ap_payment_requests")
              .select("id")
              .eq("entity_id", entityId)
              .ilike("payment_request_number", `%${escaped}%`);

          if (matchingRequestError) {
            throw matchingRequestError;
          }

          const matchingRequestIds = (matchingRequests ?? []).map(
            (row) => row.id,
          );

          const paymentConditions = [
            `payment_number.ilike.%${escaped}%`,
            `reference_number.ilike.%${escaped}%`,
          ];

          if (matchingRequestIds.length > 0) {
            paymentConditions.push(
              `payment_request_id.in.(${matchingRequestIds.join(",")})`,
            );
          }

          query = query.or(paymentConditions.join(","));
        }

        const { data: pageData, error: pageError, count } = await query;

        if (pageError) throw pageError;

        const rows = (pageData ?? []) as unknown as ApPayment[];

        const requestIds = [
          ...new Set(
            rows
              .map((row) => row.payment_request_id)
              .filter((id): id is string => Boolean(id)),
          ),
        ];

        if (requestIds.length > 0) {
          const { data: requestData, error: requestError } = await supabase
            .from("ap_payment_requests")
            .select("id, payment_request_number")
            .eq("entity_id", entityId)
            .in("id", requestIds);

          if (requestError) {
            console.warn(
              "Gagal mengambil Payment Voucher AP Payment:",
              requestError.message,
            );
            setPaymentRequests([]);
          } else {
            setPaymentRequests((requestData ?? []) as PaymentRequestLookup[]);
          }
        } else {
          setPaymentRequests([]);
        }

        const methodIds = [
          ...new Set(
            rows
              .map((row) => row.payment_method_id)
              .filter((id): id is string => Boolean(id)),
          ),
        ];

        if (methodIds.length > 0) {
          const { data: methodData, error: methodError } = await supabase
            .from("purchase_settlement_methods")
            .select("id, code, name, settlement_type")
            .in("id", methodIds);

          if (methodError) {
            console.warn(
              "Gagal mengambil payment method AP Payment:",
              methodError.message,
            );
            setPayments(rows);
          } else {
            const methodMap = new Map(
              (methodData ?? []).map((method) => [method.id, method]),
            );

            setPayments(
              rows.map((row) => ({
                ...row,
                purchase_settlement_methods: row.payment_method_id
                  ? (methodMap.get(row.payment_method_id) ?? null)
                  : null,
              })) as unknown as ApPayment[],
            );
          }
        } else {
          setPayments(rows);
        }

        const totalCount = count ?? 0;
        setPaymentsTotalCount(totalCount);

        return {
          rows,
          totalCount,
        };
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Gagal mengambil data AP Payment.";

        console.error("=== FETCH AP PAYMENTS ERROR ===", err);
        setError(message);
        setPayments([]);
        setPaymentRequests([]);
        setPaymentsTotalCount(0);

        return {
          rows: [],
          totalCount: 0,
        };
      } finally {
        setLoading(false);
      }
    },
    [entityId],
  );

  /**
   * ==========================================================
   * FETCH PAYMENTS FOR EXPORT
   *
   * Tetap server-side. Data diambil bertahap berdasarkan filter,
   * bukan mengambil seluruh tabel tanpa filter.
   * ==========================================================
   */

  const fetchPaymentsForExport = useCallback(
    async (keyword = "", dateFrom = "", dateTo = ""): Promise<ApPayment[]> => {
      if (!entityId) return [];

      const batchSize = 1000;
      let from = 0;
      const allRows: ApPayment[] = [];

      while (true) {
        let query = supabase
          .from("ap_payments")
          .select("*")
          .eq("entity_id", entityId)
          .order("payment_date", {
            ascending: false,
          })
          .order("created_at", {
            ascending: false,
          })
          .range(from, from + batchSize - 1);

        if (dateFrom) {
          query = query.gte("payment_date", dateFrom);
        }

        if (dateTo) {
          query = query.lte("payment_date", dateTo);
        }

        const normalizedKeyword = keyword.trim();

        if (normalizedKeyword) {
          const escaped = normalizedKeyword.replace(/[%_]/g, "\\$&");

          const { data: matchingRequests, error: matchingRequestError } =
            await supabase
              .from("ap_payment_requests")
              .select("id")
              .eq("entity_id", entityId)
              .ilike("payment_request_number", `%${escaped}%`);

          if (matchingRequestError) {
            throw matchingRequestError;
          }

          const matchingRequestIds = (matchingRequests ?? []).map(
            (row: { id: string }) => row.id,
          );

          const conditions: string[] = [
            `payment_number.ilike.%${escaped}%`,
            `reference_number.ilike.%${escaped}%`,
          ];

          if (matchingRequestIds.length) {
            conditions.push(
              `payment_request_id.in.(${matchingRequestIds.join(",")})`,
            );
          }

          query = query.or(conditions.join(","));
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        const rows = (data ?? []) as unknown as ApPayment[];

        allRows.push(...rows);

        if (rows.length < batchSize) {
          break;
        }

        from += batchSize;
      }

      return allRows;
    },
    [entityId],
  );

  /**
   * ==========================================================
   * FETCH APPROVED PAYMENT REQUESTS / PAYMENT VOUCHERS
   *
   * PaymentPage tidak lagi memilih supplier.
   *
   * Yang dipilih adalah:
   *
   * PV2608130001
   * PV2608130002
   * dst.
   *
   * Hanya status APPROVED dan yang belum memiliki payment.
   * ==========================================================
   */

  const fetchApprovedPaymentRequests = useCallback(async () => {
    if (!entityId) {
      setApprovedPaymentRequests([]);
      return;
    }

    setLoadingPaymentRequests(true);
    setError(null);

    try {
      /**
       * ------------------------------------------------------
       * 1. Ambil header PV APPROVED
       * ------------------------------------------------------
       */

      const { data: requestData, error: requestError } = await supabase
        .from("ap_payment_requests")
        .select(
          `
          id,
          entity_id,
          payment_request_number,
          request_date,
          status,
          total_amount,
          notes,
          created_at
        `,
        )
        .eq("entity_id", entityId)
        .eq("status", "APPROVED")
        .order("request_date", {
          ascending: false,
        })
        .order("created_at", {
          ascending: false,
        });

      if (requestError) {
        throw requestError;
      }

      const requests = requestData ?? [];

      if (requests.length === 0) {
        setApprovedPaymentRequests([]);
        return;
      }

      /**
       * ------------------------------------------------------
       * 2. Cari PV yang sudah memiliki payment
       *
       * Jangan tampilkan lagi di daftar pembayaran.
       * ------------------------------------------------------
       */

      const requestIds = requests.map((request) => request.id);

      const { data: paymentData, error: paymentError } = await supabase
        .from("ap_payments")
        .select("payment_request_id")
        .eq("entity_id", entityId)
        .in("payment_request_id", requestIds);

      if (paymentError) {
        throw paymentError;
      }

      const paidRequestIds = new Set(
        (paymentData ?? [])
          .map((payment) => payment.payment_request_id)
          .filter((id): id is string => Boolean(id)),
      );

      /**
       * ------------------------------------------------------
       * 3. Hanya PV APPROVED yang belum dibayar
       * ------------------------------------------------------
       */

      const unpaidRequests = requests.filter(
        (request) => !paidRequestIds.has(request.id),
      );

      if (unpaidRequests.length === 0) {
        setApprovedPaymentRequests([]);
        return;
      }

      /**
       * ------------------------------------------------------
       * 4. Ambil item PV
       * ------------------------------------------------------
       */

      const unpaidRequestIds = unpaidRequests.map((request) => request.id);

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
        .in("payment_request_id", unpaidRequestIds);

      if (itemError) {
        throw itemError;
      }

      const items = itemData ?? [];

      /**
       * ------------------------------------------------------
       * 5. Ambil invoice yang digunakan item PV
       * ------------------------------------------------------
       */

      const invoiceIds = items
        .map((item) => item.ap_invoice_id)
        .filter((id): id is string => Boolean(id));

      let invoiceData: ApInvoiceLookup[] = [];

      if (invoiceIds.length > 0) {
        const { data, error: invoiceError } = await supabase
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
          .in("id", invoiceIds);

        if (invoiceError) {
          throw invoiceError;
        }

        invoiceData = data ?? [];
      }

      /**
       * ------------------------------------------------------
       * 6. Supplier
       * ------------------------------------------------------
       */

      const supplierIds = invoiceData
        .map((invoice) => invoice.supplier_id)
        .filter((id): id is string => Boolean(id));

      let supplierData: SupplierLookup[] = [];

      if (supplierIds.length > 0) {
        const { data, error: supplierError } = await supabase
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

        supplierData = data ?? [];
      }

      /**
       * ------------------------------------------------------
       * 7. Receiving
       * ------------------------------------------------------
       */

      const receivingIds = invoiceData
        .map((invoice) => invoice.receiving_record_id)
        .filter((id): id is string => Boolean(id));

      let receivingData: ReceivingLookup[] = [];

      if (receivingIds.length > 0) {
        const { data, error: receivingError } = await supabase
          .from("receiving_records")
          .select(
            `
            id,
            receiving_number
          `,
          )
          .in("id", receivingIds);

        if (receivingError) {
          throw receivingError;
        }

        receivingData = data ?? [];
      }

      /**
       * ------------------------------------------------------
       * 8. Mapping
       * ------------------------------------------------------
       */

      const invoiceMap = new Map(
        invoiceData.map((invoice) => [invoice.id, invoice]),
      );

      const supplierMap = new Map(
        supplierData.map((supplier) => [supplier.id, supplier]),
      );

      const receivingMap = new Map(
        receivingData.map((receiving) => [receiving.id, receiving]),
      );

      const itemsByRequest = new Map<string, ApprovedPaymentRequestItem[]>();

      for (const item of items) {
        const invoice = item.ap_invoice_id
          ? invoiceMap.get(item.ap_invoice_id)
          : null;

        const supplier = invoice?.supplier_id
          ? supplierMap.get(invoice.supplier_id)
          : null;

        const receiving = invoice?.receiving_record_id
          ? receivingMap.get(invoice.receiving_record_id)
          : null;

        const mappedItem: ApprovedPaymentRequestItem = {
          id: item.id,
          payment_request_id: item.payment_request_id,
          ap_invoice_id: item.ap_invoice_id,
          receiving_record_id: item.receiving_record_id,
          requested_amount: Number(item.requested_amount),

          ap_invoice: invoice
            ? {
                id: invoice.id,
                invoice_number: invoice.invoice_number,
                invoice_date: invoice.invoice_date,
                due_date: invoice.due_date,

                supplier: supplier
                  ? {
                      id: supplier.id,
                      code: supplier.code,
                      name: supplier.name,
                    }
                  : null,

                receiving_record: receiving
                  ? {
                      id: receiving.id,
                      receiving_number: receiving.receiving_number,
                    }
                  : null,
              }
            : null,
        };

        const current = itemsByRequest.get(item.payment_request_id) ?? [];

        current.push(mappedItem);

        itemsByRequest.set(item.payment_request_id, current);
      }

      /**
       * ------------------------------------------------------
       * 9. Final PV
       * ------------------------------------------------------
       */

      const mappedRequests: ApprovedPaymentRequest[] = unpaidRequests.map(
        (request) => ({
          id: request.id,
          entity_id: request.entity_id,
          payment_request_number: request.payment_request_number,
          request_date: request.request_date,
          status: "APPROVED",
          total_amount: Number(request.total_amount),
          notes: request.notes,
          created_at: request.created_at,
          items: itemsByRequest.get(request.id) ?? [],
        }),
      );

      setApprovedPaymentRequests(mappedRequests);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal mengambil Payment Voucher.";

      setError(message);
      setApprovedPaymentRequests([]);
    } finally {
      setLoadingPaymentRequests(false);
    }
  }, [entityId]);

  /**
   * ==========================================================
   * FETCH SUPPLIERS
   * ==========================================================
   */

  const fetchSuppliers = useCallback(async () => {
    if (!entityId) {
      setSuppliers([]);
      return;
    }

    const { data, error: supplierError } = await supabase
      .from("suppliers")
      .select(
        `
          id,
          code,
          name,
          default_payment_term_days,
          is_active
        `,
      )
      .eq("entity_id", entityId)
      .eq("is_active", true)
      .order("code", {
        ascending: true,
      });

    if (supplierError) {
      setError(supplierError.message);
      setSuppliers([]);
      return;
    }

    setSuppliers((data ?? []) as SupplierOption[]);
  }, [entityId]);

  /**
   * ==========================================================
   * FETCH PAYMENT / SETTLEMENT METHODS
   *
   * Hanya yang tersedia untuk PAYMENT:
   *
   * PAYMENT
   * BOTH
   *
   * CREDIT_TERM / RECEIVING only tidak muncul.
   * ==========================================================
   */

  const fetchSettlementMethods = useCallback(async () => {
    if (!entityId) {
      setSettlementMethods([]);
      return;
    }

    const { data, error: methodError } = await supabase
      .from("purchase_settlement_methods")
      .select(
        `
            id,
            entity_id,
            code,
            name,
            settlement_type,
            account_id,
            requires_amount,
            is_system,
            is_active,
            available_for
          `,
      )
      .eq("is_active", true)
      .in("available_for", ["PAYMENT", "BOTH"])
      .order("name", {
        ascending: true,
      });

    if (methodError) {
      setError(methodError.message);
      setSettlementMethods([]);
      return;
    }

    setSettlementMethods((data ?? []) as ApPaymentSettlementMethod[]);
  }, [entityId]);

  /**
   * ==========================================================
   * FETCH OUTSTANDING INVOICES
   *
   * Hanya:
   *
   * OPEN
   * PARTIAL
   *
   * dan remaining_amount > 0
   *
   * Jika supplierId diberikan,
   * hanya invoice supplier tersebut.
   * ==========================================================
   */

  const fetchOutstandingInvoices = useCallback(
    async (supplierId?: string | null) => {
      if (!entityId) {
        setOutstandingInvoices([]);
        return;
      }

      setLoadingInvoices(true);
      setError(null);

      let query = supabase
        .from("ap_invoices")
        .select(
          `
            id,
            entity_id,
            receiving_record_id,
            supplier_id,
            invoice_number,
            invoice_date,
            due_date,
            subtotal,
            discount_amount,
            tax_amount,
            grand_total,
            paid_amount,
            remaining_amount,
            status,
            notes
          `,
        )
        .eq("entity_id", entityId)
        .in("status", ["OPEN", "PARTIAL"])
        .gt("remaining_amount", 0)
        .order("due_date", {
          ascending: true,
          nullsFirst: false,
        })
        .order("invoice_date", {
          ascending: true,
        });

      if (supplierId) {
        query = query.eq("supplier_id", supplierId);
      }

      const { data, error: invoiceError } = await query;

      if (invoiceError) {
        setError(invoiceError.message);
        setOutstandingInvoices([]);
      } else {
        setOutstandingInvoices((data ?? []) as ApOutstandingInvoice[]);
      }

      setLoadingInvoices(false);
    },
    [entityId],
  );

  const fetchSupplierDeposits = useCallback(
    async (supplierId?: string | null) => {
      if (!entityId) {
        setDeposits([]);
        return;
      }

      setLoadingDeposits(true);

      let query = supabase
        .from("supplier_deposits")
        .select(
          `
            id,
            supplier_id,
            reference,
            description,
            original_amount,
            allocated_amount,
            status
          `,
        )
        .eq("entity_id", entityId)
        .in("status", ["OPEN", "PARTIAL"])
        .order("deposit_date", {
          ascending: false,
        });

      if (supplierId) {
        query = query.eq("supplier_id", supplierId);
      }

      const { data, error: depositError } = await query;

      if (depositError) {
        setError(depositError.message);
        setDeposits([]);
      } else {
        setDeposits((data ?? []) as SupplierDepositOption[]);
      }

      setLoadingDeposits(false);
    },
    [entityId],
  );

  /**
   * ==========================================================
   * FETCH ALL MASTERS
   * ==========================================================
   */

  const fetchMasters = useCallback(async () => {
    setLoadingMasters(true);
    setError(null);

    await Promise.all([fetchSuppliers(), fetchSettlementMethods()]);

    setLoadingMasters(false);
  }, [fetchSuppliers, fetchSettlementMethods]);

  /**
   * ==========================================================
   * INITIAL LOAD
   * ==========================================================
   */

  useEffect(() => {
    if (!entityId) {
      setPayments([]);
      setPaymentsTotalCount(0);
      setSuppliers([]);
      setSettlementMethods([]);
      setOutstandingInvoices([]);
      return;
    }

    void fetchMasters();
    void fetchApprovedPaymentRequests();
  }, [
    entityId,
    fetchPayments,
    fetchPaymentsForExport,
    fetchMasters,
    fetchApprovedPaymentRequests,
  ]);

  /**
   * ==========================================================
   * CREATE PAYMENT
   *
   * Satu payment bisa:
   *
   * Payment
   * ├── Invoice A
   * ├── Invoice B
   * └── Invoice C
   *
   * ==========================================================
   */

  const createPayment = useCallback(
    async (payload: ApPaymentFormData): Promise<ApPaymentResult | null> => {
      if (!entityId) {
        setError("Entity user tidak ditemukan.");
        return null;
      }

      if (!payload.payment_request_id) {
        setError("Payment Voucher wajib dipilih.");
        return null;
      }

      if (!payload.payment_method_id) {
        setError("Metode pembayaran wajib dipilih.");
        return null;
      }

      if (!payload.allocations || payload.allocations.length === 0) {
        setError("Item Payment Voucher tidak ditemukan.");
        return null;
      }

      setSaving(true);
      setError(null);

      try {
        const allocations = payload.allocations.map((item) => ({
          invoice_id: item.invoice_id,

          amount: Number(item.amount),

          ...(item.deposit_id
            ? {
                deposit_id: item.deposit_id,
              }
            : {}),
        }));

        /**
         * ======================================================
         * PENTING
         *
         * createdBy dari getCustomUser() adalah "01",
         * sedangkan RPC meminta UUID.
         *
         * Jadi jangan kirim "01".
         *
         * Untuk sekarang NULL.
         * ======================================================
         */

        const { data, error: createError } = await supabase.rpc(
          "create_ap_payment",
          {
            p_entity_id: entityId,

            p_payment_date: payload.payment_date,

            p_payment_method_id: payload.payment_method_id,

            p_reference_number: payload.reference_number || null,

            p_notes: payload.notes || null,

            p_created_by: null,

            p_custom_user_id: customUserId,

            p_payment_request_id: payload.payment_request_id,

            p_allocations: allocations,
          },
        );

        if (createError) {
          setError(createError.message);
          return null;
        }

        const result = data as ApPaymentResult;

        /*
         * Pastikan row payment yang baru dibuat langsung masuk ke
         * state, lalu lakukan reload penuh. Ini membuat UI tidak
         * bergantung pada timing render setelah RPC selesai.
         */
        if (result.payment_id) {
          const { data: createdPayment, error: createdPaymentError } =
            await supabase
              .from("ap_payments")
              .select("*")
              .eq("id", result.payment_id)
              .eq("entity_id", entityId)
              .maybeSingle();

          if (createdPaymentError) {
            console.warn(
              "Gagal membaca payment yang baru dibuat:",
              createdPaymentError.message,
            );
          } else if (createdPayment) {
            setPayments((current) => [
              createdPayment as unknown as ApPayment,
              ...current.filter((item) => item.id !== createdPayment.id),
            ]);
          }
        }

        /* Refresh daftar setelah create. Jalankan berurutan supaya
         * satu fetch tidak menimpa error/state fetch lainnya. */
        await fetchPayments();
        await fetchApprovedPaymentRequests();
        await fetchOutstandingInvoices();

        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Gagal membuat pembayaran.";

        setError(message);

        return null;
      } finally {
        setSaving(false);
      }
    },
    [
      entityId,
      customUserId,
      fetchPayments,
      fetchApprovedPaymentRequests,
      fetchOutstandingInvoices,
    ],
  );

  /**
   * ==========================================================
   * UPDATE PAYMENT
   * ==========================================================
   */

  const updatePayment = useCallback(
    async (
      paymentId: string,
      payload: ApPaymentFormData,
    ): Promise<ApPaymentResult | null> => {
      if (!entityId) {
        setError("Entity user tidak ditemukan.");
        return null;
      }

      if (!paymentId) {
        setError("Payment ID tidak ditemukan.");
        return null;
      }

      if (!payload.payment_method_id) {
        setError("Metode pembayaran wajib dipilih.");
        return null;
      }

      if (!payload.allocations || payload.allocations.length === 0) {
        setError("Minimal satu invoice harus dipilih.");
        return null;
      }

      setSaving(true);
      setError(null);

      try {
        const allocations = payload.allocations.map((item) => ({
          invoice_id: item.invoice_id,

          amount: Number(item.amount),

          ...(item.deposit_id
            ? {
                deposit_id: item.deposit_id,
              }
            : {}),
        }));

        console.log("=== UPDATE AP PAYMENT ===");

        console.log("payment_id:", paymentId);

        console.log("entity_id:", entityId);

        console.log("payment_date:", payload.payment_date);

        console.log("payment_method_id:", payload.payment_method_id);

        console.log("allocations:", allocations);

        const { data, error: updateError } = await supabase.rpc(
          "update_ap_payment",
          {
            p_payment_id: paymentId,

            p_entity_id: entityId,

            p_payment_date: payload.payment_date,

            p_payment_method_id: payload.payment_method_id,

            p_reference_number: payload.reference_number || null,

            p_notes: payload.notes || null,

            /*
             * custom_users.id = "01"
             * bukan UUID PostgreSQL.
             */
            p_created_by: null,

            p_custom_user_id: customUserId,

            p_allocations: allocations,
          },
        );

        console.log("=== UPDATE AP PAYMENT RESULT ===");

        console.log("data:", data);

        console.log("error:", updateError);

        if (updateError) {
          setError(updateError.message);
          return null;
        }

        await Promise.all([fetchPayments(), fetchApprovedPaymentRequests()]);

        return data as ApPaymentResult;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Gagal mengubah pembayaran.";

        console.error("=== UPDATE AP PAYMENT EXCEPTION ===", err);

        setError(message);

        return null;
      } finally {
        setSaving(false);
      }
    },
    [entityId, customUserId, fetchPayments, fetchApprovedPaymentRequests],
  );

  /**
   * ==========================================================
   * DELETE PAYMENT
   * ==========================================================
   */

  const deletePayment = useCallback(
    async (paymentId: string): Promise<DeleteApPaymentResult | null> => {
      if (!entityId) {
        setError("Entity user tidak ditemukan.");
        return null;
      }

      if (!paymentId) {
        setError("Payment ID tidak ditemukan.");
        return null;
      }

      setSaving(true);
      setError(null);

      const { data, error: deleteError } = await supabase.rpc(
        "delete_ap_payment",
        {
          p_payment_id: paymentId,

          p_entity_id: entityId,
        },
      );

      if (deleteError) {
        setError(deleteError.message);
        setSaving(false);
        return null;
      }

      await Promise.all([fetchPayments(), fetchOutstandingInvoices()]);

      setSaving(false);

      return data as DeleteApPaymentResult;
    },
    [entityId, fetchPayments, fetchOutstandingInvoices],
  );

  /**
   * ==========================================================
   * GET PAYMENT METHOD BY ID
   * ==========================================================
   */

  const getSettlementMethod = useCallback(
    (methodId: string) => {
      return settlementMethods.find((item) => item.id === methodId) ?? null;
    },
    [settlementMethods],
  );

  /**
   * ==========================================================
   * CHECK WHETHER METHOD IS DEPOSIT
   * ==========================================================
   */

  const isDepositMethod = useCallback(
    (methodId: string) => {
      const method = settlementMethods.find((item) => item.id === methodId);

      return method?.settlement_type === "DEPOSIT";
    },
    [settlementMethods],
  );

  /**
   * ==========================================================
   * CALCULATE TOTAL ALLOCATION
   * ==========================================================
   */

  const calculateAllocationTotal = useCallback(
    (allocations: ApPaymentAllocation[]) => {
      return allocations.reduce(
        (total, item) => total + Number(item.amount || 0),
        0,
      );
    },
    [],
  );

  const clearPaymentSelection = useCallback(() => {
    setOutstandingInvoices([]);
    setDeposits([]);
  }, []);

  /**
   * ==========================================================
   * RETURN
   * ==========================================================
   */

  return {
    /**
     * Data
     */
    payments,
    paymentsTotalCount,
    paymentRequests,
    suppliers,
    settlementMethods,
    outstandingInvoices,
    approvedPaymentRequests,

    deposits,
    loadingDeposits,
    fetchSupplierDeposits,
    clearPaymentSelection,

    /**
     * Loading
     */
    loading,
    loadingMasters,
    loadingInvoices,
    saving,
    loadingPaymentRequests,

    /**
     * Error
     */
    error,

    /**
     * Fetch
     */
    fetchPayments,
    fetchPaymentsForExport,
    fetchMasters,
    fetchSuppliers,
    fetchSettlementMethods,
    fetchOutstandingInvoices,
    fetchApprovedPaymentRequests,

    /**
     * CRUD
     */
    createPayment,
    updatePayment,
    deletePayment,

    /**
     * Helpers
     */
    getSettlementMethod,
    isDepositMethod,
    calculateAllocationTotal,
  };
}
