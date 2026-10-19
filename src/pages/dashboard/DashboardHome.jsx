import React, { useMemo, useEffect, useState } from "react";
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
  InboxStackIcon,
} from "@heroicons/react/24/solid";
import { EllipsisVerticalIcon, ArrowUpIcon, ClockIcon } from "@heroicons/react/24/outline";
import { computeProductDemandOpen, getWeekRange, getMonthRange, filterOrdersByOrderDate, formatDemandDateRangeLabel, PRODUCT_DEMAND_RULES_NOTE } from "@/utils/productDemand";
import { useUrlFilters, LIST_FILTER_PATHS } from "@/utils/urlFilters";

const HOME_FILTER_STORAGE = LIST_FILTER_PATHS["/home"];

const HOME_FILTER_DEFAULTS = { statsFrom: "", statsTo: "", demandFrom: "", demandTo: "" };

const icon = { className: "w-6 h-6 text-white" };

/** Bọc thẻ thống kê: bấm để chuyển trang (Admin). */
function ClickableStat({ children, onNavigate, hint }) {
  if (!onNavigate) return children;
  return (
    <div
      role="button"
      tabIndex={0}
      title={hint}
      onClick={onNavigate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNavigate();
        }
      }}
      className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer hover:opacity-95 active:opacity-90 transition-opacity"
    >
      {children}
    </div>
  );
}

