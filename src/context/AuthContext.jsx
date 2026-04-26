import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  const saveAuth = (userData, tokens) => {
    if (tokens) localStorage.setItem("tokens", JSON.stringify(tokens));
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const clearAuth = () => {
    localStorage.removeItem("tokens");
    localStorage.removeItem("user");
    setUser(null);
  };

  const loadUser = useCallback(async () => {
    const tokens = JSON.parse(localStorage.getItem("tokens"));
    if (!tokens?.access) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me/");
      saveAuth(data, tokens);
    } catch {
      clearAuth();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (username, password) => {
    const { data } = await api.post("/auth/login/", { username, password });
    const { tokens, ...userData } = data;
    saveAuth(userData, tokens);
    return userData;
  };

  const signup = async (formData) => {
    const { data } = await api.post("/auth/signup/", formData);
    const { tokens, ...userData } = data;
    saveAuth(userData, tokens);
    return userData;
  };

  const logout = async () => {
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      if (tokens?.refresh) {
        await api.post("/auth/logout/", { refresh: tokens.refresh });
      }
    } catch  {
      clearAuth();
    }
  };

  const value = { user, loading, login, signup, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
