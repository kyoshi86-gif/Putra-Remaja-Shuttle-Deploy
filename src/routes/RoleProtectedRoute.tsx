import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

interface RoleProtectedRouteProps {
  children: ReactNode;
  requiredAccess: string | string[];
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
}: RoleProtectedRouteProps) {
  const rawUser = localStorage.getItem("custom_user");

  let user: CustomUser | null = null;
  try {
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return <Navigate to="/login" replace />;
  }

  const accessList =
    Array.isArray(user?.access)
      ? user.access
      : typeof user?.access === "string"
      ? [user.access]
      : [];

  if (!user || accessList.length === 0) {
    return <Navigate to="/login" replace />;
  }

  const normalize = (s?: string) => (s ? s.toLowerCase().trim() : "");
  const accessSet = new Set(accessList.map(normalize));
  const requiredArray = Array.isArray(requiredAccess)
    ? requiredAccess
    : [requiredAccess];

  const hasAccess = requiredArray.some((r) => accessSet.has(normalize(r)));

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}