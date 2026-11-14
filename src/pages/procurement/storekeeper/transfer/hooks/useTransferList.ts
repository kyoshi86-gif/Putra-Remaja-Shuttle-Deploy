import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

import type { PaginationMeta } from "@/lib/pagination/types";

import type { TransferDocument, TransferFilter } from "../types";

import type { StoreOption } from "../../types";

const DEFAULT_PAGE_SIZE = 25;

type TransferRpcStore = {
  id: string;
  code: string;
  name: string;
};

type TransferRpcItem = {
  code: string;
  name: string;
  unit_code: string | null;
  qty: number | string;
  value: number | string;
};

type TransferRpcRow = {
  reference: string;
  movement_date: string;
  created_at: string;
  created_by: string | null;

  from_store: TransferRpcStore | null;

  to_store: TransferRpcStore | null;

  items: TransferRpcItem[] | null;

  total_qty: number | string | null;

  total_value: number | string | null;

  total_count: number | string | null;
};

function createEmptyPagination(pageSize: number): PaginationMeta {
  return {
    page: 1,
    pageSize,
    total: 0,
    from: 0,
    to: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  };
}

function normalizeDocument(row: TransferRpcRow): TransferDocument {
  return {
    reference: row.reference,

    movement_date: row.movement_date,

    created_at: row.created_at,

    created_by: row.created_by,

    fromStore: row.from_store,

    toStore: row.to_store,

    items: Array.isArray(row.items)
      ? row.items.map((item) => ({
          code: item.code ?? "",

          name: item.name ?? "",

          unit_code: item.unit_code ?? null,

          qty: Number(item.qty ?? 0),

          value: Number(item.value ?? 0),
        }))
      : [],

    totalQty: Number(row.total_qty ?? 0),

    totalValue: Number(row.total_value ?? 0),
  };
}

