import {
  HomeIcon,
  TruckIcon,
  FolderIcon,
  CubeIcon,
  BuildingStorefrontIcon,
  UserCircleIcon,
  ClipboardDocumentListIcon,
  PlusCircleIcon,
  ChartBarIcon,
  ClipboardIcon,
  ArchiveBoxIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/solid";
import { DashboardHome, Suppliers, Categories, Products, Stores, Users, CreateOrder, OrderList, SupplierOrderList, SupplierOrderDetail, Reports, Warehouse, Settings } from "@/pages/dashboard";
import { OrderDetail } from "@/pages/dashboard/OrderDetail";
import { Login } from "@/pages/auth";

const icon = { className: "w-5 h-5 text-inherit" };

// Dashboard routes: path, element, name (null = no menu), icon, roles
export const dashboardRoutesConfig = [
  { path: "/home", element: <DashboardHome />, name: "Dashboard", icon: <HomeIcon {...icon} />, roles: ["Admin", "StoreUser", "SupplierUser"] },
  { path: "/suppliers", element: <Suppliers />, name: "Nhà cung cấp", icon: <TruckIcon {...icon} />, roles: ["Admin"] },
  { path: "/categories", element: <Categories />, name: "Danh mục", icon: <FolderIcon {...icon} />, roles: ["Admin"] },
  { path: "/products", element: <Products />, name: "Sản phẩm", icon: <CubeIcon {...icon} />, roles: ["Admin"] },
  { path: "/stores", element: <Stores />, name: "Cửa hàng", icon: <BuildingStorefrontIcon {...icon} />, roles: ["Admin"] },
  { path: "/users", element: <Users />, name: "User", icon: <UserCircleIcon {...icon} />, roles: ["Admin"] },
  { path: "/create-order", element: <CreateOrder />, name: "Tạo đơn", icon: <PlusCircleIcon {...icon} />, roles: ["StoreUser"] },
  { path: "/orders", element: <OrderList />, name: "Danh sách đơn", icon: <ClipboardDocumentListIcon {...icon} />, roles: ["Admin", "StoreUser"] },
  { path: "/orders/:id", element: <OrderDetail />, name: null, icon: null, roles: ["Admin", "StoreUser"] },
  { path: "/supplier-orders", element: <SupplierOrderList />, name: "Đơn cần xử lý", icon: <ClipboardIcon {...icon} />, roles: ["SupplierUser"] },
  { path: "/supplier-orders/:id", element: <SupplierOrderDetail />, name: null, icon: null, roles: ["SupplierUser"] },
  { path: "/warehouse", element: <Warehouse />, name: "Quản lý kho", icon: <ArchiveBoxIcon {...icon} />, roles: ["Admin", "StoreUser", "SupplierUser"] },
  { path: "/reports", element: <Reports />, name: "Báo cáo", icon: <ChartBarIcon {...icon} />, roles: ["Admin"] },
  { path: "/settings", element: <Settings />, name: "Cài đặt", icon: <Cog6ToothIcon {...icon} />, roles: ["Admin", "StoreUser", "SupplierUser"] },
];

// Group for sidenav by role
export function getDashboardRoutesForRole(role) {
  if (!role) return [];
  return dashboardRoutesConfig.filter((r) => r.name && r.roles.includes(role));
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
    ],
  },
];

export default routes;
