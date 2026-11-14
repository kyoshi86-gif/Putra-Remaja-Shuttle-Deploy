// ============================================================================
// STOREKEEPER TYPES
// ============================================================================

export type TransactionKind = "TRANSFER" | "OPNAME" | "ADJUSTMENT";

export interface StoreOption {
  id: string;
  code: string;
  name: string;
}

export interface AccountOption {
  id: string;
  code: string;
  name: string;
}

export interface ItemOption {
  id: string;
  code: string;
  name: string;
}

export interface StockRow {
  id: string;
  entity_id: string;
  store_id: string;
  store_code: string;
  store_name: string;
  store_type: string;
  item_id: string;
  item_code: string;
  item_name: string;
  item_type: string;
  category_code: string | null;
  category_name: string | null;
  subcategory_code: string | null;
  subcategory_name: string | null;
  unit_code: string;
  quantity_on_hand: number;
  average_cost: number;
  stock_value: number;
  last_movement_at: string | null;
}

export interface MovementItem {
  code: string;
  name: string;
  unit_code: string | null;
}

export interface MovementStore {
  code: string;
  name: string;
}

export interface MovementRow {
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
  item: MovementItem | null;
  store: MovementStore | null;
}

export interface StorekeeperAccess {
  view: boolean;
  print: boolean;
  export: boolean;
}

export interface TransactionForm {
  kind: TransactionKind | null;
  stockId: string;
  targetStoreId: string;
  transactionDate: string;
  quantity: string;
  offsetAccountId: string;
  reference: string;
  notes: string;
}

export interface StorekeeperFilter {
  storeId: string;
  itemId: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}

export interface StorekeeperState {
  stocks: StockRow[];
  movements: MovementRow[];
  stores: StoreOption[];
  items: ItemOption[];
  accounts: AccountOption[];
  loading: boolean;
  posting: boolean;
  error: string | null;
}

export const MOVEMENT_LABELS: Record<string, string> = {
  OPENING_BALANCE: "Saldo Awal",
  RECEIPT: "Receiving",
  ISSUE: "Pemakaian",
  TRANSFER_IN: "Transfer Masuk",
  TRANSFER_OUT: "Transfer Keluar",
  ADJUSTMENT_IN: "Penyesuaian Masuk",
  ADJUSTMENT_OUT: "Penyesuaian Keluar",
  STOCK_OPNAME: "Stock Opname",
};

export interface StockOpnameLine {
  id: string;
  stockId: string;
  qty: string;
  accountId: string;
}
