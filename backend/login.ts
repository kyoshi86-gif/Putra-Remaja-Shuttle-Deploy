import "dotenv/config";
import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface LoginPayload {
  username: string;
  password: string;
}

app.post("/login", async (req: Request<{}, {}, LoginPayload>, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Name & password wajib diisi",
      });
    }

    const { data: user, error } = await supabase
      .from("custom_users")
      .select("id, name, password, role, access")
      .eq("name", name)
      .maybeSingle();

    if (error) {
      console.error("❌ Supabase error:", error.message);
      return res.status(500).json({ success: false, message: "Gagal mengambil data user" });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Password salah",
      });
    }

    res.json({
      success: true,
      user: safeUser,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login gagal";
    console.error("Login error:", err);
    res.status(500).json({ success: false, message });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));