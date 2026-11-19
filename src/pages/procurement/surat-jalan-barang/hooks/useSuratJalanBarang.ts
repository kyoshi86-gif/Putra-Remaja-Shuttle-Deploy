import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import type {
  EntityOption,
  ItemStockOption,
  SjbFormData,
  SjbResult,
  SuratJalanBarang,
} from "../types";

export function useSuratJalanBarang(currentEntityId?: string | null) {
  const [list, setList] = useState<SuratJalanBarang[]>([]);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [stockItems, setStockItems] = useState<ItemStockOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMasters, setLoadingMasters] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("surat_jalan_barang")
      .select(
        `
        *,
        entity_asal_info:entities!surat_jalan_barang_entity_asal_fkey(kode,nama),
        entity_tujuan_info:entities!surat_jalan_barang_entity_tujuan_fkey(kode,nama)
        `,
      )
      .order("created_at", { ascending: false });

    if (currentEntityId) {
      // outlet melihat SJB masuk; pusat melihat SJB keluar (atau keduanya)
      query = query.or(
        `entity_asal.eq.${currentEntityId},entity_tujuan.eq.${currentEntityId}`,
      );
    }

    const { data, error } = await query;
    if (error) {
      setError(error.message);
      setList([]);
      setLoading(false);
      return;
    }
    setList((data ?? []) as SuratJalanBarang[]);
    setLoading(false);
  }, [currentEntityId]);

  const fetchMasters = useCallback(async () => {
    setLoadingMasters(true);
    setError(null);

    const entityPromise = supabase
      .from("entities")
      .select("id,kode,nama,tipe")
      .order("kode");

    const stockPromise = supabase
      .from("item_entity_stocks")
      .select(
        `
          item_id,
          qty_on_hand,
          avg_cost,
          item:items(
            id,
            code,
            name,
            item_type,
            standard_cost,
            is_active,
            unit:units(id,code,name),
            category:item_categories(code,name),
            subcategory:item_subcategories(code,name)
          )
          `,
      )
      .eq("entity_id", currentEntityId ?? "");

    const [entityRes, stockRes] = await Promise.all([entityPromise, stockPromise]);

    if (entityRes.error) {
      setError(entityRes.error.message);
    } else {
      setEntities((entityRes.data ?? []) as EntityOption[]);
    }

    if (stockRes.error) {
      setError(stockRes.error.message);
      setStockItems([]);
    } else {
      const rows = (stockRes.data ?? []) as Array<{
        item_id: string;
        qty_on_hand: number;
        avg_cost: number;
        item: Partial<ItemStockOption> | null;
      }>;
      const mapped: ItemStockOption[] = [];
      for (const row of rows) {
        if (!row.item?.id) continue;
        mapped.push({
          id: row.item.id as string,
          code: (row.item.code as string) ?? "",
          name: (row.item.name as string) ?? "",
          item_type: (row.item.item_type as ItemStockOption["item_type"]) ?? "STOCK",
          standard_cost: row.item.standard_cost ?? null,
          is_active: row.item.is_active ?? true,
          unit: row.item.unit ?? null,
          category: row.item.category ?? null,
          subcategory: row.item.subcategory ?? null,
          qty_on_hand: Number(row.qty_on_hand ?? 0),
          avg_cost: Number(row.avg_cost ?? 0),
        });
      }
      setStockItems(mapped.filter((i) => i.qty_on_hand > 0));
    }

    setLoadingMasters(false);
  }, [currentEntityId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (currentEntityId) fetchMasters();
  }, [fetchMasters]);

  // Buat SJB status DRAFT (belum sentuh stok)
  const createDraft = useCallback(
    async (form: SjbFormData, userId: string | null): Promise<SjbResult> => {
      setSaving(true);
      setError(null);
      const lines = form.lines.filter((l) => l.item_id && l.qty > 0);
      if (lines.length === 0) {
        setSaving(false);
        return { success: false, error: "Tidak ada item yang valid." };
      }
      const { data, error } = await supabase.rpc("post_sjb_draft", {
        p_entity_asal: currentEntityId,
        p_entity_tujuan: form.entity_tujuan,
        p_tanggal: form.tanggal,
        p_lines: lines,
        p_catatan: form.catatan,
        p_user_id: userId,
      });
      setSaving(false);
      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      }
      await fetchList();
      return data as SjbResult;
    },
    [currentEntityId, fetchList],
  );

  // Edit SJB (hanya DRAFT)
  const updateDraft = useCallback(
    async (
      sjbId: string,
      form: SjbFormData,
      userId: string | null,
    ): Promise<SjbResult> => {
      setSaving(true);
      setError(null);
      const lines = form.lines.filter((l) => l.item_id && l.qty > 0);
      if (lines.length === 0) {
        setSaving(false);
        return { success: false, error: "Tidak ada item yang valid." };
      }
      const { data, error } = await supabase.rpc("post_sjb_edit", {
        p_sjb_id: sjbId,
        p_entity_tujuan: form.entity_tujuan,
        p_tanggal: form.tanggal,
        p_lines: lines,
        p_catatan: form.catatan,
        p_user_id: userId,
      });
      setSaving(false);
      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      }
      await fetchList();
      return data as SjbResult;
    },
    [fetchList],
  );

  // Approved: DRAFT → DIKIRIM + kurangi stok asal
  const approve = useCallback(
    async (sjbId: string, userId: string | null): Promise<SjbResult> => {
      setSaving(true);
      setError(null);
      const { data, error } = await supabase.rpc("post_sjb_approve", {
        p_sjb_id: sjbId,
        p_user_id: userId,
      });
      setSaving(false);
      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      }
      await fetchList();
      return data as SjbResult;
    },
    [fetchList],
  );

  // Hapus SJB (hanya DRAFT)
  const removeDraft = useCallback(
    async (sjbId: string): Promise<SjbResult> => {
      setSaving(true);
      setError(null);
      const { data, error } = await supabase.rpc("post_sjb_hapus", {
        p_sjb_id: sjbId,
      });
      setSaving(false);
      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      }
      await fetchList();
      return data as SjbResult;
    },
    [fetchList],
  );

  const receive = useCallback(
    async (sjbId: string, lines: Array<{ item_id: string; qty_terima: number }>, userId: string | null): Promise<SjbResult> => {
      setSaving(true);
      setError(null);
      const { data, error } = await supabase.rpc("post_sjb_terima", {
        p_sjb_id: sjbId,
        p_lines: lines,
        p_user_id: userId,
      });
      setSaving(false);
      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      }
      await fetchList();
      return data as SjbResult;
    },
    [fetchList],
  );

  return {
    list,
    entities,
    stockItems,
    loading,
    loadingMasters,
    saving,
    error,
    fetchList,
    createDraft,
    updateDraft,
    approve,
    removeDraft,
    receive,
  };
}
