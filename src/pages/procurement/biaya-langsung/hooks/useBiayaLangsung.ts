import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface ItemOption {
  id: string;
  code: string;
  nama: string;
  expense_account_id: string | null;
  unit_id: string | null;
  unit_name: string;
}

export interface AccountOption {
  id: string;
  code: string;
  name: string;
}

export interface SettlementOption {
  id: string;
  code: string | null;
  kode: string | null;
  name: string;
}

export interface BiayaLine {
  item_id: string;
  qty: number;
  price: number;
  account_id: string;
}

export interface BiayaSubmitResult {
  id: string;
  nomor: string;
  total: number;
}

export function useBiayaLangsung() {
  const [items, setItems] = useState<ItemOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [settlements, setSettlements] = useState<SettlementOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemRes, unitRes, accRes, settRes] = await Promise.all([
        supabase
          .from("items")
          .select("id, code, nama, expense_account_id, unit_id")
          .eq("is_active", true)
          .order("code", { ascending: true }),
        supabase
          .from("units")
          .select("id, kode, nama, code, name"),
        supabase
          .from("accounts")
          .select("id, code, name")
          .eq("account_type", "expense")
          .eq("is_active", true)
          .order("code", { ascending: true }),
        supabase
          .from("purchase_settlement_methods")
          .select("id, code, kode, name")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

      if (itemRes.error) throw new Error(itemRes.error.message);
      if (unitRes.error) throw new Error(unitRes.error.message);
      if (accRes.error) throw new Error(accRes.error.message);
      if (settRes.error) throw new Error(settRes.error.message);

      const units = new Map<string, string>();
      for (const u of unitRes.data ?? []) {
        const lbl = u.nama || u.name || u.kode || u.code || "";
        if (u.id) units.set(u.id, lbl);
      }

      setItems(
        (itemRes.data ?? []).map((it) => ({
          id: it.id as string,
          code: it.code as string,
          nama: it.nama as string,
          expense_account_id: it.expense_account_id as string | null,
          unit_id: it.unit_id as string | null,
          unit_name: (it.unit_id && units.get(it.unit_id)) || "",
        }))
      );
      setAccounts((accRes.data ?? []) as AccountOption[]);
      setSettlements((settRes.data ?? []) as SettlementOption[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(
    async (
      entityId: string | null,
      tanggal: string,
      lines: BiayaLine[],
      description: string,
      settlementId: string | null
    ): Promise<BiayaSubmitResult> => {
      setSubmitting(true);
      setError(null);
      try {
        const payload = {
          p_entity_id: entityId,
          p_tanggal: tanggal,
          p_lines: lines.map((l) => ({
            item_id: l.item_id,
            qty: l.qty,
            price: l.price,
            account_id: l.account_id,
          })),
          p_description: description,
          p_user_id: null,
          p_settlement_id: settlementId,
        };

        const { data, error: rpcError } = await supabase.rpc(
          "post_biaya_langsung",
          payload
        );

        if (rpcError) throw new Error(rpcError.message);
        const result = (data ?? {}) as Record<string, unknown>;
        if (result.success === false) {
          throw new Error(
            typeof result.message === "string"
              ? (result.message as string)
              : "Gagal menyimpan biaya langsung."
          );
        }

        return {
          id: String(result.id ?? ""),
          nomor: String(result.nomor ?? ""),
          total: Number(result.total ?? 0),
        };
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  return {
    items,
    accounts,
    settlements,
    loading,
    error,
    submitting,
    submit,
  };
}
