// backend/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

// Supabase setup
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Extend Request to include userId
export interface AuthenticatedRequest extends Request {
  userId?: string;
}

// Middleware: hanya untuk role "manajemen"
export const requireManajemen = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const token = authHeader.split(" ")[1];
    const { data: getUserData, error: getUserError } = await supabase.auth.getUser(token);
    if (getUserError || !getUserData?.user) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    const userId = getUserData.user.id;
    const { data: row, error: rowError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (rowError) {
      return res.status(500).json({ success: false, message: rowError.message });
    }

    if (row?.role !== "manajemen") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    req.userId = userId;
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auth check failed";
    console.error("Auth middleware error:", err);
    res.status(500).json({ success: false, message });
  }
};