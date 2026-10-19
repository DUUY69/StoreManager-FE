import { useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import {
  Sidenav,
  DashboardNavbar,
  Footer,
  AssistantPanel,
  AssistantPanelProvider,
  useAssistantPanel,
  assistantPanelMarginClass,
} from "@/widgets/layout";
import { dashboardRoutesConfig, getDashboardRoutesForRole } from "@/routes";
import { useMaterialTailwindController, useAuth, useData } from "@/context";
import api from "@/api";
import { NavLink } from "react-router-dom";
import { Typography } from "@material-tailwind/react";
import { buildLoginPathWithRedirect } from "@/utils/authRedirect";
import { dashboardPathWithSavedFilters } from "@/utils/urlFilters";

export function Dashboard() {
  return (
    <AssistantPanelProvider>
      <DashboardInner />
    </AssistantPanelProvider>
  );
}

function DashboardInner() {
  const [controller, dispatch] = useMaterialTailwindController();
  const { sidenavType } = controller;
  const { currentUser, authReady } = useAuth();
  const { apiLoading, apiError, clearApiError, refetchInitialData } = useData();
  const { open: assistantOpen } = useAssistantPanel();
  const navigate = useNavigate();
  const location = useLocation();
  const menuItems = getDashboardRoutesForRole(currentUser?.role);
  const hasToken = api.USE_API && !!api.getToken();
  const authPending = hasToken && !authReady;

  useEffect(() => {
    if (!api.USE_API) return;
    if (authPending) return;
    if (!hasToken || !currentUser?.role) {
      const fullPath = `${location.pathname}${location.search || ""}`;
      navigate(buildLoginPathWithRedirect(fullPath), { replace: true });
    }
  }, [api.USE_API, authPending, hasToken, currentUser?.role, navigate, location.pathname, location.search]);

  // Bottom nav: ưu tiên các menu quan trọng nhất theo role
  const BOTTOM_NAV_PRIORITY = {
    Admin:        ["/home", "/orders", "/eod-monthly-matrix", "/eod-checkin", "/reports"],
    StoreUser:    ["/home", "/create-order", "/orders", "/eod-checkin", "/eod-monthly-matrix"],
    SupplierUser: ["/home", "/supplier-orders", "/products", "/warehouse", "/settings"],
  };
  const priority = BOTTOM_NAV_PRIORITY[currentUser?.role] || [];
  const bottomNavItems = priority.length > 0
    ? priority.map(p => menuItems.find(m => m.path === p)).filter(Boolean)
    : menuItems.slice(0, 5);

  return (
    <div className="min-h-screen bg-blue-gray-50/50">
      {authPending && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
          <div className="rounded-lg bg-white px-6 py-4 shadow-lg">Đang xác thực tài khoản...</div>
        </div>
      )}
      {apiLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
          <div className="rounded-lg bg-white px-6 py-4 shadow-lg">Đang tải dữ liệu...</div>
        </div>
      )}
      {apiError && (
        <div
          role="alert"
          className="fixed top-3 left-3 right-3 z-[70] mx-auto max-w-xl rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 shadow-md xl:left-auto xl:right-4 xl:max-w-md"
        >
          <div className="flex items-start gap-2">
            <p className="flex-1 min-w-0 leading-snug">{apiError}</p>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => refetchInitialData()}
                className="rounded px-2 py-0.5 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                Thử lại
              </button>
              <button
                type="button"
                onClick={() => clearApiError()}
                className="rounded px-2 py-0.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                aria-label="Đóng thông báo lỗi"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
      <Sidenav
        menuItems={menuItems}
        brandName="Cafe - Đặt hàng NCC"
        brandImg={
          sidenavType === "dark" ? "/img/logo-ct.png" : "/img/logo-ct-dark.png"
        }
      />

      {/* ── Main content (chừa chỗ panel trợ lý bên phải) ── */}
      <div className={`flex flex-col min-h-screen xl:ml-80 p-4 pb-4 transition-[margin] duration-200 ${assistantPanelMarginClass(assistantOpen)}`}>
        <DashboardNavbar />
        {/* Thêm padding bottom trên mobile để không bị bottom nav che */}
        <main className="flex-1 min-h-0 w-full overflow-x-hidden pb-20 xl:pb-8">
          <Routes>
            {dashboardRoutesConfig
              .filter((r) => !r.roles?.length || r.roles.includes(currentUser?.role))
              .map(({ path, element }) => (
                <Route key={path} path={path} element={element} />
              ))}
          </Routes>
        </main>
        <footer className="mt-auto shrink-0 text-blue-gray-600 pt-4 hidden xl:block">
          <Footer brandName="Multi-Supplier Order" brandLink="#" routes={[]} />
        </footer>
      </div>

      {/* ── Trợ lý AI — CHỈ Admin mới thấy/dùng được ── */}
      {currentUser?.role === "Admin" && <AssistantPanel />}

      {/* ── Bottom Navigation Bar (mobile only) ── */}
      {bottomNavItems.length > 0 && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-blue-gray-100 shadow-lg xl:hidden safe-area-bottom">
          <div className="flex items-stretch h-16">
            {bottomNavItems.map(({ path, name, icon }) => (
              <NavLink
                key={path}
                to={dashboardPathWithSavedFilters(path)}
                end={path === "/home"}
                className="flex-1"
              >
                {({ isActive }) => (
                  <div className={`flex flex-col items-center justify-center h-full gap-0.5 px-1 transition-colors
                    ${isActive ? "text-blue-600" : "text-blue-gray-400"}`}
                  >
                    <span className={`transition-transform ${isActive ? "scale-110" : ""}`}>
                      {icon}
                    </span>
                    <span className={`text-[10px] leading-tight text-center truncate w-full text-center
                      ${isActive ? "font-semibold text-blue-600" : "text-blue-gray-400"}`}
                    >
                      {name}
                    </span>
                    {isActive && (
                      <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
                    )}
                  </div>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

Dashboard.displayName = "/src/layout/dashboard.jsx";

export default Dashboard;
