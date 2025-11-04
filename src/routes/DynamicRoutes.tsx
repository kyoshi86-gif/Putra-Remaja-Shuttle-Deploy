import { lazy } from "react";
import type { ComponentType } from "react";
import { getMenus } from "../lib/getMenus";

export interface RouteItem {
  path: string;
  access: string[]; // ✅ ubah dari string ke array
  component: ComponentType;
}

export async function generateRoutes(userAccess: string[]): Promise<RouteItem[]> {
  const normalize = (s?: string) => s?.toLowerCase().trim();
  const accessSet = new Set(userAccess.map(normalize));
  const menus = await getMenus();

  const filtered: RouteItem[] = [];

  for (const menu of menus) {
    const menuAccess = normalize(menu.access ?? menu.label ?? "default");
    const menuHasAccess = accessSet.has(menuAccess);

    if (menu.path && menu.component && menuHasAccess) {
      try {
        const Component = lazy(() => import(`../pages/${menu.component}`));
        filtered.push({
          path: menu.path,
          access: [menuAccess ?? "default"], // ✅ fix
          component: Component,
        });
       
      } catch (err) {
        console.warn(`❌ Gagal load komponen menu: ${menu.component}`, err);
      }
    }

    for (const sub of menu.sub ?? []) {
      const subAccess = normalize(sub.access ?? sub.label ?? "default");
      const subHasAccess = accessSet.has(subAccess);

      if (!sub.path || !sub.component) {
        console.warn(`❌ Sub-menu "${sub.label}" tidak lengkap:`, sub);
        continue;
      }

      if (subHasAccess) {
        try {
          const Component = lazy(() => import(`../pages/${sub.component}`));
          filtered.push({
            path: menu.path?.trim() || "",
            access: [menuAccess ?? "default"], // ✅ fix
            component: Component,
          });
          
        } catch (err) {
          console.warn(`❌ Gagal load komponen sub-menu: ${sub.component}`, err);
        }
      }
    }
  }

  return filtered;
}