import "dotenv/config";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const username = "admin";      
  const name = "Administrator";
  const password = "admin123";   
  const role = "Administrator";
  const access = [
    "Keberangkatan",
    "Konfigurasi",
    "List User",
    "Role Akses",
    "Surat Jalan",
    "Uang Muka Sangu",
    "Premi Driver"
  ];

  // hash password
  const hashedPassword = bcrypt.hashSync(password, 10);

  // email dummy sesuai username
  const email = `${username}@example.com`;

  const { data, error } = await supabase
    .from("custom_users")
    .insert([{ username, name, password: hashedPassword, role, access, email }])
    .select()
    .single();

  if (error) {
    console.error("Gagal buat user:", error.message);
  } else {
    console.log("User berhasil dibuat:", data);
  }
}

main();
