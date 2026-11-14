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
  FaBook,
  FaBox,
  FaShoppingCart,
  FaClipboardList,
  FaWarehouse,
  FaMoneyBillWave,
} from "react-icons/fa";

import { createPortal } from "react-dom";

/* ============================================================
   CONSTANT
============================================================ */

const SIDEBAR_COLLAPSED = 64;
const SIDEBAR_EXPANDED = 230;

/*
 * Delay kecil agar tooltip tidak hilang ketika mouse
 * sedang berpindah dari sidebar menuju tooltip.
 */
const TOOLTIP_CLOSE_DELAY = 250;

/* ============================================================
   TYPE
============================================================ */

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

/* ============================================================
   ICON MAPPING
============================================================ */

const ICONS: Record<
  string,
  React.ComponentType<{
    style?: React.CSSProperties;
  }>
> = {
  FaBus,
  FaUsers,
  FaChartBar,
  FaCogs,
  FaCashRegister,
  FaBook,
  FaBox,
  FaShoppingCart,
  FaClipboardList,
  FaWarehouse,
  FaMoneyBillWave,
};

const getIcon = (
  name?: string,
): React.ComponentType<{
  style?: React.CSSProperties;
}> => {
  if (!name) {
    return FaCogs;
  }

  const Icon = ICONS[name as keyof typeof ICONS];

  return Icon || FaCogs;
};

