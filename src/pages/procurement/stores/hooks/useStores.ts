import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Store, StoreFormData } from "../types";

const TABLE_NAME = "stores";

export function useStores(entityId?: string | null) {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStores = useCallback(async () => {
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
      setStores([]);
    } else {
      setStores((data ?? []) as Store[]);
    }

    setLoading(false);
  }, [entityId]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const createStore = async (payload: StoreFormData) => {
    setSaving(true);
    setError(null);

    const { error: createError } = await supabase
      .from(TABLE_NAME)
      .insert({
        entity_id: entityId ?? payload.entity_id ?? null,
        code: payload.code.trim().toUpperCase(),
        name: payload.name.trim(),
        store_type: payload.store_type,
        address: payload.address.trim() || null,
        is_active: payload.is_active,
      });

    if (createError) {
      setError(createError.message);
      setSaving(false);
      return false;
    }

    await fetchStores();
    setSaving(false);
    return true;
  };

  const updateStore = async (
    id: string,
    payload: StoreFormData,
  ) => {
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from(TABLE_NAME)
      .update({
        entity_id: entityId ?? payload.entity_id ?? null,
        code: payload.code.trim().toUpperCase(),
        name: payload.name.trim(),
        store_type: payload.store_type,
        address: payload.address.trim() || null,
        is_active: payload.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return false;
    }

    await fetchStores();
    setSaving(false);
    return true;
  };

  const deleteStore = async (id: string) => {
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

    await fetchStores();
    setSaving(false);
    return true;
  };

  return {
    stores,
    loading,
    saving,
    error,
    fetchStores,
    createStore,
    updateStore,
    deleteStore,
  };
}