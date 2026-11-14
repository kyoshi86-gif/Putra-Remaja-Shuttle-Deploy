import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

import type { PaginationMeta } from "@/lib/pagination/types";

import type { OpnameDocument, OpnameFilter } from "../types";

import type { StoreOption } from "../../types";

const DEFAULT_PAGE_SIZE = 25;

type OpnameRpcStore = {
  id: string;
  code: string;
  name: string;
};

type OpnameRpcItem = {
  code: string;
  name: string;
  unit_code: string | null;

  qtySystem: number | string | null;

  qtyOpname: number | string | null;

  difference: number | string | null;

  averageCost: number | string | null;

  value: number | string | null;
};

type OpnameRpcRow = {
  reference: string;

  movement_date: string;

  created_at: string;

  created_by: string | null;

  store: OpnameRpcStore | null;

  items: OpnameRpcItem[] | null;

  total_difference: number | string | null;

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

function normalizeDocument(row: OpnameRpcRow): OpnameDocument {
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

          qtySystem: Number(item.qtySystem ?? 0),

          qtyOpname: Number(item.qtyOpname ?? 0),

          difference: Number(item.difference ?? 0),

          averageCost: Number(item.averageCost ?? 0),

          value: Number(item.value ?? 0),
        }))
      : [],

    totalDifference: Number(row.total_difference ?? 0),

    totalValue: Number(row.total_value ?? 0),
  };
}

export function useOpnameList() {
  const [loading, setLoading] = useState(false);

  const [documents, setDocuments] = useState<OpnameDocument[]>([]);

  const [stores, setStores] = useState<StoreOption[]>([]);

  const [filter, setFilter] = useState<OpnameFilter>({
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
   * LOAD STOCK OPNAME
   * =========================================================
   *
   * Pagination dilakukan di PostgreSQL.
   */

  const load = useCallback(
    async (
      currentFilter: OpnameFilter,
      requestedPage: number,
      requestedPageSize: number,
    ) => {
      setLoading(true);

      try {
        const { data, error } = await supabase.rpc("get_opname_documents", {
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

        const rows = (data ?? []) as OpnameRpcRow[];

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
        console.error("Load stock opname gagal:", error);

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
   * Khusus Export / Print.
   *
   * Tetap menggunakan filter server-side.
   */

  const fetchAllFilteredDocuments = useCallback(async (): Promise<
    OpnameDocument[]
  > => {
    const batchSize = 500;

    let currentPage = 1;

    const allDocuments: OpnameDocument[] = [];

    while (true) {
      const { data, error } = await supabase.rpc("get_opname_documents", {
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

      const rows = (data ?? []) as OpnameRpcRow[];

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
