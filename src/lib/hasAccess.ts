import { supabase } from "./supabaseClient";
import { getCustomUserId } from "./authUser";

let cachedAccess: string[] | null = null; // 🔥 cache global

export async function hasAccess(fitur: string): Promise<boolean> {
  try {
    // 🔁 pakai cache kalau sudah ada
    if (cachedAccess) {
      return cachedAccess.includes(fitur);
    }

    const userId = getCustomUserId();
    if (!userId) return false;

    const { data: profile, error } = await supabase
      .from("custom_users")
      .select("access")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      console.error("❌ hasAccess error:", error);
      return false;
    }

    let accessList: string[] = [];

    // 🔥 NORMALISASI ACCESS (INI PENTING)
    if (Array.isArray(profile.access)) {
      accessList = profile.access;
    } else if (typeof profile.access === "string") {
      try {
        accessList = JSON.parse(profile.access);
      } catch {
        accessList = [];
      }
    }

    // 🔁 simpan ke cache
    cachedAccess = accessList;

    console.log("🔐 ACCESS LOADED:", accessList);

    return accessList.includes(fitur);
  } catch (err) {
    console.error("❌ hasAccess crash:", err);
    return false;
  }
}

export function resetAccessCache() {
  cachedAccess = null;
}