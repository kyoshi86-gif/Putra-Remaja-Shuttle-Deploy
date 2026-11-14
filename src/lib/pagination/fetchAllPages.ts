import type { FetchAllPagesOptions } from "./types";

export async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => Promise<{
    data: T[] | null;
    error: unknown;
  }>,
  options: FetchAllPagesOptions = {},
): Promise<{
  data: T[];
  error: unknown;
}> {
  const pageSize = options.pageSize ?? 500;

  const maxRows = options.maxRows ?? Number.MAX_SAFE_INTEGER;

  const result: T[] = [];

  let from = 0;

  while (result.length < maxRows) {
    const to = Math.min(from + pageSize - 1, maxRows - 1);

    const { data, error } = await fetchPage(from, to);

    if (error) {
      return {
        data: result,
        error,
      };
    }

    if (!data || data.length === 0) {
      break;
    }

    result.push(...data);

    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return {
    data: result.length > maxRows ? result.slice(0, maxRows) : result,
    error: null,
  };
}
