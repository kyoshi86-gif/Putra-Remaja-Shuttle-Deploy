import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import type {
  InventoryRequest,
  InventoryRequestFormData,
  InventoryRequestLineForm,
  ItemOption,
  StoreOption,
} from "../types";

type InventoryRequestItemRow = {
  id: string;
  item_id: string;
  unit_id: string;

  qty_request: number;
  qty_approved: number;
  qty_transfer: number;

  remarks: string | null;

  item: {
    code: string;
    name: string;
  } | null;

  unit: {
    code: string;
  } | null;
};

type StoreItemQueryRow = {
  quantity_on_hand: number;

  item: {
    id: string;
    code: string;
    name: string;
    item_type: "STOCK" | "NON_STOCK" | "SERVICE";
    standard_cost: number;
    is_active: boolean;

    category: {
      code: string;
      name: string;
    } | null;

    subcategory: {
      code: string;
      name: string;
    } | null;

    unit: {
      id?: string;
      code: string;
      name: string;
    } | null;
  } | null;
};

type InventoryRequestRow = {
  id: string;
  entity_id: string | null;

  request_no: string;
  request_date: string;
  required_date: string | null;

  remarks: string | null;
  status: InventoryRequest["status"];

  created_by: string;
  created_at: string;
  updated_at: string;

  source_store_id: string;
  destination_store_id: string;

  source_store: {
    id: string;
    code: string;
    name: string;
  } | null;

  destination_store: {
    id: string;
    code: string;
    name: string;
  } | null;
};

type InventoryRequestResult = {
  success: boolean;
  request_id?: string;
  request_no: string;
  status: string;
};

type FetchRequestsParams = {
  page: number;
  pageSize: number;
  search?: string;
  startDate?: string;
  endDate?: string;
};

