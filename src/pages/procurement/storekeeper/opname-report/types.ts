export interface OpnameFilter {
  dateFrom: string;
  dateTo: string;
  storeId: string;
  keyword: string;
}

export interface OpnameItem {
  code: string;
  name: string;
  unit_code: string | null;
  qtySystem: number;
  qtyOpname: number;
  difference: number;
  averageCost: number;
  value: number;
}

export interface OpnameDocument {
  reference: string;
  movement_date: string;
  created_at: string;
  created_by: string | null;

  store: {
    id: string;
    code: string;
    name: string;
  } | null;

  items: OpnameItem[];

  totalDifference: number;
  totalValue: number;
}
