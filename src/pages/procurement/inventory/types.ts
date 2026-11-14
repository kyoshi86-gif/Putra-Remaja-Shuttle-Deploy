export type InventoryRequestStatus =
  | "DRAFT"
  | "APPROVED"
  | "IN_PREPARATION"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export interface StoreOption {
  id: string;
  code: string;
  name: string;
  entity_id: string;
}

export type UnitOption = {
  id: string;
  code: string;
  name: string;
};

export type ItemOption = {
  id: string;
  code: string;
  name: string;
  item_type: "STOCK" | "NON_STOCK" | "SERVICE";

  unit?: UnitOption | null;

  category?: {
    code: string;
    name: string;
  } | null;

  subcategory?: {
    code: string;
    name: string;
  } | null;
};

export type InventoryRequest = {
  id: string;
  entity_id: string | null;
  request_no: string;
  request_date: string;
  required_date: string | null;
  source_store_id: string;
  destination_store_id: string;
  source_store_code: string;
  source_store_name: string;
  destination_store_code: string;
  destination_store_name: string;
  remarks: string | null;
  status: InventoryRequestStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export interface InventoryRequestLineForm {
  id?: string;
  request_id?: string;
  item_id: string;
  unit_id: string;
  qty_request: number;
  qty_approved: number;
  qty_transfer: number;
  remarks: string;
  item_code?: string;
  item_name?: string;
  unit_code?: string;
}

export type InventoryRequestFormData = {
  entity_id?: string | null;
  request_date: string;
  required_date?: string;
  source_store_id: string;
  destination_store_id: string;
  remarks: string;
  details: InventoryRequestLineForm[];
};
