import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export function useAutoLogout(timeoutMs = 2 * 60 * 60 * 1000) {
  const navigate = useNavigate();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = () => {
    if (window.location.pathname === "/login") return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      localStorage.removeItem("custom_user");
      localStorage.removeItem("session_expiry");
      navigate("/login");
    }, timeoutMs);

    localStorage.setItem("session_expiry", String(Date.now() + timeoutMs));
  };

  const checkExpiry = () => {
    if (window.location.pathname === "/login") return;

    const expiry = Number(localStorage.getItem("session_expiry"));
    if (!expiry || isNaN(expiry)) return;

    if (Date.now() > expiry) {
      localStorage.removeItem("custom_user");
      localStorage.removeItem("session_expiry");
      navigate("/login");
    }
  };

  useEffect(() => {
    const events = ["mousemove", "keydown", "scroll", "click"];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    checkExpiry(); // langsung cek saat mount

    const interval = setInterval(checkExpiry, 60 * 1000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
      clearInterval(interval);
    };
  }, []);
}