export function useInventoryRequests(entityId?: string | null) {
  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [stores, setStores] = useState<StoreOption[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [storeItems, setStoreItems] = useState<ItemOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingMasters, setLoadingMasters] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * SERVER-SIDE PAGINATION
   *
   * Hanya data pada halaman aktif yang diambil dari Supabase.
   * Search + tanggal juga diproses di Supabase.
   */
  const fetchRequests = useCallback(
    async ({
      page,
      pageSize,
      search = "",
      startDate = "",
      endDate = "",
    }: FetchRequestsParams) => {
      setLoading(true);
      setError(null);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("inventory_requests")
        .select(
          `
                    *,
                    source_store:stores!fk_inventory_requests_source_store(
                        id,
                        code,
                        name
                    ),
                    destination_store:stores!fk_inventory_requests_destination_store(
                        id,
                        code,
                        name
                    )
                    `,
          {
            count: "exact",
          },
        )
        .order("request_date", {
          ascending: false,
        })
        .order("created_at", {
          ascending: false,
        })
        .range(from, to);

      if (entityId) {
        query = query.eq("entity_id", entityId);
      }

      if (startDate) {
        query = query.gte("request_date", startDate);
      }

      if (endDate) {
        query = query.lte("request_date", endDate);
      }

      const key = search.trim();

      if (key) {
        query = query.or(
          [`request_no.ilike.%${key}%`, `remarks.ilike.%${key}%`].join(","),
        );
      }

      const { data, error, count } = await query;

      if (error) {
        setError(error.message);
        setRequests([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      const normalized = ((data ?? []) as InventoryRequestRow[]).map((row) => ({
        id: row.id,
        entity_id: row.entity_id,

        request_no: row.request_no,
        request_date: row.request_date,
        required_date: row.required_date,

        remarks: row.remarks,
        status: row.status,

        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,

        source_store_id: row.source_store_id,

        destination_store_id: row.destination_store_id,

        source_store_code: row.source_store?.code ?? "",

        source_store_name: row.source_store?.name ?? "",

        destination_store_code: row.destination_store?.code ?? "",

        destination_store_name: row.destination_store?.name ?? "",
      }));

      setRequests(normalized);
      setTotalCount(count ?? 0);
      setLoading(false);
    },
    [entityId],
  );

  /**
   * Ambil seluruh data sesuai filter.
   *
   * HANYA digunakan untuk EXPORT.
   * Tidak digunakan untuk tampilan tabel.
   *
   * Data diambil bertahap 1.000 baris agar tidak
   * mengambil seluruh dataset sekaligus.
   */
  const fetchAllRequestsForExport = useCallback(
    async ({
      search = "",
      startDate = "",
      endDate = "",
    }: Omit<FetchRequestsParams, "page" | "pageSize"> = {}) => {
      const batchSize = 1000;
      let offset = 0;

      const allRows: InventoryRequestRow[] = [];

      while (true) {
        let query = supabase
          .from("inventory_requests")
          .select(
            `
                        *,
                        source_store:stores!fk_inventory_requests_source_store(
                            id,
                            code,
                            name
                        ),
                        destination_store:stores!fk_inventory_requests_destination_store(
                            id,
                            code,
                            name
                        )
                        `,
          )
          .order("request_date", {
            ascending: false,
          })
          .order("created_at", {
            ascending: false,
          })
          .range(offset, offset + batchSize - 1);

        if (entityId) {
          query = query.eq("entity_id", entityId);
        }

        if (startDate) {
          query = query.gte("request_date", startDate);
        }

        if (endDate) {
          query = query.lte("request_date", endDate);
        }

        const key = search.trim();

        if (key) {
          query = query.or(
            [`request_no.ilike.%${key}%`, `remarks.ilike.%${key}%`].join(","),
          );
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        const rows = (data ?? []) as InventoryRequestRow[];

        allRows.push(...rows);

        if (rows.length < batchSize) {
          break;
        }

        offset += batchSize;
      }

      return allRows.map((row) => ({
        id: row.id,
        entity_id: row.entity_id,

        request_no: row.request_no,
        request_date: row.request_date,
        required_date: row.required_date,

        remarks: row.remarks,
        status: row.status,

        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,

        source_store_id: row.source_store_id,

        destination_store_id: row.destination_store_id,

        source_store_code: row.source_store?.code ?? "",

        source_store_name: row.source_store?.name ?? "",

        destination_store_code: row.destination_store?.code ?? "",

        destination_store_name: row.destination_store?.name ?? "",
      }));
    },
    [entityId],
  );

  const fetchMasters = useCallback(async () => {
    setLoadingMasters(true);
    setError(null);

    let storeQuery = supabase
      .from("stores")
      .select("id,code,name,entity_id")
      .order("code");

    let itemQuery = supabase
      .from("items")
      .select(
        `
                id,
                code,
                name,
                item_type,
                category:item_categories(code,name),
                subcategory:item_subcategories(code,name),
                unit:units(id,code,name)
                `,
      )
      .eq("is_active", true)
      .order("code");

    if (entityId) {
      itemQuery = itemQuery.eq("entity_id", entityId);
    }

    const [storeResult, itemResult] = await Promise.all([
      storeQuery,
      itemQuery,
    ]);

    if (storeResult.error) {
      setError(storeResult.error.message);
      setStores([]);
    } else {
      setStores((storeResult.data ?? []) as StoreOption[]);
    }

    if (itemResult.error) {
      setError(itemResult.error.message);
      setItems([]);
    } else {
      const normalize = (itemResult.data ?? []).map((item) => ({
        ...item,

        category: Array.isArray(item.category)
          ? (item.category[0] ?? null)
          : item.category,

        subcategory: Array.isArray(item.subcategory)
          ? (item.subcategory[0] ?? null)
          : item.subcategory,

        unit: Array.isArray(item.unit) ? (item.unit[0] ?? null) : item.unit,
      }));

      setItems(normalize as ItemOption[]);
    }

    setLoadingMasters(false);
  }, [entityId]);

  const fetchStoreItems = useCallback(async (storeId: string) => {
    const { data, error } = await supabase
      .from("item_store_stocks")
      .select(
        `
                    quantity_on_hand,
                    item:items(
                        id,
                        code,
                        name,
                        item_type,
                        standard_cost,
                        is_active,
                        category:item_categories(
                            code,
                            name
                        ),
                        subcategory:item_subcategories(
                            code,
                            name
                        ),
                        unit:units(
                            id,
                            code,
                            name
                        )
                    )
                    `,
      )
      .eq("store_id", storeId);

    if (error) {
      setError(error.message);
      return;
    }

    const result: ItemOption[] = [];

    for (const row of (data ?? []) as unknown as StoreItemQueryRow[]) {
      const item = row.item;

      if (!item) continue;

      result.push({
        id: item.id,
        code: item.code,
        name: item.name,
        item_type: item.item_type,
        category: item.category,
        subcategory: item.subcategory,
        unit: item.unit,
        quantity_on_hand: Number(row.quantity_on_hand),
      } as ItemOption);
    }

    setStoreItems(result);
  }, []);

  useEffect(() => {
    fetchMasters();
  }, [fetchMasters]);

  const fetchDetails = async (
    requestId: string,
  ): Promise<InventoryRequestLineForm[] | null> => {
    const { data, error } = await supabase
      .from("inventory_request_items")
      .select(
        `
                *,
                item:items(
                    code,
                    name
                ),
                unit:units(
                    code
                )
                `,
      )
      .eq("request_id", requestId)
      .order("created_at");

    if (error) {
      setError(error.message);
      return null;
    }

    return ((data ?? []) as InventoryRequestItemRow[]).map((row) => ({
      id: row.id,

      item_id: row.item_id,
      item_code: row.item?.code ?? "",
      item_name: row.item?.name ?? "",

      unit_id: row.unit_id,
      unit_code: row.unit?.code ?? "",

      qty_request: Number(row.qty_request),

      qty_approved: Number(row.qty_approved),

      qty_transfer: Number(row.qty_transfer),

      remarks: row.remarks ?? "",
    }));
  };

  const create = async (payload: InventoryRequestFormData) => {
    setSaving(true);

    const currentUser = JSON.parse(localStorage.getItem("custom_user") || "{}");

    const userId = currentUser.id;

    const { data, error } = await supabase.rpc("create_inventory_request", {
      p_request_date: payload.request_date,

      p_required_date: payload.required_date || null,

      p_source_store_id: payload.source_store_id,

      p_destination_store_id: payload.destination_store_id,

      p_entity_id: payload.entity_id,

      p_requested_by: userId,

      p_remarks: payload.remarks || null,
    });

    if (error) {
      setSaving(false);
      setError(error.message);
      alert(error.message);
      return null;
    }

    if (!data?.success) {
      setSaving(false);

      setError(data?.message ?? "Gagal membuat Inventory Request");

      alert(data?.message ?? "Gagal membuat Inventory Request");

      return null;
    }

    setSaving(false);

    return data as InventoryRequestResult;
  };

  const addItem = async (requestId: string, line: InventoryRequestLineForm) => {
    const { data, error } = await supabase.rpc("add_inventory_request_item", {
      p_request_id: requestId,

      p_item_id: line.item_id,

      p_qty_request: line.qty_request,

      p_remarks: line.remarks ?? "",
    });

    return {
      data,
      error,
    };
  };

  const deleteRequest = async (requestId: string) => {
    const { error } = await supabase
      .from("inventory_requests")
      .delete()
      .eq("id", requestId);

    if (error) {
      return {
        success: false,
        error,
      };
    }

    return {
      success: true,
      error: null,
    };
  };

  const approve = async (
    requestId: string,
    userId: string,
    note: string,
    details: {
      id: string;
      qty_approved: number;
    }[],
  ) => {
    return supabase.rpc("approve_inventory_request", {
      p_request_id: requestId,

      p_user_id: userId,

      p_note: note,

      p_details: details,
    });
  };

  const completeRequest = async (
    requestId: string,
    userId: string,
    details: {
      id: string;
      qty_transfer: number;
    }[],
  ) => {
    const { data, error } = await supabase.rpc("complete_inventory_request", {
      p_request_id: requestId,

      p_user_id: userId,

      p_details: details,
    });

    console.log("RPC DATA :", data);

    console.log("RPC ERROR:", error);

    if (error) {
      throw error;
    }

    return data;
  };

  const update = async (
    requestId: string,
    payload: Partial<InventoryRequestFormData>,
  ) => {
    setSaving(true);

    const {
      request_date,
      required_date,
      source_store_id,
      destination_store_id,
      entity_id,
      remarks,
    } = payload;

    const { error } = await supabase
      .from("inventory_requests")
      .update({
        request_date,
        required_date,
        source_store_id,
        destination_store_id,
        entity_id,
        remarks,
      })
      .eq("id", requestId);

    setSaving(false);

    if (error) {
      setError(error.message);
      return null;
    }

    return {
      success: true,
      error: null,
    };
  };

  const updateItem = async (
    itemId: string,
    payload: Partial<InventoryRequestLineForm>,
  ) => {
    setSaving(true);

    const {
      item_id,
      unit_id,
      qty_request,
      qty_approved,
      qty_transfer,
      remarks,
    } = payload;

    const { error } = await supabase
      .from("inventory_request_items")
      .update({
        item_id,
        unit_id,
        qty_request,
        qty_approved,
        qty_transfer,
        remarks,
      })
      .eq("id", itemId);

    setSaving(false);

    if (error) {
      setError(error.message);
      console.error(error);

      return null;
    }

    return {
      success: true,
      error: null,
    };
  };

  const deleteItem = async (itemId: string) => {
    setSaving(true);

    const { error } = await supabase
      .from("inventory_request_items")
      .delete()
      .eq("id", itemId);

    setSaving(false);

    if (error) {
      setError(error.message);
      return null;
    }

    return {
      success: true,
      error: null,
    };
  };

  return {
    requests,
    totalCount,

    stores,
    items,

    loading,
    loadingMasters,
    saving,
    error,

    fetchRequests,
    fetchAllRequestsForExport,

    fetchDetails,

    create,
    addItem,

    approve,
    completeRequest,

    update,
    updateItem,

    deleteRequest,
    deleteItem,

    storeItems,
    fetchStoreItems,
  };
}
