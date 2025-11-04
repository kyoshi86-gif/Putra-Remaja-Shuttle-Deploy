import { supabase } from "./supabaseClient";

export interface MenuItem {
  id: string;
  label: string;
  path?: string | null;
  access?: string;
  icon?: string;
  order_index?: number;
  parent?: string | null;
  parent_id?: string | null;
  key?: string;
  component?: string | null; // ✅ tambahkan ini
  sub?: MenuItem[];
}

type MenuMapItem = Required<MenuItem> & {
  sub: MenuItem[];
  component: string | null;
};

export async function getMenus(): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menus")
    .select("*")
    .order("order_index", { ascending: true });

  if (error) {
    console.error("❌ Gagal ambil menus:", error);
    return [];
  }

  if (!data || !Array.isArray(data)) return [];

  const map = new Map<string, MenuMapItem>();
  const roots: MenuItem[] = [];

  data.forEach((item) => {
    if (!item.id || !item.label) {
      console.warn("⚠️ Lewatkan menu tidak lengkap:", item);
      return;
    }

    const parentKey = item.parent_id || item.parent || null;
    const cleanPath =
      item.path && item.path.trim() !== "" ? item.path.trim() : null;

    map.set(item.id, {
      id: item.id,
      label: item.label,
      path: cleanPath,
      component: item.component ?? null,
      access: item.access ?? item.label,
      icon: item.icon ?? "FaCogs",
      order_index: item.order_index ?? 0,
      parent: parentKey,
      parent_id: parentKey,
      key: item.label.toLowerCase().replace(/\s+/g, "-"),
      sub: [] as MenuItem[],
    });
  });

  map.forEach((item) => {
    if (item.parent && map.has(item.parent)) {
      map.get(item.parent)!.sub.push(item);
    } else {
      roots.push(item);
    }
  });

  return roots;
}