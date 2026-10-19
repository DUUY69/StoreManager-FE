import React, { useMemo } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import {
  Navbar,
  Typography,
  Button,
  IconButton,
  Breadcrumbs,
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
  ExclamationTriangleIcon,
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

    const oss = (o) => o.orderSuppliers || o.OrderSuppliers || [];

    if (isAdmin || isStoreUser) {
      const sid = currentUser?.storeId ?? currentUser?.StoreId;
      const myOrders = isStoreUser ? orders.filter((o) => (o.storeId ?? o.StoreId) === sid) : orders;
      if (isAdmin) {
        myOrders.forEach((o) => {
          const oid = o.id ?? o.Id;
          oss(o).forEach((os) => {
            const st = (os.status ?? os.Status ?? "").toLowerCase();
            if (st !== "delivered") return;
            const flagged = !!(os.receiveQtyAdjusted ?? os.ReceiveQtyAdjusted);
            const note = String(os.receiveNote ?? os.ReceiveNote ?? "").trim();
            const imgs = os.receiveImages ?? os.ReceiveImages ?? [];
            const hasImages = Array.isArray(imgs) && imgs.length > 0;
            if (!flagged && !note && !hasImages) return;
            list.push({
              id: `receive-adj-${os.id ?? os.Id}`,
              type: "receive_adjust",
              link: `/dashboard/orders/${oid}`,
              title: `Nhận thiếu/thừa hoặc ghi chú · đơn #${oid}`,
              sub: `${os.supplierName ?? os.SupplierName ?? "NCC"} · ${o.storeName ?? o.StoreName ?? "CH"}${note ? ` — ${note.slice(0, 72)}${note.length > 72 ? "…" : ""}` : flagged ? " — SL thực nhận khác đơn" : hasImages ? " — Có ảnh chứng từ" : ""}`,
              icon: ExclamationTriangleIcon,
            });
          });
        });
      }
      myOrders.forEach((o) => {
        const oid = o.id ?? o.Id;
        const oSt = o.status ?? o.Status;
        if (oSt === "Pending") {
          list.push({
            id: `order-submit-${oid}`,
            type: "order",
            link: `/dashboard/orders/${oid}`,
            title: `Đơn #${oid} cần duyệt`,
            sub: `${(o.storeName ?? o.StoreName) || "Cửa hàng"} · ${(o.orderDate ?? o.OrderDate) || ""}`,
            icon: ClipboardDocumentListIcon,
          });
        }
        if (oSt === "Accepted" && oss(o).length > 0) {
          const allDelivered = oss(o).every(
            (os) => (os.status ?? os.Status) === "Delivered" || (os.status ?? os.Status) === "Rejected"
          );
          if (allDelivered) {
            list.push({
              id: `order-confirm-${oid}`,
              type: "order",
              link: `/dashboard/orders/${oid}`,
              title: `Đơn #${oid} sẵn sàng đóng`,
              sub: `Tất cả NCC đã giao · ${(o.storeName ?? o.StoreName) || ""}`,
              icon: CheckCircleIcon,
            });
          }
        }
        oss(o).forEach((os) => {
          const osSt = os.status ?? os.Status;
          if (osSt === "Delivering") {
            list.push({
              id: `os-receive-${os.id ?? os.Id}`,
              type: "order",
              link: `/dashboard/orders/${oid}`,
              title: `Xác nhận nhận hàng: Đơn #${oid} - NCC`,
              sub: `Đơn con #${os.id ?? os.Id} đang giao, cần xác nhận nhận hàng`,
              icon: TruckIcon,
            });
          }
        });
      });
    }

    if (isSupplierUser && currentUser?.supplierId != null) {
      const supId = currentUser.supplierId ?? currentUser.SupplierId;
      orders
        .filter((o) => {
          const s = o.status ?? o.Status;
          return s === "Accepted" || s === "Completed";
        })
        .forEach((o) => {
          const oid = o.id ?? o.Id;
          oss(o).forEach((os) => {
            if (Number(os.supplierId ?? os.SupplierId) === Number(supId) && (os.status ?? os.Status) === "Pending") {
              list.push({
                id: `supplier-pending-${os.id ?? os.Id}`,
                type: "supplier_order",
                link: `/dashboard/supplier-orders/${os.id ?? os.Id}`,
                title: `Đơn NCC #${os.id ?? os.Id} cần xử lý`,
                sub: `${(o.storeName ?? o.StoreName) || "Cửa hàng"} · Đơn tổng #${oid}`,
                icon: ClipboardDocumentListIcon,
              });
            }
          });
        });
    }

    list.sort((a, b) => {
      const pa = a.type === "receive_adjust" ? 0 : 1;
      const pb = b.type === "receive_adjust" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return 0;
    });
    return list.slice(0, 30);
  }, [orders, currentUser, isAdmin, isStoreUser, isSupplierUser]);
}

