import React, { useMemo } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import {
  Navbar,
  Typography,
  Button,
  IconButton,
  Breadcrumbs,
  Input,
  Menu,
  MenuHandler,
  MenuList,
  MenuItem,
} from "@material-tailwind/react";
import {
  UserCircleIcon,
  BellIcon,
  ClockIcon,
  Bars3Icon,
  ArrowRightOnRectangleIcon,
  ClipboardDocumentListIcon,
  TruckIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/solid";
import {
  useMaterialTailwindController,
  setOpenSidenav,
  useAuth,
} from "@/context";
import { useData } from "@/context/DataContext";

/** Tạo danh sách thông báo theo role: ấn vào dẫn tới màn xử lý đơn tương ứng */
function useOrderNotifications() {
  const { orders } = useData();
  const { currentUser, isAdmin, isStoreUser, isSupplierUser } = useAuth();

  return useMemo(() => {
    const list = [];
    const now = new Date().toISOString().slice(0, 10);

    if (isAdmin || isStoreUser) {
      const myOrders = isStoreUser
        ? orders.filter((o) => o.storeId === currentUser?.storeId)
        : orders;
      myOrders.forEach((o) => {
        if (o.status === "Pending") {
          list.push({
            id: `order-submit-${o.id}`,
            type: "order",
            link: `/dashboard/orders/${o.id}`,
            title: `Đơn #${o.id} cần duyệt`,
            sub: `${o.storeName || "Cửa hàng"} · ${o.orderDate || ""}`,
            icon: ClipboardDocumentListIcon,
          });
        }
        if (o.status === "Accepted" && (o.orderSuppliers || []).length > 0) {
          const allDelivered = (o.orderSuppliers || []).every(
            (os) => os.status === "Delivered" || os.status === "Rejected"
          );
          if (allDelivered) {
            list.push({
              id: `order-confirm-${o.id}`,
              type: "order",
              link: `/dashboard/orders/${o.id}`,
              title: `Đơn #${o.id} sẵn sàng đóng`,
              sub: `Tất cả NCC đã giao · ${o.storeName || ""}`,
              icon: CheckCircleIcon,
            });
          }
        }
        (o.orderSuppliers || []).forEach((os) => {
          if (os.status === "Delivered") {
            list.push({
              id: `os-receive-${os.id}`,
              type: "order",
              link: `/dashboard/orders/${o.id}`,
              title: `Xác nhận nhận hàng: Đơn #${o.id} - NCC`,
              sub: `Đơn con #${os.id} đã giao, cần xác nhận & nhập kho`,
              icon: TruckIcon,
            });
          }
        });
      });
    }

    if (isSupplierUser && currentUser?.supplierId != null) {
      orders.filter((o) => o.status === "Accepted" || o.status === "Completed").forEach((o) => {
        (o.orderSuppliers || []).forEach((os) => {
          if (os.supplierId === currentUser.supplierId && os.status === "Pending") {
            list.push({
              id: `supplier-pending-${os.id}`,
              type: "supplier_order",
              link: `/dashboard/supplier-orders/${os.id}`,
              title: `Đơn NCC #${os.id} cần xử lý`,
              sub: `${o.storeName || "Cửa hàng"} · Đơn tổng #${o.id}`,
              icon: ClipboardDocumentListIcon,
            });
          }
        });
      });
    }

    return list.slice(0, 10);
  }, [orders, currentUser, isAdmin, isStoreUser, isSupplierUser]);
}

export function DashboardNavbar() {
  const [controller, dispatch] = useMaterialTailwindController();
  const { fixedNavbar, openSidenav } = controller;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const notifications = useOrderNotifications();
  const [layout, page] = pathname.split("/").filter((el) => el !== "");

  const handleLogout = () => {
    logout();
    navigate("/auth/sign-in");
  };

  const handleNotificationClick = (link) => {
    navigate(link);
  };

  return (
    <Navbar
      color={fixedNavbar ? "white" : "transparent"}
      className={`rounded-xl transition-all ${
        fixedNavbar
          ? "sticky top-4 z-40 py-3 shadow-md shadow-blue-gray-500/5"
          : "px-0 py-1"
      }`}
      fullWidth
      blurred={fixedNavbar}
    >
      <div className="flex flex-col-reverse justify-between gap-6 md:flex-row md:items-center">
        <div className="capitalize">
          <Breadcrumbs
            className={`bg-transparent p-0 transition-all ${
              fixedNavbar ? "mt-1" : ""
            }`}
          >
            <Link to="/dashboard">
              <Typography
                variant="small"
                color="blue-gray"
                className="font-normal opacity-50 transition-all hover:text-blue-500 hover:opacity-100"
              >
                {layout}
              </Typography>
            </Link>
            <Typography
              variant="small"
              color="blue-gray"
              className="font-normal"
            >
              {page || "home"}
            </Typography>
          </Breadcrumbs>
          <Typography variant="h6" color="blue-gray">
            {page || "Dashboard"}
          </Typography>
        </div>
        <div className="flex items-center">
          <div className="mr-auto md:mr-4 md:w-56">
            <Input label="Search" />
          </div>
          <IconButton
            variant="text"
            color="blue-gray"
            className="grid xl:hidden"
            onClick={() => setOpenSidenav(dispatch, !openSidenav)}
          >
            <Bars3Icon strokeWidth={3} className="h-6 w-6 text-blue-gray-500" />
          </IconButton>
          <Menu>
            <MenuHandler>
              <Button
                variant="text"
                color="blue-gray"
                className="hidden items-center gap-1 px-4 xl:flex normal-case"
              >
                <UserCircleIcon className="h-5 w-5 text-blue-gray-500" />
                {currentUser?.name || "User"}
              </Button>
            </MenuHandler>
            <MenuList>
              <MenuItem className="flex items-center gap-2" disabled>
                <Typography variant="small">{currentUser?.name ?? ""}</Typography>
                <Typography variant="small" color="gray">({currentUser?.email ?? ""})</Typography>
              </MenuItem>
              <MenuItem onClick={() => navigate("/dashboard/settings")} className="flex items-center gap-2">
                <Cog6ToothIcon className="h-5 w-5" />
                Cài đặt
              </MenuItem>
              <MenuItem onClick={handleLogout} className="flex items-center gap-2">
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                Đăng xuất
              </MenuItem>
            </MenuList>
          </Menu>
          <Link to="/auth/sign-in" className="xl:hidden">
            <IconButton variant="text" color="blue-gray">
              <UserCircleIcon className="h-5 w-5 text-blue-gray-500" />
            </IconButton>
          </Link>
          <Menu>
            <MenuHandler>
              <IconButton variant="text" color="blue-gray" className="relative">
                <BellIcon className="h-5 w-5 text-blue-gray-500" />
                {notifications.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {notifications.length > 9 ? "9+" : notifications.length}
                  </span>
                )}
              </IconButton>
            </MenuHandler>
            <MenuList className="w-[340px] max-h-[80vh] overflow-y-auto border-0">
              <div className="px-3 py-2 border-b border-blue-gray-50">
                <Typography variant="small" className="font-semibold text-blue-gray-700">
                  Thông báo đơn hàng
                </Typography>
                <Typography variant="small" color="gray">
                  Bấm vào để mở màn xử lý tương ứng
                </Typography>
              </div>
              {notifications.length === 0 ? (
                <MenuItem disabled className="flex items-center gap-3">
                  <Typography variant="small" color="gray">Không có thông báo mới</Typography>
                </MenuItem>
              ) : (
                notifications.map((n) => {
                  const Icon = n.icon;
                  return (
                    <MenuItem
                      key={n.id}
                      className="flex items-center gap-3 py-3"
                      onClick={() => handleNotificationClick(n.link)}
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-gray-100 text-blue-gray-600">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Typography variant="small" color="blue-gray" className="mb-0.5 font-medium block">
                          {n.title}
                        </Typography>
                        <Typography variant="small" color="gray" className="flex items-center gap-1 text-xs">
                          <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                          {n.sub}
                        </Typography>
                      </div>
                    </MenuItem>
                  );
                })
              )}
            </MenuList>
          </Menu>
        </div>
      </div>

    </Navbar>
  );
}

DashboardNavbar.displayName = "/src/widgets/layout/dashboard-navbar.jsx";

export default DashboardNavbar;
