export type MappingModuleCode =
  "CASH_DAILY" | "SALES" | "PURCHASE" | "RECEIVING" | "PAYMENT" | "ADJUSTMENT";

export type MappingTransactionCode =
  | "CASH_RECEIPT"
  | "CASH_EXPENSE"
  | "INVOICE"
  | "BILL"
  | "RECEIVE_ITEM"
  | "CUSTOMER_PAYMENT"
  | "SUPPLIER_PAYMENT"
  | "MANUAL_ADJUSTMENT";

export type MappingKey =
  | "CASH_ACCOUNT"
  | "BANK_ACCOUNT"
  | "REVENUE_ACCOUNT"
  | "DISCOUNT_ACCOUNT"
  | "COGS_ACCOUNT"
  | "EXPENSE_ACCOUNT"
  | "AR_ACCOUNT"
  | "AP_ACCOUNT"
  | "INVENTORY_ACCOUNT"
  | "TAX_ACCOUNT"
  | "ROUNDING_ACCOUNT";

export interface AccountMapping {
  id: string;
  module_code: MappingModuleCode;
  transaction_code: MappingTransactionCode;
  name: string;
  description: string | null;
  entity_id: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  mapping_key: MappingKey | null;
  account_id: string | null;
}

export interface AccountMappingFormData {
  id?: string;
  module_code: MappingModuleCode;
  transaction_code: MappingTransactionCode;
  name: string;
  description: string | null;
  entity_id: string | null;
  is_active: boolean;
  mapping_key: MappingKey;
  account_id: string;
}

export interface AccountMappingWithAccount extends AccountMapping {
  account?: {
    id: string;
    code: string;
    name: string;
    category_code: string | null;
    account_type: string | null;
  } | null;
}
