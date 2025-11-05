import { useState, useRef, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabaseClient";
import { getUserAccess } from "../lib/access";
import { getMenus } from "../lib/getMenus";
import { useAutoLogout } from "../utils/useAutoLogout";
import bcrypt from "bcryptjs";

export default function Layout() {
  useAutoLogout(); // ⏱️ aktif di semua halaman
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

  const handleLogout = () => {
    localStorage.removeItem("custom_user");
    navigate("/login");
  };

  const getCurrentCustomUser = async () => {
    try {
      const raw = localStorage.getItem("custom_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id) return parsed;
      }

      const { data: authData } = await supabase.auth.getUser();
      const email = authData?.user?.email;
      if (email) {
        const { data, error } = await supabase
          .from("custom_users")
          .select("id,name,email,role")
          .eq("email", email)
          .single();
        if (!error && data) return data;
      }
    } catch (err) {
      console.warn("❌ Gagal ambil user:", err);
    }
    return null;
  };

  const handleChangePassword = async () => {
    const newPassword = prompt("Masukkan password baru (minimal 6 karakter):");
    if (!newPassword || newPassword.length < 6)
      return alert("Password minimal 6 karakter.");
    const confirm = prompt("Konfirmasi password baru:");
    if (confirm !== newPassword) return alert("Konfirmasi password tidak cocok.");

    const current = await getCurrentCustomUser();
    if (!current?.id) return alert("Tidak ada user yang login.");

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    const { error } = await supabase
      .from("custom_users")
      .update({ password: hashedPassword })
      .eq("id", current.id);

    if (error) alert("Gagal mengubah password: " + error.message);
    else alert("Password berhasil diubah!");
  };

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
      const hierarchyMap: Record<string, { label: string; path: string }[]> = {};

      for (const menu of menus) {
        if (menu.path && menu.label && !uniquePaths.has(menu.path)) {
          titles[menu.path] = menu.label;
          uniquePaths.add(menu.path);
        }
        for (const sub of menu.sub ?? []) {
          if (sub.path && sub.label && !uniquePaths.has(sub.path)) {
            titles[sub.path] = sub.label;
            hierarchyMap[sub.path] = [
              { label: menu.label, path: menu.path || "/" },
              { label: sub.label, path: sub.path },
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentTitle = menuTitles[location.pathname] || "Dashboard";

  //-- tampilan tabel sroll horizontal --
  useEffect(() => {
    const wrapWideTables = () => {
      const tables = document.querySelectorAll("table");
      tables.forEach((table) => {
        const parent = table.parentElement;
        const alreadyWrapped = parent?.classList.contains("table-scroll-wrapper");
        if (!alreadyWrapped) {
          const wrapper = document.createElement("div");
          wrapper.className = "table-scroll-wrapper";
          wrapper.style.overflowX = "auto";
          wrapper.style.width = "100%";
          wrapper.style.maxWidth = "100vw"; // ⬅️ batasi agar scroll tidak lari ke body
          wrapper.style.marginBottom = "16px";

          parent?.insertBefore(wrapper, table);
          wrapper.appendChild(table);
        }
      });
    };

    wrapWideTables(); // initial wrap
    const observer = new MutationObserver(wrapWideTables);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return (
    <div className={`layout-wrapper`} style={{ display: "flex", minHeight: "100vh", backgroundColor: "#0092F5", overflowX: "hidden", overflowY: "auto", }}>
      {!isPrintRoute && userAccess !== null ? (
        <Sidebar
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          userAccess={userAccess}
        />
      ) : !isPrintRoute ? (
        <div
          style={{
            width: isCollapsed ? "50px" : "250px",
            background: "#2c3e50",
            color: "white",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
          }}
        >
          Loading menu...
        </div>
      ) : null}

      <div style={{ paddingTop: "5px", width: "100%", transition: "padding-left 0.3s" }}>
        {!isPrintRoute && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: isCollapsed ? "50px" : "200px",
              right: 0,
              height: "40px",
              background: "#B7BABF",
              borderBottom: "1px solid #ddd",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0 20px",
              zIndex: 1000,
              transition: "left 0.3s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <img src="/logo.png" alt="Logo" style={{ height: "40px", objectFit: "contain" }} />
            </div>

            <div
              ref={profileRef}
              style={{
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                color: "black",
              }}
              onClick={() => setShowMenu(!showMenu)}
            >
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`}
                alt="Profil"
                style={{ width: "30px", height: "30px", borderRadius: "50%" }}
              />
              <span style={{ fontWeight: "bold", fontSize: "12px" }}>{username}</span>
            </div>

            {showMenu && (
              <div
                ref={menuRef}
                style={{
                  position: "absolute",
                  top: "40px",
                  right: "0px",
                  background: "white",
                  color: "black",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
                  borderRadius: "2px",
                  overflow: "hidden",
                  zIndex: 1100,
                }}
              >
                <div
                  onClick={handleChangePassword}
                  style={{
                    padding: "10px 20px",
                    cursor: "pointer",
                    borderBottom: "1px solid #eee",
                    fontSize: "14px",
                  }}
                >
                  Ubah Password
                </div>
                <div
                  onClick={handleLogout}
                  style={{
                    padding: "10px 20px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Logout
                </div>
              </div>
            )}
          </div>
        )}

        {!isPrintRoute && (
          <div
            style={{
              marginLeft: isPrintRoute ? "0px" : isCollapsed ? "50px" : "200px",
              marginTop: "40px",
              padding: "10px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "white",
              transition: "margin-left 0.3s ease",
            }}
          >
            <div style={{ fontWeight: "bold", fontSize: "24px" }}>{currentTitle}</div>

            <div style={{ fontSize: "12px", opacity: 0.9 }}>
              {breadcrumbMap[location.pathname]?.map((item, idx) => (
                <span key={`${item.path}-${idx}`}>
                  <span
                    style={{ cursor: "pointer", textDecoration: "underline" }}
                    onClick={() => navigate(item.path)}
                  >
                    {item.label}
                  </span>
                  {idx < breadcrumbMap[location.pathname].length - 1 && (
                    <span style={{ margin: "0 4px" }}>{">"}</span>
                  )}
                </span>
              ))}
            </div>
                   </div>
        )}

        {/* Konten utama */}
        <div
          className="main-content"
          style={{
            flex: 1,
            marginLeft: isPrintRoute ? "0px" : isCollapsed ? "50px" : "200px",
            padding: "20px 20px 20px 20px",
            transition: "margin-left 0.3s",
            backgroundColor: isPrintRoute ? "white" : "#fff",
            borderRadius: "5px",
            borderTop: isPrintRoute ? "none" : "10px solid #B7BABF",
            width: "100%",
            maxWidth: "100vw",
            overflowX: "auto",
            overflowY: "auto",
          }}
        >
          <div style={{ minWidth: "800px" }}>
          <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}