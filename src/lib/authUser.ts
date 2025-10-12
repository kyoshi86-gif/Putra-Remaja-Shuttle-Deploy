// lib/authUser.ts
import { supabase } from "./supabaseClient";
import bcrypt from "bcryptjs";

export async function authenticateUser(name: string, password: string) {
  const { data: user, error } = await supabase
    .from("custom_users")
    .select("id, name, password, role, access")
    .eq("name", name)
    .maybeSingle();

  if (error) throw new Error("Gagal mengambil data user");
  if (!user) throw new Error("Username tidak ditemukan");

  const passwordMatches = bcrypt.compareSync(password, user.password);
  if (!passwordMatches) throw new Error("Password salah");

  return user;
}