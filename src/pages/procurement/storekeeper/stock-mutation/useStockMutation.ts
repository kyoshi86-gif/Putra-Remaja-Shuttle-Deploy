import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/lib/supabaseClient";

import type {
  StockMutationItem,
  StockMutationRow,
  StockMutationStore,
} from "./types";

// ============================================================================
// TYPES
// ============================================================================

type UnitRaw = {
  code: string | null;
};

type ItemRaw = {
  code: string | null;
  name: string | null;
  unit:
    | UnitRaw
    | UnitRaw[]
    | null;
};

type StoreRaw = {
  code: string | null;
  name: string | null;
};

type RawMovementRow = {
  id: string;

  movement_date: string;
  movement_type: string;

  quantity_in: number | string | null;
  quantity_out: number | string | null;

  unit_cost: number | string | null;
  movement_value: number | string | null;

  quantity_before: number | string | null;
  quantity_after: number | string | null;

  average_cost_before: number | string | null;
  average_cost_after: number | string | null;

  source_table: string | null;
  source_id: string | null;

  reference: string | null;
  description: string | null;

  created_at: string;
  created_by: string | null;

  item_id: string;
  store_id: string;

  item:
    | ItemRaw
    | ItemRaw[]
    | null;

  store:
    | StoreRaw
    | StoreRaw[]
    | null;
};

type ReceivingLookup = {
  id: string;

  purchase_order_number_snapshot:
    | string
    | null;

  supplier_name_snapshot:
    | string
    | null;
};

// ============================================================================
// HELPERS
// ============================================================================

function firstValue<T>(
  value:
    | T
    | T[]
    | null
    | undefined,
): T | null {
  if (
    Array.isArray(
      value,
    )
  ) {
    return (
      value[0] ??
      null
    );
  }

  return (
    value ??
    null
  );
}

function numberValue(
  value: unknown,
): number {
  const result =
    Number(
      value ?? 0,
    );

  return Number.isFinite(
    result,
  )
    ? result
    : 0;
}

// ============================================================================
// HOOK
// ============================================================================

