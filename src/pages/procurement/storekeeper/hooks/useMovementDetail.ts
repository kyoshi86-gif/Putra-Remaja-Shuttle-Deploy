import {
  useCallback,
  useState,
} from "react";

import {
  supabase,
} from "@/lib/supabaseClient";

type AccountRelation = {
  code: string | null;
  name: string | null;
};

type UnitRelation = {
  code: string | null;
};

type ItemRelation = {
  code: string | null;
  name: string | null;

  unit:
    | UnitRelation
    | UnitRelation[]
    | null;
};

type StoreRelation = {
  code: string | null;
  name: string | null;
};

type MovementDetailRawRow = {
  id: string;

  movement_date: string;

  movement_type: string;

  quantity_in: number | null;

  quantity_out: number | null;

  quantity_after: number | null;

  average_cost_after: number | null;

  reference: string;

  description: string | null;

  created_at: string;

  created_by: string | null;

  offset_account_id: string | null;

  offset_account:
    | AccountRelation
    | AccountRelation[]
    | null;

  item:
    | ItemRelation
    | ItemRelation[]
    | null;

  store:
    | StoreRelation
    | StoreRelation[]
    | null;
};

type MovementDetailRow =
  Omit<
    MovementDetailRawRow,
    "item" | "store" | "offset_account"
  > & {
    item: {
      code: string | null;

      name: string | null;

      unit: UnitRelation | null;
    } | null;

    store: StoreRelation | null;

    offset_account:
      AccountRelation | null;
  };

export function useMovementDetail() {
  const [loading, setLoading] =
    useState(false);

  const [rows, setRows] =
    useState<MovementDetailRow[]>([]);

  const loadDetail =
    useCallback(
      async (
        reference: string,
      ) => {
        if (!reference) {
          setRows([]);
          return;
        }

        setLoading(true);

        try {
          const {
            data,
            error,
          } = await supabase
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
                quantity_after,
                average_cost_after,
                reference,
                description,
                created_at,
                created_by,
                offset_account_id,

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
                ),

                offset_account:accounts!inventory_movements_offset_account_id_fkey(
                  code,
                  name
                )
              `,
            )
            .eq(
              "reference",
              reference,
            )
            .order(
              "created_at",
              {
                ascending: true,
              },
            );

          if (error) {
            throw error;
          }

          const movementRows =
            (
              data ??
              []
            ).map(
              (
                row: MovementDetailRawRow,
              ): MovementDetailRow => {
                const rawItem =
                  Array.isArray(
                    row.item,
                  )
                    ? row.item[0] ??
                      null
                    : row.item;

                const rawStore =
                  Array.isArray(
                    row.store,
                  )
                    ? row.store[0] ??
                      null
                    : row.store;

                const rawAccount =
                  Array.isArray(
                    row.offset_account,
                  )
                    ? row.offset_account[0] ??
                      null
                    : row.offset_account;

                return {
                  ...row,

                  item:
                    rawItem
                      ? {
                          code:
                            rawItem.code,

                          name:
                            rawItem.name,

                          unit:
                            Array.isArray(
                              rawItem.unit,
                            )
                              ? rawItem.unit[0] ??
                                null
                              : rawItem.unit,
                        }
                      : null,

                  store:
                    rawStore,

                  offset_account:
                    rawAccount,
                };
              },
            );

          setRows(
            movementRows,
          );
        } catch (error) {
          console.error(
            "Load movement detail error:",
            error,
          );

          setRows([]);
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  return {
    loading,

    rows,

    loadDetail,
  };
}