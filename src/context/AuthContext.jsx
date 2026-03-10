import React from "react";
import { usersData } from "@/data";
import { storesData, suppliersData } from "@/data";
import api from "@/api";

const STORAGE_KEY = "multi_supplier_current_user";

const defaultUser = usersData[0]; // Admin Cafe

function getStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Khi dùng API: lưu cả id, role, storeId, supplierId — có role thì dùng luôn
    if (parsed.role) return parsed;
    // Có token nhưng stored không có role → không dùng usersData (dễ nhầm Admin), để useEffect gọi /auth/me
    if (api.USE_API && api.getToken()) return null;
    const found = usersData.find((u) => u.id === parsed.id);
    return found || null;
  } catch {
    return null;
  }
}

export const AuthContext = React.createContext(null);

export function AuthProvider({ children }) {
  // Khi có token mà stored không có role → khởi tạo null, không dùng defaultUser (Admin)
  const [currentUser, setCurrentUser] = React.useState(() => {
    const stored = getStoredUser();
    if (api.USE_API && api.getToken() && (!stored || !stored.role)) return null;
    return stored || defaultUser;
  });

  // Có token thì gọi /api/auth/me để lấy đúng user từ server (NCC/Store/Admin) — tránh nhảy sang Admin sau F5
  React.useEffect(() => {
    if (!api.USE_API || !api.getToken()) return;
    api.get("auth.me")
      .then((me) => {
        if (me && (me.id || me.Id)) {
          const user = {
            id: me.id ?? me.Id,
            email: me.email ?? me.Email,
            name: me.name ?? me.Name,
            role: me.role ?? me.Role,
            storeId: me.storeId ?? me.StoreId,
            supplierId: me.supplierId ?? me.SupplierId,
            status: me.status ?? me.Status,
          };
          setCurrentUser(user);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: user.id, role: user.role, storeId: user.storeId, supplierId: user.supplierId }));
          } catch (_) {}
        }
      })
      .catch(() => {
        // Khi auth.me lỗi (mạng/401): giữ user đã lưu trong localStorage thay vì set null → tránh mất role sau F5
        const stored = getStoredUser();
        if (!stored || !stored.role) setCurrentUser(null);
      });
  }, []);

  const login = React.useCallback((user) => {
    const u = user && (user.id != null || user.Id != null) ? {
      id: user.id ?? user.Id,
      email: user.email ?? user.Email,
      name: user.name ?? user.Name,
      role: user.role ?? user.Role,
      storeId: user.storeId ?? user.StoreId,
      supplierId: user.supplierId ?? user.SupplierId,
      status: user.status ?? user.Status,
    } : user;
    setCurrentUser(u);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: u?.id ?? u?.Id, role: u?.role ?? u?.Role, storeId: u?.storeId ?? u?.StoreId, supplierId: u?.supplierId ?? u?.SupplierId }));
    } catch (_) {}
  }, []);

  const logout = React.useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEY);
    api.setToken(null);
  }, []);

  const isAdmin = currentUser?.role === "Admin";
  const isStoreUser = currentUser?.role === "StoreUser";
  const isSupplierUser = currentUser?.role === "SupplierUser";

  const storeName = currentUser?.storeId
    ? storesData.find((s) => s.id === currentUser.storeId)?.name
    : null;
  const supplierName = currentUser?.supplierId
    ? suppliersData.find((s) => s.id === currentUser.supplierId)?.name
    : null;

  const value = React.useMemo(
    () => ({
      currentUser,
      login,
      logout,
      isAdmin,
      isStoreUser,
      isSupplierUser,
      storeName,
      supplierName,
    }),
    [currentUser, login, logout, isAdmin, isStoreUser, isSupplierUser, storeName, supplierName]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
