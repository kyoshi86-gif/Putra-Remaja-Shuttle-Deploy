export type SettlementType = "CREDIT_TERM" | "DEPOSIT" | "CASH_BANK" | "OTHER";

export type AccountOption = {
  id: string;
  code: string;
  name: string;
  category_code: string;
  account_type: string;
  is_active: boolean;
  is_posting: boolean;
};

export type PurchaseSettlementMethod = {
  id: string;
  entity_id: string | null;

  code: string;
  name: string;
  settlement_type: SettlementType;

  account_id: string | null;
  requires_amount: boolean;
  is_system: boolean;
  is_active: boolean;

  created_at: string;
  updated_at: string;

  account?: AccountOption | null;
};

export type PurchaseSettlementMethodFormData = {
  entity_id?: string | null;

  code: string;
  name: string;
  settlement_type: SettlementType;

  account_id: string;
  requires_amount: boolean;
  is_active: boolean;
};
