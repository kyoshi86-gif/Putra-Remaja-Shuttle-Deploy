import { useCallback, useEffect, useMemo, useState } from "react";
import { hasAccess } from "@/lib/hasAccess";
import { supabase } from "@/lib/supabaseClient";

import type {
  AccountOption,
  MovementRow,
  StockRow,
  StoreOption,
  StorekeeperAccess,
} from "../types";

import { inputDate, currentMonthStart } from "../../utils/date";

type MovementQueryRow = {
  id: string;
  movement_date: string;
  movement_type: string;
  quantity_in: number | null;
  quantity_out: number | null;
  unit_cost: number | null;
  movement_value: number | null;
  quantity_before: number | null;
  quantity_after: number | null;
  average_cost_before: number | null;
  average_cost_after: number | null;
  reference: string | null;
  description: string | null;
  created_at: string;
  created_by: string | null;

  item:
    | {
        code: string | null;
        name: string | null;
        unit:
          | {
              code: string | null;
            }
          | {
              code: string | null;
            }[]
          | null;
      }
    | {
        code: string | null;
        name: string | null;
        unit:
          | {
              code: string | null;
            }
          | {
              code: string | null;
            }[]
          | null;
      }[]
    | null;

  store:
    | {
        code: string | null;
        name: string | null;
      }
    | {
        code: string | null;
        name: string | null;
      }[]
    | null;
};

type GroupedMovementItem = {
  code: string;
  name: string;
  unit_code: string | null;
  qty_in: number | null;
  qty_out: number | null;
  balance: number | null;
  cost: number | null;
};

type GroupedMovement = MovementRow & {
  items: GroupedMovementItem[];
  fromStore: MovementRow["store"];
  toStore: MovementRow["store"];
};

