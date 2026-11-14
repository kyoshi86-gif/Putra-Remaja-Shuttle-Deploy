import type { PaginationMeta } from "@/lib/pagination/types";

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
}

export default function Pagination({
  meta,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
}: PaginationProps) {
  if (meta.total === 0) {
    return null;
  }

  const start = meta.from + 1;

  const end = Math.min(meta.to + 1, meta.total);

  return (
    <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-gray-500">
        Menampilkan <span className="font-medium text-gray-700">{start}</span>
        {" - "}
        <span className="font-medium text-gray-700">{end}</span>
        {" dari "}
        <span className="font-medium text-gray-700">{meta.total}</span>
        {" data"}
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="pagination-page-size" className="text-sm text-gray-500">
          Tampilkan
        </label>

        <select
          id="pagination-page-size"
          value={meta.pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={!meta.hasPreviousPage}
          onClick={() => onPageChange(meta.page - 1)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          Sebelumnya
        </button>

        <span className="min-w-[90px] text-center text-sm text-gray-600">
          Halaman {meta.page}
          {" / "}
          {meta.totalPages}
        </span>

        <button
          type="button"
          disabled={!meta.hasNextPage}
          onClick={() => onPageChange(meta.page + 1)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          Berikutnya
        </button>
      </div>
    </div>
  );
}
