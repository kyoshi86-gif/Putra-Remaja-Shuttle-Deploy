import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

app.post("/login", async (req, res) => {
  const { name, password } = req.body;

  const { data: user, error } = await supabase
    .from("custom_users")
    .select("id, name, password, role, access, entity_id")
    .eq("name", name)
    .maybeSingle();

  if (error)
    return res.status(500).json({ error: "Gagal mengambil data user" });
  if (!user) return res.status(401).json({ error: "Username tidak ditemukan" });

  const passwordMatches = bcrypt.compareSync(password, user.password);
  if (!passwordMatches)
    return res.status(401).json({ error: "Password salah" });

  const token = jwt.sign(
    { sub: user.id, id: user.id, role: user.role, access: user.access },
    process.env.JWT_SECRET || "secret_key",
    { expiresIn: "1h" },
  );

  res.json({ ...user, token });
});

app.listen(3001, () =>
  console.log("✅ Login API running on http://localhost:3001"),
);
