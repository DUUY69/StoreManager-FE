import { Routes, Route } from "react-router-dom";
import {
  Sidenav,
  DashboardNavbar,
  Footer,
} from "@/widgets/layout";
import { dashboardRoutesConfig, getDashboardRoutesForRole } from "@/routes";
import { useMaterialTailwindController, useAuth, useData } from "@/context";
import api from "@/api";

export function Dashboard() {
  const [controller, dispatch] = useMaterialTailwindController();
  const { sidenavType } = controller;
  const { currentUser } = useAuth();
  const { apiLoading, apiError } = useData();
  const menuItems = getDashboardRoutesForRole(currentUser?.role);
  const authPending = currentUser === null && api.USE_API && api.getToken();

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
        <div className="sticky top-0 z-50 bg-red-100 text-red-800 px-4 py-2 text-center text-sm">
          {apiError}
        </div>
      )}
      <Sidenav
        menuItems={menuItems}
        brandName="Cafe - Đặt hàng NCC"
        brandImg={
          sidenavType === "dark" ? "/img/logo-ct.png" : "/img/logo-ct-dark.png"
        }
      />
      <div className="flex flex-col min-h-screen xl:ml-80 p-4 pb-4">
        <DashboardNavbar />
        <main className="flex-1 pb-8">
          <Routes>
            {dashboardRoutesConfig.map(({ path, element }) => (
              <Route key={path} path={path} element={element} />
            ))}
          </Routes>
        </main>
        <footer className="mt-auto shrink-0 text-blue-gray-600 pt-4">
          <Footer brandName="Multi-Supplier Order" brandLink="#" routes={[]} />
        </footer>
      </div>
    </div>
  );
}

Dashboard.displayName = "/src/layout/dashboard.jsx";

export default Dashboard;
