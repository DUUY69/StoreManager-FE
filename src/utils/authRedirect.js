/** Đường dẫn sau đăng nhập (chỉ cho phép /dashboard/*). */
export function sanitizeDashboardRedirect(raw) {
  if (!raw || typeof raw !== "string") return null;
  const path = raw.trim();
  if (!path.startsWith("/dashboard")) return null;
  if (path.includes("://") || path.startsWith("//")) return null;
  return path;
}

export function getRedirectFromSearch(searchParams) {
  const q = searchParams?.get?.("redirect") ?? new URLSearchParams(window.location.search).get("redirect");
  return sanitizeDashboardRedirect(q);
}

export function buildLoginPathWithRedirect(dashboardPath) {
  const safe = sanitizeDashboardRedirect(dashboardPath);
  if (!safe) return "/lcs";
  return `/lcs?redirect=${encodeURIComponent(safe)}`;
}
