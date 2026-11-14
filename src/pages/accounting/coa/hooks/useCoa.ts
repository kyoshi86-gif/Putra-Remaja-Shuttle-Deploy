import { useCallback, useEffect, useMemo, useState } from "react";
import type { CoaFormData, CoaNode } from "../types";
import { supabase } from "@/lib/supabaseClient";

const TABLE_NAME = "accounts";

export function useCoa(entityId?: string | null) {
  const [accounts, setAccounts] = useState<CoaNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from(TABLE_NAME)
      .select("*")
      .order("code", { ascending: true });

    if (entityId) {
      query = query.eq("entity_id", entityId);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setAccounts([]);
    } else {
      setAccounts((data ?? []) as CoaNode[]);
    }

    setLoading(false);
  }, [entityId]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const createAccount = async (payload: CoaFormData) => {
    setSaving(true);
    setError(null);

    const { error: createError } = await supabase.from(TABLE_NAME).insert({
      code: payload.code.trim(),
      name: payload.name.trim(),
      parent_account_id: payload.parent_account_id || null,
      category_code: payload.category_code,

      type: payload.account_type,
      account_type: payload.account_type,

      normal_balance: payload.normal_balance,
      is_posting: payload.is_posting,
      is_summary: payload.is_summary,
      is_active: payload.is_active,
      entity_id: payload.entity_id || null,
    });

    if (createError) {
      setError(createError.message);
      setSaving(false);
      return false;
    }

    await fetchAccounts();
    setSaving(false);
    return true;
  };

  const updateAccount = async (id: string, payload: CoaFormData) => {
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from(TABLE_NAME)
      .update({
        code: payload.code,
        name: payload.name,
        parent_account_id: payload.parent_account_id || null,
        category_code: payload.category_code,

        // Selalu sinkronkan kedua kolom.
        account_type: payload.account_type,

        normal_balance: payload.normal_balance,
        is_posting: payload.is_posting,
        is_summary: payload.is_summary,
        is_active: payload.is_active,
        entity_id: payload.entity_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return false;
    }

    await fetchAccounts();
    setSaving(false);
    return true;
  };

  const deleteAccount = async (id: string) => {
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

    await fetchAccounts();
    setSaving(false);
    return true;
  };

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.is_active),
    [accounts],
  );

  const postingAccounts = useMemo(
    () => accounts.filter((account) => account.is_posting && account.is_active),
    [accounts],
  );

  const summaryAccounts = useMemo(
    () => accounts.filter((account) => account.is_summary && account.is_active),
    [accounts],
  );

  return {
    accounts,
    activeAccounts,
    postingAccounts,
    summaryAccounts,
    loading,
    saving,
    error,
    fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
  };
}
