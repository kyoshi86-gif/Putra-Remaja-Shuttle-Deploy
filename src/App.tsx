import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import Layout from "./layouts/Layout";
import Login from "./pages/Login";
import RoleProtectedRoute from "./routes/RoleProtectedRoute";
import Dashboard from "./pages/Dashboard";
import EditRole from "./pages/EditRole";
import CetakSuratJalan from "./pages/CetakSuratJalan";
import CetakUangSaku from "./pages/CetakUangSaku";
import menus from "./data/menus.json";
import { resolvePageComponent } from "./utils/resolvePageComponent";

interface CustomUser {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  access: string[];
}

export default function App() {
  const [dynamicRoutes, setDynamicRoutes] = useState<
    { path: string; access: string[]; component: React.LazyExoticComponent<React.ComponentType<any>> }[]
  >([]);
  const [routesLoaded, setRoutesLoaded] = useState(false);
  const [userKey, setUserKey] = useState<string>("");
  const [user, setUser] = useState<CustomUser | null>(null);

  useEffect(() => {
    const rawUser = localStorage.getItem("custom_user");
    const parsedUser = rawUser ? JSON.parse(rawUser) : null;

    if (!parsedUser || !Array.isArray(parsedUser.access) || parsedUser.access.length === 0) {
      localStorage.removeItem("custom_user");
      setUser(null);
      setRoutesLoaded(true);
      return;
    }

    setUser(parsedUser);
    setUserKey(parsedUser.id || Date.now().toString());

    const normalize = (s?: string) => s?.toLowerCase().trim();
    const accessSet = new Set(parsedUser.access.map(normalize));
    const routes: typeof dynamicRoutes = [];

    for (const group of menus) {
      for (const sub of group.sub) {
        const path = sub.path?.trim();
        const rawComponent = sub.component?.trim();
        const accessKey = normalize(sub.access);
        const labelKey = normalize(sub.label);

        if (!path || !rawComponent) continue;
        if (!(accessSet.has(accessKey) || accessSet.has(labelKey))) continue;

        const Component = lazy(resolvePageComponent(rawComponent));
        routes.push({ path, access: [accessKey ?? "default"], component: Component });
      }
    }

    setDynamicRoutes(routes);
    setRoutesLoaded(true);
  }, []);

  if (!routesLoaded) {
    return <div>Loading routes...</div>;
  }

  return (
    <Router>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes key={userKey}>
          <Route path="/login" element={<Login />} />

          {user && (
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/dashboard"
                element={
                  <RoleProtectedRoute skipAccessCheck>
                    <Dashboard />
                  </RoleProtectedRoute>
                }
              />

              {dynamicRoutes.map(({ path, access, component: Component }) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <RoleProtectedRoute requiredAccess={access}>
                      <Component />
                    </RoleProtectedRoute>
                  }
                />
              ))}

              <Route
                path="/edit-role"
                element={
                  <RoleProtectedRoute requiredAccess={["Konfigurasi"]}>
                    <EditRole />
                  </RoleProtectedRoute>
                }
              />
            </Route>
          )}

          {user && (
            <>
              <Route
                path="/cetak-surat-jalan"
                element={
                  <RoleProtectedRoute requiredAccess={["Cetak"]}>
                    <CetakSuratJalan />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/cetak-uang-saku"
                element={
                  <RoleProtectedRoute requiredAccess={["Cetak"]}>
                    <CetakUangSaku />
                  </RoleProtectedRoute>
                }
              />
            </>
          )}

          <Route
            path="*"
            element={
              user ? (
                <RoleProtectedRoute requiredAccess={["Dashboard"]}>
                  <Navigate to="/dashboard" replace />
                </RoleProtectedRoute>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </Suspense>
    </Router>
  );
}