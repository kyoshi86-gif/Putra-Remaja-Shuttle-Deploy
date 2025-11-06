import { supabase } from "./supabaseClient";
import { getCustomUserId } from "./authUser";

export async function hasAccess(fitur: string): Promise<boolean> {
  const userId = getCustomUserId();
  if (!userId) return false;

  const { data: profile, error } = await supabase
    .from("custom_users")
    .select("access")
    .eq("id", userId) // ⬅️ pastikan pakai kolom `id`, bukan `user_id`
    .single();

  if (error || !profile) return false;

  return profile.access?.includes(fitur) || false;
}