export type PurchaseOrderStatus =
  | "DRAFT"
  | "APPROVED"
  | "OPEN"
  | "PARTIAL_RECEIVED"
  | "CLOSED"
  | "CANCELLED";

export type SupplierOption = {
  id: string;
  code: string;
  name: string;
  default_payment_term_days: number;
  is_active: boolean;
};

export type ItemOption = {
  id: string;
  code: string;
  name: string;
  item_type: "STOCK" | "NON_STOCK" | "SERVICE";
  standard_cost: number;
  is_active: boolean;

  category?: {
    code: string;
    name: string;
  } | null;

  subcategory?: {
    code: string;
    name: string;
  } | null;

  unit?: {
    code: string;
    name: string;
  } | null;
};

export type PurchaseOrder = {
  id: string;

  entity_id: string | null;

  po_number: string;

  order_date: string;

  expected_delivery_date: string | null;

  /*
   * DRAFT dapat belum memiliki supplier.
   * Supplier wajib dilengkapi sebelum PO dibuka.
   */
  supplier_id: string | null;
  supplier_code_snapshot: string | null;
  supplier_name_snapshot: string | null;
  store_id: string | null;
  store_name: string | null;
  payment_term_days: number;
  currency_code: string;
  status: PurchaseOrderStatus;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  grand_total: number;
  notes: string | null;
  created_at: string;
};

export type PurchaseOrderLineForm = {
  item_id: string;
  item_code_snapshot?: string;
  item_name_snapshot?: string;
  unit_code_snapshot?: string;
  quantity_ordered: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  notes: string;
};

export type PurchaseOrderFormData = {
  entity_id?: string | null;
  order_date: string;
  expected_delivery_date: string;

  /*
   * User pembuat Draft boleh belum memilih supplier.
   */
  supplier_id: string;
  store_id: string;
  payment_term_days: number;
  notes: string;
  details: PurchaseOrderLineForm[];
};