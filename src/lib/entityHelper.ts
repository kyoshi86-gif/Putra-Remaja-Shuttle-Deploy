import { SupabaseQueryBuilder } from "@supabase/supabase-js";

/**
 * Terapkan filter entity:
 * - PUSAT → lihat semua
 * - OUTLET → hanya entity sendiri
 */
export function applyEntityFilter<T>(
  query: SupabaseQueryBuilder<T>,
  userEntityId: string,
  pusatEntityId: string
) {
  if (userEntityId !== pusatEntityId) {
    return query.eq("entity_id", userEntityId);
  }
  return query;
}
