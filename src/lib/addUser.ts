// src/addUser.ts
import { supabase } from "./supabaseClient";

export const addUserIfNotExists = async () => {
  try {
    // Ambil user yang sedang login
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error("Gagal ambil user dari auth:", authError.message);
      return;
    }

    if (!user) {
      console.warn("Tidak ada user login.");
      return;
    }

    // Cek apakah user sudah ada di tabel "users"
    const { data: existingUser, error: selectError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (selectError) {
      console.error("Error cek user di tabel users:", selectError.message);
      return;
    }

    if (!existingUser) {
      // Insert user baru dengan id = auth.uid()
      const { error: insertError } = await supabase.from("users").insert([
        {
          id: user.id,       // wajib sama dengan auth.uid()
          email: user.email, // simpan juga email
          name: user.email?.split("@")[0] || "Guest", // default name
        },
      ]);

      if (insertError) {
        console.error("Gagal insert user baru:", insertError.message);
      } else {
        console.log("User baru berhasil ditambahkan ke tabel users.");
      }
    } else {
      console.log("User sudah ada di tabel users, skip insert.");
    }
  } catch (err) {
    console.error("Unexpected error addUserIfNotExists:", err);
  }
};
