export type AccountCategory =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "COGS"
  | "EXPENSE"
  | "OTHER_INCOME"
  | "OTHER_EXPENSE";

export type AccountType =
  | "CASH"
  | "BANK"
  | "ACCOUNT_RECEIVABLE"
  | "ACCOUNT_PAYABLE"
  | "INVENTORY"
  | "FIXED_ASSET"
  | "ACCUMULATED_DEPRECIATION"
  | "REVENUE"
  | "EXPENSE"
  | "COGS"
  | "EQUITY"
  | "LIABILITY"
  | "OTHER";

export interface CoaNode {
  id: string;

  code: string;

  name: string;

  parent_account_id: string | null;

  account_level: number;

  category_code: AccountCategory | null;

  account_type: AccountType | null;

  normal_balance: "D" | "C" | null;

  is_posting: boolean;

  is_summary: boolean;

  is_active: boolean;

  entity_id: string | null;

  created_at: string;

  updated_at: string | null;
}

export interface CoaFormData {
  id?: string;

  code: string;

  name: string;

  parent_account_id: string | null;

  category_code: AccountCategory;

  account_type: AccountType;

  normal_balance: "D" | "C";

  is_posting: boolean;

  is_summary: boolean;

  is_active: boolean;

  entity_id: string | null;
}
