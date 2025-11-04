import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

// Supabase setup
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Types
interface AuthenticatedRequest extends Request {
  userId?: string;
}

interface UpdateUserPayload {
  id: string;
  name?: string;
  role?: string;
  access?: string[];
  password?: string;
}

interface DeleteUserPayload {
  id: string;
}

// Middleware: require manajemen role
const requireManajemen = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Missing Authorization header" });
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

    if (rowError) return res.status(500).json({ success: false, message: rowError.message });
    if (row?.role !== "manajemen") {
      return res.status(403).json({ success: false, message: "Access denied. Requires manajemen role" });
    }

    req.userId = userId;
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auth check failed";
    console.error("Auth middleware error:", err);
    res.status(500).json({ success: false, message });
  }
};

// Health check
app.get("/", (_req, res) => res.send("UpdateUser backend OK"));

// List users
app.get("/list-users", requireManajemen, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role, access");
    if (error) throw error;
    res.json({ users: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "List users failed";
    console.error("list-users error:", err);
    res.status(500).json({ success: false, message });
  }
});

// Update user
app.post("/update-user", requireManajemen, async (
  req: Request<{}, {}, UpdateUserPayload>,
  res: Response
) => {
  const { id, name, access, role, password } = req.body;
  if (!id) return res.status(400).json({ success: false, message: "id required" });

  try {
    const { error: updateError } = await supabase
      .from("users")
      .update({
        name,
        role,
        access: Array.isArray(access) ? access : [],
      })
      .eq("id", id);
    if (updateError) throw updateError;

    if (password && password.length > 0) {
      const { error: pwError } = await supabase.auth.admin.updateUserById(id, { password });
      if (pwError) throw pwError;
    }

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update user failed";
    console.error("update-user error:", err);
    res.status(400).json({ success: false, message });
  }
});

// Delete user
app.post("/delete-user", requireManajemen, async (
  req: Request<{}, {}, DeleteUserPayload>,
  res: Response
) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: "id required" });

  try {
    const { error: authError } = await supabase.auth.admin.deleteUser(id);
    if (authError) throw authError;

    const { error: dbError } = await supabase.from("users").delete().eq("id", id);
    if (dbError) throw dbError;

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete user failed";
    console.error("delete-user error:", err);
    res.status(400).json({ success: false, message });
  }
});

// Start server
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(PORT, () => console.log(`✅ UpdateUser backend running on port ${PORT}`));