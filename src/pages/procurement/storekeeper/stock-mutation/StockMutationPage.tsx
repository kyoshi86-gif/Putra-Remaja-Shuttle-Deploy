import {
  useCallback,
  useMemo,
} from "react";

import DateInput from "@/components/common/DateInput";
import Pagination from "@/components/common/Pagination";

import SearchableSelect, {
  type SearchableSelectOption,
} from "@/components/common/SearchableSelect";

import {
  createPaginationMeta,
} from "@/lib/pagination/types";

import {
  usePagination,
} from "@/lib/pagination/usePagination";

import {
  getCustomUser,
} from "@/lib/authUser";

import {
  exportReport,
  formatReportDateRange,
  formatReportDisplayDate,
} from "@/utils/exportReport";

import {
  printReport,
} from "@/utils/printReport";

import {
  money,
  quantity,
} from "../../utils/format";

import {
  STOCK_MUTATION_LABELS,
} from "./types";

import {
  useStockMutation,
} from "./useStockMutation";

// ============================================================================
// HELPER
// ============================================================================

function getMovementLabel(
  value: string,
): string {
  return (
    STOCK_MUTATION_LABELS[value] ??
    value
  );
}

function movementClass(
  movementType: string,
): string {
  if (
    movementType ===
      "TRANSFER_IN" ||
    movementType ===
      "RECEIPT" ||
    movementType ===
      "ADJUSTMENT_IN" ||
    movementType ===
      "OPENING_BALANCE"
  ) {
    return "text-emerald-600";
  }

  if (
    movementType ===
      "TRANSFER_OUT" ||
    movementType ===
      "ISSUE" ||
    movementType ===
      "ADJUSTMENT_OUT" ||
    movementType ===
      "STOCK_OPNAME"
  ) {
    return "text-red-600";
  }

  return "text-gray-700";
}

function getPeriodText(
  dateFrom: string,
  dateTo: string,
): string {
  if (!dateFrom && !dateTo) {
    return "Semua Periode";
  }

  if (dateFrom && !dateTo) {
    return `Mulai ${formatReportDisplayDate(
      new Date(
        `${dateFrom}T00:00:00`,
      ),
    )}`;
  }

  if (!dateFrom && dateTo) {
    return `Sampai ${formatReportDisplayDate(
      new Date(
        `${dateTo}T00:00:00`,
      ),
    )}`;
  }

  return `${formatReportDisplayDate(
    new Date(
      `${dateFrom}T00:00:00`,
    ),
  )} s/d ${formatReportDisplayDate(
    new Date(
      `${dateTo}T00:00:00`,
    ),
  )}`;
}

// ============================================================================
// PAGE
// ============================================================================

