import { lazy } from "react";
import menus from "../data/menus.json";

export type RouteItem = {
  path: string;
  access: string[];
  component: React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>>;
};

interface SubMenuItem {
  label: string;
  access: string;
  path: string;
  component: string;
}

interface MenuGroup {
  key: string;
  label: string;
  sub: SubMenuItem[];
}

export async function generateRoutes(userAccess: string[]): Promise<RouteItem[]> {
  const normalize = (s?: string) => s?.toLowerCase().trim();
  const accessSet = new Set(userAccess.map(normalize));
  const routes: RouteItem[] = [];

  console.log("📂 Raw menus.json loaded:", menus);

  for (const group of menus as MenuGroup[]) {
    for (const sub of group.sub) {
      console.log("📦 Sub-menu mentah:", sub);

      const path = typeof sub.path === "string" ? sub.path.trim() : "";
      const component = typeof sub.component === "string" ? sub.component.trim() : "";
      const accessKey = normalize(sub.access);

      if (!path || !path.startsWith("/")) {
        console.warn(`⚠️ Path invalid: "${sub.label}" → "${sub.path}"`);
        continue;
      }

      if (!component) {
        console.warn(`⚠️ Component kosong: "${sub.label}"`);
        continue;
      }

      if (!accessKey || !accessSet.has(accessKey)) {
        console.log(`🚫 Akses ditolak: "${sub.label}" → "${sub.access}"`);
        continue;
      }

      const Component = lazy(() => import(`../pages/${component}`));

      console.log(`✅ Route aktif:`, { path, access: sub.access, component });

      routes.push({
        path,
        access: [sub.access],
        component: Component,
      });
    }
  }

  console.log("✅ Final dynamicRoutes:", routes);
  return routes;
}