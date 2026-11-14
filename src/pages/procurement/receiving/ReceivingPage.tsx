import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { hasAccess } from "@/lib/hasAccess";
import { supabase } from "@/lib/supabaseClient";
import { getCustomUserId } from "@/lib/authUser";
import { usePagination } from "@/lib/pagination/usePagination";
import { createPaginationMeta } from "@/lib/pagination/types";
import Pagination from "@/components/common/Pagination";

type PoDetail = {
  id: string;
  item_code_snapshot: string;
  item_name_snapshot: string;
  unit_code_snapshot: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
};

type PurchaseOrder = {
  id: string;
  entity_id: string | null;
  po_number: string;
  supplier_id: string;
  supplier_name_snapshot: string;
  payment_term_days: number;
  store_id: string | null;
  purchase_order_details: PoDetail[];
};

type Store = {
  id: string;
  code: string;
  name: string;
};

type SettlementMethod = {
  id: string;
  code: string;
  name: string;
  settlement_type: "CREDIT_TERM" | "DEPOSIT" | "CASH_BANK" | "OTHER";
  requires_amount: boolean;
};

type ReceivingLine = {
  purchase_order_detail_id: string;
  quantity_received: number;
  unit_cost: number;
  discount_amount: number;
  tax_amount: number;
  notes: string;
};

type SettlementLine = {
  settlement_method_id: string;
  amount: number;
  notes: string;
};

type ReceivingRecord = {
  id: string;
  receiving_number: string;
  receiving_date: string;
  posted_at: string | null;
  created_at: string;

  purchase_order_number_snapshot: string;
  supplier_name_snapshot: string;
  store_name_snapshot: string;

  supplier_invoice_number: string | null;
  supplier_invoice_date: string | null;
  supplier_due_date: string | null;

  grand_total: number;
  status: "DRAFT" | "POSTED" | "CANCELLED";
};

type ReceivingRecordDetailRow = {
  purchase_order_detail_id: string;
  quantity_received: number;
  unit_cost: number;
  discount_amount: number | null;
  tax_amount: number | null;
  notes: string | null;
};

type ReceivingSettlementRow = {
  settlement_method_id: string;
  supplier_deposit_id: string | null;
  amount: number;
  notes: string | null;
};

