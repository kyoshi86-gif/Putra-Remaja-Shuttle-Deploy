import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type {
  AccountMappingFormData,
  AccountMappingWithAccount,
} from "../types";

const TABLE_NAME = "account_mappings";

export interface AccountMappingPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function useAccountMapping(entityId?: string | null) {
  const [mappings, setMappings] = useState<AccountMappingWithAccount[]>([]);

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [page, setPageState] = useState(1);

  const [pageSize, setPageSizeState] = useState(25);

  const [total, setTotal] = useState(0);

  const [search, setSearchState] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  /*
   * ==========================================================
   * SERVER-SIDE FETCH
   * ==========================================================
   *
   * Supabase hanya mengirim row sesuai page/pageSize.
   * Search juga dilakukan di database.
   */
  const fetchMappings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const keyword = search.trim();

      /*
       * Untuk pencarian berdasarkan COA,
       * cari ID akun terlebih dahulu.
       *
       * Kita hanya mengambil kolom id,
       * bukan seluruh data account.
       */
      let matchingAccountIds: string[] = [];

      if (keyword) {
        const escapedKeyword = keyword.replace(/[%_]/g, "\\$&");

        const { data: matchingAccounts, error: accountSearchError } =
          await supabase
            .from("accounts")
            .select("id")
            .or(
              [
                `code.ilike.%${escapedKeyword}%`,
                `name.ilike.%${escapedKeyword}%`,
              ].join(","),
            );

        if (accountSearchError) {
          throw accountSearchError;
        }

        matchingAccountIds = (matchingAccounts ?? [])
          .map((account: { id: string }) => account.id)
          .filter((id): id is string => Boolean(id));
      }

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
                account_type
              )
            `,
          {
            count: "exact",
          },
        )
        .order("module_code", {
          ascending: true,
        })
        .order("transaction_code", {
          ascending: true,
        })
        .order("mapping_key", {
          ascending: true,
        });

      /*
       * Entity scope.
       *
       * entityId = null:
       * hanya mapping global.
       *
       * entityId ada:
       * hanya mapping entity tersebut.
       */
      if (entityId) {
        query = query.eq("entity_id", entityId);
      } else {
        query = query.is("entity_id", null);
      }

      /*
       * Global database-side search.
       */
      if (keyword) {
        const escapedKeyword = keyword.replace(/[%_]/g, "\\$&");

        const conditions: string[] = [
          `module_code.ilike.%${escapedKeyword}%`,
          `transaction_code.ilike.%${escapedKeyword}%`,
          `mapping_key.ilike.%${escapedKeyword}%`,
          `name.ilike.%${escapedKeyword}%`,
          `description.ilike.%${escapedKeyword}%`,
        ];

        if (matchingAccountIds.length > 0) {
          conditions.push(`account_id.in.(${matchingAccountIds.join(",")})`);
        }

        query = query.or(conditions.join(","));
      }

      /*
       * ======================================================
       * SERVER-SIDE PAGINATION
       * ======================================================
       */
      const from = (page - 1) * pageSize;

      const to = from + pageSize - 1;

      query = query.range(from, to);

      const { data, error: fetchError, count } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setMappings((data ?? []) as AccountMappingWithAccount[]);

      setTotal(count ?? 0);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Gagal mengambil data account mapping.";

      console.error("Account Mapping fetch error:", fetchError);

      setError(message);
      setMappings([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [entityId, page, pageSize, search]);

  /*
   * ==========================================================
   * LOAD DATA
   * ==========================================================
   *
   * Debounce 250ms agar mengetik search tidak menembak
   * database pada setiap keypress.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchMappings();
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchMappings]);

  /*
   * Search selalu kembali ke halaman pertama.
   * Tidak ada effect setState yang bergantung pada page,
   * sehingga tidak menyebabkan maximum update depth.
   */
  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPageState(1);
  }, []);

  /*
   * Page size berubah -> kembali ke page 1.
   */
  const setPageSize = useCallback((value: number) => {
    const nextSize = Math.max(1, Number(value) || 25);

    setPageSizeState(nextSize);
    setPageState(1);
  }, []);

  const setPage = useCallback(
    (value: number) => {
      setPageState(Math.max(1, Math.min(value, totalPages)));
    },
    [totalPages],
  );

  /*
   * ==========================================================
   * CREATE
   * ==========================================================
   */
  const createMapping = async (payload: AccountMappingFormData) => {
    setSaving(true);
    setError(null);

    try {
      const { error: createError } = await supabase.from(TABLE_NAME).insert({
        module_code: payload.module_code,
        transaction_code: payload.transaction_code,
        mapping_key: payload.mapping_key,
        account_id: payload.account_id,
        entity_id: payload.entity_id,
        name: payload.name,
        description: payload.description,
        is_active: payload.is_active,
      });

      if (createError) {
        throw createError;
      }

      await fetchMappings();

      return true;
    } catch (createError) {
      const message =
        createError instanceof Error
          ? createError.message
          : "Gagal membuat account mapping.";

      setError(message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  /*
   * ==========================================================
   * UPDATE
   * ==========================================================
   */
  const updateMapping = async (id: string, payload: AccountMappingFormData) => {
    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from(TABLE_NAME)
        .update({
          module_code: payload.module_code,
          transaction_code: payload.transaction_code,
          mapping_key: payload.mapping_key,
          account_id: payload.account_id,
          entity_id: payload.entity_id,
          name: payload.name,
          description: payload.description,
          is_active: payload.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        throw updateError;
      }

      await fetchMappings();

      return true;
    } catch (updateError) {
      const message =
        updateError instanceof Error
          ? updateError.message
          : "Gagal memperbarui account mapping.";

      setError(message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  /*
   * ==========================================================
   * DELETE
   * ==========================================================
   */
  const deleteMapping = async (id: string) => {
    setSaving(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq("id", id);

      if (deleteError) {
        throw deleteError;
      }

      /*
       * Jika menghapus row terakhir di halaman terakhir,
       * pindahkan page ke belakang.
       */
      if (mappings.length === 1 && page > 1) {
        setPageState((current) => Math.max(1, current - 1));
      } else {
        await fetchMappings();
      }

      return true;
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Gagal menghapus account mapping.";

      setError(message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    mappings,
    loading,
    saving,
    error,

    fetchMappings,

    createMapping,
    updateMapping,
    deleteMapping,

    page,
    pageSize,
    total,
    totalPages,

    setPage,
    setPageSize,

    search,
    setSearch,
  };
}
