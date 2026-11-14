export interface AdjustmentFilter {
  dateFrom: string;
  dateTo: string;
  storeId: string;
  keyword: string;
}

export interface AdjustmentItem {
  code: string;
  name: string;
  unit_code: string | null;

  qtyBefore: number;
  qtyAdjustment: number;
  qtyAfter: number;

  averageCost: number;
  value: number;
}

export interface AdjustmentDocument {
  reference: string;
  movement_date: string;
  created_at: string;
  created_by: string | null;

  store: {
    id: string;
    code: string;
    name: string;
  } | null;

  items: AdjustmentItem[];

  totalQty: number;
  totalValue: number;
}
