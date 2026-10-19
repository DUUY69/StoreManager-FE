import {
  HomeIcon,
  TruckIcon,
  CubeIcon,
  BuildingStorefrontIcon,
  UserCircleIcon,
  ClipboardDocumentListIcon,
  PlusCircleIcon,
  ChartBarIcon,
  ClipboardIcon,
  ArchiveBoxIcon,
  Cog6ToothIcon,
  ClipboardDocumentCheckIcon,
  CalendarDaysIcon,
  ShoppingCartIcon,
} from "@heroicons/react/24/solid";
import { DashboardHome, Suppliers, Products, Stores, Users, CreateOrder, OrderList, SupplierOrderList, SupplierOrderDetail, Reports, Warehouse, Settings, EodCheckin, EodMonthlyMatrix, ProductDemand } from "@/pages/dashboard";
import { OrderDetail } from "@/pages/dashboard/OrderDetail";
import { Login } from "@/pages/auth";

const icon = { className: "w-5 h-5 text-inherit" };

/** Tạm ẩn "Kho" trên menu (sidebar + bottom nav) khi đang kiểm kê cuối ngày. Đặt false để hiện lại. */
export const TEMP_HIDE_WAREHOUSE_MENU = true;

// Dashboard routes: path, element, name (null = no menu), icon, roles
export const dashboardRoutesConfig = [
  { path: "/home", element: <DashboardHome />, name: "Dashboard", icon: <HomeIcon {...icon} />, roles: ["Admin", "StoreUser", "SupplierUser"] },
  { path: "/suppliers", element: <Suppliers />, name: "Nhà cung cấp", icon: <TruckIcon {...icon} />, roles: ["Admin"] },
  { path: "/products", element: <Products />, name: "Sản phẩm", icon: <CubeIcon {...icon} />, roles: ["Admin", "SupplierUser"] },
  { path: "/stores", element: <Stores />, name: "Cửa hàng", icon: <BuildingStorefrontIcon {...icon} />, roles: ["Admin"] },
  { path: "/users", element: <Users />, name: "User", icon: <UserCircleIcon {...icon} />, roles: ["Admin"] },
  { path: "/create-order", element: <CreateOrder />, name: "Tạo đơn", icon: <PlusCircleIcon {...icon} />, roles: ["StoreUser"] },
  { path: "/orders", element: <OrderList />, name: "Danh sách đơn", icon: <ClipboardDocumentListIcon {...icon} />, roles: ["Admin", "StoreUser"] },
  { path: "/orders/:id", element: <OrderDetail />, name: null, icon: null, roles: ["Admin", "StoreUser"] },
  { path: "/supplier-orders", element: <SupplierOrderList />, name: "Đơn cần xử lý", icon: <ClipboardIcon {...icon} />, roles: ["SupplierUser"] },
  { path: "/supplier-orders-admin", element: <SupplierOrderList />, name: null, icon: null, roles: ["Admin"] },
  { path: "/supplier-orders/:id", element: <SupplierOrderDetail />, name: null, icon: null, roles: ["SupplierUser", "Admin"] },
  { path: "/warehouse", element: <Warehouse />, name: "Kho", icon: <ArchiveBoxIcon {...icon} />, roles: ["StoreUser", "SupplierUser"] },
  { path: "/eod-checkin", element: <EodCheckin />, name: "Kiểm kho cuối ngày", icon: <ClipboardDocumentCheckIcon {...icon} />, roles: ["Admin", "StoreUser"] },
  { path: "/eod-monthly-matrix", element: <EodMonthlyMatrix />, name: "Tồn kiểm kê tháng", icon: <CalendarDaysIcon {...icon} />, roles: ["Admin", "StoreUser"] },
  { path: "/reports", element: <Reports />, name: "Báo cáo", icon: <ChartBarIcon {...icon} />, roles: ["Admin"] },
  { path: "/product-demand", element: <ProductDemand />, name: "Nhu cầu SP", icon: <ShoppingCartIcon {...icon} />, roles: ["Admin"] },
  { path: "/settings", element: <Settings />, name: "Cài đặt", icon: <Cog6ToothIcon {...icon} />, roles: ["Admin", "StoreUser", "SupplierUser"] },
];

// Group for sidenav by role
export function getDashboardRoutesForRole(role) {
  if (!role) return [];
  return dashboardRoutesConfig
    .filter((r) => r.name && r.roles.includes(role))
    .filter((r) => !(TEMP_HIDE_WAREHOUSE_MENU && r.path === "/warehouse"));
}

// Legacy: full routes for backward compat (auth only)
export const routes = [
  {
    layout: "dashboard",
    pages: dashboardRoutesConfig.filter((r) => r.name).map((r) => ({ icon: r.icon, name: r.name, path: r.path, element: r.element })),
  },
  {
    title: "auth pages",
    layout: "auth",
    pages: [
      { icon: null, name: "Đăng nhập", path: "/sign-in", element: <Login /> },
      { icon: null, name: "Đăng nhập (lcs)", path: "/lcs", element: <Login /> },
    ],
  },
];

export default routes;
