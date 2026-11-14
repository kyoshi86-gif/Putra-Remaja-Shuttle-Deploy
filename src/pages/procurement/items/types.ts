export type ItemType = "STOCK" | "NON_STOCK" | "SERVICE";

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

export type ItemSubcategoryOption = {
  id: string;
  category_id: string;
  code: string;
  name: string;
  is_active: boolean;
};

export type UnitOption = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

export type Item = {
  id: string;
  entity_id: string | null;

  code: string;
  name: string;
  description: string | null;
  item_type: ItemType;

  category_id: string;
  subcategory_id: string | null;
  unit_id: string;

  inventory_account_id: string | null;
  expense_account_id: string | null;
  cogs_account_id: string | null;
  stock_adjustment_account_id: string | null;

  valuation_method: "MOVING_AVERAGE";
  minimum_stock: number;
  standard_cost: number;
  is_active: boolean;

  created_at: string;
  updated_at: string;

  category?: ItemCategoryOption | null;
  subcategory?: ItemSubcategoryOption | null;
  unit?: UnitOption | null;
};

export type ItemFormData = {
  entity_id?: string | null;

  code: string;
  name: string;
  description: string;
  item_type: ItemType;

  category_id: string;
  subcategory_id: string;
  unit_id: string;

  inventory_account_id: string;
  expense_account_id: string;
  cogs_account_id: string;
  stock_adjustment_account_id: string;

  minimum_stock: number;
  standard_cost: number;
  is_active: boolean;
};
