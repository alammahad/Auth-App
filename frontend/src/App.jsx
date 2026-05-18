import { useState, useEffect } from "react";
import { API_BASE, mapMeToUser } from "./utils";
import { LandingPage } from "./pages/LandingPage";
import { AuthPage } from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import { G } from "../styles/theme";

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("schlr_token") || "");
  const [bootLoading, setBootLoading] = useState(true);
  const [authView, setAuthView] = useState("landing");
  const [authMode, setAuthMode] = useState("login");

  const handleToken = (value) => {
    setToken(value);
    localStorage.setItem("schlr_token", value);
  };
  const handleLogout = () => {
    localStorage.removeItem("schlr_token");
    setToken("");
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const resp = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const me = await resp.json();
      const u = mapMeToUser(me);
      if (u) setUser(u);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const bootstrapSession = async () => {
      if (!token) {
        setBootLoading(false);
        return;
      }
      try {
        const resp = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error("Session expired");
        const me = await resp.json();
        setUser(mapMeToUser(me));
      } catch {
        localStorage.removeItem("schlr_token");
        setToken("");
        setUser(null);
      } finally {
        setBootLoading(false);
      }
    };
    bootstrapSession();
  }, [token]);

  if (bootLoading) return <div style={{padding:40,fontFamily:"Jost, sans-serif"}}>Loading...</div>;
  if (!user && authView === "landing") return <LandingPage onChoose={(mode) => { setAuthMode(mode); setAuthView("auth"); }} />;
  if (!user) return <AuthPage onLogin={setUser} onAuthToken={handleToken} initialMode={authMode} onBack={() => setAuthView("landing")} />;
  return (
    <>
      <style>{G}</style>
      <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
        <Dashboard user={user} token={token} onLogout={handleLogout} onUserRefresh={refreshUser} />
      </div>
    </>
  );
}
