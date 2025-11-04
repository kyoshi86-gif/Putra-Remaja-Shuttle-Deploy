import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaBars,
  FaChevronDown,
  FaBus,
  FaUsers,
  FaChartBar,
  FaCogs,
  FaCashRegister,
} from "react-icons/fa";

// ======== 🔹 Tipe Menu ========
interface SubMenu {
  id: string;
  label: string;
  path?: string;
  access?: string;
  parent?: string;
  order?: number;
}

interface Menu {
  id: string;
  label: string;
  path?: string;
  access?: string;
  parent?: string | null;
  order?: number;
  icon?: string;
  key?: string;
  sub: SubMenu[];
}

// ======== 🔹 Ikon Mapping ========
const ICONS: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  FaBus,
  FaUsers,
  FaChartBar,
  FaCogs,
  FaCashRegister
};

const getIcon = (name?: string): React.ComponentType<{ style?: React.CSSProperties }> => {
  if (!name) return FaCogs;
  const Icon = ICONS[name as keyof typeof ICONS];
  return Icon || FaCogs;
};

// ======== 🔹 Sidebar Component ========
export default function Sidebar({
  isCollapsed,
  setIsCollapsed,
  userAccess = [],
}: {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
  userAccess?: string[];
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ===== Toggle menu utama =====
  const toggleMenu = (key: string) => setOpenMenu(openMenu === key ? null : key);
  const isActive = (path?: string) => path && location.pathname === path;
  const normalize = (s?: string) => (s ? s.toLowerCase().trim() : "");
  const accessSet = new Set(userAccess.map(normalize));

  // ===== Filter submenu berdasar akses =====
  const filterSubmenu = (menu: Menu): SubMenu[] =>
    (menu.sub ?? []).filter((sub) => accessSet.has(normalize(sub.access)));

  const filteredMenus: Menu[] = menus
    .map((menu) => {
      const sub = filterSubmenu(menu);
      const menuHasAccess = accessSet.has(normalize(menu.access ?? menu.label));
      return { ...menu, sub, show: sub.length > 0 || menuHasAccess };
    })
    .filter((m) => (m as Menu & { show?: boolean }).show);

  // ===== Ambil menu dari Supabase =====
  useEffect(() => {
    const fetchMenus = async () => {
      try {
        const { data, error } = await supabase
          .from("menus")
          .select("*")
          .order("order", { ascending: true });

        if (error) {
          console.error("Gagal ambil menu:", error.message);
          return;
        }

        if (!data) return;

        // Cast hasil ke tipe Menu
        const typedData = data as unknown as Menu[];

        const rootMenus = typedData.filter((m) => !m.parent);
        const subMenus = typedData.filter((m) => m.parent);

        const menusTree: Menu[] = rootMenus.map((menu) => ({
        ...menu,
        sub: subMenus
          .filter((sub) => sub.parent === menu.id)
          .map((sub) => ({
            id: sub.id,
            label: sub.label,
            path: sub.path,
            access: sub.access,
            parent: sub.parent ?? "",
            order: sub.order,
          })),
      }));
      
        setMenus(menusTree);
      } catch (err) {
        console.error("Error ambil menu:", err);
      }
    };

    fetchMenus();

    // Auto-refresh ketika event "refreshSidebar" dikirim dari window
    const handleRefreshSidebar = () => {
      console.log("🔄 Refresh Sidebar karena role diubah");
      fetchMenus();
    };

    window.addEventListener("refreshSidebar", handleRefreshSidebar);
    return () => window.removeEventListener("refreshSidebar", handleRefreshSidebar);
  }, []);

  // ===== Tooltip posisi =====
  useEffect(() => {
    if (hoveredMenu && menuRefs.current[hoveredMenu]) {
      const rect = menuRefs.current[hoveredMenu]!.getBoundingClientRect();
      setTooltipPos({ top: rect.top, left: rect.right });
    }
  }, [hoveredMenu, isCollapsed]);

  // ===== Render utama =====
  return (
    <div
      style={{
        width: isCollapsed ? "50px" : "200px",
        background: "#2c3e50",
        color: "white",
        height: "100vh",
        transition: "width 0.3s",
        position: "fixed",
        left: 0,
        top: 0,
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "space-between",
          padding: isCollapsed ? "0 0" : "0 15px",
          height: "40px",
          borderBottom: "1px solid rgba(255,255,255,0.2)",
        }}
      >
        {!isCollapsed && (
          <h3 style={{ margin: 0, fontSize: "16px", letterSpacing: "0.5px" }}>
            MENU NAVIGASI
          </h3>
        )}
        <FaBars
          style={{
            cursor: "pointer",
            fontSize: "16px",
            marginTop: isCollapsed ? "0" : "2px",
          }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        />
      </div>

      {/* Menu */}
      <div className="mt-2">
        {filteredMenus.map((menu, menuIdx) => {
          const menuKey = menu.key || menu.label || `menu-${menuIdx}`;
          const Icon = getIcon(menu.icon);
          const isMenuActive = menu.sub.some((sub) => isActive(sub.path));

          return (
            <div key={`menu-${menuKey}`}>
              <div
                ref={(el) => (menuRefs.current[menuKey] = el)}
                onClick={() => {
                  if (menu.sub && menu.sub.length > 0) {
                    toggleMenu(menuKey);
                    return;
                  }

                  if (menu.path && menu.path.trim() !== "") {
                    navigate(menu.path);
                  } else {
                    console.warn(`Menu "${menu.label}" tidak punya path — tidak navigate.`);
                  }
                }}
                onMouseEnter={() => setHoveredMenu(menuKey)}
                onMouseLeave={() => setHoveredMenu(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isCollapsed ? "center" : "space-between",
                  padding: isCollapsed ? "12px 0" : "8px 16px",
                  cursor: "pointer",
                  background: isMenuActive ? "#34495e" : "transparent",
                  transition: "all 0.3s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: isCollapsed ? "0" : "10px",
                    justifyContent: isCollapsed ? "center" : "flex-start",
                    width: "100%",
                  }}
                >
                  <Icon style={{ fontSize: "18px" }} />
                  {!isCollapsed && <span>{menu.label}</span>}
                </div>
                {!isCollapsed && menu.sub.length > 0 && (
                  <FaChevronDown
                    style={{
                      transition: "transform 0.3s",
                      transform: openMenu === menuKey ? "rotate(180deg)" : "rotate(0)",
                    }}
                  />
                )}
              </div>

              {/* Tooltip collapsed */}
              {isCollapsed && hoveredMenu === menuKey && menu.sub.length > 0 && (
                <div
                  style={{
                    position: "fixed",
                    top: tooltipPos.top,
                    left: tooltipPos.left,
                    background: "#0068EF",
                    padding: "2px 0",
                    borderRadius: "6px",
                    zIndex: 9999,
                    minWidth: "180px",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                    fontSize: "12px",
                    lineHeight: "1.4",
                  }}
                  onMouseEnter={() => setHoveredMenu(menuKey)}
                  onMouseLeave={() => setHoveredMenu(null)}
                >
                  <div
                    style={{
                      fontWeight: "bold",
                      padding: "8px 12px",
                      borderBottom: "1px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    {menu.label}
                  </div>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {menu.sub.map((sub, idx) => (
                      <li key={`tooltip-${menuKey}-${sub.label}-${idx}`}>
                        <Link
                          to={sub.path && sub.path.trim() !== "" ? sub.path : "#"}
                          style={{
                            display: "block",
                            padding: "8px 12px",
                            color: isActive(sub.path) ? "#1abc9c" : "white",
                            textDecoration: "none",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#0092F5")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                          onClick={() => setHoveredMenu(null)}
                        >
                          {sub.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Submenu Expanded */}
              {!isCollapsed && openMenu === menuKey && menu.sub.length > 0 && (
                <ul style={{ paddingLeft: "3rem", marginTop: "-2px" }}>
                  {menu.sub.map((sub, idx) => (
                    <li key={`sidebar-${menuKey}-${sub.label}-${idx}`}>
                      {sub.path ? (
                        <Link
                          to={sub.path || "#"}
                          className={`block px-3 py-1.5 rounded text-sm transition ${
                            isActive(sub.path)
                              ? "bg-green-600 text-white"
                              : "text-gray-300 hover:bg-gray-700 hover:text-white"
                          }`}
                        >
                          {sub.label}
                        </Link>
                      ) : (
                        <div
                          style={{
                            display: "block",
                            padding: "4px 12px",
                            color: "#9ca3af",
                            cursor: "default",
                            fontSize: "0.875rem",
                          }}
                        >
                          {sub.label}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
