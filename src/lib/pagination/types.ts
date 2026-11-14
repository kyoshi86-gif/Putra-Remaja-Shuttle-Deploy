export interface PaginationState {
  page: number;
  pageSize: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
}

export interface FetchAllPagesOptions {
  pageSize?: number;
  maxRows?: number;
}

export function createPaginationMeta(
  page: number,
  pageSize: number,
  total: number,
): PaginationMeta {
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

  const from = total > 0 ? (page - 1) * pageSize : 0;

  const to = total > 0 ? Math.min(from + pageSize - 1, total - 1) : -1;

  return {
    page,
    pageSize,
    total,
    totalPages,
    from,
    to,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}