export function useTransferList() {
  const [loading, setLoading] = useState(false);

  const [documents, setDocuments] = useState<TransferDocument[]>([]);

  const [stores, setStores] = useState<StoreOption[]>([]);

  const [filter, setFilter] = useState<TransferFilter>({
    dateFrom: "",
    dateTo: "",
    fromStoreId: "",
    toStoreId: "",
    keyword: "",
  });

  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>(
    createEmptyPagination(DEFAULT_PAGE_SIZE),
  );

  /*
   * =========================================================
   * LOAD STORE
   * =========================================================
   */

  useEffect(() => {
    let cancelled = false;

    const loadStores = async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, code, name")
        .order("code", {
          ascending: true,
        });

      if (cancelled) {
        return;
      }

      if (error) {
        console.error("Gagal mengambil daftar store:", error);

        return;
      }

      setStores((data ?? []) as StoreOption[]);
    };

    void loadStores();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * =========================================================
   * LOAD TRANSFER DOCUMENT
   * =========================================================
   *
   * Pagination dilakukan oleh RPC di PostgreSQL.
   *
   * Yang dipagination:
   *
   *     reference / dokumen
   *
   * BUKAN:
   *
   *     inventory_movements
   */

  const load = useCallback(
    async (
      currentFilter: TransferFilter,
      requestedPage: number,
      requestedPageSize: number,
    ) => {
      setLoading(true);

      try {
        const { data, error } = await supabase.rpc("get_transfer_documents", {
          p_date_from: currentFilter.dateFrom || null,

          p_date_to: currentFilter.dateTo || null,

          p_from_store_id: currentFilter.fromStoreId || null,

          p_to_store_id: currentFilter.toStoreId || null,

          p_keyword: currentFilter.keyword.trim() || "",

          p_page: requestedPage,

          p_page_size: requestedPageSize,
        });

        if (error) {
          throw error;
        }

        const rows = (data ?? []) as TransferRpcRow[];

        /*
         * total_count berasal dari RPC.
         *
         * Penting:
         * total_count adalah jumlah DOKUMEN,
         * bukan jumlah movement.
         */
        const total = Number(rows[0]?.total_count ?? 0);

        const totalPages = total > 0 ? Math.ceil(total / requestedPageSize) : 0;

        /*
         * Bila halaman aktif sudah tidak valid
         * karena data terhapus setelah pagination,
         * kembalikan ke halaman terakhir yang valid.
         */
        const safePage =
          totalPages === 0
            ? 1
            : Math.min(Math.max(requestedPage, 1), totalPages);

        if (safePage !== requestedPage && total > 0) {
          await load(currentFilter, safePage, requestedPageSize);

          return;
        }

        const normalized = rows.map(normalizeDocument);

        const from = total === 0 ? 0 : (safePage - 1) * requestedPageSize;

        const to =
          total === 0 ? 0 : Math.min(from + normalized.length - 1, total - 1);

        setDocuments(normalized);

        setPaginationMeta({
          page: safePage,

          pageSize: requestedPageSize,

          total,

          from,

          to,

          totalPages,

          hasPreviousPage: safePage > 1,

          hasNextPage: safePage < totalPages,
        });
      } catch (error) {
        console.error("Gagal mengambil Transfer:", error);

        setDocuments([]);

        setPaginationMeta(createEmptyPagination(requestedPageSize));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /*
   * =========================================================
   * INITIAL LOAD + FILTER
   * =========================================================
   *
   * Setiap perubahan filter otomatis kembali
   * ke halaman 1.
   */

  useEffect(() => {
    void load(filter, 1, paginationMeta.pageSize);
  }, [filter, load, paginationMeta.pageSize]);

  /*
   * =========================================================
   * PAGE CHANGE
   * =========================================================
   */

  const goToPage = useCallback(
    (nextPage: number) => {
      if (nextPage < 1) {
        return;
      }

      if (
        paginationMeta.totalPages > 0 &&
        nextPage > paginationMeta.totalPages
      ) {
        return;
      }

      void load(filter, nextPage, paginationMeta.pageSize);
    },
    [filter, load, paginationMeta.pageSize, paginationMeta.totalPages],
  );

  /*
   * =========================================================
   * PAGE SIZE CHANGE
   * =========================================================
   */

  const changePageSize = useCallback(
    (nextPageSize: number) => {
      if (nextPageSize <= 0) {
        return;
      }

      void load(filter, 1, nextPageSize);
    },
    [filter, load],
  );

  /*
   * =========================================================
   * FETCH ALL FILTERED DOCUMENTS
   * =========================================================
   *
   * KHUSUS:
   * - Export
   * - Print
   *
   * Tidak digunakan untuk tabel.
   *
   * Tetap server-side dan mengambil dokumen
   * per batch.
   */

  const fetchAllFilteredDocuments = useCallback(async (): Promise<
    TransferDocument[]
  > => {
    const batchSize = 500;

    let currentPage = 1;

    const allDocuments: TransferDocument[] = [];

    while (true) {
      const { data, error } = await supabase.rpc("get_transfer_documents", {
        p_date_from: filter.dateFrom || null,

        p_date_to: filter.dateTo || null,

        p_from_store_id: filter.fromStoreId || null,

        p_to_store_id: filter.toStoreId || null,

        p_keyword: filter.keyword.trim() || "",

        p_page: currentPage,

        p_page_size: batchSize,
      });

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as TransferRpcRow[];

      if (rows.length === 0) {
        break;
      }

      allDocuments.push(...rows.map(normalizeDocument));

      const total = Number(rows[0]?.total_count ?? 0);

      if (allDocuments.length >= total) {
        break;
      }

      currentPage += 1;
    }

    return allDocuments;
  }, [filter]);

  /*
   * =========================================================
   * RELOAD CURRENT PAGE
   * =========================================================
   */

  const reload = useCallback(() => {
    void load(filter, paginationMeta.page, paginationMeta.pageSize);
  }, [filter, load, paginationMeta.page, paginationMeta.pageSize]);

  return {
    loading,

    documents,

    stores,

    filter,
    setFilter,

    paginationMeta,

    goToPage,
    changePageSize,

    fetchAllFilteredDocuments,

    reload,
  };
}
