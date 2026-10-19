/** Token + user cache — dùng chung client API và AuthContext */

const TOKEN_KEY = "admin_dashboard_token";
const USER_KEY = "multi_supplier_current_user";

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function getStoredAuthUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.role ? parsed : null;
  } catch {
    return null;
  }
}

export function setStoredAuthUser(user) {
  try {
    if (!user?.role) {
      localStorage.removeItem(USER_KEY);
      return;
    }
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        id: user.id ?? user.Id,
        role: user.role ?? user.Role,
        storeId: user.storeId ?? user.StoreId,
        supplierId: user.supplierId ?? user.SupplierId,
      }),
    );
  } catch {
    /* ignore */
  }
}

export function clearAuthSession() {
  setAuthToken(null);
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:logout"));
  }
}

export function isLoginPath(pathname = "") {
  const p = pathname || (typeof window !== "undefined" ? window.location.pathname : "");
  return /\/lcs(\/|$)/.test(p) || /\/auth\/sign-in(\/|$)/.test(p) || /\/sign-in(\/|$)/.test(p);
}

export function redirectToLogin() {
  if (typeof window === "undefined" || isLoginPath()) return;
  const full = `${window.location.pathname}${window.location.search || ""}`;
  const redirect =
    full.startsWith("/dashboard") ? encodeURIComponent(full) : encodeURIComponent("/dashboard/home");
  window.location.replace(`/lcs?redirect=${redirect}`);
}

export { TOKEN_KEY, USER_KEY };
