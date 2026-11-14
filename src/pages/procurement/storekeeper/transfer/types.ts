export interface TransferItem {
  code: string;
  name: string;
  unit_code: string | null;
  qty: number;
  value: number;
}

export interface TransferDocument {
  reference: string;
  movement_date: string;
  created_at: string;
  created_by: string | null;
  fromStore: {
    id: string;
    code: string;
    name: string;
  } | null;

  toStore: {
    id: string;
    code: string;
    name: string;
  } | null;
  items: TransferItem[];
  totalQty: number;
  totalValue: number;
}

export interface TransferFilter {
  dateFrom: string;
  dateTo: string;
  fromStoreId: string;
  toStoreId: string;
  keyword: string;
}
