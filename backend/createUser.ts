import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { supabase } from "../lib/supabaseClient"; // pastikan path sesuai

interface LoginRequestBody {
  username: string;
  password: string;
}

app.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password }: LoginRequestBody = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "username & password required",
      });
    }

    const { data, error } = await supabase
      .from("custom_users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const isValid = bcrypt.compareSync(password, data.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Password incorrect",
      });
    }

    res.json({ success: true, user: data });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    res.status(500).json({ success: false, message: errorMessage });
  }
});