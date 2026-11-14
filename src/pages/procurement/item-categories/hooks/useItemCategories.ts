import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type {
  AccountOption,
  ItemCategory,
  ItemCategoryFormData,
} from "../types";

const TABLE_NAME = "item_categories";

export function useItemCategories(entityId?: string | null) {
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);

    let query = supabase
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
      query = query.eq("entity_id", entityId);
    }

    const { data, error: accountError } = await query;

    if (accountError) {
      setError(accountError.message);
      setAccounts([]);
    } else {
      setAccounts((data ?? []) as AccountOption[]);
    }

    setLoadingAccounts(false);
  }, [entityId]);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from(TABLE_NAME)
      .select(
        `
        *,
        inventory_account:accounts!item_categories_inventory_account_id_fkey (
          id, code, name, category_code, account_type, is_active, is_posting
        ),
        expense_account:accounts!item_categories_expense_account_id_fkey (
          id, code, name, category_code, account_type, is_active, is_posting
        ),
        cogs_account:accounts!item_categories_cogs_account_id_fkey (
          id, code, name, category_code, account_type, is_active, is_posting
        ),
        stock_adjustment_account:accounts!item_categories_stock_adjustment_account_id_fkey (
          id, code, name, category_code, account_type, is_active, is_posting
        )
      `,
      )
      .order("code", { ascending: true });

    if (entityId) {
      query = query.eq("entity_id", entityId);
    }

    const { data, error: categoryError } = await query;

    if (categoryError) {
      setError(categoryError.message);
      setCategories([]);
    } else {
      setCategories((data ?? []) as ItemCategory[]);
    }

    setLoading(false);
  }, [entityId]);

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
  }, [fetchAccounts, fetchCategories]);

  const createCategory = async (payload: ItemCategoryFormData) => {
    setSaving(true);
    setError(null);

    const { error: createError } = await supabase.from(TABLE_NAME).insert({
      entity_id: payload.entity_id || null,
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

    await fetchCategories();
    setSaving(false);
    return true;
  };

  const updateCategory = async (id: string, payload: ItemCategoryFormData) => {
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from(TABLE_NAME)
      .update({
        entity_id: payload.entity_id || null,
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

    await fetchCategories();
    setSaving(false);
    return true;
  };

  const deleteCategory = async (id: string) => {
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

    await fetchCategories();
    setSaving(false);
    return true;
  };

  return {
    categories,
    accounts,
    loading,
    loadingAccounts,
    saving,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
