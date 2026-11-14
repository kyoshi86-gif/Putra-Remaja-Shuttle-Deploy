import { useMemo, useState } from "react";

import type { PaginationMeta, PaginationState } from "./types";

export const DEFAULT_PAGE_SIZE = 50;

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export function usePagination(
  initialPage = 1,
  initialPageSize = DEFAULT_PAGE_SIZE,
) {
  const [pagination, setPagination] = useState<PaginationState>({
    page: initialPage,
    pageSize: initialPageSize,
  });

  const from = (pagination.page - 1) * pagination.pageSize;

  const to = from + pagination.pageSize - 1;

  const setPage = (page: number) => {
    setPagination((current) => ({
      ...current,
      page: Math.max(1, page),
    }));
  };

  const setPageSize = (pageSize: number) => {
    setPagination({
      page: 1,
      pageSize,
    });
  };

  const resetPage = () => {
    setPage(1);
  };

  const createMeta = (total: number): PaginationMeta => {
    const totalPages = Math.ceil(total / pagination.pageSize);

    return {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages,
      from,
      to,
      hasPreviousPage: pagination.page > 1,
      hasNextPage: pagination.page < totalPages,
    };
  };

  const meta = useMemo(
    () => createMeta(0),
    [pagination.page, pagination.pageSize, from, to],
  );

  return {
    page: pagination.page,
    pageSize: pagination.pageSize,

    from,
    to,

    meta,

    setPage,
    setPageSize,
    resetPage,

    createMeta,
  };
}
