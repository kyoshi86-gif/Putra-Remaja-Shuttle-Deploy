import { supabase } from "@/lib/supabaseClient";

type CreateInventoryRequestPayload = {
  p_request_date: string;
  p_required_date: string | null;
  p_source_store_id: string;
  p_destination_store_id: string;
  p_entity_id: string;
  p_requested_by: string;
  p_remarks: string | null;
};

type AddInventoryRequestItemPayload = {
  p_request_id: string;
  p_item_id: string;
  p_qty_request: number;
  p_remarks: string;
};

export const inventoryRequestService = {
  getList(entityId?: string | null) {
    let query = supabase
      .from("inventory_requests")
      .select("*")
      .order("request_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (entityId) {
      query = query.eq("entity_id", entityId);
    }

    return query;
  },

  getDetail(requestId: string) {
    return supabase
      .from("inventory_request_items")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at");
  },

  create(payload: CreateInventoryRequestPayload) {
    return supabase.rpc("create_inventory_request", payload);
  },

  addItem(payload: AddInventoryRequestItemPayload) {
    return supabase.rpc("add_inventory_request_item", payload);
  },

  submit(requestId: string, userId: string) {
    return supabase.rpc("submit_inventory_request", {
      p_request_id: requestId,
      p_user_id: userId,
    });
  },

  approve(requestId: string, userId: string, note: string) {
    return supabase.rpc("approve_inventory_request", {
      p_request_id: requestId,
      p_user_id: userId,
      p_note: note,
    });
  },

  approveItem(itemId: string, qty: number) {
    return supabase.rpc("update_inventory_request_item_approved", {
      p_item_id: itemId,
      p_qty_approved: qty,
    });
  },

  transferItem(itemId: string, qty: number) {
    return supabase.rpc("update_inventory_request_item_transfer", {
      p_item_id: itemId,
      p_qty_transfer: qty,
    });
  },
};
