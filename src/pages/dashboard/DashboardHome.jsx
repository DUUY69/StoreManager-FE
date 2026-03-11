import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Typography, Card, CardHeader, CardBody, Button, Chip } from "@material-tailwind/react";
import { StatisticsCard } from "@/widgets/cards";
import { StatisticsChart } from "@/widgets/charts";
import { chartsConfig } from "@/configs";
import { useAuth } from "@/context";
import { useData } from "@/context/DataContext";
import {
  ClipboardDocumentListIcon,
  TruckIcon,
  PlusCircleIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ShoppingCartIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/solid";
import { EllipsisVerticalIcon, ArrowUpIcon, ClockIcon } from "@heroicons/react/24/outline";

const icon = { className: "w-6 h-6 text-white" };

export function DashboardHome() {
  const navigate = useNavigate();
  const { currentUser, isAdmin, isStoreUser, isSupplierUser, storeName, supplierName } = useAuth();
  const { orders, useApi, apiLoading, apiError, refetchInitialData } = useData();

  const totalOrders = orders.length;
  const totalOrderSuppliers = orders.reduce((s, o) => s + (o.orderSuppliers || o.OrderSuppliers || []).length, 0);
  const totalAmount = orders.reduce((s, o) => s + Number(o.totalAmount ?? o.TotalAmount ?? 0), 0);
  const deliveringCount = orders.filter(
    (o) => o.status === "Accepted" || o.orderSuppliers?.some((os) => os.status === "Delivering")
  ).length;
  const today = new Date().toISOString().slice(0, 10);
  const lateCount = orders.reduce((sum, o) => {
    return sum + (o.orderSuppliers || []).filter((os) => {
      if (os.status === "Delivering" && os.expectedDeliveryDate) return os.expectedDeliveryDate < today;
      if (os.status === "Delivered" && os.actualDeliveryDate && os.expectedDeliveryDate) return os.actualDeliveryDate > os.expectedDeliveryDate;
      return false;
    }).length;
  }, 0);

  const storeIdUser = currentUser?.storeId ?? currentUser?.StoreId;
  const supplierIdUser = currentUser?.supplierId ?? currentUser?.SupplierId;
  const storeOrders = isStoreUser ? orders.filter((o) => (o.storeId ?? o.StoreId) === storeIdUser) : [];
  const supplierOrderSuppliers = isSupplierUser
    ? orders
        .filter((o) => ["Accepted", "Completed"].includes(o.status ?? o.Status))
        .flatMap((o) => o.orderSuppliers || o.OrderSuppliers || [])
        .filter((os) => Number(os.supplierId ?? os.SupplierId) === Number(supplierIdUser))
    : [];

  // Chart data: đơn theo tháng (Admin)
  const ordersByMonthChart = useMemo(() => {
    const months = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
    const count = months.map((_, i) => orders.filter((o) => o.orderDate && new Date(o.orderDate).getMonth() === i).length);
    return {
      type: "bar",
      height: 220,
      series: [{ name: "Số đơn", data: count }],
      options: {
        ...chartsConfig,
        colors: "#0288d1",
        plotOptions: { bar: { columnWidth: "60%", borderRadius: 5 } },
        xaxis: { ...chartsConfig.xaxis, categories: months },
      },
    };
  }, [orders]);

  const ordersByStatusChart = useMemo(() => {
    const statuses = ["Pending", "Rejected", "Accepted", "Completed"];
    const count = statuses.map((s) => orders.filter((o) => o.status === s).length);
    return {
      type: "bar",
      height: 220,
      series: [{ name: "Số đơn", data: count }],
      options: {
        ...chartsConfig,
        colors: "#388e3c",
        plotOptions: { bar: { columnWidth: "60%", borderRadius: 5 } },
        xaxis: { ...chartsConfig.xaxis, categories: statuses },
      },
    };
  }, [orders]);

  const ordersTrendChart = useMemo(() => {
    const weeks = ["Tuần 1", "Tuần 2", "Tuần 3", "Tuần 4"];
    const count = weeks.map((_, i) =>
      orders.filter((o) => o.orderDate && Math.ceil(new Date(o.orderDate).getDate() / 7) === i + 1).length
    );
    return {
      type: "line",
      height: 220,
      series: [{ name: "Đơn hàng", data: count }],
      options: {
        ...chartsConfig,
        colors: ["#0288d1"],
        stroke: { lineCap: "round" },
        markers: { size: 5 },
        xaxis: { ...chartsConfig.xaxis, categories: weeks },
      },
    };
  }, [orders]);

  // Sắp xếp đơn mới nhất trên cùng (theo ngày đặt giảm dần, rồi id giảm dần)
  const sortOrdersNewestFirst = (arr) =>
    [...arr].sort((a, b) => {
      const dA = a.orderDate ?? a.OrderDate ?? "";
      const dB = b.orderDate ?? b.OrderDate ?? "";
      if (dB !== dA) return String(dB).localeCompare(String(dA));
      return (b.id ?? b.Id ?? 0) - (a.id ?? a.Id ?? 0);
    });

  const recentOrders = useMemo(() => sortOrdersNewestFirst(orders).slice(0, 5), [orders]);
  const orderOverviewList = useMemo(() => {
    return sortOrdersNewestFirst(orders).slice(0, 6).map((o) => ({
      id: o.id ?? o.Id,
      title: `Đơn #${o.id ?? o.Id} - ${o.storeName ?? o.StoreName}`,
      description: `${o.orderDate ?? o.OrderDate} · ${o.status ?? o.Status}`,
      link: `/dashboard/orders/${o.id ?? o.Id}`,
    }));
  }, [orders]);

  const storeRecentOrders = useMemo(() => sortOrdersNewestFirst(storeOrders).slice(0, 5), [storeOrders]);
  const storeOrderOverviewList = useMemo(() => {
    return sortOrdersNewestFirst(storeOrders).slice(0, 6).map((o) => ({
      id: o.id ?? o.Id,
      title: `Đơn #${o.id ?? o.Id} - ${o.storeName ?? o.StoreName}`,
      description: `${o.orderDate ?? o.OrderDate} · ${o.status ?? o.Status}`,
      link: `/dashboard/orders/${o.id ?? o.Id}`,
    }));
  }, [storeOrders]);

  /** Gắn order cha cho từng đơn NCC, sắp mới nhất trước */
  const supplierOsWithOrder = useMemo(() => {
    const list = supplierOrderSuppliers.map((os) => {
      const order = orders.find((o) => (o.orderSuppliers || o.OrderSuppliers || []).some((x) => (x.id ?? x.Id) === (os.id ?? os.Id)));
      return { os, order };
    });
    list.sort((a, b) => {
      const dA = a.order?.orderDate ?? a.order?.OrderDate ?? "";
      const dB = b.order?.orderDate ?? b.order?.OrderDate ?? "";
      if (dB !== dA) return String(dB).localeCompare(String(dA));
      return (b.os?.id ?? b.os?.Id ?? 0) - (a.os?.id ?? a.os?.Id ?? 0);
    });
    return list;
  }, [supplierOrderSuppliers, orders]);

  /** Danh sách đơn NCC pending để NCC bấm vào xử lý (mới nhất trên cùng) */
  const supplierPendingList = useMemo(() => {
    const pending = supplierOsWithOrder.filter(({ os }) => (os.status ?? os.Status) === "Pending");
    return pending.slice(0, 5).map(({ os, order }) => ({
      id: os.id ?? os.Id,
      orderId: order?.id ?? order?.Id,
      title: `Đơn NCC #${os.id ?? os.Id}`,
      description: order ? `${order.storeName ?? order.StoreName} · Đơn #${order.id ?? order.Id}` : "",
      link: `/dashboard/supplier-orders/${os.id ?? os.Id}`,
    }));
  }, [supplierOsWithOrder]);

  /** Đơn NCC gần đây (dùng cho bảng + tổng quan, giống Admin) */
  const supplierRecentList = useMemo(() => supplierOsWithOrder.slice(0, 5), [supplierOsWithOrder]);
  const supplierOverviewList = useMemo(() => supplierOsWithOrder.slice(0, 6).map(({ os, order }) => ({
    id: os.id ?? os.Id,
    title: `Đơn NCC #${os.id ?? os.Id} – ${order?.storeName ?? order?.StoreName ?? ""}`,
    description: order ? `${order.orderDate ?? order.OrderDate} · ${os.status ?? os.Status}` : String(os.status ?? os.Status),
    link: `/dashboard/supplier-orders/${os.id ?? os.Id}`,
  })), [supplierOsWithOrder]);

  /** Chart đơn NCC theo tháng / trạng thái / tuần */
  const supplierOrdersByMonthChart = useMemo(() => {
    const months = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
    const count = months.map((_, i) => supplierOsWithOrder.filter(({ order }) => {
      const d = order?.orderDate ?? order?.OrderDate;
      return d && new Date(d).getMonth() === i;
    }).length);
    return { type: "bar", height: 220, series: [{ name: "Số đơn NCC", data: count }], options: { ...chartsConfig, colors: "#0288d1", plotOptions: { bar: { columnWidth: "60%", borderRadius: 5 } }, xaxis: { ...chartsConfig.xaxis, categories: months } } };
  }, [supplierOsWithOrder]);
  const supplierOrdersByStatusChart = useMemo(() => {
    const statuses = ["Pending", "Accepted", "Rejected", "Delivering", "Delivered"];
    const count = statuses.map((s) => supplierOrderSuppliers.filter((os) => (os.status ?? os.Status) === s).length);
    return { type: "bar", height: 220, series: [{ name: "Số đơn", data: count }], options: { ...chartsConfig, colors: "#388e3c", plotOptions: { bar: { columnWidth: "60%", borderRadius: 5 } }, xaxis: { ...chartsConfig.xaxis, categories: statuses } } };
  }, [supplierOrderSuppliers]);
  const supplierOrdersTrendChart = useMemo(() => {
    const weeks = ["Tuần 1", "Tuần 2", "Tuần 3", "Tuần 4"];
    const count = weeks.map((_, i) => supplierOsWithOrder.filter(({ order }) => {
      const d = order?.orderDate ?? order?.OrderDate;
      return d && Math.ceil(new Date(d).getDate() / 7) === i + 1;
    }).length);
    return { type: "line", height: 220, series: [{ name: "Đơn NCC", data: count }], options: { ...chartsConfig, colors: ["#0288d1"], stroke: { lineCap: "round" }, markers: { size: 5 }, xaxis: { ...chartsConfig.xaxis, categories: weeks } } };
  }, [supplierOsWithOrder]);

  const storeOrdersByMonthChart = useMemo(() => {
    const months = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
    const count = months.map((_, i) => storeOrders.filter((o) => o.orderDate && new Date(o.orderDate).getMonth() === i).length);
    return { type: "bar", height: 220, series: [{ name: "Số đơn", data: count }], options: { ...chartsConfig, colors: "#0288d1", plotOptions: { bar: { columnWidth: "60%", borderRadius: 5 } }, xaxis: { ...chartsConfig.xaxis, categories: months } } };
  }, [storeOrders]);
  const storeOrdersByStatusChart = useMemo(() => {
    const statuses = ["Pending", "Rejected", "Accepted", "Completed"];
    const count = statuses.map((s) => storeOrders.filter((o) => o.status === s).length);
    return { type: "bar", height: 220, series: [{ name: "Số đơn", data: count }], options: { ...chartsConfig, colors: "#388e3c", plotOptions: { bar: { columnWidth: "60%", borderRadius: 5 } }, xaxis: { ...chartsConfig.xaxis, categories: statuses } } };
  }, [storeOrders]);
  const storeOrdersTrendChart = useMemo(() => {
    const weeks = ["Tuần 1", "Tuần 2", "Tuần 3", "Tuần 4"];
    const count = weeks.map((_, i) => storeOrders.filter((o) => o.orderDate && Math.ceil(new Date(o.orderDate).getDate() / 7) === i + 1).length);
    return { type: "line", height: 220, series: [{ name: "Đơn hàng", data: count }], options: { ...chartsConfig, colors: ["#0288d1"], stroke: { lineCap: "round" }, markers: { size: 5 }, xaxis: { ...chartsConfig.xaxis, categories: weeks } } };
  }, [storeOrders]);

  const pendingSupplier = supplierOrderSuppliers.filter((os) => (os.status ?? os.Status) === "Pending").length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDelivery = supplierOrderSuppliers.filter((os) => {
    const d = os.expectedDeliveryDate ?? os.ExpectedDeliveryDate;
    return d && String(d).slice(0, 10) === todayStr;
  }).length;

  return (
    <div className="mt-12">
      {isAdmin && (
        <>
          <div className="mb-12 grid gap-y-10 gap-x-6 md:grid-cols-2 xl:grid-cols-4">
            <StatisticsCard
              color="blue"
              icon={<ClipboardDocumentListIcon {...icon} />}
              title="Tổng đơn lớn"
              value={String(totalOrders)}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <strong className="text-blue-500">Đơn tổng (Orders)</strong>
                </Typography>
              }
            />
            <StatisticsCard
              color="teal"
              icon={<TruckIcon {...icon} />}
              title="Tổng đơn nhỏ (NCC)"
              value={String(totalOrderSuppliers)}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <strong className="text-teal-600">Đơn theo NCC (OrderSuppliers)</strong>
                </Typography>
              }
            />
            <StatisticsCard
              color="green"
              icon={<ShoppingCartIcon {...icon} />}
              title="Tổng tiền"
              value={totalAmount >= 1e6 ? `${(totalAmount / 1e6).toFixed(1)} tr` : totalAmount.toLocaleString("vi-VN")}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <strong className="text-green-600">{totalAmount.toLocaleString("vi-VN")} đ</strong>
                </Typography>
              }
            />
            <StatisticsCard
              color="orange"
              icon={<TruckIcon {...icon} />}
              title="Đơn đang giao"
              value={String(deliveringCount)}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <strong className="text-orange-500">Chấp nhận / Đang giao</strong>
                </Typography>
              }
            />
            <StatisticsCard
              color="red"
              icon={<ExclamationTriangleIcon {...icon} />}
              title="NCC giao trễ"
              value={String(lateCount)}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <strong className="text-red-500">Cần theo dõi</strong>
                </Typography>
              }
            />
            <StatisticsCard
              color="amber"
              icon={<ChartBarIcon {...icon} />}
              title="Báo cáo tháng"
              value="Xem"
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <Link to="/dashboard/reports">
                    <strong className="text-amber-600">Đến trang Report</strong>
                  </Link>
                </Typography>
              }
            />
          </div>
          <div className="mb-6 grid grid-cols-1 gap-y-12 gap-x-6 md:grid-cols-2 xl:grid-cols-3">
            <StatisticsChart
              color="white"
              title="Xem đơn theo tháng"
              description="Số đơn tạo theo từng tháng"
              chart={ordersByMonthChart}
              footer={
                <Typography variant="small" className="flex items-center font-normal text-blue-gray-600">
                  <ClockIcon strokeWidth={2} className="h-4 w-4 text-blue-gray-400 mr-1" />
                  {useApi ? "Dữ liệu từ API (đơn hàng)" : "Dữ liệu local"}
                </Typography>
              }
            />
            <StatisticsChart
              color="white"
              title="Doanh số đơn hàng"
              description="Xu hướng đơn theo tuần"
              chart={ordersTrendChart}
              footer={
                <Typography variant="small" className="flex items-center font-normal text-blue-gray-600">
                  <ClockIcon strokeWidth={2} className="h-4 w-4 text-blue-gray-400 mr-1" />
                  {useApi ? "Dữ liệu từ API" : "Dữ liệu local"}
                </Typography>
              }
            />
            <StatisticsChart
              color="white"
              title="Các đơn theo trạng thái"
              description="Pending, Rejected, Accepted, Completed"
              chart={ordersByStatusChart}
              footer={
                <Typography variant="small" className="flex items-center font-normal text-blue-gray-600">
                  <ClockIcon strokeWidth={2} className="h-4 w-4 text-blue-gray-400 mr-1" />
                  Tổng {totalOrders} đơn
                </Typography>
              }
            />
          </div>
          <div className="mb-4 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="overflow-hidden xl:col-span-2 border border-blue-gray-100 shadow-sm">
              <CardHeader
                floated={false}
                shadow={false}
                color="transparent"
                className="m-0 flex items-center justify-between p-6"
              >
                <div>
                  <Typography variant="h6" color="blue-gray" className="mb-1">
                    Đơn gần đây
                  </Typography>
                  <Typography variant="small" className="flex items-center gap-1 font-normal text-blue-gray-600">
                    <CheckCircleIcon strokeWidth={3} className="h-4 w-4 text-blue-gray-200" />
                    <strong>{recentOrders.length} đơn</strong> mới nhất
                  </Typography>
                </div>
                <Link to="/dashboard/orders">
                  <Button size="sm" variant="outlined">Xem tất cả</Button>
                </Link>
              </CardHeader>
              <CardBody className="overflow-x-auto px-0 pt-0 pb-2">
                <table className="w-full table-fixed" style={{ tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th className="border-b border-blue-gray-50 py-3 px-4 text-left" style={{ width: "6%" }}><Typography variant="small" className="text-[11px] font-medium uppercase text-blue-gray-400">Mã đơn</Typography></th>
                      <th className="border-b border-blue-gray-50 py-3 px-4 text-left" style={{ width: "28%" }}><Typography variant="small" className="text-[11px] font-medium uppercase text-blue-gray-400">Cửa hàng</Typography></th>
                      <th className="border-b border-blue-gray-50 py-3 px-4 text-left" style={{ width: "12%" }}><Typography variant="small" className="text-[11px] font-medium uppercase text-blue-gray-400">Ngày đặt</Typography></th>
                      <th className="border-b border-blue-gray-50 py-3 px-4 text-left" style={{ width: "18%" }}><Typography variant="small" className="text-[11px] font-medium uppercase text-blue-gray-400">Trạng thái</Typography></th>
                      <th className="border-b border-blue-gray-50 py-3 px-4 text-left" style={{ width: "36%" }}><Typography variant="small" className="text-[11px] font-medium uppercase text-blue-gray-400">Thao tác</Typography></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((o) => {
                      const oid = o.id ?? o.Id;
                      return (
                      <tr key={oid} className="hover:bg-blue-gray-50/50">
                        <td className="border-b border-blue-gray-50 py-3 px-4"><Typography variant="small" className="font-semibold">#{oid}</Typography></td>
                        <td className="border-b border-blue-gray-50 py-3 px-4 min-w-0"><Typography variant="small" className="truncate block" title={o.storeName ?? o.StoreName}>{o.storeName ?? o.StoreName}</Typography></td>
                        <td className="border-b border-blue-gray-50 py-3 px-4 whitespace-nowrap"><Typography variant="small">{o.orderDate ?? o.OrderDate}</Typography></td>
                        <td className="border-b border-blue-gray-50 py-3 px-4"><Chip size="sm" value={o.status ?? o.Status} color={(o.status ?? o.Status) === "Completed" ? "green" : (o.status ?? o.Status) === "Rejected" ? "red" : (o.status ?? o.Status) === "Accepted" ? "amber" : "blue"} className="w-fit max-w-full truncate" /></td>
                        <td className="border-b border-blue-gray-50 py-3 px-4">
                          <Button size="sm" variant="text" className="p-1 text-xs font-semibold text-blue-600" onClick={() => navigate(`/dashboard/orders/${oid}`)}>
                            Xem / Theo dõi
                          </Button>
                        </td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </CardBody>
            </Card>
            <Card className="border border-blue-gray-100 shadow-sm">
              <CardHeader floated={false} shadow={false} color="transparent" className="m-0 p-6">
                <Typography variant="h6" color="blue-gray" className="mb-2">
                  Tổng quan đơn hàng
                </Typography>
                <Typography variant="small" className="flex items-center gap-1 font-normal text-blue-gray-600">
                  <ArrowUpIcon strokeWidth={3} className="h-3.5 w-3.5 text-green-500" />
                  <strong>↑ {totalOrders}</strong> đơn trong hệ thống
                </Typography>
              </CardHeader>
              <CardBody className="pt-0">
                {orderOverviewList.map((item, key) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(item.link)}
                    onKeyDown={(e) => e.key === "Enter" && navigate(item.link)}
                    className="flex items-start gap-4 py-3 cursor-pointer hover:bg-blue-gray-50/50 rounded-lg px-2 -mx-2 transition-colors"
                  >
                    <div
                      className={`relative p-1 after:absolute after:-bottom-6 after:left-2/4 after:w-0.5 after:-translate-x-2/4 after:bg-blue-gray-50 after:content-[''] ${
                        key === orderOverviewList.length - 1 ? "after:h-0" : "after:h-4/6"
                      }`}
                    >
                      <ShoppingCartIcon className="!w-5 !h-5 text-blue-gray-300" />
                    </div>
                    <div className="min-w-0">
                      <Typography variant="small" color="blue-gray" className="block font-medium">
                        {item.title}
                      </Typography>
                      <Typography as="span" variant="small" className="text-xs font-medium text-blue-gray-500">
                        {item.description}
                      </Typography>
                      <Typography variant="small" className="text-blue-600 text-xs mt-0.5 block">
                        Bấm để xử lý đơn →
                      </Typography>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </>
      )}

      {isStoreUser && (
        <>
          {(() => {
            const storeTotalOs = storeOrders.reduce((s, o) => s + (o.orderSuppliers || o.OrderSuppliers || []).length, 0);
            const storeTotalAmt = storeOrders.reduce((s, o) => s + Number(o.totalAmount ?? o.TotalAmount ?? 0), 0);
            return (
          <div className="mb-12 grid gap-y-10 gap-x-6 md:grid-cols-2 xl:grid-cols-4">
            <StatisticsCard
              color="blue"
              icon={<ClipboardDocumentListIcon {...icon} />}
              title="Tổng đơn lớn"
              value={String(storeOrders.length)}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <strong className="text-blue-500">{storeName}</strong>
                </Typography>
              }
            />
            <StatisticsCard
              color="teal"
              icon={<TruckIcon {...icon} />}
              title="Tổng đơn nhỏ (NCC)"
              value={String(storeTotalOs)}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <strong className="text-teal-600">Đơn theo NCC</strong>
                </Typography>
              }
            />
            <StatisticsCard
              color="green"
              icon={<ShoppingCartIcon {...icon} />}
              title="Tổng tiền"
              value={storeTotalAmt >= 1e6 ? `${(storeTotalAmt / 1e6).toFixed(1)} tr` : storeTotalAmt.toLocaleString("vi-VN")}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <strong className="text-green-600">{storeTotalAmt.toLocaleString("vi-VN")} đ</strong>
                </Typography>
              }
            />
            <StatisticsCard
              color="orange"
              icon={<TruckIcon {...icon} />}
              title="Đơn đang giao"
              value={String(storeOrders.filter((o) => o.status === "Accepted").length)}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <strong className="text-orange-500">Chấp nhận / Đang giao</strong>
                </Typography>
              }
            />
            <StatisticsCard
              color="red"
              icon={<ExclamationTriangleIcon {...icon} />}
              title="Đơn chờ xử lý"
              value={String(storeOrders.filter((o) => o.status === "Pending").length)}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <strong className="text-red-500">Chờ</strong>
                </Typography>
              }
            />
            <StatisticsCard
              color="amber"
              icon={<ChartBarIcon {...icon} />}
              title="Tạo đơn / Theo dõi"
              value="→"
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <Link to="/dashboard/create-order"><strong className="text-amber-600">Tạo đơn</strong></Link>
                  {" · "}
                  <Link to="/dashboard/orders"><strong className="text-amber-600">Danh sách đơn</strong></Link>
                </Typography>
              }
            />
          </div>
            );
          })()}
          <div className="mb-6 grid grid-cols-1 gap-y-12 gap-x-6 md:grid-cols-2 xl:grid-cols-3">
            <StatisticsChart
              color="white"
              title="Xem đơn theo tháng"
              description={`Số đơn của ${storeName} theo tháng`}
              chart={storeOrdersByMonthChart}
              footer={
                <Typography variant="small" className="flex items-center font-normal text-blue-gray-600">
                  <ClockIcon strokeWidth={2} className="h-4 w-4 text-blue-gray-400 mr-1" />
                  Dữ liệu cửa hàng
                </Typography>
              }
            />
            <StatisticsChart
              color="white"
              title="Doanh số đơn hàng"
              description="Xu hướng đơn theo tuần"
              chart={storeOrdersTrendChart}
              footer={
                <Typography variant="small" className="flex items-center font-normal text-blue-gray-600">
                  <ClockIcon strokeWidth={2} className="h-4 w-4 text-blue-gray-400 mr-1" />
                  Đã cập nhật gần đây
                </Typography>
              }
            />
            <StatisticsChart
              color="white"
              title="Các đơn theo trạng thái"
              description="Pending, Rejected, Accepted, Completed"
              chart={storeOrdersByStatusChart}
              footer={
                <Typography variant="small" className="flex items-center font-normal text-blue-gray-600">
                  <ClockIcon strokeWidth={2} className="h-4 w-4 text-blue-gray-400 mr-1" />
                  Tổng {storeOrders.length} đơn
                </Typography>
              }
            />
          </div>
          <div className="mb-4 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="overflow-hidden xl:col-span-2 border border-blue-gray-100 shadow-sm">
              <CardHeader
                floated={false}
                shadow={false}
                color="transparent"
                className="m-0 flex items-center justify-between p-6"
              >
                <div>
                  <Typography variant="h6" color="blue-gray" className="mb-1">Đơn gần đây</Typography>
                  <Typography variant="small" className="flex items-center gap-1 font-normal text-blue-gray-600">
                    <CheckCircleIcon strokeWidth={3} className="h-4 w-4 text-blue-gray-200" />
                    <strong>{storeRecentOrders.length} đơn</strong> mới nhất
                  </Typography>
                </div>
                <Link to="/dashboard/orders">
                  <Button size="sm" variant="outlined">Xem tất cả</Button>
                </Link>
              </CardHeader>
              <CardBody className="overflow-x-auto px-0 pt-0 pb-2">
                <table className="w-full table-fixed" style={{ tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th className="border-b border-blue-gray-50 py-3 px-4 text-left" style={{ width: "6%" }}><Typography variant="small" className="text-[11px] font-medium uppercase text-blue-gray-400">Mã đơn</Typography></th>
                      <th className="border-b border-blue-gray-50 py-3 px-4 text-left" style={{ width: "28%" }}><Typography variant="small" className="text-[11px] font-medium uppercase text-blue-gray-400">Cửa hàng</Typography></th>
                      <th className="border-b border-blue-gray-50 py-3 px-4 text-left" style={{ width: "12%" }}><Typography variant="small" className="text-[11px] font-medium uppercase text-blue-gray-400">Ngày đặt</Typography></th>
                      <th className="border-b border-blue-gray-50 py-3 px-4 text-left" style={{ width: "18%" }}><Typography variant="small" className="text-[11px] font-medium uppercase text-blue-gray-400">Trạng thái</Typography></th>
                      <th className="border-b border-blue-gray-50 py-3 px-4 text-left" style={{ width: "36%" }}><Typography variant="small" className="text-[11px] font-medium uppercase text-blue-gray-400">Thao tác</Typography></th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeRecentOrders.map((o) => {
                      const oid = o.id ?? o.Id;
                      return (
                      <tr key={oid} className="hover:bg-blue-gray-50/50">
                        <td className="border-b border-blue-gray-50 py-3 px-4"><Typography variant="small" className="font-semibold">#{oid}</Typography></td>
                        <td className="border-b border-blue-gray-50 py-3 px-4 min-w-0"><Typography variant="small" className="truncate block" title={o.storeName ?? o.StoreName}>{o.storeName ?? o.StoreName}</Typography></td>
                        <td className="border-b border-blue-gray-50 py-3 px-4 whitespace-nowrap"><Typography variant="small">{o.orderDate ?? o.OrderDate}</Typography></td>
                        <td className="border-b border-blue-gray-50 py-3 px-4"><Chip size="sm" value={o.status ?? o.Status} color={(o.status ?? o.Status) === "Completed" ? "green" : (o.status ?? o.Status) === "Rejected" ? "red" : (o.status ?? o.Status) === "Accepted" ? "amber" : "blue"} className="w-fit max-w-full truncate" /></td>
                        <td className="border-b border-blue-gray-50 py-3 px-4">
                          <Button size="sm" variant="text" className="p-1 text-xs font-semibold text-blue-600" onClick={() => navigate(`/dashboard/orders/${oid}`)}>
                            Xem / Theo dõi
                          </Button>
                        </td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </CardBody>
            </Card>
            <Card className="border border-blue-gray-100 shadow-sm">
              <CardHeader floated={false} shadow={false} color="transparent" className="m-0 p-6">
                <Typography variant="h6" color="blue-gray" className="mb-2">Tổng quan đơn hàng</Typography>
                <Typography variant="small" className="flex items-center gap-1 font-normal text-blue-gray-600">
                  <ArrowUpIcon strokeWidth={3} className="h-3.5 w-3.5 text-green-500" />
                  <strong>↑ {storeOrders.length}</strong> đơn của cửa hàng
                </Typography>
              </CardHeader>
              <CardBody className="pt-0">
                {storeOrderOverviewList.map((item, key) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(item.link)}
                    onKeyDown={(e) => e.key === "Enter" && navigate(item.link)}
                    className="flex items-start gap-4 py-3 cursor-pointer hover:bg-blue-gray-50/50 rounded-lg px-2 -mx-2 transition-colors"
                  >
                    <div className={`relative p-1 after:absolute after:-bottom-6 after:left-2/4 after:w-0.5 after:-translate-x-2/4 after:bg-blue-gray-50 after:content-[''] ${key === storeOrderOverviewList.length - 1 ? "after:h-0" : "after:h-4/6"}`}>
                      <ShoppingCartIcon className="!w-5 !h-5 text-blue-gray-300" />
                    </div>
                    <div className="min-w-0">
                      <Typography variant="small" color="blue-gray" className="block font-medium">{item.title}</Typography>
                      <Typography as="span" variant="small" className="text-xs font-medium text-blue-gray-500">{item.description}</Typography>
                      <Typography variant="small" className="text-blue-600 text-xs mt-0.5 block">Bấm để xử lý đơn →</Typography>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </>
      )}

      {isSupplierUser && (
        <>
          {(() => {
            const supplierTotalAmt = supplierOrderSuppliers.reduce((s, os) => s + Number(os.totalAmount ?? os.TotalAmount ?? 0), 0);
            return (
          <div className="mb-12 grid gap-y-10 gap-x-6 md:grid-cols-2 xl:grid-cols-4">
            <StatisticsCard
              color="blue"
              icon={<ClipboardDocumentListIcon {...icon} />}
              title="Tổng đơn nhỏ (NCC)"
              value={String(supplierOrderSuppliers.length)}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <strong className="text-blue-500">{supplierName}</strong>
                </Typography>
              }
            />
            <StatisticsCard
              color="green"
              icon={<ShoppingCartIcon {...icon} />}
              title="Tổng tiền"
              value={supplierTotalAmt >= 1e6 ? `${(supplierTotalAmt / 1e6).toFixed(1)} tr` : supplierTotalAmt.toLocaleString("vi-VN")}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <strong className="text-green-600">{supplierTotalAmt.toLocaleString("vi-VN")} đ</strong>
                </Typography>
              }
            />
            <StatisticsCard
              color="orange"
              icon={<ClipboardDocumentListIcon {...icon} />}
              title="Đơn mới (Pending)"
              value={String(pendingSupplier)}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  Cần xác nhận
                </Typography>
              }
            />
            <StatisticsCard
              color="red"
              icon={<TruckIcon {...icon} />}
              title="Đơn giao dự kiến hôm nay"
              value={String(todayDelivery)}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  Dự kiến giao hôm nay
                </Typography>
              }
            />
            <StatisticsCard
              color="amber"
              icon={<ChartBarIcon {...icon} />}
              title="Danh sách đơn"
              value="Xem"
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <Link to="/dashboard/supplier-orders">
                    <strong className="text-amber-600">Đơn cần xử lý</strong>
                  </Link>
                </Typography>
              }
            />
          </div>
            );
          })()}
          <div className="mb-6 grid grid-cols-1 gap-y-12 gap-x-6 md:grid-cols-2 xl:grid-cols-3">
            <StatisticsChart
              color="white"
              title="Đơn NCC theo tháng"
              description={`Số đơn của ${supplierName} theo tháng`}
              chart={supplierOrdersByMonthChart}
              footer={
                <Typography variant="small" className="flex items-center font-normal text-blue-gray-600">
                  <ClockIcon strokeWidth={2} className="h-4 w-4 text-blue-gray-400 mr-1" />
                  Dữ liệu từ API
                </Typography>
              }
            />
            <StatisticsChart
              color="white"
              title="Xu hướng đơn NCC"
              description="Theo tuần"
              chart={supplierOrdersTrendChart}
              footer={
                <Typography variant="small" className="flex items-center font-normal text-blue-gray-600">
                  <ClockIcon strokeWidth={2} className="h-4 w-4 text-blue-gray-400 mr-1" />
                  Đã cập nhật gần đây
                </Typography>
              }
            />
            <StatisticsChart
              color="white"
              title="Đơn NCC theo trạng thái"
              description="Pending, Accepted, Delivering, Delivered..."
              chart={supplierOrdersByStatusChart}
              footer={
                <Typography variant="small" className="flex items-center font-normal text-blue-gray-600">
                  <ClockIcon strokeWidth={2} className="h-4 w-4 text-blue-gray-400 mr-1" />
                  Tổng {supplierOrderSuppliers.length} đơn
                </Typography>
              }
            />
          </div>
          <div className="mb-4 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="overflow-hidden xl:col-span-2 border border-blue-gray-100 shadow-sm">
              <CardHeader
                floated={false}
                shadow={false}
                color="transparent"
                className="m-0 flex items-center justify-between p-6"
              >
                <div>
                  <Typography variant="h6" color="blue-gray" className="mb-1">
                    Đơn NCC gần đây
                  </Typography>
                  <Typography variant="small" className="flex items-center gap-1 font-normal text-blue-gray-600">
                    <CheckCircleIcon strokeWidth={3} className="h-4 w-4 text-blue-gray-200" />
                    <strong>{supplierRecentList.length} đơn</strong> mới nhất
                  </Typography>
                </div>
                <Link to="/dashboard/supplier-orders">
                  <Button size="sm" variant="outlined">Xem tất cả</Button>
                </Link>
              </CardHeader>
              <CardBody className="overflow-x-auto px-0 pt-0 pb-2">
                <table className="w-full table-fixed" style={{ tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th className="border-b border-blue-gray-50 py-3 px-4 text-left" style={{ width: "10%" }}><Typography variant="small" className="text-[11px] font-medium uppercase text-blue-gray-400">Mã đơn NCC</Typography></th>
                      <th className="border-b border-blue-gray-50 py-3 px-4 text-left" style={{ width: "28%" }}><Typography variant="small" className="text-[11px] font-medium uppercase text-blue-gray-400">Cửa hàng</Typography></th>
                      <th className="border-b border-blue-gray-50 py-3 px-4 text-left" style={{ width: "14%" }}><Typography variant="small" className="text-[11px] font-medium uppercase text-blue-gray-400">Ngày đặt</Typography></th>
                      <th className="border-b border-blue-gray-50 py-3 px-4 text-left" style={{ width: "20%" }}><Typography variant="small" className="text-[11px] font-medium uppercase text-blue-gray-400">Trạng thái</Typography></th>
                      <th className="border-b border-blue-gray-50 py-3 px-4 text-left" style={{ width: "28%" }}><Typography variant="small" className="text-[11px] font-medium uppercase text-blue-gray-400">Thao tác</Typography></th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierRecentList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center">
                          <Typography variant="small" color="gray">Chưa có đơn NCC nào.</Typography>
                        </td>
                      </tr>
                    ) : supplierRecentList.map(({ os, order }) => {
                      const osId = os.id ?? os.Id;
                      const status = os.status ?? os.Status;
                      return (
                        <tr key={osId} className="hover:bg-blue-gray-50/50">
                          <td className="border-b border-blue-gray-50 py-3 px-4"><Typography variant="small" className="font-semibold">#{osId}</Typography></td>
                          <td className="border-b border-blue-gray-50 py-3 px-4 min-w-0"><Typography variant="small" className="truncate block" title={order?.storeName ?? order?.StoreName}>{order?.storeName ?? order?.StoreName ?? "-"}</Typography></td>
                          <td className="border-b border-blue-gray-50 py-3 px-4 whitespace-nowrap"><Typography variant="small">{order?.orderDate ?? order?.OrderDate ?? "-"}</Typography></td>
                          <td className="border-b border-blue-gray-50 py-3 px-4"><Chip size="sm" value={status} color={status === "Delivered" ? "green" : status === "Pending" ? "indigo" : status === "Rejected" ? "red" : status === "Delivering" ? "orange" : "blue"} className="w-fit max-w-full truncate" /></td>
                          <td className="border-b border-blue-gray-50 py-3 px-4">
                            <Button size="sm" variant="text" className="p-1 text-xs font-semibold text-blue-600" onClick={() => navigate(`/dashboard/supplier-orders/${osId}`)}>
                              Xem / Xử lý
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardBody>
            </Card>
            <Card className="border border-blue-gray-100 shadow-sm">
              <CardHeader floated={false} shadow={false} color="transparent" className="m-0 p-6">
                <Typography variant="h6" color="blue-gray" className="mb-2">
                  Tổng quan đơn NCC
                </Typography>
                <Typography variant="small" className="flex items-center gap-1 font-normal text-blue-gray-600">
                  <ArrowUpIcon strokeWidth={3} className="h-3.5 w-3.5 text-green-500" />
                  <strong>↑ {supplierOrderSuppliers.length}</strong> đơn của NCC
                </Typography>
              </CardHeader>
              <CardBody className="pt-0">
                {supplierOverviewList.map((item, key) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(item.link)}
                    onKeyDown={(e) => e.key === "Enter" && navigate(item.link)}
                    className="flex items-start gap-4 py-3 cursor-pointer hover:bg-blue-gray-50/50 rounded-lg px-2 -mx-2 transition-colors"
                  >
                    <div className={`relative p-1 after:absolute after:-bottom-6 after:left-2/4 after:w-0.5 after:-translate-x-2/4 after:bg-blue-gray-50 after:content-[''] ${key === supplierOverviewList.length - 1 ? "after:h-0" : "after:h-4/6"}`}>
                      <ShoppingCartIcon className="!w-5 !h-5 text-blue-gray-300" />
                    </div>
                    <div className="min-w-0">
                      <Typography variant="small" color="blue-gray" className="block font-medium">{item.title}</Typography>
                      <Typography as="span" variant="small" className="text-xs font-medium text-blue-gray-500">{item.description}</Typography>
                      <Typography variant="small" className="text-blue-600 text-xs mt-0.5 block">Bấm để xử lý đơn →</Typography>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
          <Card className="border border-blue-gray-100 mt-4">
            <CardBody>
              <Typography variant="h6" color="blue-gray">
                NCC: <strong>{supplierName}</strong>. Vào "Đơn cần xử lý" để Chấp nhận / Từ chối / cập nhật Đang giao / Giao hoàn thành.
              </Typography>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

export default DashboardHome;
