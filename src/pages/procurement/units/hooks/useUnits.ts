import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Unit, UnitFormData } from "../types";

const TABLE_NAME = "units";

export function useUnits() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("code", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setUnits([]);
    } else {
      setUnits((data ?? []) as Unit[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const createUnit = async (payload: UnitFormData) => {
    setSaving(true);
    setError(null);

    const { error: createError } = await supabase.from(TABLE_NAME).insert({
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
      is_active: payload.is_active,
    });

    if (createError) {
      setError(createError.message);
      setSaving(false);
      return false;
    }

    await fetchUnits();
    setSaving(false);
    return true;
  };

  const updateUnit = async (id: string, payload: UnitFormData) => {
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from(TABLE_NAME)
      .update({
        code: payload.code.trim().toUpperCase(),
        name: payload.name.trim(),
        is_active: payload.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return false;
    }

    await fetchUnits();
    setSaving(false);
    return true;
  };

  const deleteUnit = async (id: string) => {
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

    await fetchUnits();
    setSaving(false);
    return true;
  };

  return {
    units,
    loading,
    saving,
    error,
    fetchUnits,
    createUnit,
    updateUnit,
    deleteUnit,
  };
}
