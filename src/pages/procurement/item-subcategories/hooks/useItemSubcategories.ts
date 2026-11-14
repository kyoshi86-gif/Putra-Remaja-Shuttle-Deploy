import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type {
  AccountOption,
  ItemCategoryOption,
  ItemSubcategory,
  ItemSubcategoryFormData,
} from "../types";

const TABLE_NAME = "item_subcategories";

export function useItemSubcategories(entityId?: string | null) {
  const [subcategories, setSubcategories] = useState<ItemSubcategory[]>([]);
  const [categories, setCategories] = useState<ItemCategoryOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingMasters, setLoadingMasters] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMasters = useCallback(async () => {
    setLoadingMasters(true);
    setError(null);

    let categoryQuery = supabase
      .from("item_categories")
      .select("id, code, name, is_active")
      .eq("is_active", true)
      .order("code", { ascending: true });

    let accountQuery = supabase
      .from("accounts")
      .select(
        `
        id,
        code,
        name,
        category_code,
        account_type,
        is_active,
        is_posting
      `,
      )
      .eq("is_active", true)
      .eq("is_posting", true)
      .order("code", { ascending: true });

    if (entityId) {
      categoryQuery = categoryQuery.eq("entity_id", entityId);
      accountQuery = accountQuery.eq("entity_id", entityId);
    }

    const [categoryResult, accountResult] = await Promise.all([
      categoryQuery,
      accountQuery,
    ]);

    if (categoryResult.error) {
      setError(categoryResult.error.message);
      setCategories([]);
    } else {
      setCategories((categoryResult.data ?? []) as ItemCategoryOption[]);
    }

    if (accountResult.error) {
      setError(accountResult.error.message);
      setAccounts([]);
    } else {
      setAccounts((accountResult.data ?? []) as AccountOption[]);
    }

    setLoadingMasters(false);
  }, [entityId]);

  const fetchSubcategories = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from(TABLE_NAME)
      .select(
        `
        *,
        category:item_categories!item_subcategories_category_id_fkey (
          id, code, name, is_active
        ),
        inventory_account:accounts!item_subcategories_inventory_account_id_fkey (
          id, code, name, category_code, account_type, is_active, is_posting
        ),
        expense_account:accounts!item_subcategories_expense_account_id_fkey (
          id, code, name, category_code, account_type, is_active, is_posting
        ),
        cogs_account:accounts!item_subcategories_cogs_account_id_fkey (
          id, code, name, category_code, account_type, is_active, is_posting
        ),
        stock_adjustment_account:accounts!item_subcategories_stock_adjustment_account_id_fkey (
          id, code, name, category_code, account_type, is_active, is_posting
        )
      `,
      )
      .order("code", { ascending: true });

    if (entityId) {
      query = query.eq("entity_id", entityId);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setSubcategories([]);
    } else {
      setSubcategories((data ?? []) as ItemSubcategory[]);
    }

    setLoading(false);
  }, [entityId]);

  useEffect(() => {
    fetchMasters();
    fetchSubcategories();
  }, [fetchMasters, fetchSubcategories]);

  const createSubcategory = async (payload: ItemSubcategoryFormData) => {
    setSaving(true);
    setError(null);

    const { error: createError } = await supabase.from(TABLE_NAME).insert({
      entity_id: payload.entity_id || null,

      category_id: payload.category_id,
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
      description: payload.description.trim() || null,

      inventory_account_id: payload.inventory_account_id || null,
      expense_account_id: payload.expense_account_id || null,
      cogs_account_id: payload.cogs_account_id || null,
      stock_adjustment_account_id: payload.stock_adjustment_account_id || null,

      is_active: payload.is_active,
    });

    if (createError) {
      setError(createError.message);
      setSaving(false);
      return false;
    }

    await fetchSubcategories();
    setSaving(false);
    return true;
  };

  const updateSubcategory = async (
    id: string,
    payload: ItemSubcategoryFormData,
  ) => {
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from(TABLE_NAME)
      .update({
        entity_id: payload.entity_id || null,

        category_id: payload.category_id,
        code: payload.code.trim().toUpperCase(),
        name: payload.name.trim(),
        description: payload.description.trim() || null,

        inventory_account_id: payload.inventory_account_id || null,
        expense_account_id: payload.expense_account_id || null,
        cogs_account_id: payload.cogs_account_id || null,
        stock_adjustment_account_id:
          payload.stock_adjustment_account_id || null,

        is_active: payload.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return false;
    }

    await fetchSubcategories();
    setSaving(false);
    return true;
  };

  const deleteSubcategory = async (id: string) => {
    setSaving(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return false;
    }

    await fetchSubcategories();
    setSaving(false);
    return true;
  };

  return {
    subcategories,
    categories,
    accounts,
    loading,
    loadingMasters,
    saving,
    error,

    fetchSubcategories,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
  };
}
