import { supabase } from "./supabaseClient";

export interface EntityContext {
  entity_id: string;
  kode: string;
  tipe: "pusat" | "outlet";
}

/**
 * Ambil entity lengkap dari entity_id user
 * SATU-SATUNYA SUMBER KEBENARAN ENTITY
 */
export async function getEntityContext(entity_id: string): Promise<EntityContext> {
  
  const { data, error } = await supabase
    .from("entities")
    .select("id, kode, tipe")
    .eq("id", entity_id)
    .single();

  if (error || !data) {
    throw new Error("Entity tidak ditemukan / tidak valid");
  }

  return {
    entity_id: data.id,
    kode: data.kode,
    tipe: data.tipe as "pusat" | "outlet",
  };
}