export default function StockMutationPage(): JSX.Element {
  // --------------------------------------------------------------------------
  // PAGINATION
  // --------------------------------------------------------------------------

  const {
    page,
    pageSize,
    setPage,
    setPageSize,
  } = usePagination();

  // --------------------------------------------------------------------------
  // DATA
  // --------------------------------------------------------------------------

  const {
    stores,
    items,

    movements,
    totalCount,
    hasSearched,

    itemId,
    setItemId,

    storeId,
    setStoreId,

    dateFrom,
    setDateFrom,

    dateTo,
    setDateTo,

    keyword,
    setKeyword,

    totalIn,
    totalOut,

    loading,
    loadingMaster,

    error,

    searchMovements,
    loadMovements,
    clearResult,
  } = useStockMutation();

  // ==========================================================================
  // ITEM OPTIONS
  // ==========================================================================

  const itemOptions =
    useMemo<
      SearchableSelectOption[]
    >(
      () =>
        items.map(
          (
            item,
          ) => ({
            value:
              item.id,

            label:
              `${item.code} - ${item.name}`,

            searchText:
              [
                item.code,
                item.name,
              ].join(" "),
          }),
        ),
      [
        items,
      ],
    );

  // ==========================================================================
  // STORE OPTIONS
  // ==========================================================================

  const storeOptions =
    useMemo<
      SearchableSelectOption[]
    >(
      () =>
        stores.map(
          (
            store,
          ) => ({
            value:
              store.id,

            label:
              `${store.code} - ${store.name}`,

            searchText:
              [
                store.code,
                store.name,
              ].join(" "),
          }),
        ),
      [
        stores,
      ],
    );

  // ==========================================================================
  // PAGINATION META
  // ==========================================================================

  const paginationMeta =
    createPaginationMeta(
      page,
      pageSize,
      totalCount,
    );

  // ==========================================================================
  // SEARCH
  // ==========================================================================

  const handleSearch =
    useCallback(
      async () => {
        setPage(
          1,
        );

        await searchMovements(
          1,
          pageSize,
        );
      },
      [
        pageSize,
        searchMovements,
        setPage,
      ],
    );

  // ==========================================================================
  // PAGE CHANGE
  // ==========================================================================

  const handlePageChange =
    useCallback(
      async (
        nextPage: number,
      ) => {
        setPage(
          nextPage,
        );

        await loadMovements(
          nextPage,
          pageSize,
        );
      },
      [
        loadMovements,
        pageSize,
        setPage,
      ],
    );

  // ==========================================================================
  // PAGE SIZE CHANGE
  // ==========================================================================

  const handlePageSizeChange =
    useCallback(
      async (
        nextPageSize: number,
      ) => {
        setPageSize(
          nextPageSize,
        );

        setPage(
          1,
        );

        if (
          hasSearched
        ) {
          await loadMovements(
            1,
            nextPageSize,
          );
        }
      },
      [
        hasSearched,
        loadMovements,
        setPage,
        setPageSize,
      ],
    );

  // ==========================================================================
  // RESET
  // ==========================================================================

  const handleReset = () => {
    setItemId(
      "",
    );

    setStoreId(
      "",
    );

    setKeyword(
      "",
    );

    setDateFrom(
      "",
    );

    setDateTo(
      "",
    );

    setPage(
      1,
    );

    clearResult();
  };

  // ==========================================================================
  // EXPORT EXCEL
  // ==========================================================================

  const handleExport =
    useCallback(() => {
      if (
        movements.length === 0
      ) {
        return;
      }

      try {
        exportReport({
          filename:
            `Mutasi_Persediaan_${formatReportDateRange(
              dateFrom
                ? new Date(
                    `${dateFrom}T00:00:00`,
                  )
                : null,

              dateTo
                ? new Date(
                    `${dateTo}T00:00:00`,
                  )
                : null,
            )}.xlsx`,

          sheetName:
            "Mutasi Persediaan",

          columns: [
            {
              label:
                "Tanggal",

              key:
                "movement_date",
            },

            {
              label:
                "Referensi",

              key:
                "reference",
            },

            {
              label:
                "Artikel",

              key:
                "item",
            },

            {
              label:
                "Satuan",

              key:
                "unit",
            },

            {
              label:
                "Store",

              key:
                "store",
            },

            {
              label:
                "Jenis Mutasi",

              key:
                "movement_type",
            },

            {
              label:
                "Qty Masuk",

              key:
                "quantity_in",

              format:
                (value) =>
                  Number(
                    value ?? 0,
                  ),
            },

            {
              label:
                "Qty Keluar",

              key:
                "quantity_out",

              format:
                (value) =>
                  Number(
                    value ?? 0,
                  ),
            },

            {
              label:
                "Saldo",

              key:
                "quantity_after",

              format:
                (value) =>
                  Number(
                    value ?? 0,
                  ),
            },

            {
              label:
                "Avg Cost",

              key:
                "average_cost_after",

              format:
                (value) =>
                  Number(
                    value ?? 0,
                  ),
            },

            {
              label:
                "Nilai Mutasi",

              key:
                "movement_value",

              format:
                (value) =>
                  Number(
                    value ?? 0,
                  ),
            },

            {
              label:
                "Keterangan",

              key:
                "description",
            },
          ],

          rows:
            movements.map(
              (
                row,
              ) => ({
                movement_date:
                  row.movement_date,

                reference:
                  row.reference ?? "",

                item:
                  row.item
                    ? `${row.item.code ?? ""} - ${
                        row.item.name ?? ""
                      }`
                    : "",

                unit:
                  row.item?.unit?.code ?? "",

                store:
                  row.store
                    ? `${row.store.code ?? ""} - ${
                        row.store.name ?? ""
                      }`
                    : "",

                movement_type:
                  getMovementLabel(
                    row.movement_type,
                  ),

                quantity_in:
                  Number(
                    row.quantity_in ?? 0,
                  ),

                quantity_out:
                  Number(
                    row.quantity_out ?? 0,
                  ),

                quantity_after:
                  Number(
                    row.quantity_after ?? 0,
                  ),

                average_cost_after:
                  Number(
                    row.average_cost_after ?? 0,
                  ),

                movement_value:
                  Number(
                    row.movement_value ?? 0,
                  ),

                description:
                  row.description ?? "",
              }),
            ),
        });
      } catch (
        exportError
      ) {
        console.error(
          "Export Mutasi Persediaan gagal:",
          exportError,
        );

        alert(
          "Gagal melakukan export Mutasi Persediaan.",
        );
      }
    }, [
      movements,
      dateFrom,
      dateTo,
    ]);

  // ==========================================================================
  // PRINT
  // ==========================================================================

  const handlePrint =
    useCallback(() => {
      if (
        movements.length === 0
      ) {
        return;
      }

      try {
        const currentUser =
          getCustomUser();

        const printedBy =
          currentUser?.name ??
          "-";

        printReport({
          title:
            "LAPORAN MUTASI PERSEDIAAN",

          company:
            "BUTTER CLUB BAKERY",

          period:
            getPeriodText(
              dateFrom,
              dateTo,
            ),

          orientation:
            "landscape",

          printedBy,

          columns: [
            {
              label:
                "Tanggal",

              key:
                "movement_date",

              width:
                "9%",
            },

            {
              label:
                "Referensi",

              key:
                "reference",

              width:
                "11%",
            },

            {
              label:
                "Artikel",

              key:
                "item",

              width:
                "20%",
            },

            {
              label:
                "Store",

              key:
                "store",

              width:
                "14%",
            },

            {
              label:
                "Jenis",

              key:
                "movement_type",

              width:
                "10%",
            },

            {
              label:
                "Masuk",

              key:
                "quantity_in",

              align:
                "right",

              width:
                "8%",

              format:
                (value) =>
                  quantity(
                    Number(
                      value ?? 0,
                    ),
                  ),
            },

            {
              label:
                "Keluar",

              key:
                "quantity_out",

              align:
                "right",

              width:
                "8%",

              format:
                (value) =>
                  quantity(
                    Number(
                      value ?? 0,
                    ),
                  ),
            },

            {
              label:
                "Saldo",

              key:
                "quantity_after",

              align:
                "right",

              width:
                "8%",

              format:
                (value) =>
                  quantity(
                    Number(
                      value ?? 0,
                    ),
                  ),
            },

            {
              label:
                "Avg Cost",

              key:
                "average_cost_after",

              align:
                "right",

              width:
                "12%",

              format:
                (value) =>
                  money(
                    Number(
                      value ?? 0,
                    ),
                  ),
            },
          ],

          rows:
            movements.map(
              (
                row,
              ) => ({
                movement_date:
                  row.movement_date,

                reference:
                  row.reference ?? "",

                item:
                  row.item
                    ? `${row.item.code ?? ""} - ${
                        row.item.name ?? ""
                      }`
                    : "",

                store:
                  row.store
                    ? `${row.store.code ?? ""} - ${
                        row.store.name ?? ""
                      }`
                    : "",

                movement_type:
                  getMovementLabel(
                    row.movement_type,
                  ),

                quantity_in:
                  Number(
                    row.quantity_in ?? 0,
                  ),

                quantity_out:
                  Number(
                    row.quantity_out ?? 0,
                  ),

                quantity_after:
                  Number(
                    row.quantity_after ?? 0,
                  ),

                average_cost_after:
                  Number(
                    row.average_cost_after ?? 0,
                  ),
              }),
            ),

          footer: [
            {
              label:
                "Jumlah Dokumen",

              value:
                totalCount,
            },

            {
              label:
                "Total Masuk",

              value:
                quantity(
                  totalIn,
                ),
            },

            {
              label:
                "Total Keluar",

              value:
                quantity(
                  totalOut,
                ),
            },
          ],
        });
      } catch (
        printError
      ) {
        console.error(
          "Print Mutasi Persediaan gagal:",
          printError,
        );

        alert(
          "Gagal mencetak Mutasi Persediaan.",
        );
      }
    }, [
      movements,
      dateFrom,
      dateTo,
      totalCount,
      totalIn,
      totalOut,
    ]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="w-full space-y-4 pr-2">

      {/* ================================================================
          HEADER
      ================================================================= */}

      <div>
        <h1 className="text-2xl font-bold">
          Mutasi Stok
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Riwayat keluar masuk persediaan per artikel dan per gudang.
        </p>
      </div>

      {/* ================================================================
          FILTER
      ================================================================= */}

      <div className="rounded-lg border bg-white p-4">

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">

          {/* ARTIKEL */}

          <div>
            <label className="mb-1 block text-sm font-medium">
              Artikel
            </label>

            <SearchableSelect
              value={itemId}
              options={itemOptions}
              placeholder={
                loadingMaster
                  ? "Memuat artikel..."
                  : "Semua artikel"
              }
              emptyMessage="Artikel tidak ditemukan."
              onChange={setItemId}
            />
          </div>

          {/* STORE */}

          <div>
            <label className="mb-1 block text-sm font-medium">
              Store / Gudang
            </label>

            <SearchableSelect
              value={storeId}
              options={storeOptions}
              placeholder={
                loadingMaster
                  ? "Memuat store..."
                  : "Semua store"
              }
              emptyMessage="Store tidak ditemukan."
              onChange={setStoreId}
            />
          </div>

          {/* TANGGAL DARI */}

          <div>
            <label className="mb-1 block text-sm font-medium">
              Tanggal Dari
            </label>

            <DateInput
              value={dateFrom}
              onChange={setDateFrom}
            />
          </div>

          {/* TANGGAL SAMPAI */}

          <div>
            <label className="mb-1 block text-sm font-medium">
              Tanggal Sampai
            </label>

            <DateInput
              value={dateTo}
              min={dateFrom || undefined}
              onChange={setDateTo}
            />
          </div>

          {/* ACTION */}

          <div className="flex items-end gap-3">

            <button
              type="button"
              onClick={() => {
                void handleSearch();
              }}
              disabled={
                loading ||
                loadingMaster
              }
              className="rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Memuat..."
                : "Cari"}
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="rounded-md border border-gray-300 px-4 py-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Reset
            </button>

          </div>

        </div>

        {/* KEYWORD */}

        <div className="mt-4">

          <label className="mb-1 block text-sm font-medium">
            Pencarian
          </label>

          <input
            type="search"
            value={keyword}
            onChange={(event) =>
              setKeyword(
                event.target.value,
              )
            }
            placeholder="Cari kode artikel, nama artikel, store, referensi atau keterangan..."
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />

        </div>

      </div>

      {/* ================================================================
          SUMMARY
      ================================================================= */}

      {hasSearched && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

          <div className="rounded-lg border bg-white p-4">

            <div className="text-sm text-gray-500">
              Jumlah Mutasi
            </div>

            <div className="mt-1 text-2xl font-semibold">
              {totalCount}
            </div>

          </div>

          <div className="rounded-lg border bg-white p-4">

            <div className="text-sm text-gray-500">
              Total Masuk
            </div>

            <div className="mt-1 text-2xl font-semibold text-emerald-600">
              {quantity(
                totalIn,
              )}
            </div>

          </div>

          <div className="rounded-lg border bg-white p-4">

            <div className="text-sm text-gray-500">
              Total Keluar
            </div>

            <div className="mt-1 text-2xl font-semibold text-red-600">
              {quantity(
                totalOut,
              )}
            </div>

          </div>

        </div>
      )}

      {/* ================================================================
          ERROR
      ================================================================= */}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ================================================================
          TABLE
      ================================================================= */}

      {hasSearched && (
        <div className="rounded-lg border bg-white">

          {/* TABLE HEADER */}

          <div className="flex items-center justify-between border-b px-4 py-3">

            <h3 className="text-lg font-semibold">
              Riwayat Mutasi Persediaan
            </h3>

            <div className="flex items-center gap-2">

              <button
                type="button"
                onClick={handleExport}
                disabled={
                  loading ||
                  movements.length === 0
                }
                className="rounded-md border border-green-600 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export Excel
              </button>

              <button
                type="button"
                onClick={handlePrint}
                disabled={
                  loading ||
                  movements.length === 0
                }
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Print
              </button>

            </div>

          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">

            <table className="min-w-[1500px] w-full text-sm">

              <thead className="bg-gray-100 text-gray-700">

                <tr>

                  <th className="border-b px-3 py-3 text-center">
                    No
                  </th>

                  <th className="border-b px-3 py-3 text-left">
                    Tanggal
                  </th>

                  <th className="border-b px-3 py-3 text-left">
                    Artikel
                  </th>

                  <th className="border-b px-3 py-3 text-left">
                    Satuan
                  </th>

                  <th className="border-b px-3 py-3 text-left">
                    Store / Gudang
                  </th>

                  <th className="border-b px-3 py-3 text-left">
                    Jenis Mutasi
                  </th>

                  <th className="border-b px-3 py-3 text-left">
                    Referensi
                  </th>

                  <th className="border-b px-3 py-3 text-right">
                    Qty Masuk
                  </th>

                  <th className="border-b px-3 py-3 text-right">
                    Qty Keluar
                  </th>

                  <th className="border-b px-3 py-3 text-right">
                    Saldo
                  </th>

                  <th className="border-b px-3 py-3 text-right">
                    Avg Cost
                  </th>

                  <th className="border-b px-3 py-3 text-right">
                    Nilai Mutasi
                  </th>

                  <th className="border-b px-3 py-3 text-left">
                    Keterangan
                  </th>

                </tr>

              </thead>

              <tbody>

                {loading ? (

                  <tr>

                    <td
                      colSpan={13}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Memuat data...
                    </td>

                  </tr>

                ) : movements.length === 0 ? (

                  <tr>

                    <td
                      colSpan={13}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Tidak ada data mutasi persediaan.
                    </td>

                  </tr>

                ) : (

                  movements.map(
                    (
                      row,
                      index,
                    ) => (

                      <tr
                        key={row.id}
                        className="hover:bg-gray-50"
                      >

                        <td className="border-b px-3 py-2 text-center">

                          {(page - 1) *
                            pageSize +
                            index +
                            1}

                        </td>

                        <td className="border-b px-3 py-2">
                          {row.movement_date}
                        </td>

                        <td className="border-b px-3 py-2">

                          {row.item
                            ? `${row.item.code ?? ""} - ${
                                row.item.name ?? ""
                              }`
                            : "-"}

                        </td>

                        <td className="border-b px-3 py-2">
                          {row.item?.unit?.code ?? "-"}
                        </td>

                        <td className="border-b px-3 py-2">

                          {row.store
                            ? `${row.store.code ?? ""} - ${
                                row.store.name ?? ""
                              }`
                            : "-"}

                        </td>

                        <td className="border-b px-3 py-2">

                          <span
                            className={
                              movementClass(
                                row.movement_type,
                              )
                            }
                          >
                            {getMovementLabel(
                              row.movement_type,
                            )}
                          </span>

                        </td>

                        <td className="border-b px-3 py-2">
                          {row.reference ?? "-"}
                        </td>

                        <td className="border-b px-3 py-2 text-right text-emerald-600">
                          {quantity(
                            Number(
                              row.quantity_in ?? 0,
                            ),
                          )}
                        </td>

                        <td className="border-b px-3 py-2 text-right text-red-600">
                          {quantity(
                            Number(
                              row.quantity_out ?? 0,
                            ),
                          )}
                        </td>

                        <td className="border-b px-3 py-2 text-right">
                          {quantity(
                            Number(
                              row.quantity_after ?? 0,
                            ),
                          )}
                        </td>

                        <td className="border-b px-3 py-2 text-right">
                          {money(
                            Number(
                              row.average_cost_after ?? 0,
                            ),
                          )}
                        </td>

                        <td className="border-b px-3 py-2 text-right">
                          {money(
                            Number(
                              row.movement_value ?? 0,
                            ),
                          )}
                        </td>

                        <td className="border-b px-3 py-2">
                          {row.description ?? "-"}
                        </td>

                      </tr>

                    ),
                  )

                )}

              </tbody>

            </table>

          </div>

          {/* PAGINATION */}

          {movements.length > 0 && (
            <div className="border-t p-4">

              <Pagination
                meta={paginationMeta}
                onPageChange={(nextPage) => {
                  void handlePageChange(nextPage);
                }}
                onPageSizeChange={(nextPageSize) => {
                  void handlePageSizeChange(nextPageSize);
                }}
              />

            </div>
          )}

        </div>
      )}

    </div>
  );
}