export function useStorekeeper() {
  // ---------------------------------------------------------------------
  // MASTER DATA
  // ---------------------------------------------------------------------

  const [stocks, setStocks] = useState<StockRow[]>([]);
  const currentUser = JSON.parse(localStorage.getItem("custom_user") || "{}",  );
  const entityId =
    typeof currentUser.entity_id === "string"
      ? currentUser.entity_id
      : "";
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  // ---------------------------------------------------------------------
  // FILTER
  // ---------------------------------------------------------------------

  const [storeId, setStoreId] = useState("");
  const [itemId, setItemId] = useState("");
  const [search, setSearch] = useState("");

  const [dateFrom, setDateFrom] = useState(currentMonthStart());

  const [dateTo, setDateTo] = useState(inputDate(new Date()));

  // ---------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [access, setAccess] = useState<StorekeeperAccess>({
    view: false,
    print: false,
    export: false,
  });

  // ---------------------------------------------------------------------
  // LOAD DATA
  // ---------------------------------------------------------------------

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let stockQuery = supabase
        .from("v_inventory_stock_summary")
        .select("*")
        .order("store_code")
        .order("item_code");

      if (storeId) {
        stockQuery = stockQuery.eq("store_id", storeId);
      }

      let movementQuery = supabase
        .from("inventory_movements")
        .select(
          `
          id,
          movement_date,
          movement_type,
          quantity_in,
          quantity_out,
          unit_cost,
          quantity_before,
          quantity_after,
          average_cost_before,
          average_cost_after,
          reference,
          description,
          created_at,
          created_by,
          item:items(
              code,
              name,
              unit:units(
                  code
              )
          ),
          from_store:stores!inventory_movements_from_store_id_fkey(
            code,
            name
          ),
          to_store:stores!inventory_movements_to_store_id_fkey(
            code,
            name
          )
      `,
        )
        .order("movement_date", {
          ascending: false,
        })
        .order("created_at", {
          ascending: false,
        });

      if (storeId) {
        movementQuery = movementQuery.or(`from_store_id.eq.${storeId},to_store_id.eq.${storeId}`);
      }

      if (itemId) {
        movementQuery = movementQuery.eq("item_id", itemId);
      }

      if (dateFrom) {
        movementQuery = movementQuery.gte("movement_date", dateFrom);
      }

      if (dateTo) {
        movementQuery = movementQuery.lte("movement_date", dateTo);
      }

      const [stockResult, movementResult, storeResult, accountResult] =
        await Promise.all([
          stockQuery,

          movementQuery,

          supabase
            .from("stores")
            .select("id,code,name")
            .eq("is_active", true)
            .order("code"),

          supabase
            .from("accounts")
            .select("id,code,name")
            .eq("is_active", true)
            .eq("is_posting", true)
            .order("code"),
        ]);

      if (stockResult.error) {
        setError(stockResult.error.message);
      } else {
        setStocks((stockResult.data ?? []) as StockRow[]);
      }

      if (movementResult.error) {
        setError(movementResult.error.message);
      } else {
        const movementData = (movementResult.data ?? []).map((raw) => {
          const row = raw as MovementQueryRow;

          const item = Array.isArray(row.item)
            ? (row.item[0] ?? null)
            : row.item;

          const store = row.from_store ?? row.to_store;

          const unit = item
            ? Array.isArray(item.unit)
              ? (item.unit[0] ?? null)
              : item.unit
            : null;

          return {
            ...row,
            created_at: row.created_at,
            created_by: row.created_by,

            item: item
              ? {
                  code: item.code,
                  name: item.name,
                  unit_code: unit?.code ?? null,
                }
              : null,

            store: store
              ? {
                  code: store.code,
                  name: store.name,
                }
              : null,
          };
        }) as MovementRow[];

        setMovements(movementData);
      }

      if (storeResult.error) {
        setError(storeResult.error.message);
      } else {
        setStores((storeResult.data ?? []) as StoreOption[]);
      }

      if (accountResult.error) {
        setError(accountResult.error.message);
      } else {
        setAccounts((accountResult.data ?? []) as AccountOption[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }, [storeId, itemId, dateFrom, dateTo]);

  // ---------------------------------------------------------------------
  // LOAD ACCESS
  // ---------------------------------------------------------------------

  const loadAccess = useCallback(async () => {
    const [view, print, exportExcel] = await Promise.all([
      hasAccess("storekeeper.view"),

      hasAccess("storekeeper.print"),

      hasAccess("storekeeper.export"),
    ]);

    setAccess({
      view,
      print,
      export: exportExcel,
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadAccess();
  }, [loadAccess]);

  // ---------------------------------------------------------------------
  // FILTERED STOCK
  // ---------------------------------------------------------------------

  const filteredStocks = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return stocks;
    }

    return stocks.filter((row) =>
      [
        row.item_code,
        row.item_name,
        row.store_code,
        row.store_name,
        row.category_name,
        row.subcategory_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [stocks, search]);

  // ---------------------------------------------------------------------
  // GROUP MOVEMENT
  // ---------------------------------------------------------------------
  const groupedMovements = Object.values(
    movements.reduce(
      (acc, row) => {
        const key = row.reference ?? row.id;

        if (!acc[key]) {
          acc[key] = {
            ...row,
            items: [],
            fromStore: null,
            toStore: null,
          };
        }

        acc[key].items.push({
          code: row.item?.code ?? "",
          name: row.item?.name ?? "",
          unit_code: row.item?.unit_code ?? null,
          qty_in: row.quantity_in,
          qty_out: row.quantity_out,
          balance: row.quantity_after,
          cost: row.average_cost_after,
        });

        if (row.movement_type === "TRANSFER_OUT") {
          acc[key].fromStore = row.from_store;
        }

        if (row.movement_type === "TRANSFER_IN") {
          acc[key].toStore = row.to_store;
        }

        if (
          row.movement_type === "STOCK_OPNAME" ||
          row.movement_type.startsWith("ADJUSTMENT")
        ) {
          acc[key].fromStore = row.from_store;
        }

        return acc;
      },
      {} as Record<string, GroupedMovement>,
    ),
  );

  // ---------------------------------------------------------------------
  // FILTERED MOVEMENT
  // ---------------------------------------------------------------------

  const filteredMovements = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return groupedMovements;
    }

    return groupedMovements.filter((row) => {
      const itemMatch = row.items.some((item: GroupedMovementItem) =>
        [item.code, item.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword)),
      );

      const headerMatch = [
        row.from_store?.code ?? row.to_store?.code,
        row.from_store?.name ?? row.to_store?.name,
        row.reference,
        row.description,
        row.movement_type,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
      return itemMatch || headerMatch;
    });
  }, [groupedMovements, search]);

  // ---------------------------------------------------------------------
  // TOTAL STOCK VALUE
  // ---------------------------------------------------------------------

  const totalValue = useMemo(() => {
    return filteredStocks.reduce(
      (sum, row) => sum + Number(row.stock_value ?? 0),
      0,
    );
  }, [filteredStocks]);

  // ---------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------

  return {
    // raw data
    stocks,
    movements,
    groupedMovements,
    stores,
    accounts,

    // entity aktif
    entityId,

    // filtered
    filteredStocks,
    filteredMovements,

    // state
    loading,
    error,
    access,

    // filter
    storeId,
    setStoreId,

    itemId,
    setItemId,

    search,
    setSearch,

    dateFrom,
    setDateFrom,

    dateTo,
    setDateTo,

    // summary
    totalValue,

    // action
    loadData,
    setError,
  };
}
