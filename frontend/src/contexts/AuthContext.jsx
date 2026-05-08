import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/api/client";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("workpulse_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("workpulse_token", data.token);
    localStorage.setItem("workpulse_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = useCallback(() => {
    localStorage.removeItem("workpulse_token");
    localStorage.removeItem("workpulse_user");
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.data);
      localStorage.setItem("workpulse_user", JSON.stringify(data.data));
    } catch (e) {
      // token invalid -> handled by interceptor
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem("workpulse_token")) refreshMe();
  }, [refreshMe]);

  return (
    <AuthCtx.Provider value={{ user, login, logout, refreshMe, loading, setLoading }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
