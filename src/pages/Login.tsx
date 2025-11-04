import { useState, useEffect } from "react";
import { authenticateUser } from "../lib/authUser";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const originalBodyBg = document.body.style.backgroundColor;
    const originalHtmlBg = document.documentElement.style.backgroundColor;
    const originalBodyMargin = document.body.style.margin;
    const originalHtmlMargin = document.documentElement.style.margin;

    document.body.style.backgroundColor = "white";
    document.documentElement.style.backgroundColor = "white";
    document.body.style.margin = "0";
    document.documentElement.style.margin = "0";

    return () => {
      document.body.style.backgroundColor = originalBodyBg;
      document.documentElement.style.backgroundColor = originalHtmlBg;
      document.body.style.margin = originalBodyMargin;
      document.documentElement.style.margin = originalHtmlMargin;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await authenticateUser(username, password);

      if (!user || !Array.isArray(user.access) || user.access.length === 0) {
        alert("Login gagal: akses tidak ditemukan.");
        return;
      }

      localStorage.setItem("custom_user", JSON.stringify(user));
      console.log("✅ custom_user tersimpan:", user);

      if (!user?.id || user.id.includes("-")) {
        console.warn("⚠️ ID user masih UUID atau tidak valid:", user.id);
        alert("Login berhasil, tapi ID user tidak valid. Pastikan login pakai custom_users.");
      }

      window.location.href = "/dashboard"; // paksa reload agar App.tsx rerender
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan saat login.";
      alert("Login gagal: " + message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          padding: "30px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          background: "white",
          width: "320px",
          boxShadow: "0 4px 12px hsla(0, 0%, 1%, 0.10)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <img
            src="/logo.png"
            alt="Logo"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
            style={{ height: "50px", marginBottom: "10px" }}
          />
          <h2 style={{ margin: 0, color: "black" }}>Back Office</h2>
        </div>
        <form
          onSubmit={handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{
              padding: "10px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              backgroundColor: "#f0f0f0",
              color: "black",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: "10px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              backgroundColor: "#f0f0f0",
              color: "black",
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px",
              background: loading ? "#999" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}