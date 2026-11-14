import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type {
  AccountOption,
  PurchaseSettlementMethod,
  PurchaseSettlementMethodFormData,
} from "../types";

const TABLE_NAME = "purchase_settlement_methods";

export function usePurchaseSettlementMethods(entityId?: string | null) {
  const [methods, setMethods] = useState<PurchaseSettlementMethod[]>([]);
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

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setAccounts([]);
    } else {
      setAccounts((data ?? []) as AccountOption[]);
    }

    setLoadingAccounts(false);
  }, [entityId]);

  const fetchMethods = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from(TABLE_NAME)
      .select(
        `
        *,
        account:accounts (
          id,
          code,
          name,
          category_code,
          account_type,
          is_active,
          is_posting
        )
      `,
      )
      .order("is_system", { ascending: false })
      .order("code", { ascending: true });

    if (entityId) {
      query = query.eq("entity_id", entityId);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setMethods([]);
    } else {
      setMethods((data ?? []) as PurchaseSettlementMethod[]);
    }

    setLoading(false);
  }, [entityId]);

  useEffect(() => {
    fetchAccounts();
    fetchMethods();
  }, [fetchAccounts, fetchMethods]);

  const createMethod = async (payload: PurchaseSettlementMethodFormData) => {
    setSaving(true);
    setError(null);

    const { error: createError } = await supabase.from(TABLE_NAME).insert({
      entity_id: payload.entity_id || null,

      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
      settlement_type: payload.settlement_type,

      account_id: payload.account_id || null,
      requires_amount: payload.requires_amount,

      is_system: false,
      is_active: payload.is_active,
    });

    if (createError) {
      setError(createError.message);
      setSaving(false);
      return false;
    }

    await fetchMethods();
    setSaving(false);
    return true;
  };

  const updateMethod = async (
    method: PurchaseSettlementMethod,
    payload: PurchaseSettlementMethodFormData,
  ) => {
    setSaving(true);
    setError(null);

    const updatePayload = method.is_system
      ? {
          name: payload.name.trim(),
          account_id: payload.account_id || null,
          requires_amount: payload.requires_amount,
          is_active: true,
          updated_at: new Date().toISOString(),
        }
      : {
          code: payload.code.trim().toUpperCase(),
          name: payload.name.trim(),
          settlement_type: payload.settlement_type,
          account_id: payload.account_id || null,
          requires_amount: payload.requires_amount,
          is_active: payload.is_active,
          updated_at: new Date().toISOString(),
        };

    const { error: updateError } = await supabase
      .from(TABLE_NAME)
      .update(updatePayload)
      .eq("id", method.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return false;
    }

    await fetchMethods();
    setSaving(false);
    return true;
  };

  const deleteMethod = async (method: PurchaseSettlementMethod) => {
    if (method.is_system) {
      setError("Metode sistem tidak boleh dihapus.");
      return false;
    }

    setSaving(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq("id", method.id);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return false;
    }

    await fetchMethods();
    setSaving(false);
    return true;
  };

  return {
    methods,
    accounts,

    loading,
    loadingAccounts,
    saving,
    error,

    fetchMethods,
    createMethod,
    updateMethod,
    deleteMethod,
  };
}
