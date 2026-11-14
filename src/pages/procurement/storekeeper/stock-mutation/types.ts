// ============================================================================
// STOCK MUTATION TYPES
// ============================================================================

export interface StockMutationStore {
  id: string;
  code: string;
  name: string;
}

export interface StockMutationItem {
  id: string;
  code: string;
  name: string;
}

export interface StockMutationRow {
  id: string;

  movement_date: string;

  movement_type: string;

  quantity_in: number;
  quantity_out: number;

  unit_cost: number;
  movement_value: number;

  quantity_before: number;
  quantity_after: number;

  average_cost_before: number;
  average_cost_after: number;

  reference: string | null;
  description: string | null;

  created_at: string;
  created_by: string | null;

  item_id: string;
  store_id: string;

  item: {
    code: string | null;
    name: string | null;

    unit: {
      code: string | null;
    } | null;
  } | null;

  store: {
    code: string | null;
    name: string | null;
  } | null;
}

export interface StockMutationFilter {
  itemId: string;
  storeId: string;

  dateFrom: string;
  dateTo: string;

  keyword: string;
}

export const STOCK_MUTATION_LABELS: Record<string, string> = {
  OPENING_BALANCE: "Saldo Awal",

  RECEIPT: "Receiving",

  ISSUE: "Pemakaian",

  TRANSFER_IN: "Transfer Masuk",

  TRANSFER_OUT: "Transfer Keluar",

  ADJUSTMENT_IN: "Adjustment Masuk",

  ADJUSTMENT_OUT: "Adjustment Keluar",

  STOCK_OPNAME: "Stock Opname",
};