export function DashboardNavbar() {
  const [controller, dispatch] = useMaterialTailwindController();
  const { fixedNavbar, openSidenav } = controller;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const notifications = useOrderNotifications();
  const segments = pathname.split("/").filter((el) => el !== "");
  const page = segments[1] || "";
  const pageLabels = {
    home: "Tổng quan",
    orders: "Danh sách đơn",
    "create-order": "Tạo đơn",
    suppliers: "Nhà cung cấp",
    products: "Sản phẩm",
    stores: "Cửa hàng",
    users: "Người dùng",
    reports: "Báo cáo",
    warehouse: "Kho",
    settings: "Cài đặt",
    "eod-checkin": "Kiểm kho cuối ngày",
    "eod-monthly-matrix": "Tồn kiểm kê tháng",
    "supplier-orders": "Đơn NCC",
    "supplier-orders-admin": "Đơn NCC (Admin)",
  };
  let pageLabel = pageLabels[page] || (page ? page.replace(/-/g, " ") : "Tổng quan");
  if (page === "orders" && segments[2] && /^\d+$/.test(segments[2])) pageLabel = `Chi tiết đơn #${segments[2]}`;
  if ((page === "supplier-orders" || page === "supplier-orders-admin") && segments[2] && /^\d+$/.test(segments[2])) {
    pageLabel = `Đơn NCC #${segments[2]}`;
  }

  const handleLogout = () => {
    logout();
    navigate("/lcs");
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
      <div className="flex items-center justify-between gap-2">
        {/* ── Left: hamburger + breadcrumb ── */}
        <div className="flex items-center gap-2 min-w-0">
          <IconButton
            variant="text"
            color="blue-gray"
            className="xl:hidden shrink-0"
            onClick={() => setOpenSidenav(dispatch, !openSidenav)}
          >
            <Bars3Icon strokeWidth={3} className="h-6 w-6 text-blue-gray-500" />
          </IconButton>
          <div className="min-w-0">
            <Breadcrumbs
              className={`bg-transparent p-0 transition-all hidden sm:flex ${fixedNavbar ? "mt-1" : ""}`}
            >
              <Link to="/dashboard/home">
                <Typography
                  variant="small"
                  color="blue-gray"
                  className="font-normal opacity-50 transition-all hover:text-blue-500 hover:opacity-100"
                >
                  Cafe — Đặt hàng NCC
                </Typography>
              </Link>
              <Typography variant="small" color="blue-gray" className="font-normal">
                {pageLabel}
              </Typography>
            </Breadcrumbs>
            <Typography variant="h6" color="blue-gray" className="truncate max-w-[160px] sm:max-w-none">
              {pageLabel}
            </Typography>
          </div>
        </div>

        {/* ── Right: bell + user ── */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Bell notification */}
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
            <MenuList className="w-[320px] sm:w-[340px] max-h-[80vh] overflow-y-auto border-0">
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

          {/* User menu — hiện trên mọi màn hình */}
          <Menu>
            <MenuHandler>
              <Button
                variant="text"
                color="blue-gray"
                className="flex items-center gap-1 px-2 sm:px-4 normal-case"
              >
                <UserCircleIcon className="h-5 w-5 text-blue-gray-500 shrink-0" />
                <span className="hidden sm:inline truncate max-w-[120px]">
                  {currentUser?.name || "User"}
                </span>
              </Button>
            </MenuHandler>
            <MenuList className="min-w-[200px]">
              <MenuItem disabled className="flex flex-col items-start gap-0.5 opacity-100">
                <Typography variant="small" className="font-semibold">{currentUser?.name ?? ""}</Typography>
                <Typography variant="small" color="gray" className="text-xs">{currentUser?.email ?? ""}</Typography>
                <Typography variant="small" color="blue" className="text-xs capitalize">{currentUser?.role ?? ""}</Typography>
              </MenuItem>
              <hr className="my-1 border-blue-gray-50" />
              <MenuItem onClick={() => navigate("/dashboard/settings")} className="flex items-center gap-2">
                <Cog6ToothIcon className="h-4 w-4" />
                Cài đặt
              </MenuItem>
              <MenuItem onClick={handleLogout} className="flex items-center gap-2 text-red-500">
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                Đăng xuất
              </MenuItem>
            </MenuList>
          </Menu>
        </div>
      </div>
    </Navbar>
  );
}

DashboardNavbar.displayName = "/src/widgets/layout/dashboard-navbar.jsx";

export default DashboardNavbar;
