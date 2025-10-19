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

export default function App() {
  const [dynamicRoutes, setDynamicRoutes] = useState<
    { path: string; access: string[]; component: React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>> }[]
  >([]);
  const [routesLoaded, setRoutesLoaded] = useState(false);
  const [userKey, setUserKey] = useState<string>("");

  useEffect(() => {
    const loadRoutes = async () => {
      const rawUser = localStorage.getItem("custom_user");
      const user = rawUser ? JSON.parse(rawUser) : null;
      const normalize = (s?: string) => s?.toLowerCase().trim();
      const accessSet = new Set(user?.access?.map(normalize) ?? []);
      const routes: typeof dynamicRoutes = [];

      for (const group of menus) {
        for (const sub of group.sub) {
          const path = typeof sub.path === "string" && sub.path.trim().startsWith("/") ? sub.path.trim() : "";
          const component = typeof sub.component === "string" ? sub.component.trim() : "";
          const accessKey = normalize(sub.access);

          if (!path || !component || !accessKey || !accessSet.has(accessKey)) {
            continue;
          }

          const Component = lazy(() => import(`./pages/${component}`));
          routes.push({ path, access: [sub.access], component: Component });
        }
      }

      setDynamicRoutes(routes);
      setRoutesLoaded(true);
      setUserKey(user?.id || Date.now().toString()); // force rerender on user change
    };

    loadRoutes();
  }, [localStorage.getItem("custom_user")]); // rerun when user changes

  return (
    <Router>
      <Suspense fallback={<div>Loading...</div>}>
        {routesLoaded ? (
          <Routes key={userKey}>
            {/* Login route */}
            <Route path="/login" element={<Login />} />

            {/* Protected layout routes */}
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />

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

              {/* Manual route */}
              <Route
                path="/edit-role"
                element={
                  <RoleProtectedRoute requiredAccess={["Konfigurasi"]}>
                    <EditRole />
                  </RoleProtectedRoute>
                }
              />
            </Route>
              
              {/* Route di luar layout */}
              <Route path="/cetak-surat-jalan" element={<CetakSuratJalan />} />
              <Route path="/cetak-uang-saku" element={<CetakUangSaku />} />

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        ) : (
          <div>Loading routes...</div>
        )}
      </Suspense>
    </Router>
  );
}