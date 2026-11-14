import { useState, useRef, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabaseClient";
import { getUserAccess } from "../lib/access";
import { getMenus } from "../lib/getMenus";
import { useAutoLogout } from "../utils/useAutoLogout";
import bcrypt from "bcryptjs";

const SIDEBAR_COLLAPSED = 64;
const SIDEBAR_EXPANDED = 230;

export default function Layout() {
  useAutoLogout();

  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [username, setUsername] = useState("Admin User");
  const [userAccess, setUserAccess] = useState<string[] | null>(null);
  const [menuTitles, setMenuTitles] = useState<Record<string, string>>({});
  const [breadcrumbMap, setBreadcrumbMap] = useState<
    Record<string, { label: string; path: string }[]>
  >({});

  const profileRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const isPrintRoute = location.pathname.startsWith("/cetak");

  /*
   * Dashboard utama dibuat sebagai landing page.
   * Karena dashboard sudah memiliki desain sendiri,
   * page header Layout tidak perlu ditampilkan.
   */
  const isDashboard =
    location.pathname === "/" || location.pathname === "/dashboard";

  const sidebarWidth = isCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  const handleLogout = () => {
    localStorage.removeItem("custom_user");
    navigate("/login");
  };

  const getCurrentCustomUser = async () => {
    try {
      const raw = localStorage.getItem("custom_user");

      if (raw) {
        const parsed = JSON.parse(raw);

        if (parsed?.id) {
          return parsed;
        }
      }

      const { data: authData } = await supabase.auth.getUser();

      const email = authData?.user?.email;

      if (email) {
        const { data, error } = await supabase
          .from("custom_users")
          .select("id,name,email,role")
          .eq("email", email)
          .single();

        if (!error && data) {
          return data;
        }
      }
    } catch (err) {
      console.warn("❌ Gagal ambil user:", err);
    }

    return null;
  };

  const handleChangePassword = async () => {
    const newPassword = prompt("Masukkan password baru (minimal 6 karakter):");

    if (!newPassword || newPassword.length < 6) {
      return alert("Password minimal 6 karakter.");
    }

    const confirm = prompt("Konfirmasi password baru:");

    if (confirm !== newPassword) {
      return alert("Konfirmasi password tidak cocok.");
    }

    const current = await getCurrentCustomUser();

    if (!current?.id) {
      return alert("Tidak ada user yang login.");
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    const { error } = await supabase
      .from("custom_users")
      .update({
        password: hashedPassword,
      })
      .eq("id", current.id);

    if (error) {
      alert("Gagal mengubah password: " + error.message);
    } else {
      alert("Password berhasil diubah!");
    }
  };

  /*
   * ============================================================
   * INIT USER + MENU
   * ============================================================
   */
  useEffect(() => {
    const init = async () => {
      const user = await getCurrentCustomUser();

      if (user) {
        setUsername(user.name || user.email || "Admin User");

        const access = user.role ? await getUserAccess(user.role) : [];

        setUserAccess(access || []);
      } else {
        setUsername("Admin User");
        setUserAccess([]);
      }

      const menus = await getMenus();

      const uniquePaths = new Set<string>();

      const titles: Record<string, string> = {};

      const hierarchyMap: Record<string, { label: string; path: string }[]> =
        {};

      for (const menu of menus) {
        if (menu.path && menu.label && !uniquePaths.has(menu.path)) {
          titles[menu.path] = menu.label;

          uniquePaths.add(menu.path);
        }

        for (const sub of menu.sub ?? []) {
          if (sub.path && sub.label && !uniquePaths.has(sub.path)) {
            titles[sub.path] = sub.label;

            hierarchyMap[sub.path] = [
              {
                label: menu.label,
                path: menu.path || "/",
              },
              {
                label: sub.label,
                path: sub.path,
              },
            ];

            uniquePaths.add(sub.path);
          }
        }
      }

      setMenuTitles(titles);
      setBreadcrumbMap(hierarchyMap);
    };

    init();

    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const currentTitle = menuTitles[location.pathname] || "Dashboard";

  /*
   * ============================================================
   * TABLE HORIZONTAL SCROLL
   * ============================================================
   */
  useEffect(() => {
    const wrapWideTables = () => {
      const tables = document.querySelectorAll("table");

      tables.forEach((table) => {
        const parent = table.parentElement;

        const alreadyWrapped = parent?.classList.contains(
          "table-scroll-wrapper",
        );

        if (!alreadyWrapped) {
          const wrapper = document.createElement("div");

          wrapper.className = "table-scroll-wrapper";

          wrapper.style.overflowX = "auto";
          wrapper.style.width = "100%";
          wrapper.style.maxWidth = "100vw";
          wrapper.style.marginBottom = "16px";

          parent?.insertBefore(wrapper, table);

          wrapper.appendChild(table);
        }
      });
    };

    wrapWideTables();

    const observer = new MutationObserver(wrapWideTables);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */
  return (
    <div
      className="layout-wrapper"
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#f6fcf5",
        overflowX: "auto",
        overflowY: "auto",
      }}
    >
      {/* ======================================================
          SIDEBAR
      ====================================================== */}
      {!isPrintRoute && userAccess !== null ? (
        <Sidebar
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          userAccess={userAccess}
        />
      ) : !isPrintRoute ? (
        <div
          style={{
            width: isCollapsed
              ? `${SIDEBAR_COLLAPSED}px`
              : `${SIDEBAR_EXPANDED}px`,
            background: "#ffffff",
            color: "#174a7e",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "13px",
            borderRight: "1px solid #dbe7f3",
            borderTop: "4px solid #d62828",
          }}
        >
          Loading menu...
        </div>
      ) : null}

      {/* ======================================================
          CONTENT AREA
      ====================================================== */}
      <div
        style={{
          paddingTop: isPrintRoute ? "0px" : "0px",
          width: `calc(100vw - ${sidebarWidth}px)`,
          minWidth: `calc(100vw - ${sidebarWidth}px)`,
          marginLeft: `${sidebarWidth}px`,
          transition:
            "width 0.3s ease, min-width 0.3s ease, margin-left 0.3s ease",
          boxSizing: "border-box",
        }}
      >
        {/* ====================================================
            TOP HEADER
        ==================================================== */}
        {!isPrintRoute && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: `${sidebarWidth}px`,
              right: 0,
              height: "68px",

              /*
               * Dashboard menggunakan background foto,
               * sehingga header dibuat sedikit transparan.
               */
              backgroundColor: isDashboard
                ? "rgba(255, 255, 255, 0.78)"
                : "#ffffff",

              backdropFilter: "blur(8px)",

              borderBottom: "1px solid #eddbf3",

              borderTop: "4px solid #d62828",

              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",

              padding: "0 20px",

              zIndex: 1000,

              transition: "left 0.3s ease",
              boxSizing: "border-box",
            }}
          >
            {/* LEFT */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              {!isDashboard && (
                <img
                  src="/logo.png"
                  alt="Butter Club Bakery"
                  style={{
                    height: "32px",
                    width: "auto",
                    objectFit: "contain",
                  }}
                />
              )}
            </div>

            {/* USER */}
            <div
              ref={profileRef}
              style={{
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "9px",
                color: "#23415f",
                userSelect: "none",
              }}
              onClick={() => setShowMenu(!showMenu)}
            >
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                  username,
                )}&background=e7f2ff&color=174a7e&bold=true`}
                alt="Profil"
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  border: "1px solid #d4c9f2",
                }}
              />

              <span
                style={{
                  fontWeight: 600,
                  fontSize: "12px",
                }}
              >
                {username}
              </span>

              <span
                style={{
                  color: "#d62828",
                  fontSize: "10px",
                }}
              >
                ▼
              </span>
            </div>

            {/* PROFILE MENU */}
            {showMenu && (
              <div
                ref={menuRef}
                style={{
                  position: "absolute",
                  top: "48px",
                  right: "16px",
                  minWidth: "170px",

                  background: "#ffffff",
                  color: "#405f23",

                  border: "1px solid #dbe7f3",

                  boxShadow: "0 8px 25px rgba(31, 78, 121, 0.15)",

                  borderRadius: "8px",

                  overflow: "hidden",
                  zIndex: 1100,
                }}
              >
                <div
                  onClick={handleChangePassword}
                  style={{
                    padding: "11px 16px",
                    cursor: "pointer",
                    borderBottom: "1px solid #edf2f7",
                    fontSize: "13px",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#f0f7ff")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "#ffffff")
                  }
                >
                  Ubah Password
                </div>

                <div
                  onClick={handleLogout}
                  style={{
                    padding: "11px 16px",
                    cursor: "pointer",
                    fontSize: "13px",
                    color: "#c62828",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#fff5f5")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "#ffffff")
                  }
                >
                  Logout
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====================================================
            PAGE HEADER
            Dashboard tidak menggunakan header ini.
        ==================================================== */}
        {!isPrintRoute && !isDashboard && (
          <div
            style={{
              marginLeft: "0px",
              marginTop: "68px",

              padding: "12px 24px",

              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",

              color: "#3c5f23",

              transition: "margin-left 0.3s ease",

              background: "#DCEBFA",

              borderBottom: "1px solid #e5edf5",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: "22px",
              }}
            >
              {currentTitle}
            </div>

            <div
              style={{
                fontSize: "12px",
                color: "#6b7f93",
              }}
            >
              {breadcrumbMap[location.pathname]?.map((item, idx) => (
                <span key={`${item.path}-${idx}`}>
                  <span
                    style={{
                      cursor: "pointer",
                      textDecoration: "none",
                      color: idx === 0 ? "#2877bd" : "#6b7f93",
                    }}
                    onClick={() => navigate(item.path)}
                  >
                    {item.label}
                  </span>

                  {idx < breadcrumbMap[location.pathname].length - 1 && (
                    <span
                      style={{
                        margin: "0 5px",
                        color: "#9bb4ca",
                      }}
                    >
                      /
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ====================================================
            MAIN CONTENT
        ==================================================== */}
        <div
          className="main-content"
          style={{
            flex: 1,

            marginLeft: "0px",

            marginTop: isPrintRoute ? "0px" : isDashboard ? "48px" : "0px",

            padding: isDashboard ? "0px" : "20px",

            transition: "margin-left 0.3s ease",

            /*
             * Dashboard transparan agar background
             * dari Dashboard.tsx bisa terlihat.
             */
            backgroundColor: isPrintRoute
              ? "#ffffff"
              : isDashboard
                ? "transparent"
                : "#ffffff",

            borderRadius: isDashboard ? "0px" : "8px",

            borderTop: "none",

            width: "100%",
            maxWidth: "none",

            minHeight: isDashboard
              ? "calc(100vh - 48px)"
              : "calc(100vh - 48px)",

            overflowX: isDashboard ? "hidden" : "auto",

            overflowY: "auto",

            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              minWidth: isDashboard ? "0" : "800px",
              minHeight: isDashboard ? "100%" : "auto",
            }}
          >
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
