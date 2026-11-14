import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { StockRow, TransactionKind, StockOpnameLine } from "../types";
import { inputDate } from "../../utils/date";

interface UseInventoryTransactionProps {
  stocks: StockRow[];
  loadData: () => Promise<void>;
  setError: (message: string | null) => void;
  entityId: string | null;
}

const createEmptyLine = (): StockOpnameLine => ({
  id: generateLocalId(),
  stockId: "",
  qty: "",
  accountId: "",
});

// =====================================================
// LOCAL LINE ID
// =====================================================

const generateLocalId = (): string => {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return [
    "local",
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 11),
  ].join("-");
};

export function useInventoryTransaction({
  stocks,
  loadData,
  setError,
}: UseInventoryTransactionProps) {
  // =====================================================
  // FORM STATE
  // =====================================================

  const [transactionKind, setTransactionKind] =
    useState<TransactionKind | null>(null);

  const [transactionStockId, setTransactionStockId] = useState("");

  const [targetStoreId, setTargetStoreId] = useState("");

  const [fromStoreId, setFromStoreId] = useState("");

  const [toStoreId, setToStoreId] = useState("");

  const [transactionDate, setTransactionDate] = useState(inputDate(new Date()));

  const [transactionQty, setTransactionQty] = useState("");

  const [lines, setLines] = useState<StockOpnameLine[]>([createEmptyLine()]);

  const [offsetAccountId, setOffsetAccountId] = useState("");

  const [reference, setReference] = useState("");

  const [transactionNotes, setTransactionNotes] = useState("");

  const [postingTransaction, setPostingTransaction] = useState(false);

  const [isOpen, setIsOpen] = useState(false);

  const currentUser = JSON.parse(
    localStorage.getItem("custom_user") || "{}",
  ) as {
    id?: string;
    entity_id?: string;
  };

  const userId = currentUser.id ?? "";

  const currentUserEntityId =
    currentUser.entity_id ?? null;

  // =====================================================
  // RESET FORM
  // =====================================================

  const resetForm = () => {
    setTransactionStockId("");
    setTargetStoreId("");
    setFromStoreId("");
    setToStoreId("");

    setTransactionDate(inputDate(new Date()));

    setTransactionQty("");

    setLines([createEmptyLine()]);

    setOffsetAccountId("");
    setReference("");
    setTransactionNotes("");

    setTransactionKind(null);
    setIsOpen(false);
  };

  // =====================================================
  // STORE CHANGE
  // =====================================================

  const changeStore = (id: string) => {
    setTargetStoreId(id);

    setLines([createEmptyLine()]);
  };

  const handleFromStoreChange = (value: string) => {
    setFromStoreId(value);

    setLines([createEmptyLine()]);
  };

  const handleTargetStoreChange = (value: string) => {
    setTargetStoreId(value);

    setLines([createEmptyLine()]);
  };

  // =====================================================
  // OPEN TRANSACTION
  // =====================================================

  const openTransaction = (kind: TransactionKind) => {
    setTransactionStockId("");
    setTargetStoreId("");
    setFromStoreId("");
    setToStoreId("");

    setTransactionDate(inputDate(new Date()));

    setTransactionQty("");

    setLines([createEmptyLine()]);

    setOffsetAccountId("");
    setReference("");
    setTransactionNotes("");

    setTransactionKind(kind);
    setIsOpen(true);

    setError(null);
  };

  // =====================================================
  // LINE MANAGEMENT
  // =====================================================

  const addLine = () => {
    setLines((previous) => [...previous, createEmptyLine()]);
  };

  const removeLine = (id: string) => {
    setLines((previous) => {
      const filtered = previous.filter((line) => line.id !== id);

      return filtered.length > 0 ? filtered : [createEmptyLine()];
    });
  };

  const updateLine = (
    id: string,
    field: keyof StockOpnameLine,
    value: string,
  ) => {
    setLines((previous) =>
      previous.map((line) =>
        line.id === id
          ? {
              ...line,
              [field]: value,
            }
          : line,
      ),
    );
  };

  // =====================================================
  // POST TRANSACTION
  // =====================================================

  const postTransaction = async () => {
    if (!transactionKind) {
      return;
    }

    if (!userId) {
      window.alert("User aplikasi tidak ditemukan. Silakan login kembali.");

      return;
    }

    // ==========================================
    // VALIDASI BARIS
    // ==========================================

    if (lines.length === 0) {
      window.alert("Belum ada artikel.");

      return;
    }

    const validLines = lines.filter((line) => line.stockId.trim() !== "");

    if (validLines.length === 0) {
      window.alert("Pilih minimal satu artikel.");

      return;
    }

    // ==========================================
    // VALIDASI TRANSFER
    // ==========================================

    if (transactionKind === "TRANSFER" && !targetStoreId) {
      window.alert("Pilih store tujuan.");

      return;
    }

    // ==========================================
    // VALIDASI ADJUSTMENT
    // ==========================================

    if (transactionKind === "ADJUSTMENT" && !offsetAccountId) {
      window.alert("Pilih akun selisih.");

      return;
    }

    setPostingTransaction(true);
    setError(null);

    try {
      // ==========================================
      // TRANSFER
      // ==========================================

      if (transactionKind === "TRANSFER") {
        for (let index = 0; index < validLines.length; index += 1) {
          const line = validLines[index];

          const stockLine = stocks.find((stock) => stock.id === line.stockId);

          if (!stockLine) {
            throw new Error(`Artikel pada baris ${index + 1} tidak ditemukan.`);
          }

          const qtyLine = Number(line.qty);

          if (!Number.isFinite(qtyLine) || qtyLine <= 0) {
            throw new Error(
              `Kuantitas pada baris ${index + 1} harus lebih dari 0.`,
            );
          }

          const result = await supabase.rpc("post_inventory_transfer", {
            p_entity_id: stockLine.entity_id,

            p_transfer_date: transactionDate,

            p_item_id: stockLine.item_id,

            p_from_store_id: stockLine.store_id,

            p_to_store_id: targetStoreId,

            p_quantity: qtyLine,

            p_reference: reference.trim() || null,

            p_description: transactionNotes.trim() || null,

            p_user_id: userId,
          });

          if (result.error) {
            throw new Error(result.error.message);
          }
        }
      }

      // ==========================================
      // ADJUSTMENT
      // ==========================================

      else if (transactionKind === "ADJUSTMENT") {
        if (!currentUserEntityId) {
          throw new Error(
            "Entity transaksi tidak ditemukan pada user yang sedang login.",
          );
        }

        const adjustmentLines: Array<{
          item_id: string;
          store_id: string;
          actual_quantity: number;
          offset_account_id: string;
        }> = [];

        for (
          let index = 0;
          index < validLines.length;
          index += 1
        ) {
          const line = validLines[index];

          const stockLine = stocks.find(
            (stock) => stock.id === line.stockId,
          );

          if (!stockLine) {
            throw new Error(
              `Artikel pada baris ${index + 1} tidak ditemukan.`,
            );
          }

          // ==========================================
          // VALIDASI QTY
          // ==========================================

          if (line.qty.trim() === "") {
            throw new Error(
              `Qty pada baris ${index + 1} wajib diisi.`,
            );
          }

          const qtyLine = Number(line.qty);

          if (!Number.isFinite(qtyLine)) {
            throw new Error(
              `Qty pada baris ${index + 1} tidak valid.`,
            );
          }

          if (qtyLine < 0) {
            throw new Error(
              `Qty pada baris ${index + 1} tidak boleh negatif.`,
            );
          }

          if (!line.accountId) {
            throw new Error(
              `Pilih akun pada baris ${index + 1}.`,
            );
          }


          // ==========================================
          // TAMBAHKAN LINE
          // ==========================================

          adjustmentLines.push({
            item_id: stockLine.item_id,
            store_id: stockLine.store_id,
            actual_quantity: qtyLine,
            offset_account_id: line.accountId,
          });
        }

        if (adjustmentLines.length === 0) {
          throw new Error(
            "Tidak ada artikel Adjustment yang valid.",
          );
        }

        // ==========================================
        // DEBUG
        // ==========================================

        console.log(
          "Adjustment batch payload:",
          {
            p_entity_id: currentUserEntityId,
            p_adjustment_date: transactionDate,
            p_lines: adjustmentLines,
            p_reference: reference.trim() || null,
            p_description: transactionNotes.trim() || null,
            p_is_opname: false,
            p_user_id: userId,
          },
        );

        // ==========================================
        // POST BATCH
        // ==========================================

        const result = await supabase.rpc(
          "post_inventory_adjustment_batch",
          {
            p_entity_id: currentUserEntityId,

            p_adjustment_date: transactionDate,

            p_lines: adjustmentLines,

            p_reference:
              reference.trim() || null,

            p_description:
              transactionNotes.trim() || null,

            p_is_opname: false,

            p_user_id: userId,
          },
        );

        if (result.error) {
          throw new Error(
            result.error.message,
          );
        }
      }

      // ==========================================
      // STOCK OPNAME
      // ==========================================
      else {
        if (!currentUserEntityId) {
          throw new Error(
            "Entity transaksi tidak ditemukan pada user yang sedang login.",
          );
        }

        const opnameLines: {
          item_id: string;
          actual_quantity: number;
          offset_account_id: string;
        }[] = [];

        let opnameStoreId = "";

        for (
          let index = 0;
          index < validLines.length;
          index += 1
        ) {
          const line = validLines[index];

          const stockLine = stocks.find(
            (stock) => stock.id === line.stockId,
          );

          if (!stockLine) {
            throw new Error(
              `Artikel pada baris ${index + 1} tidak ditemukan.`,
            );
          }

          // ==========================================
          // VALIDASI STORE
          // ==========================================

          if (!stockLine.store_id) {
            throw new Error(
              `Store pada artikel baris ${index + 1} tidak ditemukan.`,
            );
          }

          /*
          * Stock Opname dalam satu transaksi
          * harus berasal dari store yang sama.
          */
          if (
            opnameStoreId &&
            opnameStoreId !== stockLine.store_id
          ) {
            throw new Error(
              "Semua artikel Stock Opname harus berasal dari store yang sama.",
            );
          }

          opnameStoreId = stockLine.store_id;

          // ==========================================
          // VALIDASI QTY
          // ==========================================

          /*
          * Qty kosong tidak valid.
          *
          * Qty 0 tetap valid.
          */
          if (line.qty.trim() === "") {
            throw new Error(
              `Qty fisik pada baris ${index + 1} wajib diisi.`,
            );
          }

          const qtyLine = Number(line.qty);

          if (!Number.isFinite(qtyLine)) {
            throw new Error(
              `Qty fisik pada baris ${index + 1} tidak valid.`,
            );
          }

          if (qtyLine < 0) {
            throw new Error(
              `Qty fisik pada baris ${index + 1} tidak boleh negatif.`,
            );
          }

          // ==========================================
          // VALIDASI AKUN SELISIH
          // ==========================================

          if (!line.accountId) {
            throw new Error(
              `Pilih akun selisih pada baris ${index + 1}.`,
            );
          }

          // ==========================================
          // TAMBAHKAN LINE BATCH
          // ==========================================

          opnameLines.push({
            item_id: stockLine.item_id,
            actual_quantity: qtyLine,
            offset_account_id: line.accountId,
          });
        }

        // ==========================================
        // VALIDASI FINAL
        // ==========================================

        if (opnameLines.length === 0) {
          throw new Error(
            "Tidak ada artikel Stock Opname yang valid.",
          );
        }

        if (!opnameStoreId) {
          throw new Error(
            "Store Stock Opname tidak ditemukan.",
          );
        }

        // ==========================================
        // DEBUG
        // ==========================================

        console.log(
          "Stock Opname batch payload:",
          {
            p_entity_id: currentUserEntityId,
            p_adjustment_date: transactionDate,
            p_store_id: opnameStoreId,
            p_lines: opnameLines,
            p_reference: reference.trim() || null,
            p_description: transactionNotes.trim() || null,
            p_user_id: userId,
          },
        );

        // ==========================================
        // POST BATCH
        // ==========================================

        const result = await supabase.rpc(
          "post_inventory_opname_batch",
          {
            p_entity_id: currentUserEntityId,

            p_adjustment_date: transactionDate,

            p_store_id: opnameStoreId,

            p_lines: opnameLines,

            p_reference:
              reference.trim() || null,

            p_description:
              transactionNotes.trim() || null,

            p_user_id: userId,
          },
        );

        if (result.error) {
          throw new Error(
            result.error.message,
          );
        }
      }

      // ==========================================
      // RELOAD DATA
      // ==========================================

      await loadData();

      resetForm();

      window.alert("Transaksi berhasil diposting.");
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Gagal memposting transaksi inventory.";

      console.error("Post inventory transaction error:", error);

      setError(message);

      window.alert(message);
    } finally {
      setPostingTransaction(false);
    }
  };

  // =====================================================
  // RETURN
  // =====================================================

  return {
    isOpen,

    transactionKind,
    transactionStockId,

    fromStoreId,
    toStoreId,
    targetStoreId,

    transactionDate,

    transactionQty,

    offsetAccountId,
    reference,
    transactionNotes,

    setTransactionKind,
    setTransactionStockId,
    setTargetStoreId,
    setTransactionDate,

    changeStore,

    setTransactionQty,
    setOffsetAccountId,

    setReference,
    setTransactionNotes,

    lines,
    setLines,

    addLine,
    removeLine,
    updateLine,

    setFromStoreId,
    handleFromStoreChange,

    setToStoreId,
    handleTargetStoreChange,

    postingTransaction,

    openTransaction,
    postTransaction,
    resetForm,
  };
}
