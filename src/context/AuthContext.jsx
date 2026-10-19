import React from "react";
import api from "@/api";
import {
  getStoredAuthUser,
  setStoredAuthUser,
  clearAuthSession,
  getAuthToken,
} from "@/utils/authSession";

export const AuthContext = React.createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = React.useState(() => {
    const token = getAuthToken();
    if (!token) {
      clearAuthSession();
      return null;
    }
    return getStoredAuthUser();
  });

  const [authReady, setAuthReady] = React.useState(() => !getAuthToken());

  React.useEffect(() => {
    const onLogout = () => {
      setCurrentUser(null);
      setAuthReady(true);
    };
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, []);

  // Có token → gọi /api/auth/me để đồng bộ user từ server
  React.useEffect(() => {
    if (!api.USE_API || !getAuthToken()) {
      setAuthReady(true);
      return;
    }

    let cancelled = false;
    setAuthReady(false);

    api.get("auth.me")
      .then((me) => {
        if (cancelled) return;
        if (me && (me.id || me.Id)) {
          const user = {
            id: me.id ?? me.Id,
            email: me.email ?? me.Email,
            name: me.name ?? me.Name,
            role: me.role ?? me.Role,
            storeId: me.storeId ?? me.StoreId,
            supplierId: me.supplierId ?? me.SupplierId,
            storeName: me.storeName ?? me.StoreName,
            supplierName: me.supplierName ?? me.SupplierName,
            status: me.status ?? me.Status,
          };
          setCurrentUser(user);
          setStoredAuthUser(user);
        } else {
          clearAuthSession();
          setCurrentUser(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.status === 401) {
          clearAuthSession();
          setCurrentUser(null);
        } else {
          const stored = getStoredAuthUser();
          if (stored?.role && getAuthToken()) setCurrentUser(stored);
          else setCurrentUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = React.useCallback((user) => {
    const u =
      user && (user.id != null || user.Id != null)
        ? {
            id: user.id ?? user.Id,
            email: user.email ?? user.Email,
            name: user.name ?? user.Name,
            role: user.role ?? user.Role,
            storeId: user.storeId ?? user.StoreId,
            supplierId: user.supplierId ?? user.SupplierId,
            storeName: user.storeName ?? user.StoreName,
            supplierName: user.supplierName ?? user.SupplierName,
            status: user.status ?? user.Status,
          }
        : user;
    setCurrentUser(u);
    setStoredAuthUser(u);
    setAuthReady(true);
  }, []);

  const logout = React.useCallback(() => {
    clearAuthSession();
    setCurrentUser(null);
    setAuthReady(true);
  }, []);

  const isAdmin = currentUser?.role === "Admin";
  const isStoreUser = currentUser?.role === "StoreUser";
  const isSupplierUser = currentUser?.role === "SupplierUser";

  const storeName = currentUser?.storeName ?? null;
  const supplierName = currentUser?.supplierName ?? null;

  const value = React.useMemo(
    () => ({
      currentUser,
      authReady,
      login,
      logout,
      isAdmin,
      isStoreUser,
      isSupplierUser,
      storeName,
      supplierName,
    }),
    [currentUser, authReady, login, logout, isAdmin, isStoreUser, isSupplierUser, storeName, supplierName],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
