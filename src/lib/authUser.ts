import { supabase } from "./supabaseClient";
import bcrypt from "bcryptjs";

// ✅ Fungsi login manual pakai custom_users
export async function authenticateUser(name: string, password: string) {
  const { data: user, error } = await supabase
    .from("custom_users") // ✅ HARUS dari custom_users
    .select("id, name, password, role, access")
    .eq("name", name)
    .maybeSingle();

  if (error) throw new Error("Gagal mengambil data user");
  if (!user) throw new Error("Username tidak ditemukan");

  const passwordMatches = bcrypt.compareSync(password, user.password);
  if (!passwordMatches) throw new Error("Password salah");

  return user; // ✅ ini yang kamu simpan ke localStorage
}

// ✅ Ambil user dari localStorage
export function getCustomUser() {
  const stored = localStorage.getItem("custom_user");
  try {
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

// ✅ Ambil hanya ID user
export function getCustomUserId(): string | null {
  const user = getCustomUser();
  return user?.id ?? null;
}