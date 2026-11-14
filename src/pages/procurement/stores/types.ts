export type StoreType = "WAREHOUSE" | "STORE" | "BAR" | "KITCHEN" | "OUTLET";

export type Store = {
  id: string;
  entity_id: string | null;
  code: string;
  name: string;
  store_type: StoreType;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StoreFormData = {
  entity_id?: string | null;
  code: string;
  name: string;
  store_type: StoreType;
  address: string;
  is_active: boolean;
};
