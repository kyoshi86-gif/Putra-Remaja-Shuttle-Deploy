import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

import type {
  AccountOption,
  Item,
  ItemCategoryOption,
  ItemFormData,
  ItemSubcategoryOption,
  UnitOption,
} from "../types";

import { getCustomUser } from "@/lib/authUser";

const TABLE_NAME = "items";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const EXPORT_BATCH_SIZE = 1000;

/*
 * ==========================================================
 * TYPE MASTER DENGAN ARTICLE PREFIX
 *
 * article_prefix berasal dari database:
 *
 * item_categories.article_prefix
 * item_subcategories.article_prefix
 *
 * Tidak ada hard-code kategori/subkategori di frontend.
 * ==========================================================
 */

type ItemCategoryWithPrefix = ItemCategoryOption & {
  article_prefix: number | null;
};

type ItemSubcategoryWithPrefix = ItemSubcategoryOption & {
  article_prefix: number | null;
};

/*
 * ==========================================================
 * PARAMETER FETCH
 * ==========================================================
 */

type FetchItemsOptions = {
  page?: number;
  pageSize?: number;
  search?: string;
};

export function useItems(
  entityId?: string | null,
  page: number = DEFAULT_PAGE,
  pageSize: number = DEFAULT_PAGE_SIZE,
  search: string = "",
) {
  const [items, setItems] = useState<Item[]>([]);

  const [totalCount, setTotalCount] = useState(0);

  const [categories, setCategories] = useState<ItemCategoryOption[]>([]);

  const [subcategories, setSubcategories] = useState<ItemSubcategoryOption[]>(
    [],
  );

  const [units, setUnits] = useState<UnitOption[]>([]);

  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  const [loading, setLoading] = useState(false);

  const [loadingMasters, setLoadingMasters] = useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  /*
   * ==========================================================
   * FETCH MASTER
   *
   * Kategori & subkategori:
   * GLOBAL
   *
   * Tidak difilter entity.
   *
   * COA:
   * MENGIKUTI ENTITY USER.
   *
   * Unit:
   * Tetap global seperti sebelumnya.
   * ==========================================================
   */

  const fetchMasters = useCallback(async () => {
    setLoadingMasters(true);
    setError(null);

    try {
      const categoryQuery = supabase
        .from("item_categories")
        .select(
          `
                id,
                code,
                name,
                article_prefix,
                is_active
              `,
        )
        .eq("is_active", true)
        .order("article_prefix", {
          ascending: true,
        });

      const subcategoryQuery = supabase
        .from("item_subcategories")
        .select(
          `
                id,
                category_id,
                code,
                name,
                article_prefix,
                is_active
              `,
        )
        .eq("is_active", true)
        .order("article_prefix", {
          ascending: true,
        });

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
        .order("code", {
          ascending: true,
        });

      const unitQuery = supabase
        .from("units")
        .select(
          `
                id,
                code,
                name,
                is_active
              `,
        )
        .eq("is_active", true)
        .order("code", {
          ascending: true,
        });

      /*
       * ======================================================
       * COA MENGIKUTI ENTITY
       * ======================================================
       */

      if (entityId) {
        accountQuery = accountQuery.eq("entity_id", entityId);
      }

      const [categoryResult, subcategoryResult, unitResult, accountResult] =
        await Promise.all([
          categoryQuery,
          subcategoryQuery,
          unitQuery,
          accountQuery,
        ]);

      /*
       * ======================================================
       * CATEGORY
       * ======================================================
       */

      if (categoryResult.error) {
        setError(categoryResult.error.message);

        setCategories([]);
      } else {
        setCategories((categoryResult.data ?? []) as ItemCategoryWithPrefix[]);
      }

      /*
       * ======================================================
       * SUBCATEGORY
       * ======================================================
       */

      if (subcategoryResult.error) {
        setError(subcategoryResult.error.message);

        setSubcategories([]);
      } else {
        setSubcategories(
          (subcategoryResult.data ?? []) as ItemSubcategoryWithPrefix[],
        );
      }

      /*
       * ======================================================
       * UNIT
       * ======================================================
       */

      if (unitResult.error) {
        setError(unitResult.error.message);

        setUnits([]);
      } else {
        setUnits((unitResult.data ?? []) as UnitOption[]);
      }

      /*
       * ======================================================
       * ACCOUNT
       * ======================================================
       */

      if (accountResult.error) {
        setError(accountResult.error.message);

        setAccounts([]);
      } else {
        setAccounts((accountResult.data ?? []) as AccountOption[]);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal mengambil master artikel.";

      setError(message);

      setCategories([]);
      setSubcategories([]);
      setUnits([]);
      setAccounts([]);
    } finally {
      setLoadingMasters(false);
    }
  }, [entityId]);

  /*
   * ==========================================================
   * FETCH ITEMS
   *
   * SERVER-SIDE PAGINATION
   *
   * Supabase hanya mengirim data halaman aktif.
   *
   * Contoh:
   *
   * page     = 1
   * pageSize = 25
   *
   * range(0, 24)
   *
   * BUKAN mengambil seluruh items.
   * ==========================================================
   */

  const fetchItems = useCallback(
    async (options?: FetchItemsOptions) => {
      setLoading(true);
      setError(null);

      try {
        const currentPage = Math.max(1, options?.page ?? page ?? DEFAULT_PAGE);

        const currentPageSize = Math.max(
          1,
          options?.pageSize ?? pageSize ?? DEFAULT_PAGE_SIZE,
        );

        const currentSearch = (options?.search ?? search ?? "").trim();

        const from = (currentPage - 1) * currentPageSize;

        const to = from + currentPageSize - 1;

        /*
         * ====================================================
         * QUERY ITEMS
         * ====================================================
         */

        let query = supabase.from(TABLE_NAME).select(
          `
                  *,
                  category:item_categories!items_category_id_fkey (
                    id,
                    code,
                    name,
                    is_active
                  ),
                  subcategory:item_subcategories!items_subcategory_id_fkey (
                    id,
                    category_id,
                    code,
                    name,
                    is_active
                  ),
                  unit:units!items_unit_id_fkey (
                    id,
                    code,
                    name,
                    is_active
                  )
                `,
          {
            count: "exact",
          },
        );

        /*
         * ====================================================
         * ENTITY
         * ====================================================
         */

        if (entityId) {
          query = query.eq("entity_id", entityId);
        }

        /*
         * ====================================================
         * SERVER-SIDE SEARCH
         *
         * Untuk sekarang pencarian utama:
         *
         * - kode
         * - nama
         * - deskripsi
         *
         * Kita tidak melakukan .filter()
         * di React lagi.
         * ====================================================
         */

        if (currentSearch) {
          const escapedSearch = currentSearch
            .replace(/[%_]/g, "\\$&")
            .replace(/,/g, " ");

          query = query.or(
            [
              `code.ilike.%${escapedSearch}%`,
              `name.ilike.%${escapedSearch}%`,
              `description.ilike.%${escapedSearch}%`,
            ].join(","),
          );
        }

        /*
         * ====================================================
         * ORDER + RANGE
         * ====================================================
         */

        query = query
          .order("code", {
            ascending: true,
          })
          .range(from, to);

        const { data, error: fetchError, count } = await query;

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        setItems((data ?? []) as Item[]);

        setTotalCount(count ?? 0);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Gagal mengambil data artikel.";

        setError(message);

        setItems([]);

        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    [entityId, page, pageSize, search],
  );

  /*
   * ==========================================================
   * INITIAL LOAD / PAGINATION / SEARCH
   *
   * fetchMasters hanya dijalankan ketika entity berubah.
   *
   * fetchItems akan dijalankan ketika:
   *
   * - page berubah
   * - pageSize berubah
   * - search berubah
   * - entity berubah
   * ==========================================================
   */

  useEffect(() => {
    void fetchMasters();
  }, [fetchMasters]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  /*
   * ==========================================================
   * GENERATE NEXT ITEM CODE
   *
    * FORMAT:
    *
    * [CATEGORY ARTICLE PREFIX]
    * [SUBCATEGORY ARTICLE PREFIX]
    * [5 DIGIT SEQUENCE]
    *
    * CATEGORY PREFIX dapat lebih dari satu digit.
    *
    * Contoh kategori 1:
    *
    * categoryPrefix    = 1
    * subcategoryPrefix = 2
    *
    * hasil:
    *
    * 1200001
    *
    * Contoh kategori 10:
    *
    * categoryPrefix    = 10
    * subcategoryPrefix = 2
    *
    * hasil:
    *
    * 10200001
    *
    * Tidak ada hard-code batas jumlah kategori.
    * Semua prefix berasal dari database.
   * ==========================================================
   */

  const generateNextItemCode = useCallback(
    async (categoryId: string, subcategoryId: string): Promise<string> => {
      if (!categoryId) {
        throw new Error("Kategori artikel belum dipilih.");
      }

      if (!subcategoryId) {
        throw new Error("Subkategori artikel wajib dipilih.");
      }

      if (!entityId) {
        throw new Error("Entity user tidak ditemukan.");
      }

      /*
       * ======================================================
       * CARI CATEGORY
       * ======================================================
       */

      const category = categories.find((item) => item.id === categoryId) as
        ItemCategoryWithPrefix | undefined;

      /*
       * ======================================================
       * CARI SUBCATEGORY
       * ======================================================
       */

      const subcategory = subcategories.find(
        (item) => item.id === subcategoryId,
      ) as ItemSubcategoryWithPrefix | undefined;

      if (!category) {
        throw new Error("Data kategori tidak ditemukan.");
      }

      if (!subcategory) {
        throw new Error("Data subkategori tidak ditemukan.");
      }

      /*
       * ======================================================
       * VALIDASI RELASI
       * ======================================================
       */

      if (subcategory.category_id !== category.id) {
        throw new Error(
          "Subkategori tidak sesuai dengan kategori yang dipilih.",
        );
      }

      /*
       * ======================================================
       * ARTICLE PREFIX
       * ======================================================
       */

      const categoryPrefix = Number(category.article_prefix);

      const subcategoryPrefix = Number(subcategory.article_prefix);

      /*
      * ======================================================
      * VALIDASI CATEGORY ARTICLE PREFIX
      *
      * Category prefix berasal dari database.
      *
      * Tidak dibatasi hanya 1–9 karena jumlah kategori
      * dapat lebih dari 9.
      *
      * Contoh:
      *
      * 1
      * 2
      * ...
      * 9
      * 10
      * 11
      * dan seterusnya.
      * ======================================================
      */

      if (
        !Number.isSafeInteger(categoryPrefix) ||
        categoryPrefix < 1
      ) {
        throw new Error(
          `Kategori "${category.name}" belum memiliki article prefix yang valid.`,
        );
      }

      /*
      * ======================================================
      * VALIDASI SUBCATEGORY ARTICLE PREFIX
      *
      * Tetap 1 digit karena format kode artikel saat ini:
      *
      * [CATEGORY PREFIX][SUBCATEGORY PREFIX][5 DIGIT SEQUENCE]
      *
      * Contoh:
      *
      * Category 10
      * Subcategory 2
      * Sequence 00001
      *
      * Hasil:
      *
      * 10200001
      * ======================================================
      */

      if (
        !Number.isSafeInteger(subcategoryPrefix) ||
        subcategoryPrefix < 1 ||
        subcategoryPrefix > 9
      ) {
        throw new Error(
          `Subkategori "${subcategory.name}" belum memiliki article prefix yang valid.`,
        );
      }

      const prefix = `${categoryPrefix}${subcategoryPrefix}`;

      /*
       * ======================================================
       * CARI KODE TERAKHIR
       *
       * Entity sama.
       * Prefix sama.
       * ======================================================
       */

      const { data, error: codeError } = await supabase
        .from(TABLE_NAME)
        .select("code")
        .eq("entity_id", entityId)
        .like("code", `${prefix}%`)
        .order("code", {
          ascending: false,
        })
        .limit(1000);

      if (codeError) {
        throw new Error(`Gagal menentukan nomor artikel: ${codeError.message}`);
      }

      /*
       * ======================================================
       * CARI SEQUENCE TERBESAR
       * ======================================================
       */

      let maxSequence = 0;

      for (const row of data ?? []) {
        const code = String(row.code ?? "").trim();

        const match = code.match(new RegExp(`^${prefix}(\\d{5})$`));

        if (!match) {
          continue;
        }

        const sequence = Number(match[1]);

        if (Number.isInteger(sequence) && sequence > maxSequence) {
          maxSequence = sequence;
        }
      }

      const nextSequence = maxSequence + 1;

      if (nextSequence > 99999) {
        throw new Error(
          `Nomor artikel untuk prefix ${prefix} sudah mencapai batas 99999.`,
        );
      }

      return `${prefix}${String(nextSequence).padStart(5, "0")}`;
    },
    [categories, subcategories, entityId],
  );

  /*
   * ==========================================================
   * FORMAT NAMA ARTIKEL
   *
   * Input:
   * Paha Ayam
   *
   * Database:
   * POULTRY - Paha Ayam
   *
   * Tidak boleh:
   * POULTRY - POULTRY - Paha Ayam
   * ==========================================================
   */

  const formatItemName = useCallback(
    (rawName: string, subcategoryName: string) => {
      const name = rawName.trim();

      const prefix = `${subcategoryName.trim()} -`;

      if (name.toUpperCase().startsWith(prefix.toUpperCase())) {
        return name;
      }

      return `${subcategoryName.trim()} - ${name}`;
    },
    [],
  );

  /*
   * ==========================================================
   * CREATE ITEM
   * ==========================================================
   */

  const createItem = async (payload: ItemFormData) => {
    const currentUser = getCustomUser();

    if (!currentUser?.entity_id) {
      throw new Error("Entity user tidak ditemukan.");
    }

    setSaving(true);
    setError(null);

    try {
      if (!payload.category_id) {
        throw new Error("Kategori artikel wajib dipilih.");
      }

      if (!payload.subcategory_id) {
        throw new Error("Subkategori artikel wajib dipilih.");
      }

      if (!payload.name.trim()) {
        throw new Error("Nama artikel wajib diisi.");
      }

      /*
       * Generate kode otomatis.
       */

      const generatedCode = await generateNextItemCode(
        payload.category_id,
        payload.subcategory_id,
      );

      /*
       * Subcategory.
       */

      const subcategory = subcategories.find(
        (item) => item.id === payload.subcategory_id,
      );

      if (!subcategory) {
        throw new Error("Subkategori artikel tidak ditemukan.");
      }

      /*
       * Format nama.
       */

      const formattedName = formatItemName(payload.name, subcategory.name);

      /*
       * Insert.
       */

      const { error: createError } = await supabase.from(TABLE_NAME).insert({
        entity_id: currentUser.entity_id,

        code: generatedCode,

        name: formattedName,

        description: payload.description.trim() || null,

        item_type: payload.item_type,

        category_id: payload.category_id,

        subcategory_id: payload.subcategory_id,

        unit_id: payload.unit_id,

        inventory_account_id: payload.inventory_account_id || null,

        expense_account_id: payload.expense_account_id || null,

        cogs_account_id: payload.cogs_account_id || null,

        stock_adjustment_account_id:
          payload.stock_adjustment_account_id || null,

        valuation_method: "MOVING_AVERAGE",

        minimum_stock: Number(payload.minimum_stock || 0),

        standard_cost: Number(payload.standard_cost || 0),

        is_active: payload.is_active,
      });

      if (createError) {
        throw new Error(createError.message);
      }

      /*
       * Refresh halaman aktif.
       */

      await fetchItems();

      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal menyimpan artikel.";

      setError(message);

      window.alert(message);

      return false;
    } finally {
      setSaving(false);
    }
  };

  /*
   * ==========================================================
   * UPDATE ITEM
   *
   * KODE TIDAK DIGENERATE ULANG.
   * ==========================================================
   */

  const updateItem = async (id: string, payload: ItemFormData) => {
    setSaving(true);
    setError(null);

    try {
      if (!payload.category_id) {
        throw new Error("Kategori artikel wajib dipilih.");
      }

      if (!payload.subcategory_id) {
        throw new Error("Subkategori artikel wajib dipilih.");
      }

      if (!payload.name.trim()) {
        throw new Error("Nama artikel wajib diisi.");
      }

      const subcategory = subcategories.find(
        (item) => item.id === payload.subcategory_id,
      );

      if (!subcategory) {
        throw new Error("Subkategori artikel tidak ditemukan.");
      }

      if (subcategory.category_id !== payload.category_id) {
        throw new Error(
          "Subkategori tidak sesuai dengan kategori yang dipilih.",
        );
      }

      const formattedName = formatItemName(payload.name, subcategory.name);

      const { error: updateError } = await supabase
        .from(TABLE_NAME)
        .update({
          entity_id: payload.entity_id || null,

          code: payload.code.trim().toUpperCase(),

          name: formattedName,

          description: payload.description.trim() || null,

          item_type: payload.item_type,

          category_id: payload.category_id,

          subcategory_id: payload.subcategory_id,

          unit_id: payload.unit_id,

          inventory_account_id: payload.inventory_account_id || null,

          expense_account_id: payload.expense_account_id || null,

          cogs_account_id: payload.cogs_account_id || null,

          stock_adjustment_account_id:
            payload.stock_adjustment_account_id || null,

          minimum_stock: Number(payload.minimum_stock || 0),

          standard_cost: Number(payload.standard_cost || 0),

          is_active: payload.is_active,

          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      await fetchItems();

      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal memperbarui artikel.";

      setError(message);

      window.alert(message);

      return false;
    } finally {
      setSaving(false);
    }
  };

  /*
   * ==========================================================
   * DELETE ITEM
   * ==========================================================
   */

  const deleteItem = async (id: string) => {
    setSaving(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq("id", id);

      if (deleteError) {
        /*
         * ==================================================
         * PURCHASE ORDER FK
         * ==================================================
         */

        if (
          deleteError.code === "23503" ||
          deleteError.message.includes("purchase_order_details_item_id_fkey")
        ) {
          throw new Error(
            "Artikel tidak dapat dihapus karena sudah digunakan pada Purchase Order. Silakan nonaktifkan artikel tersebut agar riwayat transaksi tetap aman.",
          );
        }

        /*
         * ==================================================
         * FOREIGN KEY LAIN
         * ==================================================
         */

        if (deleteError.code === "23503") {
          throw new Error(
            "Artikel tidak dapat dihapus karena masih digunakan oleh transaksi atau data lain. Nonaktifkan artikel tersebut agar riwayat transaksi tetap aman.",
          );
        }

        throw new Error(deleteError.message);
      }

      await fetchItems();

      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Artikel gagal dihapus.";

      setError(message);

      window.alert(message);

      return false;
    } finally {
      setSaving(false);
    }
  };

  /*
   * ==========================================================
   * EXPORT ITEMS
   *
   * INI BERBEDA DENGAN fetchItems().
   *
   * fetchItems()
   *   → hanya halaman aktif.
   *
   * exportItems()
   *   → seluruh hasil sesuai search/entity.
   *
   * Tetap batch 1000 supaya tidak membuat satu
   * response besar sekaligus.
   * ==========================================================
   */

  const exportItems = useCallback(
    async (exportSearch: string = ""): Promise<Item[]> => {
      if (!entityId) {
        throw new Error("Entity user tidak ditemukan.");
      }

      const currentSearch = exportSearch.trim();

      let allItems: Item[] = [];

      let offset = 0;

      while (true) {
        let query = supabase
          .from(TABLE_NAME)
          .select(
            `
                  *,
                  category:item_categories!items_category_id_fkey (
                    id,
                    code,
                    name,
                    is_active
                  ),
                  subcategory:item_subcategories!items_subcategory_id_fkey (
                    id,
                    category_id,
                    code,
                    name,
                    is_active
                  ),
                  unit:units!items_unit_id_fkey (
                    id,
                    code,
                    name,
                    is_active
                  )
                `,
          )
          .eq("entity_id", entityId);

        /*
         * Server-side search yang sama
         * dengan tabel.
         */

        if (currentSearch) {
          const escapedSearch = currentSearch
            .replace(/[%_]/g, "\\$&")
            .replace(/,/g, " ");

          query = query.or(
            [
              `code.ilike.%${escapedSearch}%`,
              `name.ilike.%${escapedSearch}%`,
              `description.ilike.%${escapedSearch}%`,
            ].join(","),
          );
        }

        const { data, error: exportError } = await query
          .order("code", {
            ascending: true,
          })
          .range(offset, offset + EXPORT_BATCH_SIZE - 1);

        if (exportError) {
          throw new Error(
            `Gagal mengambil data export: ${exportError.message}`,
          );
        }

        const batch = (data ?? []) as Item[];

        allItems = [...allItems, ...batch];

        if (batch.length < EXPORT_BATCH_SIZE) {
          break;
        }

        offset += EXPORT_BATCH_SIZE;
      }

      return allItems;
    },
    [entityId],
  );

  /*
   * ==========================================================
   * RETURN
   * ==========================================================
   */

  return {
    items,

    totalCount,

    categories,
    subcategories,
    units,
    accounts,

    loading,
    loadingMasters,
    saving,
    error,

    fetchItems,

    exportItems,

    createItem,
    updateItem,
    deleteItem,

    generateNextItemCode,
  };
}