function formatInputDate(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function today() {
  return formatInputDate(new Date());
}

function firstDayOfCurrentMonth() {
  const now = new Date();

  return formatInputDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function ReceivingPage() {
  const [records, setRecords] = useState<ReceivingRecord[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [methods, setMethods] = useState<SettlementMethod[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(firstDayOfCurrentMonth());
  const [dateTo, setDateTo] = useState(today());
  const [statusFilter, setStatusFilter] = useState<
    "POSTED" | "DRAFT" | "CANCELLED" | "ALL"
  >("ALL");
  const [access, setAccess] = useState({
    create: false,
    editDraft: false,
    deleteDraft: false,
    post: false,
    print: false,
    export: false,
  });
  const [error, setError] = useState<string | null>(null);

  const { page, pageSize, setPage, setPageSize } = usePagination();

  const [totalCount, setTotalCount] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [receivingDate, setReceivingDate] = useState(today());

  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState("");
  const [supplierPaymentTermDays, setSupplierPaymentTermDays] = useState(0);

  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ReceivingLine[]>([]);
  const [settlements, setSettlements] = useState<SettlementLine[]>([]);

  const selectedPo = useMemo(
    () => purchaseOrders.find((po) => po.id === selectedPoId) ?? null,
    [purchaseOrders, selectedPoId],
  );

  useEffect(() => {
    const loadSupplierPaymentTerm = async () => {
      if (!selectedPo?.supplier_id) {
        setSupplierPaymentTermDays(0);
        return;
      }

      const { data, error } = await supabase
        .from("suppliers")
        .select("default_payment_term_days")
        .eq("id", selectedPo.supplier_id)
        .single();

      if (error) {
        console.error("Gagal mengambil payment term supplier:", error);
        setSupplierPaymentTermDays(0);
        return;
      }

      setSupplierPaymentTermDays(Number(data?.default_payment_term_days ?? 0));
    };

    loadSupplierPaymentTerm();
  }, [selectedPo?.supplier_id]);

  const totalReceiving = useMemo(
    () =>
      lines.reduce(
        (total, line) =>
          total +
          line.quantity_received * line.unit_cost -
          line.discount_amount +
          line.tax_amount,
        0,
      ),
    [lines],
  );

  const loadData = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.max(1, Number(pageSize) || 25);
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;

    let recordQuery = supabase
      .from("receiving_records")
      .select("*", { count: "exact" })
      .order(statusFilter === "POSTED" ? "posted_at" : "created_at", {
        ascending: false,
      });

    if (statusFilter !== "ALL") {
      recordQuery = recordQuery.eq("status", statusFilter);
    }

    const dateColumn = statusFilter === "POSTED" ? "posted_at" : "created_at";

    if (dateFrom) {
      recordQuery = recordQuery.gte(dateColumn, `${dateFrom}T00:00:00.000`);
    }

    if (dateTo) {
      recordQuery = recordQuery.lte(dateColumn, `${dateTo}T23:59:59.999`);
    }

    const keyword = search.trim();

    if (keyword) {
      const safeKeyword = keyword.replace(/[%_]/g, "\\$&").replace(/,/g, " ");

      recordQuery = recordQuery.or(
        [
          `receiving_number.ilike.%${safeKeyword}%`,
          `purchase_order_number_snapshot.ilike.%${safeKeyword}%`,
          `supplier_name_snapshot.ilike.%${safeKeyword}%`,
          `store_name_snapshot.ilike.%${safeKeyword}%`,
          `status.ilike.%${safeKeyword}%`,
          `supplier_invoice_number.ilike.%${safeKeyword}%`,
        ].join(","),
      );
    }

    const [recordResult, poResult, storeResult, methodResult] =
      await Promise.all([
        recordQuery.range(from, to),

        supabase
          .from("purchase_orders")
          .select(
            `
          id,
          entity_id,
          po_number,
          supplier_id:vendor_id,
          supplier_name_snapshot,
          payment_term_days,
          store_id:ship_to_store_id,
          purchase_order_details (
            id,
            item_code_snapshot,
            item_name_snapshot,
            unit_code_snapshot,
            quantity_ordered,
            quantity_received,
            unit_price
          )
        `,
          )
          .in("status", ["OPEN", "PARTIAL_RECEIVED"])
          .order("order_date", { ascending: false }),

        supabase
          .from("stores")
          .select("id, code, name")
          .eq("is_active", true)
          .order("code"),

        supabase
          .from("purchase_settlement_methods")
          .select("id, code, name, settlement_type, requires_amount")
          .eq("is_active", true)
          .order("code"),
      ]);

    if (recordResult.error) {
      setError(recordResult.error.message);
      setRecords([]);
      setTotalCount(0);
    } else {
      setRecords((recordResult.data ?? []) as ReceivingRecord[]);
      setTotalCount(recordResult.count ?? 0);
    }

    if (poResult.error) {
      setError(poResult.error.message);
    }

    if (storeResult.error) {
      setError(storeResult.error.message);
    }

    if (methodResult.error) {
      setError(methodResult.error.message);
    }

    setPurchaseOrders((poResult.data ?? []) as unknown as PurchaseOrder[]);
    setStores((storeResult.data ?? []) as Store[]);
    setMethods((methodResult.data ?? []) as SettlementMethod[]);

    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, [page, pageSize, search, dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    async function loadAccess() {
      const [create, editDraft, deleteDraft, post, print, exportExcel] =
        await Promise.all([
          hasAccess("receiving.create"),
          hasAccess("receiving.edit_draft"),
          hasAccess("receiving.delete_draft"),
          hasAccess("receiving.post"),
          hasAccess("receiving.print"),
          hasAccess("receiving.export"),
        ]);

      setAccess({
        create,
        editDraft,
        deleteDraft,
        post,
        print,
        export: exportExcel,
      });
    }

    loadAccess();
  }, []);

  const paginationMeta = useMemo(
    () => createPaginationMeta(page, pageSize, totalCount),
    [page, pageSize, totalCount],
  );

  const resetForm = () => {
    setEditingId(null);
    setSelectedPoId("");
    setStoreId("");
    setReceivingDate(today());

    setSupplierInvoiceNumber("");
    setSupplierInvoiceDate("");
    setSupplierPaymentTermDays(0);

    setNotes("");
    setLines([]);
    setSettlements([]);

    setShowForm(false);
  };

  const calculateSupplierDueDate = (invoiceDate: string, termDays: number) => {
    if (!invoiceDate) return "";

    const date = new Date(`${invoiceDate}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return "";
    }
    date.setDate(date.getDate() + termDays);
    return date.toISOString().slice(0, 10);
  };

  const supplierDueDate = calculateSupplierDueDate(
    supplierInvoiceDate,
    supplierPaymentTermDays,
  );

  const choosePo = async (poId: string) => {
    const po = purchaseOrders.find((row) => row.id === poId);

    setSelectedPoId(poId);

    if (!po) {
      setStoreId("");
      setLines([]);
      return;
    }

    if (!po.store_id) {
      setStoreId("");
      setLines([]);

      window.alert(
        `PO ${po.po_number} belum memiliki Store/Gudang Tujuan. ` +
          `PO harus diedit terlebih dahulu dan Store Tujuan harus dipilih.`,
      );

      return;
    }

    // Store otomatis mengikuti PO
    setStoreId(po.store_id);

    setLines(
      (po.purchase_order_details ?? [])
        .filter(
          (detail) =>
            Number(detail.quantity_ordered) > Number(detail.quantity_received),
        )
        .map((detail) => ({
          purchase_order_detail_id: detail.id,
          quantity_received: 0,
          unit_cost: Number(detail.unit_price || 0),
          discount_amount: 0,
          tax_amount: 0,
          notes: "",
        })),
    );
  };

  const handleEditDraft = async (record: ReceivingRecord) => {
    setSaving(true);
    setError(null);

    const { data, error } = await supabase
      .from("receiving_records")
      .select(
        `
        id,
        purchase_order_id,
        store_id,
        receiving_date,
        supplier_invoice_number,
        supplier_invoice_date,
        supplier_due_date,
        notes,
        receiving_record_details (
          purchase_order_detail_id,
          quantity_received,
          unit_cost,
          discount_amount,
          tax_amount,
          notes
        ),
        receiving_settlements (
          settlement_method_id,
          supplier_deposit_id,
          amount,
          notes
        )
      `,
      )
      .eq("id", record.id)
      .single();

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    // buka form
    setShowForm(true);

    // isi header
    setSelectedPoId(data.purchase_order_id);
    setEditingId(record.id);
    setReceivingDate(data.receiving_date);
    setNotes(data.notes ?? "");

    setSupplierInvoiceNumber(data.supplier_invoice_number ?? "");

    setSupplierInvoiceDate(data.supplier_invoice_date ?? "");

    // load ulang PO supaya deposit ikut muncul
    await choosePo(data.purchase_order_id);

    // detail barang
    setLines(
      ((data.receiving_record_details ?? []) as ReceivingRecordDetailRow[]).map(
        (item) => ({
          purchase_order_detail_id: item.purchase_order_detail_id,
          quantity_received: Number(item.quantity_received),
          unit_cost: Number(item.unit_cost),
          discount_amount: Number(item.discount_amount ?? 0),
          tax_amount: Number(item.tax_amount ?? 0),
          notes: item.notes ?? "",
        }),
      ),
    );

    // settlement
    setSettlements(
      ((data.receiving_settlements ?? []) as ReceivingSettlementRow[]).map(
        (item) => ({
          settlement_method_id: item.settlement_method_id,
          supplier_deposit_id: item.supplier_deposit_id ?? "",
          amount: Number(item.amount),
          notes: item.notes ?? "",
        }),
      ),
    );
  };

  const updateLine = (
    index: number,
    field: keyof ReceivingLine,
    value: string | number,
  ) => {
    setLines((previous) =>
      previous.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line,
      ),
    );
  };

  const addSettlement = () => {
    setSettlements((previous) => [
      ...previous,
      {
        settlement_method_id: "",
        supplier_deposit_id: "",
        amount: 0,
        notes: "",
      },
    ]);
  };

  const updateSettlement = (
    index: number,
    field: keyof SettlementLine,
    value: string | number,
  ) => {
    setSettlements((previous) =>
      previous.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line,
      ),
    );
  };

  const buildSettlementsForSave = (): SettlementLine[] => {
    const creditTermMethod = methods.find(
      (method) => method.settlement_type === "CREDIT_TERM",
    );

    if (!creditTermMethod) {
      throw new Error(
        "Metode settlement CREDIT_TERM / Tempo tidak ditemukan atau tidak aktif.",
      );
    }

    const currentSettlements = settlements.filter(
      (settlement) => settlement.settlement_method_id,
    );

    const hasCreditTerm = currentSettlements.some((settlement) => {
      const method = methods.find(
        (row) => row.id === settlement.settlement_method_id,
      );

      return method?.settlement_type === "CREDIT_TERM";
    });

    /**
     * Hitung seluruh settlement yang benar-benar
     * mengurangi nilai Receiving.
     *
     * CREDIT_TERM amount selalu 0 karena
     * nominal AP Trade dihitung oleh
     * post_receiving_record().
     */
    const cashSettlementTotal = currentSettlements.reduce(
      (total, settlement) => {
        const method = methods.find(
          (row) => row.id === settlement.settlement_method_id,
        );

        if (method?.settlement_type === "CREDIT_TERM") {
          return total;
        }

        return total + Number(settlement.amount || 0);
      },
      0,
    );

    /**
     * Jika masih ada nilai yang belum
     * diselesaikan, maka otomatis masuk
     * AP Trade / Tempo.
     */
    const remainingAmount = Number(totalReceiving || 0) - cashSettlementTotal;

    if (remainingAmount > 0 && !hasCreditTerm) {
      return [
        ...currentSettlements,
        {
          settlement_method_id: creditTermMethod.id,
          amount: 0,
          notes: "",
        },
      ];
    }

    return currentSettlements;
  };

  const removeSettlement = (index: number) => {
    setSettlements((previous) =>
      previous.filter((_, lineIndex) => lineIndex !== index),
    );
  };

  const saveDraft = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedPo || !storeId) {
      window.alert("PO dan Store/Gudang tujuan wajib dipilih.");
      return;
    }

    const validLines = lines.filter(
      (line) => Number(line.quantity_received) > 0,
    );

    if (validLines.length === 0) {
      window.alert("Isi minimal satu qty barang yang benar-benar diterima.");
      return;
    }

    let settlementsForSave: SettlementLine[];
    try {
      settlementsForSave = buildSettlementsForSave();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Metode settlement Tempo tidak ditemukan.",
      );
      return;
    }

    const hasCreditTerm = settlementsForSave.some((settlement) => {
      const method = methods.find(
        (row) => row.id === settlement.settlement_method_id,
      );

      return method?.settlement_type === "CREDIT_TERM";
    });

    if (hasCreditTerm) {
      if (!supplierInvoiceNumber.trim()) {
        window.alert("No. Invoice Supplier wajib diisi untuk Receiving Tempo.");
        return;
      }

      if (!supplierInvoiceDate) {
        window.alert(
          "Tanggal Invoice Supplier wajib diisi untuk Receiving Tempo.",
        );
        return;
      }
    }

    setSaving(true);
    setError(null);

    const { data, error: saveError } = editingId
      ? await supabase.rpc("update_receiving_record_draft", {
          p_receiving_record_id: editingId,
          p_receiving_date: receivingDate,
          p_store_id: storeId,
          p_notes: notes || null,
          p_details: validLines,
          p_settlements: settlementsForSave,

          p_supplier_invoice_number: supplierInvoiceNumber.trim() || null,

          p_supplier_invoice_date: supplierInvoiceDate || null,
        })
      : await supabase.rpc("create_receiving_record_draft", {
          p_entity_id: selectedPo.entity_id,
          p_receiving_date: receivingDate,
          p_purchase_order_id: selectedPo.id,
          p_store_id: storeId,
          p_notes: notes || null,
          p_details: validLines,
          p_settlements: settlementsForSave,

          p_supplier_invoice_number: supplierInvoiceNumber.trim() || null,

          p_supplier_invoice_date: supplierInvoiceDate || null,
        });

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    const result = data as {
      success: boolean;
      receiving_number: string;
    };

    window.alert(
      editingId
        ? `Draft Receiving ${result.receiving_number} berhasil diperbarui.`
        : `Receiving ${result.receiving_number} berhasil dibuat sebagai Draft.`,
    );

    setShowForm(false);
    setEditingId(null);
    setSelectedPoId("");
    setStoreId("");
    setReceivingDate(today());
    setNotes("");
    setLines([]);
    setSettlements([]);

    setSupplierInvoiceNumber("");
    setSupplierInvoiceDate("");

    resetForm();
    await loadData();
  };

  const postReceiving = async (record: ReceivingRecord) => {
    const confirmed = window.confirm(
      `Post Receiving ${record.receiving_number}?\n\n` +
        "Stok, harga average, PO, AP/Deposit, dan jurnal akan diproses.",
    );

    if (!confirmed) return;

    const customUserId = getCustomUserId();

    if (!customUserId) {
      setError(
        "User aplikasi tidak ditemukan. Silakan login kembali sebelum melakukan posting.",
      );
      return;
    }

    setSaving(true);
    setError(null);

    const { data, error: postError } = await supabase.rpc(
      "post_receiving_record",
      {
        p_receiving_record_id: record.id,
        p_custom_user_id: customUserId,
      },
    );

    setSaving(false);

    if (postError) {
      setError(postError.message);
      return;
    }

    const result = data as {
      receiving_number: string;
      purchase_order_status: string;
      ap_trade_amount: number;
    };

    window.alert(
      `Receiving ${result.receiving_number} berhasil diposting.\n` +
        `Status PO: ${result.purchase_order_status}\n` +
        `AP Trade: ${rupiah(result.ap_trade_amount)}`,
    );

    await loadData();
  };

  const deleteReceivingDraft = async (record: ReceivingRecord) => {
    const confirmed = window.confirm(
      `Hapus Draft Receiving ${record.receiving_number}?`,
    );

    if (!confirmed) return;

    setSaving(true);

    const { data, error: deleteError } = await supabase.rpc(
      "delete_receiving_record_draft",
      {
        p_receiving_record_id: record.id,
      },
    );

    setSaving(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    const result = data as {
      success: boolean;
      receiving_number: string;
    };

    if (result.success) {
      window.alert(`Draft Receiving ${result.receiving_number} dihapus.`);
      loadData();
    }
  };

  const exportReceivingExcel = async () => {
    try {
      if (totalCount === 0) {
        window.alert("Tidak ada Receiving yang dapat diexport.");
        return;
      }

      const exportRows: ReceivingRecord[] = [];
      const batchSize = 1000;
      let offset = 0;

      const keyword = search.trim();

      while (true) {
        let query = supabase
          .from("receiving_records")
          .select("*")
          .order(statusFilter === "POSTED" ? "posted_at" : "created_at", {
            ascending: false,
          });

        if (statusFilter !== "ALL") {
          query = query.eq("status", statusFilter);
        }

        const dateColumn =
          statusFilter === "POSTED" ? "posted_at" : "created_at";

        if (dateFrom) {
          query = query.gte(dateColumn, `${dateFrom}T00:00:00.000`);
        }

        if (dateTo) {
          query = query.lte(dateColumn, `${dateTo}T23:59:59.999`);
        }

        if (keyword) {
          const safeKeyword = keyword
            .replace(/[%_]/g, "\\$&")
            .replace(/,/g, " ");

          query = query.or(
            [
              `receiving_number.ilike.%${safeKeyword}%`,
              `purchase_order_number_snapshot.ilike.%${safeKeyword}%`,
              `supplier_name_snapshot.ilike.%${safeKeyword}%`,
              `store_name_snapshot.ilike.%${safeKeyword}%`,
              `status.ilike.%${safeKeyword}%`,
              `supplier_invoice_number.ilike.%${safeKeyword}%`,
            ].join(","),
          );
        }

        const { data, error: exportError } = await query.range(
          offset,
          offset + batchSize - 1,
        );

        if (exportError) {
          throw new Error(exportError.message);
        }

        const batch = (data ?? []) as ReceivingRecord[];

        exportRows.push(...batch);

        if (batch.length < batchSize) {
          break;
        }

        offset += batchSize;
      }

      const rows = exportRows.map((record) => ({
        Tanggal: record.receiving_date,
        "Nomor Receiving": record.receiving_number,
        "Invoice Supplier": record.supplier_invoice_number,
        "Nomor PO": record.purchase_order_number_snapshot,
        Supplier: record.supplier_name_snapshot,
        Store: record.store_name_snapshot,
        Total: Number(record.grand_total),
        "Jatuh Tempo": record.supplier_due_date,
        Status: record.status,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);

      worksheet["!cols"] = [
        { wch: 16 },
        { wch: 22 },
        { wch: 24 },
        { wch: 18 },
        { wch: 30 },
        { wch: 24 },
        { wch: 18 },
        { wch: 16 },
        { wch: 14 },
      ];

      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, "Receiving Record");

      const file = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      saveAs(
        new Blob([file], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `Receiving-${today()}.xlsx`,
      );
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Gagal export Receiving.",
      );
    }
  };

  const printReceivingA4 = async (record: ReceivingRecord) => {
    const { data: details, error: detailError } = await supabase
      .from("receiving_record_details")
      .select(
        `
        line_number,
        item_code_snapshot,
        item_name_snapshot,
        unit_code_snapshot,
        quantity_received,
        unit_cost,
        line_total
      `,
      )
      .eq("receiving_record_id", record.id)
      .order("line_number");

    if (detailError) {
      setError(detailError.message);
      return;
    }

    const rows = (details ?? [])
      .map(
        (detail, index) => `
          <tr>
            <td style="text-align:center">${index + 1}</td>
            <td>${detail.item_code_snapshot}</td>
            <td>${detail.item_name_snapshot}</td>
            <td style="text-align:center">${detail.quantity_received}</td>
            <td style="text-align:center">${detail.unit_code_snapshot}</td>
            <td style="text-align:right">${rupiah(detail.unit_cost)}</td>
            <td style="text-align:right">${rupiah(detail.line_total)}</td>
          </tr>
        `,
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=1000,height=800");

    if (!printWindow) {
      window.alert("Popup print diblokir browser.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Receiving ${record.receiving_number}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: Arial, sans-serif; font-size: 12px; color: #111827; }
            h1 { margin: 0; font-size: 22px; }
            .header {
              display: flex;
              justify-content: space-between;
              border-bottom: 2px solid #111827;
              padding-bottom: 14px;
              margin-bottom: 18px;
            }
            .info {
              display: grid;
              grid-template-columns: 130px 1fr;
              gap: 6px;
              margin-bottom: 16px;
            }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #374151; padding: 7px; }
            th { background: #e5e7eb; }
            .total {
              width: 300px;
              margin: 14px 0 0 auto;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>RECEIVING REPORT</h1>
              <div>Laporan Penerimaan Barang</div>
            </div>
            <div>
              <strong>Tanggal:</strong> ${record.receiving_date}<br />
              <strong>No. Receiving:</strong> ${record.receiving_number}<br />
              <strong>Status:</strong> ${record.status}
            </div>
          </div>

          <div class="info">
            <strong>Purchase Order</strong>
            <span>${record.purchase_order_number_snapshot}</span>

            <strong>No. Invoice Supplier</strong>
            <span>${record.supplier_invoice_number || "-"}</span>

            <strong>Tanggal Invoice</strong>
            <span>${record.supplier_invoice_date || "-"}</span>

            <strong>Jatuh Tempo</strong>
            <span>${record.supplier_due_date || "-"}</span>

            <strong>Supplier</strong>
            <span>${record.supplier_name_snapshot}</span>

            <strong>Store / Gudang</strong>
            <span>${record.store_name_snapshot}</span>
          </div>

          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Kode</th>
                <th>Artikel</th>
                <th>Qty</th>
                <th>Satuan</th>
                <th>Harga</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <table class="total">
            <tr>
              <td><strong>Grand Total</strong></td>
              <td style="text-align:right"><strong>${rupiah(
                record.grand_total,
              )}</strong></td>
            </tr>
          </table>

          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="w-full pr-2 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Terima barang berdasarkan Purchase Order dan simpan ke Store/Gudang.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm md:w-80"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Cari nomor RR atau supplier..."
          />
          {access.export && (
            <button
              type="button"
              onClick={exportReceivingExcel}
              className="rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
            >
              Export Excel
            </button>
          )}

          {access.create && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Buat Receiving
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={saveDraft}
          className="space-y-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">
                {editingId ? "Edit Receiving Draft" : "Buat Receiving Draft"}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {editingId
                  ? "Draft dapat diubah sebelum Receiving diposting."
                  : "Nomor Receiving dibuat otomatis saat Draft disimpan."}
              </p>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              Batal
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Tanggal Receiving
              </label>
              <input
                type="date"
                value={receivingDate}
                onChange={(event) => setReceivingDate(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Purchase Order
              </label>
              <select
                value={selectedPoId}
                onChange={(event) => choosePo(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Pilih PO Open</option>
                {purchaseOrders.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.po_number} - {po.supplier_name_snapshot}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Store / Gudang Tujuan
              </label>
              <select
                value={storeId}
                disabled={!selectedPoId}
                className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm disabled:cursor-not-allowed"
              >
                <option value="">Pilih Store/Gudang</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.code} - {store.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                No. Invoice Supplier
              </label>

              <input
                type="text"
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                placeholder="Contoh: INV-VJ-001"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />

              <p className="mt-1 text-xs text-gray-500">
                Invoice wajib diisi jika transaksi memiliki sisa AP / Tempo.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tanggal Invoice
              </label>

              <input
                type="date"
                value={supplierInvoiceDate}
                onChange={(e) => setSupplierInvoiceDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jatuh Tempo
              </label>

              <input
                type="date"
                value={supplierDueDate}
                readOnly
                className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm"
              />

              <p className="mt-1 text-xs text-gray-500">
                Term supplier: {supplierPaymentTermDays} hari
              </p>
            </div>
          </div>

          {selectedPo && (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-[950px] w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-3 py-3">Item</th>
                    <th className="px-3 py-3 text-right">Sisa PO</th>
                    <th className="px-3 py-3 text-right">Qty Fisik</th>
                    <th className="px-3 py-3">Satuan</th>
                    <th className="px-3 py-3 text-right">Harga Aktual</th>
                    <th className="px-3 py-3 text-right">Total</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {lines.map((line, index) => {
                    const poDetail = selectedPo.purchase_order_details.find(
                      (detail) => detail.id === line.purchase_order_detail_id,
                    );

                    const total =
                      line.quantity_received * line.unit_cost -
                      line.discount_amount +
                      line.tax_amount;

                    return (
                      <tr key={line.purchase_order_detail_id}>
                        <td className="px-3 py-3">
                          <div className="font-medium">
                            {poDetail?.item_code_snapshot}
                          </div>
                          <div className="text-gray-600">
                            {poDetail?.item_name_snapshot}
                          </div>
                        </td>

                        <td className="px-3 py-3 text-right">
                          {Number(poDetail?.quantity_ordered || 0) -
                            Number(poDetail?.quantity_received || 0)}
                        </td>

                        <td className="px-3 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            max={
                              Number(poDetail?.quantity_ordered || 0) -
                              Number(poDetail?.quantity_received || 0)
                            }
                            step="0.0001"
                            value={line.quantity_received}
                            onChange={(event) =>
                              updateLine(
                                index,
                                "quantity_received",
                                Number(event.target.value || 0),
                              )
                            }
                            className="w-24 rounded-md border border-gray-300 px-2 py-2 text-right"
                          />
                        </td>

                        <td className="px-3 py-3">
                          {poDetail?.unit_code_snapshot}
                        </td>

                        <td className="px-3 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={line.unit_cost}
                            onChange={(event) =>
                              updateLine(
                                index,
                                "unit_cost",
                                Number(event.target.value || 0),
                              )
                            }
                            className="w-32 rounded-md border border-gray-300 px-2 py-2 text-right"
                          />
                        </td>

                        <td className="px-3 py-3 text-right font-medium">
                          {rupiah(total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Catatan</label>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Opsional"
            />
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">
                  Settlement Pembayaran
                </h3>
                <p className="text-sm text-gray-500">
                  Kosongkan jika seluruh nilai masuk AP Trade/Tempo.
                </p>
              </div>

              <button
                type="button"
                onClick={addSettlement}
                className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700"
              >
                + Tambah Settlement
              </button>
            </div>

            {settlements.map((settlement, index) => {
              const method = methods.find(
                (row) => row.id === settlement.settlement_method_id,
              );

              return (
                <div
                  key={index}
                  className="mb-3 grid grid-cols-1 gap-3 rounded-md bg-gray-50 p-3 md:grid-cols-4"
                >
                  <select
                    value={settlement.settlement_method_id}
                    onChange={(event) =>
                      updateSettlement(
                        index,
                        "settlement_method_id",
                        event.target.value,
                      )
                    }
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Pilih metode</option>
                    {methods.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="0"
                    value={settlement.amount}
                    disabled={method?.settlement_type === "CREDIT_TERM"}
                    onChange={(event) =>
                      updateSettlement(
                        index,
                        "amount",
                        Number(event.target.value || 0),
                      )
                    }
                    placeholder="Nominal"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                  />

                  <button
                    type="button"
                    onClick={() => removeSettlement(index)}
                    className="rounded-md text-red-600 hover:text-red-800"
                  >
                    Hapus
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
            <span className="font-semibold text-gray-900">Total Receiving</span>
            <span className="text-lg font-bold text-gray-900">
              {rupiah(totalReceiving)}
            </span>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving
                ? "Menyimpan..."
                : editingId
                  ? "Simpan Perubahan Draft"
                  : "Simpan Draft Receiving"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Dari Tanggal
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as
                    "POSTED" | "DRAFT" | "CANCELLED" | "ALL",
                )
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="POSTED">Posted</option>
              <option value="DRAFT">Draft</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="ALL">Semua Status</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setDateFrom(firstDayOfCurrentMonth());
                setDateTo(today());
                setStatusFilter("ALL");
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Periode Bulan Berjalan
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Receiving Posted menggunakan tanggal Posting. Draft dan Cancelled
          menggunakan tanggal dibuat.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold">Daftar Receiving Record</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-4 py-3 font-medium">Nomor Receiving</th>
                <th className="px-4 py-3 font-medium">Invoice Supplier</th>
                <th className="px-4 py-3 font-medium">PO / Supplier</th>
                <th className="px-4 py-3 font-medium">Store</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Jatuh Tempo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Memuat Receiving...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Belum ada Receiving Record.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-3">{record.receiving_date}</td>

                    <td className="px-4 py-3 font-medium">
                      {record.receiving_number}
                    </td>

                    <td className="px-4 py-3">
                      {record.supplier_invoice_number || "-"}
                      {record.supplier_invoice_date && (
                        <div className="text-xs text-gray-500">
                          {record.supplier_invoice_date}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div>{record.purchase_order_number_snapshot}</div>
                      <div className="text-xs text-gray-500">
                        {record.supplier_name_snapshot}
                      </div>
                    </td>

                    <td className="px-4 py-3">{record.store_name_snapshot}</td>
                    <td className="px-4 py-3 text-right">
                      {rupiah(record.grand_total)}
                    </td>

                    <td className="px-4 py-3">
                      {record.supplier_due_date || "-"}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={
                          record.status === "POSTED"
                            ? "rounded-full bg-green-100 px-2 py-1 text-xs text-green-700"
                            : record.status === "CANCELLED"
                              ? "rounded-full bg-red-100 px-2 py-1 text-xs text-red-700"
                              : "rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-700"
                        }
                      >
                        {record.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {access.print && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => printReceivingA4(record)}
                          className="mr-3 text-gray-700 hover:text-gray-900 disabled:opacity-50"
                        >
                          Print A4
                        </button>
                      )}

                      {record.status === "DRAFT" && (
                        <>
                          {access.editDraft && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleEditDraft(record)}
                              className="mr-3 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                            >
                              Edit
                            </button>
                          )}

                          {access.post && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => postReceiving(record)}
                              className="mr-3 text-green-600 hover:text-green-800 disabled:opacity-50"
                            >
                              Post
                            </button>
                          )}

                          {access.deleteDraft && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => deleteReceivingDraft(record)}
                              className="text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              Hapus
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-200 px-5 py-4">
          <Pagination
            meta={paginationMeta}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>
    </div>
  );
}
