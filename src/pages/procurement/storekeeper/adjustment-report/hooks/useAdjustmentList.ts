import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

import type { PaginationMeta } from "@/lib/pagination/types";

import type { AdjustmentDocument, AdjustmentFilter } from "../types";

import type { StoreOption } from "../../types";

const DEFAULT_PAGE_SIZE = 25;

type AdjustmentRpcStore = {
  id: string;
  code: string;
  name: string;
};

type AdjustmentRpcItem = {
  code: string;
  name: string;
  unit_code: string | null;

  qtyBefore: number | string | null;

  qtyAdjustment: number | string | null;

  qtyAfter: number | string | null;

  averageCost: number | string | null;

  value: number | string | null;
};

type AdjustmentRpcRow = {
  reference: string;

  movement_date: string;

  created_at: string;

  created_by: string | null;

  store: AdjustmentRpcStore | null;

  items: AdjustmentRpcItem[] | null;

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

function normalizeDocument(row: AdjustmentRpcRow): AdjustmentDocument {
  return {
    reference: row.reference,

    movement_date: row.movement_date,

    created_at: row.created_at,

    created_by: row.created_by,

    store: row.store,

    items: Array.isArray(row.items)
      ? row.items.map((item) => ({
          code: item.code ?? "",

          name: item.name ?? "",

          unit_code: item.unit_code ?? null,

          qtyBefore: Number(item.qtyBefore ?? 0),

          qtyAdjustment: Number(item.qtyAdjustment ?? 0),

          qtyAfter: Number(item.qtyAfter ?? 0),

          averageCost: Number(item.averageCost ?? 0),

          value: Number(item.value ?? 0),
        }))
      : [],

    totalQty: Number(row.total_qty ?? 0),

    totalValue: Number(row.total_value ?? 0),
  };
}

export function useAdjustmentList() {
  const [loading, setLoading] = useState(false);

  const [documents, setDocuments] = useState<AdjustmentDocument[]>([]);

  const [stores, setStores] = useState<StoreOption[]>([]);

  const [filter, setFilter] = useState<AdjustmentFilter>({
    dateFrom: "",

    dateTo: "",

    storeId: "",

    keyword: "",
  });

  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>(
    createEmptyPagination(DEFAULT_PAGE_SIZE),
  );

  /*
   * =========================================================
   * LOAD STORES
   * =========================================================
   */

  useEffect(() => {
    let cancelled = false;

    const loadStores = async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id,code,name")
        .order("code", {
          ascending: true,
        });

      if (cancelled) {
        return;
      }

      if (error) {
        console.error("Load stores gagal:", error);

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
   * LOAD ADJUSTMENT
   * =========================================================
   *
   * Pagination terjadi di PostgreSQL.
   *
   * React hanya menerima dokumen pada
   * halaman yang sedang aktif.
   */

  const load = useCallback(
    async (
      currentFilter: AdjustmentFilter,
      requestedPage: number,
      requestedPageSize: number,
    ) => {
      setLoading(true);

      try {
        const { data, error } = await supabase.rpc("get_adjustment_documents", {
          p_date_from: currentFilter.dateFrom || null,

          p_date_to: currentFilter.dateTo || null,

          p_store_id: currentFilter.storeId || null,

          p_keyword: currentFilter.keyword.trim() || "",

          p_page: requestedPage,

          p_page_size: requestedPageSize,
        });

        if (error) {
          throw error;
        }

        const rows = (data ?? []) as AdjustmentRpcRow[];

        const total = Number(rows[0]?.total_count ?? 0);

        const totalPages = total > 0 ? Math.ceil(total / requestedPageSize) : 0;

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
        console.error("Load adjustment gagal:", error);

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
   * FILTER BERUBAH
   * =========================================================
   *
   * Kembali ke page 1.
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
   * PAGE SIZE
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
   * FETCH ALL
   * =========================================================
   *
   * Hanya untuk Export / Print.
   *
   * Tetap menggunakan filter server-side.
   */

  const fetchAllFilteredDocuments = useCallback(async (): Promise<
    AdjustmentDocument[]
  > => {
    const batchSize = 500;

    let currentPage = 1;

    const allDocuments: AdjustmentDocument[] = [];

    while (true) {
      const { data, error } = await supabase.rpc("get_adjustment_documents", {
        p_date_from: filter.dateFrom || null,

        p_date_to: filter.dateTo || null,

        p_store_id: filter.storeId || null,

        p_keyword: filter.keyword.trim() || "",

        p_page: currentPage,

        p_page_size: batchSize,
      });

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as AdjustmentRpcRow[];

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
   * RELOAD
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
