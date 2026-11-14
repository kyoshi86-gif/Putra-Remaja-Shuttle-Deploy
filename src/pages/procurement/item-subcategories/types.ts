export type AccountOption = {
  id: string;
  code: string;
  name: string;
  category_code: string;
  account_type: string;
  is_active: boolean;
  is_posting: boolean;
};

export type ItemCategoryOption = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

export type ItemSubcategory = {
  id: string;
  entity_id: string | null;

  category_id: string;
  code: string;
  name: string;
  description: string | null;

  inventory_account_id: string | null;
  expense_account_id: string | null;
  cogs_account_id: string | null;
  stock_adjustment_account_id: string | null;

  is_active: boolean;
  created_at: string;
  updated_at: string;

  category?: ItemCategoryOption | null;
  inventory_account?: AccountOption | null;
  expense_account?: AccountOption | null;
  cogs_account?: AccountOption | null;
  stock_adjustment_account?: AccountOption | null;
};

export type ItemSubcategoryFormData = {
  entity_id?: string | null;

  category_id: string;
  code: string;
  name: string;
  description: string;

  inventory_account_id: string;
  expense_account_id: string;
  cogs_account_id: string;
  stock_adjustment_account_id: string;

  is_active: boolean;
};
