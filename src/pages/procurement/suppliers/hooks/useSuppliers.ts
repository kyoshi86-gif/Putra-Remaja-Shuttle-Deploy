import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Supplier, SupplierFormData } from "../types";
import { getCustomUser } from "@/lib/authUser";

const TABLE_NAME = "suppliers";

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = getCustomUser();

  const entityId = user?.entity_id ?? null;

  const fetchSuppliers = useCallback(async () => {
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
      setSuppliers([]);
    } else {
      setSuppliers((data ?? []) as Supplier[]);
    }

    setLoading(false);
  }, [entityId]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const createSupplier = async (payload: SupplierFormData) => {
    setSaving(true);
    setError(null);

    const { error: createError } = await supabase.from(TABLE_NAME).insert({
      entity_id: entityId,
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),

      contact_person: payload.contact_person.trim() || null,
      phone: payload.phone.trim() || null,
      email: payload.email.trim() || null,
      address: payload.address.trim() || null,

      default_payment_term_days: Number(payload.default_payment_term_days || 0),

      is_active: payload.is_active,
    });

    if (createError) {
      setError(createError.message);
      setSaving(false);
      return false;
    }

    await fetchSuppliers();
    setSaving(false);
    return true;
  };

  const updateSupplier = async (id: string, payload: SupplierFormData) => {
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from(TABLE_NAME)
      .update({
        entity_id: entityId,
        code: payload.code.trim().toUpperCase(),
        name: payload.name.trim(),

        contact_person: payload.contact_person.trim() || null,
        phone: payload.phone.trim() || null,
        email: payload.email.trim() || null,
        address: payload.address.trim() || null,

        default_payment_term_days: Number(
          payload.default_payment_term_days || 0,
        ),

        is_active: payload.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return false;
    }

    await fetchSuppliers();
    setSaving(false);
    return true;
  };

  const deleteSupplier = async (id: string) => {
    setSaving(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq("id", id);

    if (deleteError) {
      if (
        deleteError.code === "23503" ||
        deleteError.message.includes("purchase_orders_supplier_id_fkey")
      ) {
        setError(
          "Supplier tidak dapat dihapus karena sudah digunakan pada Purchase Order.",
        );
      } else {
        setError(deleteError.message);
      }

      setSaving(false);
      return false;
    }

    await fetchSuppliers();
    setSaving(false);
    return true;
  };

  return {
    suppliers,
    loading,
    saving,
    error,
    fetchSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
  };
}