/* ============================================================
   SIDEBAR
============================================================ */

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

  const [tooltipPos, setTooltipPos] = useState({
    top: 0,
    left: 0,
  });

  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /*
   * Timeout tooltip disimpan menggunakan ref.
   * Jangan menggunakan state untuk timeout karena akan
   * menyebabkan render tambahan.
   */
  const tooltipCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ==========================================================
     COLORS
  ========================================================== */

  const COLORS = {
    /*
     * Brand red
     */
    red: "#D62828",
    redSoft: "#FFF3F3",

    /*
     * Main blue
     */
    blueDark: "#174A7E",
    blue: "#1E5FA8",
    bluePrimary: "#2877BD",

    /*
     * Active / hover blue
     */
    blueActive: "#DCEBFA",
    blueHover: "#EDF5FD",

    /*
     * Text
     */
    text: "#23415F",
    muted: "#6B7F93",

    /*
     * Border
     */
    border: "#D5E3F0",
    borderSoft: "#E7EFF6",

    white: "#FFFFFF",
  };

  /* ==========================================================
     SIDEBAR WIDTH
  ========================================================== */

  const sidebarWidth = isCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  /* ==========================================================
     TOOLTIP TIMER
  ========================================================== */

  const clearTooltipTimer = () => {
    if (tooltipCloseTimer.current) {
      clearTimeout(tooltipCloseTimer.current);

      tooltipCloseTimer.current = null;
    }
  };

  const closeTooltipWithDelay = () => {
    clearTooltipTimer();

    tooltipCloseTimer.current = setTimeout(() => {
      setHoveredMenu(null);

      tooltipCloseTimer.current = null;
    }, TOOLTIP_CLOSE_DELAY);
  };

  /* ==========================================================
     MENU TOGGLE
  ========================================================== */

  const toggleMenu = (key: string) => {
    setOpenMenu(openMenu === key ? null : key);
  };

  /* ==========================================================
     ACTIVE
  ========================================================== */

  const isActive = (path?: string) =>
    Boolean(path && location.pathname === path);

  const normalize = (value?: string) =>
    value ? value.toLowerCase().trim() : "";

  const accessSet = new Set(userAccess.map(normalize));

  /* ==========================================================
     FILTER SUBMENU
  ========================================================== */

  const filterSubmenu = (menu: Menu): SubMenu[] =>
    (menu.sub ?? []).filter((sub) => accessSet.has(normalize(sub.access)));

  /* ==========================================================
     FILTER MENU
  ========================================================== */

  const filteredMenus: Menu[] = menus
    .map((menu) => {
      const sub = filterSubmenu(menu);

      const menuHasAccess = accessSet.has(normalize(menu.access ?? menu.label));

      return {
        ...menu,
        sub,
        show: sub.length > 0 || menuHasAccess,
      };
    })
    .filter(
      (menu) =>
        (
          menu as Menu & {
            show?: boolean;
          }
        ).show,
    );

  /* ==========================================================
     FETCH MENU
  ========================================================== */

  useEffect(() => {
    const fetchMenus = async () => {
      try {
        const { data, error } = await supabase
          .from("menus")
          .select("*")
          .order("order", {
            ascending: true,
          });

        if (error) {
          console.error("Gagal ambil menu:", error.message);

          return;
        }

        if (!data) {
          return;
        }

        const typedData = data as unknown as Menu[];

        const rootMenus = typedData.filter((menu) => !menu.parent);

        const subMenus = typedData.filter((menu) => menu.parent);

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

    const handleRefreshSidebar = () => {
      fetchMenus();
    };

    window.addEventListener("refreshSidebar", handleRefreshSidebar);

    return () => {
      window.removeEventListener("refreshSidebar", handleRefreshSidebar);

      clearTooltipTimer();
    };
  }, []);

  /* ==========================================================
     TOOLTIP POSITION
  ========================================================== */

  useEffect(() => {
    if (hoveredMenu && menuRefs.current[hoveredMenu]) {
      const rect = menuRefs.current[hoveredMenu]!.getBoundingClientRect();

      /*
       * Tooltip ditempel langsung ke ujung sidebar.
       *
       * Sebelumnya:
       * left: rect.right + 8
       *
       * Itu membuat gap 8px sehingga mouse harus
       * melewati area kosong dan tooltip langsung hilang.
       *
       * Sekarang:
       * left: rect.right
       */
      setTooltipPos({
        top: rect.top,
        left: rect.right,
      });
    }
  }, [hoveredMenu, isCollapsed]);

  /* ==========================================================
     RESET TOOLTIP KETIKA EXPAND
  ========================================================== */

  useEffect(() => {
    if (!isCollapsed) {
      clearTooltipTimer();
      setHoveredMenu(null);
    }
  }, [isCollapsed]);

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div
      style={{
        width: `${sidebarWidth}px`,

        background: COLORS.white,

        color: COLORS.text,

        height: "100vh",

        transition: "width 0.3s ease",

        position: "fixed",

        left: 0,
        top: 0,

        overflowY: "auto",

        overflowX: "hidden",

        zIndex: 1200,

        borderRight: `1px solid ${COLORS.border}`,

        borderTop: `4px solid ${COLORS.red}`,

        boxShadow: "2px 0 14px rgba(23, 74, 126, 0.07)",
      }}
    >
      {/* ======================================================
          BRAND
      ====================================================== */}

      <div
        style={{
          height: isCollapsed ? "64px" : "132px",

          display: "flex",

          flexDirection: "column",

          alignItems: "center",

          justifyContent: "center",

          position: "relative",

          borderBottom: `1px solid ${COLORS.border}`,

          padding: isCollapsed ? "0" : "10px 12px",
        }}
      >
        {!isCollapsed ? (
          <>
            <img
              src="/logo.png"
              alt="Butter Club Bakery"
              style={{
                width: "175px",

                maxWidth: "100%",

                height: "auto",

                maxHeight: "82px",

                objectFit: "contain",
              }}
            />

            <div
              style={{
                display: "flex",

                alignItems: "center",

                gap: "7px",

                marginTop: "5px",

                width: "100%",
              }}
            >
              <span
                style={{
                  height: "1px",

                  flex: 1,

                  background: "#8AB9E0",
                }}
              />

              <span
                style={{
                  width: "6px",

                  height: "6px",

                  borderRadius: "50%",

                  background: COLORS.red,
                }}
              />

              <span
                style={{
                  height: "1px",

                  flex: 1,

                  background: "#8AB9E0",
                }}
              />
            </div>
          </>
        ) : (
          <div
            style={{
              width: "36px",

              height: "36px",

              borderRadius: "50%",

              display: "flex",

              alignItems: "center",

              justifyContent: "center",

              background: COLORS.redSoft,

              color: COLORS.red,

              fontSize: "12px",

              fontWeight: 800,

              letterSpacing: "0.5px",

              border: `1px solid #F2C2C2`,
            }}
          >
            PR
          </div>
        )}
      </div>

      {/* ======================================================
          TOGGLE
      ====================================================== */}

      <div
        style={{
          height: "42px",

          display: "flex",

          alignItems: "center",

          justifyContent: isCollapsed ? "center" : "flex-end",

          padding: isCollapsed ? "0" : "0 14px",

          borderBottom: `1px solid ${COLORS.borderSoft}`,
        }}
      >
        <FaBars
          style={{
            cursor: "pointer",

            fontSize: "17px",

            color: COLORS.blue,

            transition: "transform 0.2s",
          }}

          onClick={() => setIsCollapsed(!isCollapsed)}
        />
      </div>

      {/* ======================================================
          MENU LIST
      ====================================================== */}

      <div
        style={{
          padding: "8px 7px 20px",
        }}
      >
        {filteredMenus.map((menu, menuIdx) => {
          const menuKey = menu.key || menu.label || `menu-${menuIdx}`;

          const Icon = getIcon(menu.icon);

          const isMenuActive =
            menu.sub.some((sub) => isActive(sub.path)) || isActive(menu.path);

          const isOpen = openMenu === menuKey;

          return (
            <div
              key={`menu-${menuKey}`}
              style={{
                marginBottom: "3px",
              }}
            >
              {/* =================================================
                    MAIN MENU
                ================================================= */}

              <div
                ref={(el) => {
                  menuRefs.current[menuKey] = el;
                }}

                onClick={() => {
                  if (menu.sub && menu.sub.length > 0) {
                    toggleMenu(menuKey);

                    return;
                  }

                  if (menu.path && menu.path.trim() !== "") {
                    navigate(menu.path);
                  } else {
                    console.warn(`Menu "${menu.label}" tidak punya path.`);
                  }
                }}

                onMouseEnter={() => {
                  clearTooltipTimer();

                  if (isCollapsed && menu.sub.length > 0) {
                    setHoveredMenu(menuKey);
                  }
                }}

                onMouseLeave={() => {
                  if (isCollapsed && menu.sub.length > 0) {
                    closeTooltipWithDelay();
                  }
                }}

                style={{
                  display: "flex",

                  alignItems: "center",

                  justifyContent: isCollapsed ? "center" : "space-between",

                  minHeight: "44px",

                  padding: isCollapsed ? "8px 0" : "8px 13px",

                  cursor: "pointer",

                  color: isMenuActive ? COLORS.blueDark : "#315B82",

                  background: isMenuActive ? COLORS.blueActive : "transparent",

                  borderRadius: "9px",

                  borderLeft: isMenuActive
                    ? `3px solid ${COLORS.red}`
                    : "3px solid transparent",

                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",

                    alignItems: "center",

                    gap: isCollapsed ? "0" : "12px",

                    justifyContent: isCollapsed ? "center" : "flex-start",

                    width: "100%",
                  }}
                >
                  <Icon
                    style={{
                      fontSize: "18px",

                      color: isMenuActive ? COLORS.blue : "#467CA8",

                      flexShrink: 0,
                    }}
                  />

                  {!isCollapsed && (
                    <span
                      style={{
                        fontSize: "13px",

                        fontWeight: isMenuActive ? 700 : 500,

                        whiteSpace: "nowrap",
                      }}
                    >
                      {menu.label}
                    </span>
                  )}
                </div>

                {!isCollapsed && menu.sub.length > 0 && (
                  <FaChevronDown
                    style={{
                      fontSize: "11px",

                      color: COLORS.blue,

                      transition: "transform 0.25s",

                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                )}
              </div>

              {/* =================================================
                    COLLAPSED TOOLTIP
                ================================================= */}

              {isCollapsed &&
                hoveredMenu === menuKey &&
                menu.sub.length > 0 &&
                createPortal(
                  <div
                    style={{
                      position: "fixed",

                      /*
                       * TEPAT di ujung sidebar.
                       * Tidak ada gap.
                       */
                      top: tooltipPos.top,

                      left: tooltipPos.left,

                      minWidth: "205px",

                      background: COLORS.white,

                      border: `1px solid ${COLORS.border}`,

                      borderRadius: "0 10px 10px 0",

                      boxShadow: "0 10px 28px rgba(23, 74, 126, 0.18)",

                      zIndex: 99999,

                      padding: "5px",

                      /*
                       * Pastikan seluruh area tooltip
                       * bisa menerima mouse.
                       */
                      pointerEvents: "auto",
                    }}

                    onMouseEnter={() => {
                      clearTooltipTimer();

                      setHoveredMenu(menuKey);
                    }}

                    onMouseLeave={() => {
                      closeTooltipWithDelay();
                    }}
                  >
                    {/* HEADER TOOLTIP */}

                    <div
                      style={{
                        fontWeight: 700,

                        padding: "10px 12px",

                        borderBottom: `1px solid ${COLORS.border}`,

                        color: COLORS.blueDark,

                        background: COLORS.blueActive,

                        borderRadius: "6px",

                        fontSize: "12px",
                      }}
                    >
                      {menu.label}
                    </div>

                    {/* SUBMENU */}

                    <ul
                      style={{
                        listStyle: "none",

                        margin: 0,

                        padding: "4px 0",
                      }}
                    >
                      {menu.sub.map((sub, idx) => (
                        <li key={`tooltip-${menuKey}-${sub.label}-${idx}`}>
                          <Link
                            to={
                              sub.path && sub.path.trim() !== ""
                                ? sub.path
                                : "#"
                            }

                            style={{
                              display: "block",

                              padding: "9px 12px",

                              color: isActive(sub.path)
                                ? COLORS.red
                                : COLORS.text,

                              fontWeight: isActive(sub.path) ? 700 : 500,

                              textDecoration: "none",

                              borderRadius: "7px",

                              fontSize: "12px",

                              transition: "all 0.15s ease",
                            }}

                            onMouseEnter={(e) => {
                              clearTooltipTimer();

                              setHoveredMenu(menuKey);

                              if (!isActive(sub.path)) {
                                e.currentTarget.style.background =
                                  COLORS.blueHover;

                                e.currentTarget.style.color = COLORS.blueDark;
                              }
                            }}

                            onMouseLeave={(e) => {
                              if (!isActive(sub.path)) {
                                e.currentTarget.style.background =
                                  "transparent";

                                e.currentTarget.style.color = COLORS.text;
                              }
                            }}

                            onClick={() => {
                              clearTooltipTimer();

                              setHoveredMenu(null);
                            }}
                          >
                            {sub.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>,

                  document.body,
                )}

              {/* =================================================
                    EXPANDED SUBMENU
                ================================================= */}

              {!isCollapsed && isOpen && menu.sub.length > 0 && (
                <ul
                  style={{
                    listStyle: "none",

                    margin: "3px 0 5px",

                    padding: "3px 8px 3px 38px",

                    borderLeft: `1px solid ${COLORS.border}`,
                  }}
                >
                  {menu.sub.map((sub, idx) => (
                    <li
                      key={`sidebar-${menuKey}-${sub.label}-${idx}`}
                      style={{
                        marginBottom: "2px",
                      }}
                    >
                      {sub.path ? (
                        <Link
                          to={sub.path}

                          style={{
                            display: "block",

                            padding: "7px 10px",

                            borderRadius: "7px",

                            color: isActive(sub.path)
                              ? COLORS.blueDark
                              : "#60788F",

                            background: isActive(sub.path)
                              ? COLORS.blueActive
                              : "transparent",

                            fontSize: "12px",

                            fontWeight: isActive(sub.path) ? 700 : 500,

                            textDecoration: "none",

                            transition: "all 0.2s",
                          }}

                          onMouseEnter={(e) => {
                            if (!isActive(sub.path)) {
                              e.currentTarget.style.background =
                                COLORS.blueHover;

                              e.currentTarget.style.color = COLORS.blueDark;
                            }
                          }}

                          onMouseLeave={(e) => {
                            if (!isActive(sub.path)) {
                              e.currentTarget.style.background = "transparent";

                              e.currentTarget.style.color = "#60788F";
                            }
                          }}
                        >
                          {sub.label}
                        </Link>
                      ) : (
                        <div
                          style={{
                            display: "block",

                            padding: "7px 10px",

                            color: "#9AAABA",

                            cursor: "default",

                            fontSize: "12px",
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