export function useStockMutation() {
  // --------------------------------------------------------------------------
  // MASTER
  // --------------------------------------------------------------------------

  const [
    stores,
    setStores,
  ] = useState<
    StockMutationStore[]
  >([]);

  const [
    items,
    setItems,
  ] = useState<
    StockMutationItem[]
  >([]);

  // --------------------------------------------------------------------------
  // MOVEMENT
  // --------------------------------------------------------------------------

  const [
    movements,
    setMovements,
  ] = useState<
    StockMutationRow[]
  >([]);

  const [
    totalCount,
    setTotalCount,
  ] = useState(0);

  // --------------------------------------------------------------------------
  // FILTER
  // --------------------------------------------------------------------------

  const [
    itemId,
    setItemId,
  ] = useState("");

  const [
    storeId,
    setStoreId,
  ] = useState("");

  const [
    dateFrom,
    setDateFrom,
  ] = useState("");

  const [
    dateTo,
    setDateTo,
  ] = useState("");

  const [
    keyword,
    setKeyword,
  ] = useState("");

  /*
   * Penting:
   *
   * false saat halaman pertama dibuka.
   *
   * Data movement TIDAK dimuat
   * sebelum user klik Cari.
   */
  const [
    hasSearched,
    setHasSearched,
  ] = useState(false);

  // --------------------------------------------------------------------------
  // STATE
  // --------------------------------------------------------------------------

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    loadingMaster,
    setLoadingMaster,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  // ==========================================================================
  // LOAD MASTER
  // ==========================================================================

  const loadMaster =
    useCallback(
      async () => {
        setLoadingMaster(
          true,
        );

        setError(
          null,
        );

        try {
          const [
            storeResult,
            itemResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  "stores",
                )
                .select(
                  `
                  id,
                  code,
                  name
                  `,
                )
                .eq(
                  "is_active",
                  true,
                )
                .order(
                  "code",
                  {
                    ascending:
                      true,
                  },
                ),

              supabase
                .from(
                  "items",
                )
                .select(
                  `
                  id,
                  code,
                  name
                  `,
                )
                .eq(
                  "is_active",
                  true,
                )
                .order(
                  "code",
                  {
                    ascending:
                      true,
                  },
                ),
            ]);

          if (
            storeResult.error
          ) {
            throw storeResult.error;
          }

          if (
            itemResult.error
          ) {
            throw itemResult.error;
          }

          setStores(
            (
              storeResult.data ??
              []
            ) as StockMutationStore[],
          );

          setItems(
            (
              itemResult.data ??
              []
            ) as StockMutationItem[],
          );
        } catch (
          err
        ) {
          setError(
            err instanceof Error
              ? err.message
              : "Gagal memuat master data.",
          );
        } finally {
          setLoadingMaster(
            false,
          );
        }
      },
      [],
    );

  // ==========================================================================
  // LOAD MOVEMENT
  //
  // SERVER SIDE PAGINATION
  // ==========================================================================

  const loadMovements =
    useCallback(
      async (
        page: number,
        pageSize: number,
      ) => {
        /*
         * Tidak ada query movement
         * sebelum pencarian dilakukan.
         */
        if (
          !hasSearched
        ) {
          setMovements(
            [],
          );

          setTotalCount(
            0,
          );

          return;
        }

        setLoading(
          true,
        );

        setError(
          null,
        );

        try {
          const from =
            (
              page -
              1
            ) *
            pageSize;

          const to =
            from +
            pageSize -
            1;

          let query =
            supabase
              .from(
                "inventory_movements",
              )
              .select(
                `
                id,

                movement_date,

                movement_type,

                quantity_in,
                quantity_out,

                unit_cost,
                movement_value,

                quantity_before,
                quantity_after,

                average_cost_before,
                average_cost_after,

                source_table,
                source_id,

                reference,
                description,

                created_at,
                created_by,

                item_id,
                store_id,

                item:items(
                  code,
                  name,

                  unit:units(
                    code
                  )
                ),

                store:stores(
                  code,
                  name
                )
                `,
                {
                  count:
                    "exact",
                },
              )
              .order(
                "movement_date",
                {
                  ascending:
                    false,
                },
              )
              .order(
                "created_at",
                {
                  ascending:
                    false,
                },
              );

          // ------------------------------------------------
          // ITEM
          // ------------------------------------------------

          if (
            itemId
          ) {
            query =
              query.eq(
                "item_id",
                itemId,
              );
          }

          // ------------------------------------------------
          // STORE
          // ------------------------------------------------

          if (
            storeId
          ) {
            query =
              query.eq(
                "store_id",
                storeId,
              );
          }

          // ------------------------------------------------
          // DATE FROM
          // ------------------------------------------------

          if (
            dateFrom
          ) {
            query =
              query.gte(
                "movement_date",
                dateFrom,
              );
          }

          // ------------------------------------------------
          // DATE TO
          // ------------------------------------------------

          if (
            dateTo
          ) {
            query =
              query.lte(
                "movement_date",
                dateTo,
              );
          }

          // ------------------------------------------------
          // KEYWORD
          // ------------------------------------------------

          const search =
            keyword
              .trim();

          if (
            search
          ) {
            query =
              query.or(
                [
                  `reference.ilike.%${search}%`,
                  `description.ilike.%${search}%`,
                  `movement_type.ilike.%${search}%`,
                ].join(
                  ",",
                ),
              );
          }

          // ------------------------------------------------
          // SERVER PAGINATION
          // ------------------------------------------------

          const {
            data,
            error:
              queryError,
            count,
          } =
            await query.range(
              from,
              to,
            );

          if (
            queryError
          ) {
            throw queryError;
          }

          const rawRows =
            (
              data ??
              []
            ) as unknown as RawMovementRow[];

          // ==============================================================
          // RECEIVING LOOKUP
          //
          // inventory_movements.source_id
          // =
          // receiving_records.id
          // ==============================================================

          const receivingIds =
            Array.from(
              new Set(
                rawRows
                  .filter(
                    (
                      row,
                    ) =>
                      row.source_table ===
                        "receiving_records" &&
                      Boolean(
                        row.source_id,
                      ),
                  )
                  .map(
                    (
                      row,
                    ) =>
                      row.source_id as string,
                  ),
              ),
            );

          const receivingMap =
            new Map<
              string,
              ReceivingLookup
            >();

          if (
            receivingIds.length >
            0
          ) {
            const {
              data:
                receivingData,
              error:
                receivingError,
            } =
              await supabase
                .from(
                  "receiving_records",
                )
                .select(
                  `
                  id,
                  purchase_order_number_snapshot,
                  supplier_name_snapshot
                  `,
                )
                .in(
                  "id",
                  receivingIds,
                );

            if (
              receivingError
            ) {
              throw receivingError;
            }

            for (
              const receiving
              of (
                receivingData ??
                []
              ) as ReceivingLookup[]
            ) {
              receivingMap.set(
                receiving.id,
                receiving,
              );
            }
          }

          // ==============================================================
          // MAP RESULT
          // ==============================================================

          const result =
            rawRows.map(
              (
                row,
              ):
                StockMutationRow => {
                const item =
                  firstValue(
                    row.item,
                  );

                const store =
                  firstValue(
                    row.store,
                  );

                const unit =
                  item
                    ? firstValue(
                        item.unit,
                      )
                    : null;

                // --------------------------------------------------------
                // RECEIVING DESCRIPTION
                // --------------------------------------------------------

                const receiving =
                  row.source_table ===
                    "receiving_records" &&
                  row.source_id
                    ? receivingMap.get(
                        row.source_id,
                      )
                    : null;

                const displayDescription =
                  receiving
                    ? `[PO ${
                        receiving.purchase_order_number_snapshot ??
                        "-"
                      }][${
                        receiving.supplier_name_snapshot ??
                        "-"
                      }]`
                    : row.description;

                return {
                  id:
                    row.id,

                  movement_date:
                    row.movement_date,

                  movement_type:
                    row.movement_type,

                  quantity_in:
                    numberValue(
                      row.quantity_in,
                    ),

                  quantity_out:
                    numberValue(
                      row.quantity_out,
                    ),

                  unit_cost:
                    numberValue(
                      row.unit_cost,
                    ),

                  movement_value:
                    numberValue(
                      row.movement_value,
                    ),

                  quantity_before:
                    numberValue(
                      row.quantity_before,
                    ),

                  quantity_after:
                    numberValue(
                      row.quantity_after,
                    ),

                  average_cost_before:
                    numberValue(
                      row.average_cost_before,
                    ),

                  average_cost_after:
                    numberValue(
                      row.average_cost_after,
                    ),

                  reference:
                    row.reference,

                  description:
                    displayDescription,

                  created_at:
                    row.created_at,

                  created_by:
                    row.created_by,

                  item_id:
                    row.item_id,

                  store_id:
                    row.store_id,

                  item:
                    item
                      ? {
                          code:
                            item.code,

                          name:
                            item.name,

                          unit:
                            unit
                              ? {
                                  code:
                                    unit.code,
                                }
                              : null,
                        }
                      : null,

                  store:
                    store
                      ? {
                          code:
                            store.code,

                          name:
                            store.name,
                        }
                      : null,
                };
              },
            );

          setMovements(
            result,
          );

          setTotalCount(
            count ?? 0,
          );
        } catch (
          err
        ) {
          setError(
            err instanceof Error
              ? err.message
              : "Gagal memuat mutasi stok.",
          );

          setMovements(
            [],
          );

          setTotalCount(
            0,
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        hasSearched,
        itemId,
        storeId,
        dateFrom,
        dateTo,
        keyword,
      ],
    );

  // ==========================================================================
  // INITIAL LOAD
  //
  // HANYA MASTER
  // ==========================================================================

  useEffect(
    () => {
      void loadMaster();
    },
    [
      loadMaster,
    ],
  );

  // ==========================================================================
  // SUMMARY
  //
  // Total hanya halaman aktif.
  //
  // Karena data sekarang server-side,
  // jangan menganggap ini total seluruh database.
  // ==========================================================================

  const totalIn =
    useMemo(
      () =>
        movements.reduce(
          (
            total,
            row,
          ) =>
            total +
            numberValue(
              row.quantity_in,
            ),
          0,
        ),
      [
        movements,
      ],
    );

  const totalOut =
    useMemo(
      () =>
        movements.reduce(
          (
            total,
            row,
          ) =>
            total +
            numberValue(
              row.quantity_out,
            ),
          0,
        ),
      [
        movements,
      ],
    );

  // ==========================================================================
  // ACTION
  // ==========================================================================

  const searchMovements =
    useCallback(
      async (
        page: number,
        pageSize: number,
      ) => {
        setHasSearched(
          true,
        );

        /*
         * Penting:
         *
         * Karena setState async,
         * panggil query secara langsung
         * dengan flag pencarian terpisah
         * pada fungsi di bawah.
         */

        setLoading(
          true,
        );

        setError(
          null,
        );

        try {
          const from =
            (
              page -
              1
            ) *
            pageSize;

          const to =
            from +
            pageSize -
            1;

          let query =
            supabase
              .from(
                "inventory_movements",
              )
              .select(
                `
                id,
                movement_date,
                movement_type,

                quantity_in,
                quantity_out,

                unit_cost,
                movement_value,

                quantity_before,
                quantity_after,

                average_cost_before,
                average_cost_after,

                source_table,
                source_id,

                reference,
                description,

                created_at,
                created_by,

                item_id,
                store_id,

                item:items(
                  code,
                  name,

                  unit:units(
                    code
                  )
                ),

                store:stores(
                  code,
                  name
                )
                `,
                {
                  count:
                    "exact",
                },
              )
              .order(
                "movement_date",
                {
                  ascending:
                    false,
                },
              )
              .order(
                "created_at",
                {
                  ascending:
                    false,
                },
              );

          if (
            itemId
          ) {
            query =
              query.eq(
                "item_id",
                itemId,
              );
          }

          if (
            storeId
          ) {
            query =
              query.eq(
                "store_id",
                storeId,
              );
          }

          if (
            dateFrom
          ) {
            query =
              query.gte(
                "movement_date",
                dateFrom,
              );
          }

          if (
            dateTo
          ) {
            query =
              query.lte(
                "movement_date",
                dateTo,
              );
          }

          const search =
            keyword
              .trim();

          if (
            search
          ) {
            query =
              query.or(
                [
                  `reference.ilike.%${search}%`,
                  `description.ilike.%${search}%`,
                  `movement_type.ilike.%${search}%`,
                ].join(
                  ",",
                ),
              );
          }

          const {
            data,
            error:
              queryError,
            count,
          } =
            await query.range(
              from,
              to,
            );

          if (
            queryError
          ) {
            throw queryError;
          }

          const rawRows =
            (
              data ??
              []
            ) as unknown as RawMovementRow[];

          const receivingIds =
            Array.from(
              new Set(
                rawRows
                  .filter(
                    (
                      row,
                    ) =>
                      row.source_table ===
                        "receiving_records" &&
                      Boolean(
                        row.source_id,
                      ),
                  )
                  .map(
                    (
                      row,
                    ) =>
                      row.source_id as string,
                  ),
              ),
            );

          const receivingMap =
            new Map<
              string,
              ReceivingLookup
            >();

          if (
            receivingIds.length >
            0
          ) {
            const {
              data:
                receivingData,
              error:
                receivingError,
            } =
              await supabase
                .from(
                  "receiving_records",
                )
                .select(
                  `
                  id,
                  purchase_order_number_snapshot,
                  supplier_name_snapshot
                  `,
                )
                .in(
                  "id",
                  receivingIds,
                );

            if (
              receivingError
            ) {
              throw receivingError;
            }

            for (
              const receiving
              of (
                receivingData ??
                []
              ) as ReceivingLookup[]
            ) {
              receivingMap.set(
                receiving.id,
                receiving,
              );
            }
          }

          const result =
            rawRows.map(
              (
                row,
              ):
                StockMutationRow => {
                const item =
                  firstValue(
                    row.item,
                  );

                const store =
                  firstValue(
                    row.store,
                  );

                const unit =
                  item
                    ? firstValue(
                        item.unit,
                      )
                    : null;

                const receiving =
                  row.source_table ===
                    "receiving_records" &&
                  row.source_id
                    ? receivingMap.get(
                        row.source_id,
                      )
                    : null;

                return {
                  id:
                    row.id,

                  movement_date:
                    row.movement_date,

                  movement_type:
                    row.movement_type,

                  quantity_in:
                    numberValue(
                      row.quantity_in,
                    ),

                  quantity_out:
                    numberValue(
                      row.quantity_out,
                    ),

                  unit_cost:
                    numberValue(
                      row.unit_cost,
                    ),

                  movement_value:
                    numberValue(
                      row.movement_value,
                    ),

                  quantity_before:
                    numberValue(
                      row.quantity_before,
                    ),

                  quantity_after:
                    numberValue(
                      row.quantity_after,
                    ),

                  average_cost_before:
                    numberValue(
                      row.average_cost_before,
                    ),

                  average_cost_after:
                    numberValue(
                      row.average_cost_after,
                    ),

                  reference:
                    row.reference,

                  description:
                    receiving
                      ? `[PO ${
                          receiving.purchase_order_number_snapshot ??
                          "-"
                        }][${
                          receiving.supplier_name_snapshot ??
                          "-"
                        }]`
                      : row.description,

                  created_at:
                    row.created_at,

                  created_by:
                    row.created_by,

                  item_id:
                    row.item_id,

                  store_id:
                    row.store_id,

                  item:
                    item
                      ? {
                          code:
                            item.code,

                          name:
                            item.name,

                          unit:
                            unit
                              ? {
                                  code:
                                    unit.code,
                                }
                              : null,
                        }
                      : null,

                  store:
                    store
                      ? {
                          code:
                            store.code,

                          name:
                            store.name,
                        }
                      : null,
                };
              },
            );

          setMovements(
            result,
          );

          setTotalCount(
            count ?? 0,
          );
        } catch (
          err
        ) {
          setError(
            err instanceof Error
              ? err.message
              : "Gagal memuat mutasi stok.",
          );

          setMovements(
            [],
          );

          setTotalCount(
            0,
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        itemId,
        storeId,
        dateFrom,
        dateTo,
        keyword,
      ],
    );

  // ==========================================================================
  // RESET RESULT
  // ==========================================================================

  const clearResult =
    useCallback(
      () => {
        setHasSearched(
          false,
        );

        setMovements(
          [],
        );

        setTotalCount(
          0,
        );

        setError(
          null,
        );
      },
      [],
    );

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // MASTER

    stores,

    items,

    // DATA

    movements,

    totalCount,

    hasSearched,

    // FILTER

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

    // SUMMARY

    totalIn,
    totalOut,

    // STATE

    loading,

    loadingMaster,

    error,

    // ACTION

    searchMovements,

    loadMovements,

    clearResult,
  };
}