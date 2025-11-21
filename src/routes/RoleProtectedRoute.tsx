import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

interface RoleProtectedRouteProps {
  children: ReactNode;
  requiredAccess?: string | string[];
  skipAccessCheck?: boolean;
}

interface CustomUser {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  access: string[];
}

export default function RoleProtectedRoute({
  children,
  requiredAccess,
  skipAccessCheck = false,
}: RoleProtectedRouteProps) {
  const rawUser = localStorage.getItem("custom_user");

  let user: CustomUser | null = null;
  try {
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch (err) {
    console.warn("⚠️ Failed to parse user from localStorage:", err);
    return <Navigate to="/login" replace />;
  }

  const accessList =
    Array.isArray(user?.access)
      ? user.access
      : typeof user?.access === "string"
      ? [user.access]
      : [];

  if (!user || accessList.length === 0) {
    console.warn("🚫 No user or empty access list");
    return <Navigate to="/login" replace />;
  }

  if (skipAccessCheck) {
    // -- console.log("🔓 Access check skipped for this route");
    return <>{children}</>;
  }

  const normalize = (s: string) => s.toLowerCase().trim();
  const accessSet = new Set(accessList.map(normalize));
  const requiredArray = (Array.isArray(requiredAccess) ? requiredAccess : [requiredAccess])
  .filter((r): r is string => typeof r === "string");

  const hasAccess = requiredArray.some((r) => accessSet.has(normalize(r)));

  if (!hasAccess) {
    console.warn("⛔ Access denied. Redirecting to /login");
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}