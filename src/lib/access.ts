import { supabase } from "./supabaseClient";

export const getUserAccess = async (role: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("custom_roles")
    .select("access")
    .eq("name", role)
    .single();


  if (error || !data?.access || !Array.isArray(data.access)) {
    console.warn("Fallback to empty access");
    return [];
  }

  return data.access;
};

export const saveUserAccess = async (role: string, accessList: string[]) => {
  return await supabase
    .from("custom_roles")
    .update({ access: accessList })
    .eq("id", role);
};