export function DashboardHome() {
  const navigate = useNavigate();
  const { currentUser, isAdmin, isStoreUser, isSupplierUser, storeName, supplierName } = useAuth();
  const { orders, useApi, apiLoading, apiError, refetchInitialData, refetchOrders } = useData();

  useEffect(() => {
    if (!isAdmin || !useApi) return;
    const onVis = () => {
      if (document.visibilityState === "visible") refetchOrders();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isAdmin, useApi, refetchOrders]);

  const thisWeek = useMemo(() => getWeekRange(0), []);
  const thisMonth = useMemo(() => getMonthRange(0), []);
  const { values, setFilter, setFilters } = useUrlFilters(HOME_FILTER_DEFAULTS, { storageKey: HOME_FILTER_STORAGE });
  const statsDateFrom = values.statsFrom || thisWeek.from;
  const statsDateTo = values.statsTo || thisWeek.to;

  const ordersInStatsRange = useMemo(
    () => filterOrdersByOrderDate(orders, statsDateFrom, statsDateTo),
    [orders, statsDateFrom, statsDateTo]
  );

  const totalOrders = ordersInStatsRange.length;
  const totalOrderSuppliers = ordersInStatsRange.reduce(
    (s, o) => s + (o.orderSuppliers || o.OrderSuppliers || []).length,
    0
  );
  const totalAmount = ordersInStatsRange.reduce(
    (s, o) => s + Number(o.totalAmount ?? o.TotalAmount ?? 0),
    0
  );
  const deliveringCount = ordersInStatsRange.filter((o) => {
    const st = o.status ?? o.Status;
    if (st === "Delivering" || st === "Accepted") return true;
    return (o.orderSuppliers || o.OrderSuppliers || []).some((os) => (os.status ?? os.Status) === "Delivering");
  }).length;
  const today = new Date().toISOString().slice(0, 10);
  const lateCount = ordersInStatsRange.reduce((sum, o) => {
    return sum + (o.orderSuppliers || o.OrderSuppliers || []).filter((os) => {
      const ost = os.status ?? os.Status;
      if (ost === "Delivering" && os.expectedDeliveryDate) return os.expectedDeliveryDate < today;
      if (ost === "Delivered" && os.actualDeliveryDate && os.expectedDeliveryDate) return os.actualDeliveryDate > os.expectedDeliveryDate;
      return false;
    }).length;
  }, 0);

  const statsOrdersQuery = () => {
    const p = new URLSearchParams();
    if (statsDateFrom) p.set("dateFrom", statsDateFrom);
    if (statsDateTo) p.set("dateTo", statsDateTo);
    const q = p.toString();
    return q ? `?${q}` : "";
  };

  /** Đếm nhanh cho lối tắt (nếu JSX cũ còn tham chiếu); khối UI lối tắt đã gỡ khỏi trang. */
  const adminShortcuts = useMemo(() => {
    const st = (o) => o.status ?? o.Status;
    const oss = (o) => o.orderSuppliers || o.OrderSuppliers || [];
    return {
      pending: orders.filter((o) => st(o) === "Pending").length,
      accepted: orders.filter((o) => st(o) === "Accepted").length,
      delivering: orders.filter((o) => st(o) === "Delivering").length,
      completed: orders.filter((o) => st(o) === "Completed").length,
      rejected: orders.filter((o) => st(o) === "Rejected").length,
      osDelivering: orders.filter((o) => oss(o).some((os) => (os.status ?? os.Status) === "Delivering")).length,
      receiveAdjust: orders.filter((o) =>
        oss(o).some((os) => {
          if ((os.status ?? os.Status) !== "Delivered") return false;
          const flagged = !!(os.receiveQtyAdjusted ?? os.ReceiveQtyAdjusted);
          const note = String(os.receiveNote ?? os.ReceiveNote ?? "").trim();
          const imgs = os.receiveImages ?? os.ReceiveImages ?? [];
          const hasImages = Array.isArray(imgs) && imgs.length > 0;
          return flagged || !!note || hasImages;
        })
      ).length,
    };
  }, [orders]);

  /** Đơn NCC Delivered: lệch SL, ghi chú nhận, hoặc có ảnh chứng từ (hóa đơn / nhận hàng). */
  const adminReceiveDeliveryBundle = useMemo(() => {
    const full = [];
    for (const o of orders) {
      const oid = o.id ?? o.Id;
      for (const os of o.orderSuppliers || o.OrderSuppliers || []) {
        if ((os.status ?? os.Status) !== "Delivered") continue;
        const flagged = !!(os.receiveQtyAdjusted ?? os.ReceiveQtyAdjusted);
        const note = String(os.receiveNote ?? os.ReceiveNote ?? "").trim();
        const imgs = os.receiveImages ?? os.ReceiveImages ?? [];
        const hasImages = Array.isArray(imgs) && imgs.length > 0;
        if (!flagged && !note && !hasImages) continue;
        let summary = "Ghi chú nhận hàng";
        if (flagged && note) summary = "SL lệch + ghi chú";
        else if (flagged) summary = "SL nhận khác đơn / cần đối chiếu";
        else if (hasImages && !note) summary = "Có ảnh chứng từ";
        const noteShort = note
          ? note.length > 90
            ? `${note.slice(0, 90)}…`
            : note
          : hasImages
            ? "Cửa hàng đã tải ảnh khi xác nhận — đối chiếu hóa đơn / biên bản."
            : "—";
        full.push({
          key: `${oid}-${os.id ?? os.Id}`,
          orderId: oid,
          osId: os.id ?? os.Id,
          storeName: (o.storeName ?? o.StoreName) || "—",
          supplierName: (os.supplierName ?? os.SupplierName) || "NCC",
          summary,
          noteShort,
        });
      }
    }
    full.sort((a, b) => Number(b.osId) - Number(a.osId));
    const orderIds = new Set(full.map((r) => r.orderId));
    return {
      rows: full.slice(0, 8),
      orderCount: orderIds.size,
      lineCount: full.length,
    };
  }, [orders]);

  const demandDateFrom = values.demandFrom || thisWeek.from;
  const demandDateTo = values.demandTo || thisWeek.to;

  /** Preview trên Dashboard — màn đầy đủ có search ở menu Nhu cầu SP. */
  const productDemandOpen = useMemo(
    () => computeProductDemandOpen(orders, demandDateFrom, demandDateTo).slice(0, 12),
    [orders, demandDateFrom, demandDateTo]
  );
  const productDemandTotal = useMemo(
    () => computeProductDemandOpen(orders, demandDateFrom, demandDateTo).length,
    [orders, demandDateFrom, demandDateTo]
  );

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
    const statuses = ["Pending", "Rejected", "Accepted", "Delivering", "Completed"];
    const count = statuses.map((s) => orders.filter((o) => (o.status ?? o.Status) === s).length);
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

  const ordersByStatusLabels = "Pending, Rejected, Accepted, Delivering, Completed";

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
          <Card className="mb-6 border border-blue-gray-100 shadow-sm">
            <CardBody className="p-4">
              <Typography variant="small" className="font-semibold text-blue-gray-800 mb-2 block">
                Lọc thống kê theo ngày đặt đơn
              </Typography>
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                <input
                  type="date"
                  value={statsDateFrom}
                  onChange={(e) => setFilter("statsFrom", e.target.value)}
                  className="flex-1 min-w-0 sm:max-w-[160px] rounded-lg border border-blue-gray-200 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  aria-label="Từ ngày"
                />
                <span className="text-blue-gray-400 text-sm shrink-0 hidden sm:inline">→</span>
                <input
                  type="date"
                  value={statsDateTo}
                  onChange={(e) => setFilter("statsTo", e.target.value)}
                  className="flex-1 min-w-0 sm:max-w-[160px] rounded-lg border border-blue-gray-200 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  aria-label="Đến ngày"
                />
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant={statsDateFrom === thisWeek.from && statsDateTo === thisWeek.to ? "filled" : "outlined"}
                    color="blue"
                    className="normal-case text-xs py-1.5 px-2.5"
                    onClick={() => {
                      const w = getWeekRange(0);
                      setFilters({ statsFrom: w.from, statsTo: w.to });
                    }}
                  >
                    Tuần này
                  </Button>
                  <Button
                    size="sm"
                    variant="outlined"
                    color="blue-gray"
                    className="normal-case text-xs py-1.5 px-2.5"
                    onClick={() => {
                      const w = getWeekRange(-1);
                      setFilters({ statsFrom: w.from, statsTo: w.to });
                    }}
                  >
                    Tuần trước
                  </Button>
                  <Button
                    size="sm"
                    variant={statsDateFrom === thisMonth.from && statsDateTo === thisMonth.to ? "filled" : "outlined"}
                    color="blue-gray"
                    className="normal-case text-xs py-1.5 px-2.5"
                    onClick={() => {
                      const m = getMonthRange(0);
                      setFilters({ statsFrom: m.from, statsTo: m.to });
                    }}
                  >
                    Tháng này
                  </Button>
                  <Button
                    size="sm"
                    variant={!statsDateFrom && !statsDateTo ? "filled" : "outlined"}
                    color="blue-gray"
                    className="normal-case text-xs py-1.5 px-2.5"
                    onClick={() => {
                      setFilters({ statsFrom: "", statsTo: "" });
                    }}
                  >
                    Tất cả
                  </Button>
                </div>
              </div>
              <Typography variant="small" color="blue-gray" className="text-xs font-normal mt-2">
                Đang lọc: <strong>{formatDemandDateRangeLabel(statsDateFrom, statsDateTo)}</strong>
              </Typography>
            </CardBody>
          </Card>
          <div className="mb-12 grid gap-y-10 gap-x-6 md:grid-cols-2 xl:grid-cols-4">
            <ClickableStat onNavigate={() => navigate(`/dashboard/orders${statsOrdersQuery()}`)} hint="Mở danh sách đơn tổng">
            <StatisticsCard
              color="blue"
              icon={<ClipboardDocumentListIcon {...icon} />}
              title="Tổng đơn lớn"
              value={String(totalOrders)}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <strong className="text-blue-500">Đơn tổng (Orders)</strong> — bấm để xem danh sách
                </Typography>
              }
            />
            </ClickableStat>
            <ClickableStat onNavigate={() => navigate(`/dashboard/supplier-orders-admin${statsOrdersQuery()}`)} hint="Mở tất cả đơn NCC">
            <StatisticsCard
              color="teal"
              icon={<TruckIcon {...icon} />}
              title="Tổng đơn nhỏ (NCC)"
              value={String(totalOrderSuppliers)}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <strong className="text-teal-600">Đơn theo NCC</strong> — bấm để xem
                </Typography>
              }
            />
            </ClickableStat>
            <ClickableStat onNavigate={() => navigate(`/dashboard/orders${statsOrdersQuery()}`)} hint="Danh sách đơn (xem tổng tiền theo bộ lọc)">
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
            </ClickableStat>
            <ClickableStat onNavigate={() => navigate(`/dashboard/orders?osStatus=Delivering${statsDateFrom ? `&dateFrom=${statsDateFrom}` : ""}${statsDateTo ? `&dateTo=${statsDateTo}` : ""}`)} hint="Đơn có NCC đang giao">
            <StatisticsCard
              color="orange"
              icon={<TruckIcon {...icon} />}
              title="Đơn đang giao"
              value={String(deliveringCount)}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <strong className="text-orange-500">Đơn tổng / NCC đang giao</strong> — bấm lọc NCC Delivering
                </Typography>
              }
            />
            </ClickableStat>
            <ClickableStat onNavigate={() => navigate(`/dashboard/orders?osStatus=Delivering${statsDateFrom ? `&dateFrom=${statsDateFrom}` : ""}${statsDateTo ? `&dateTo=${statsDateTo}` : ""}`)} hint="Theo dõi giao trễ">
            <StatisticsCard
              color="red"
              icon={<ExclamationTriangleIcon {...icon} />}
              title="NCC giao trễ"
              value={String(lateCount)}
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <strong className="text-red-500">Cần theo dõi</strong> — bấm mở đơn đang giao
                </Typography>
              }
            />
            </ClickableStat>
            <ClickableStat onNavigate={() => navigate("/dashboard/reports")} hint="Báo cáo">
            <StatisticsCard
              color="amber"
              icon={<ChartBarIcon {...icon} />}
              title="Báo cáo tháng"
              value="→"
              footer={
                <Typography className="font-normal text-blue-gray-600">
                  <strong className="text-amber-600">Đến trang Báo cáo</strong>
                </Typography>
              }
            />
            </ClickableStat>
            <ClickableStat
              onNavigate={() => navigate("/dashboard/orders?receiveAdjust=1")}
              hint="Danh sách đơn có nhận lệch hoặc ghi chú"
            >
              <StatisticsCard
                color="deep-purple"
                icon={<InboxStackIcon {...icon} />}
                title="Nhận thiếu / thừa"
                value={String(adminReceiveDeliveryBundle.orderCount)}
                footer={
                  <Typography className="font-normal text-blue-gray-600">
                    <strong className="text-deep-purple-600">{adminReceiveDeliveryBundle.lineCount} dòng NCC</strong> đã ghi nhận lệch hoặc ghi chú — bấm xem danh sách
                  </Typography>
                }
              />
            </ClickableStat>
          </div>
          {adminReceiveDeliveryBundle.lineCount > 0 && (
            <Card className="mb-6 border border-deep-purple-100 bg-deep-purple-50/20 shadow-sm">
              <CardHeader floated={false} shadow={false} className="m-0 p-4 border-b border-deep-purple-100 rounded-none">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Typography variant="h6" color="blue-gray">Đơn giao — cửa hàng ghi nhận thiếu / thừa hoặc ghi chú</Typography>
                    <Typography variant="small" color="gray" className="mt-1 font-normal max-w-3xl block">
                      Khi cửa hàng xác nhận nhận hàng (đơn NCC <strong>Delivered</strong>) với số lượng khác đặt, có ghi chú, hoặc đã tải <strong>ảnh hóa đơn / chứng từ</strong>, hệ thống liệt kê ở đây và trong chuông góc phải. Nếu admin mở tab khác rồi quay lại, danh sách đơn sẽ tự làm mới.
                    </Typography>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outlined"
                      color="blue-gray"
                      className="normal-case"
                      disabled={apiLoading}
                      onClick={() => refetchOrders()}
                    >
                      {apiLoading ? "Đang tải…" : "Làm mới dữ liệu đơn"}
                    </Button>
                    <Link to="/dashboard/orders?receiveAdjust=1">
                      <Button size="sm" variant="gradient" color="deep-purple" className="normal-case">
                        Mở danh sách đã lọc
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardBody className="p-0 overflow-x-auto">
                <table className="w-full table-auto min-w-[640px]">
                  <thead>
                    <tr>
                      <th className="border-b border-blue-gray-50 py-2.5 px-4 text-left">
                        <Typography variant="small" className="font-bold text-blue-gray-500">Đơn #</Typography>
                      </th>
                      <th className="border-b border-blue-gray-50 py-2.5 px-4 text-left">
                        <Typography variant="small" className="font-bold text-blue-gray-500">NCC</Typography>
                      </th>
                      <th className="border-b border-blue-gray-50 py-2.5 px-4 text-left">
                        <Typography variant="small" className="font-bold text-blue-gray-500">Cửa hàng</Typography>
                      </th>
                      <th className="border-b border-blue-gray-50 py-2.5 px-4 text-left">
                        <Typography variant="small" className="font-bold text-blue-gray-500">Loại</Typography>
                      </th>
                      <th className="border-b border-blue-gray-50 py-2.5 px-4 text-left">
                        <Typography variant="small" className="font-bold text-blue-gray-500">Ghi chú / tóm tắt</Typography>
                      </th>
                      <th className="border-b border-blue-gray-50 py-2.5 px-4 text-right w-28">
                        <Typography variant="small" className="font-bold text-blue-gray-500">&nbsp;</Typography>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminReceiveDeliveryBundle.rows.map((r) => (
                      <tr key={r.key} className="hover:bg-white/60">
                        <td className="border-b border-blue-gray-50 py-2.5 px-4">
                          <Typography variant="small" className="font-semibold">#{r.orderId}</Typography>
                          <Typography variant="small" color="gray" className="text-xs block">NCC #{r.osId}</Typography>
                        </td>
                        <td className="border-b border-blue-gray-50 py-2.5 px-4">
                          <Typography variant="small">{r.supplierName}</Typography>
                        </td>
                        <td className="border-b border-blue-gray-50 py-2.5 px-4">
                          <Typography variant="small">{r.storeName}</Typography>
                        </td>
                        <td className="border-b border-blue-gray-50 py-2.5 px-4">
                          <Chip size="sm" value={r.summary} color="purple" className="w-fit normal-case" />
                        </td>
                        <td className="border-b border-blue-gray-50 py-2.5 px-4 max-w-md">
                          <Typography variant="small" color="gray" className="text-xs line-clamp-2">{r.noteShort}</Typography>
                        </td>
                        <td className="border-b border-blue-gray-50 py-2.5 px-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <Button size="sm" variant="text" className="text-deep-purple-700 font-semibold normal-case text-xs py-1" onClick={() => navigate(`/dashboard/orders/${r.orderId}`)}>
                              Đơn tổng →
                            </Button>
                            <Button size="sm" variant="text" className="text-blue-600 font-semibold normal-case text-xs py-0" onClick={() => navigate(`/dashboard/supplier-orders/${r.osId}`)}>
                              Đơn NCC →
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {adminReceiveDeliveryBundle.lineCount > adminReceiveDeliveryBundle.rows.length ? (
                  <div className="px-4 py-2 border-t border-deep-purple-100 bg-white/50">
                    <Typography variant="small" color="gray" className="text-xs">
                      Hiển thị {adminReceiveDeliveryBundle.rows.length} / {adminReceiveDeliveryBundle.lineCount} dòng — bấm &quot;Mở danh sách đã lọc&quot; để xem hết.
                    </Typography>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          )}
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
              description={ordersByStatusLabels}
              chart={ordersByStatusChart}
              footer={
                <Typography variant="small" className="flex items-center font-normal text-blue-gray-600">
                  <ClockIcon strokeWidth={2} className="h-4 w-4 text-blue-gray-400 mr-1" />
                  Tổng {totalOrders} đơn
                </Typography>
              }
            />
          </div>
          <Card className="mb-6 border border-teal-100 bg-teal-50/20 shadow-sm">
            <CardHeader floated={false} shadow={false} className="m-0 p-4 border-b border-teal-100 rounded-none">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div>
                    <Typography variant="h6" color="blue-gray">Nhu cầu theo sản phẩm (đơn còn xử lý)</Typography>
                    <Typography variant="small" color="gray" className="mt-1 font-normal">
                      {PRODUCT_DEMAND_RULES_NOTE[0]} Bấm <strong>Đơn có SP</strong> để mở danh sách đơn đã lọc.
                    </Typography>
                  </div>
                  <Link
                    to="/dashboard/product-demand"
                    className="text-xs font-semibold text-teal-700 hover:underline shrink-0 whitespace-nowrap"
                  >
                    Tìm kiếm đầy đủ →
                  </Link>
                </div>
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                  <input
                    type="date"
                    value={demandDateFrom}
                    onChange={(e) => setFilter("demandFrom", e.target.value)}
                    className="flex-1 min-w-0 sm:max-w-[160px] rounded-lg border border-teal-200 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    aria-label="Từ ngày"
                  />
                  <span className="text-blue-gray-400 text-sm shrink-0 hidden sm:inline">→</span>
                  <input
                    type="date"
                    value={demandDateTo}
                    onChange={(e) => setFilter("demandTo", e.target.value)}
                    className="flex-1 min-w-0 sm:max-w-[160px] rounded-lg border border-teal-200 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    aria-label="Đến ngày"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant={demandDateFrom === thisWeek.from && demandDateTo === thisWeek.to ? "filled" : "outlined"}
                      color="teal"
                      className="normal-case text-xs py-1.5 px-2.5"
                      onClick={() => {
                        const w = getWeekRange(0);
                        setFilters({ demandFrom: w.from, demandTo: w.to });
                      }}
                    >
                      Tuần này
                    </Button>
                    <Button
                      size="sm"
                      variant="outlined"
                      color="blue-gray"
                      className="normal-case text-xs py-1.5 px-2.5"
                      onClick={() => {
                        const w = getWeekRange(-1);
                        setFilters({ demandFrom: w.from, demandTo: w.to });
                      }}
                    >
                      Tuần trước
                    </Button>
                    <Button
                      size="sm"
                      variant={!demandDateFrom && !demandDateTo ? "filled" : "outlined"}
                      color="blue-gray"
                      className="normal-case text-xs py-1.5 px-2.5"
                      onClick={() => {
                        setFilters({ demandFrom: "", demandTo: "" });
                      }}
                    >
                      Tất cả
                    </Button>
                  </div>
                </div>
                <Typography variant="small" color="blue-gray" className="text-xs font-normal">
                  {(demandDateFrom || demandDateTo) ? (
                    <>
                      Đang lọc ngày đặt: <strong>{demandDateFrom || "…"}</strong> → <strong>{demandDateTo || "…"}</strong>
                      {" · "}
                    </>
                  ) : null}
                  {productDemandTotal} dòng (SP + NCC)
                  {productDemandTotal > productDemandOpen.length ? (
                    <span className="text-blue-gray-400"> · hiển thị {productDemandOpen.length} dòng đầu</span>
                  ) : null}
                </Typography>
              </div>
            </CardHeader>
            <CardBody className="p-0 max-h-80 overflow-y-auto">
              {productDemandOpen.length === 0 ? (
                <div className="p-6">
                  <Typography variant="small" color="gray">Không có nhu cầu mở hoặc chưa có dòng sản phẩm.</Typography>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-white sticky top-0 z-[1] shadow-sm">
                    <tr>
                      <th className="text-left py-2.5 px-4 font-medium text-blue-gray-600">Sản phẩm</th>
                      <th className="text-left py-2.5 px-4 font-medium text-blue-gray-600 min-w-[100px]">NCC</th>
                      <th className="text-right py-2.5 px-4 font-medium text-blue-gray-600 w-24">Tổng SL</th>
                      <th className="text-right py-2.5 px-4 font-medium text-blue-gray-600 w-16">Dòng</th>
                      <th className="text-right py-2.5 px-4 w-36" />
                    </tr>
                  </thead>
                  <tbody>
                    {productDemandOpen.map((row) => (
                      <tr key={`${row.productId}-${row.supplierId ?? "x"}`} className="border-t border-teal-100/80 bg-white/90 hover:bg-teal-50/40">
                        <td className="py-2.5 px-4">
                          <Typography variant="small" className="font-medium text-blue-gray-800">{row.productName}</Typography>
                          {row.unit ? <Typography variant="small" color="gray" className="text-xs block">{row.unit}</Typography> : null}
                        </td>
                        <td className="py-2.5 px-4">
                          <Typography variant="small" className="text-blue-gray-700">{row.supplierName}</Typography>
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-teal-900">{row.totalQty}</td>
                        <td className="py-2.5 px-4 text-right text-blue-gray-500">{row.lines}</td>
                        <td className="py-2.5 px-4 text-right">
                          <Button
                            size="sm"
                            variant="text"
                            className="px-2 py-1 text-xs font-semibold text-blue-700"
                            onClick={() => {
                              const params = new URLSearchParams({ product: row.productName });
                              if (demandDateFrom) params.set("dateFrom", demandDateFrom);
                              if (demandDateTo) params.set("dateTo", demandDateTo);
                              if (row.supplierId != null) params.set("supplier", String(row.supplierId));
                              navigate(`/dashboard/orders?${params.toString()}`);
                            }}
                          >
                            Đơn có SP →
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
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
