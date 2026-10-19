import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardBody,
  Typography,
  Input,
  Chip,
  IconButton,
  Tooltip,
  Button,
} from "@material-tailwind/react";
import { PrinterIcon, XMarkIcon, ArrowDownTrayIcon } from "@heroicons/react/24/solid";
import { exportOrdersSummaryExcel } from "@/utils/orderListExport";
import { orderSupplierHasReceiveFlag } from "@/utils/orderReceiveUtils";
import { useUrlFilters, LIST_FILTER_PATHS } from "@/utils/urlFilters";
import { getMatchedProductQtyInOrder } from "@/utils/productDemand";
import { useData } from "@/context/DataContext";
import { useAuth, useToast } from "@/context";
import api from "@/api";

const ORDER_FILTER_STORAGE = LIST_FILTER_PATHS["/orders"];
const ORDER_FILTER_DEFAULTS = {
  status: "",
  storeId: "",
  supplier: "",
  dateFrom: "",
  dateTo: "",
  osStatus: "",
  product: "",
  receiveAdjust: "",
};

// Đơn tổng: 4 trạng thái — Chờ, Từ chối, Chấp nhận, Hoàn thành
const statusColors = { Pending: "blue", Rejected: "red", Accepted: "orange", Delivering: "orange", Completed: "green" };
const orderStatusLabel = (s) => {
  if (!s) return "Chờ";
  const x = String(s);
  if (x === "Completed") return "Hoàn thành";
  if (x === "Rejected") return "Từ chối";
  if (x === "Delivering" || x === "Accepted") return "Đang giao";
  return "Chờ";
};

function orderSupplierDisplayList(order) {
  const oss = order.orderSuppliers || order.OrderSuppliers || [];
  const seen = new Set();
  const names = [];
  for (const os of oss) {
    const n = (os.supplierName ?? os.SupplierName ?? "").trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    names.push(n);
  }
  return names;
}

function computeOrderTotalFromItems(order) {
  const amt = Number(order.totalAmount ?? order.TotalAmount ?? 0);
  if (amt > 0) return amt;
  const pstat = order.status ?? order.Status ?? "";
  return (order.orderSuppliers || []).reduce((sum, os) => {
    const osSt = os.status ?? os.Status ?? "";
    return sum + (os.orderItems || []).reduce((s, it) => {
      const raw = String(osSt).trim().toLowerCase();
      const parent = String(pstat).trim();
      const inferredDel =
        parent === "Completed" && ["pending", "accepted", "delivering"].includes(raw);
      const delivered = raw === "delivered" || inferredDel;
      const qOrd = Number(it.quantity ?? it.Quantity ?? 0);
      let q = qOrd;
      if (delivered) {
        const r = it.receivedQuantity ?? it.ReceivedQuantity;
        q = r != null && r !== "" ? Number(r) : qOrd;
      }
      return s + q * Number((it.price ?? it.Price) || 0);
    }, 0);
  }, 0);
}

function exportOrderPrint(order, stores) {
  const storeName = stores.find((s) => s.id === order.storeId)?.name || order.storeName;
  const osList = order.orderSuppliers || [];
  const totalAmt = computeOrderTotalFromItems(order);
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Đơn #${order.id}</title>
  <style>body{font-family:Arial;padding:20px;font-size:14px} table{width:100%;border-collapse:collapse;margin:10px 0} th,td{border:1px solid #ddd;padding:8px;text-align:left} th{background:#f5f5f5} .header{margin-bottom:20px} .totals{margin-top:20px;padding:12px;background:#f9f9f9;border:1px solid #ddd;font-weight:bold}</style></head><body>
  <div class="header"><h2>ĐƠN HÀNG #${order.id}</h2><p><strong>Cửa hàng:</strong> ${storeName} | <strong>Ngày đặt:</strong> ${order.orderDate} | <strong>Trạng thái:</strong> ${order.status}</p></div>
  <table><tr><th>NCC</th><th>Sản phẩm</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>`;
  osList.forEach((os) => {
    (os.orderItems || []).forEach((it) => {
      const q = it.quantity ?? 0;
      const p = Number((it.price ?? it.Price) || 0);
      const sub = q * p;
      html += `<tr><td>${os.supplierName ?? ""}</td><td>${it.productName ?? it.ProductName ?? ""}</td><td>${q} ${it.unit ?? it.Unit ?? ""}</td><td>${p.toLocaleString("vi-VN")} đ</td><td>${sub.toLocaleString("vi-VN")} đ</td></tr>`;
    });
  });
  html += `</table><div class="totals">Tổng tiền: ${totalAmt.toLocaleString("vi-VN")} đ</div></body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 300); }
}

export function OrderList() {
  const { orders, setOrders, stores, suppliers, useApi, refetchOrders, apiLoading } = useData();
  const { currentUser, isAdmin, isStoreUser } = useAuth();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  // Auto-refetch khi vào trang để luôn có data mới nhất
  React.useEffect(() => {
    if (useApi) refetchOrders().catch(() => {});
  }, []);

  const handleRefresh = async () => {
    if (!useApi) return;
    setRefreshing(true);
    try { await refetchOrders(); } catch (e) { showToast(e.message || "Lỗi tải đơn", "error"); }
    finally { setRefreshing(false); }
  };

  const applyAccept = (order) => {
    const oid = order.id ?? order.Id;
    setOrders(orders.map((o) => {
      if ((o.id ?? o.Id) !== oid) return o;
      const oss = o.orderSuppliers || o.OrderSuppliers || [];
      const newOrderSuppliers = oss.map((os) => {
        if ((os.status ?? os.Status) === "Pending") return { ...os, status: "Delivering" };
        return os;
      });
      return { ...o, status: "Accepted", orderSuppliers: newOrderSuppliers };
    }));
  };

  const applyReject = (order) => {
    const oid = order.id ?? order.Id;
    setOrders(orders.map((o) => {
      if ((o.id ?? o.Id) !== oid) return o;
      const newOrderSuppliers = (o.orderSuppliers || o.OrderSuppliers || []).map((os) => ({ ...os, status: "Rejected" }));
      return { ...o, orderSuppliers: newOrderSuppliers, status: "Rejected" };
    }));
  };

  const handleAdminAcceptOrder = async (order) => {
    if (useApi) {
      try {
        await api.patch("orders.accept", {}, { params: { id: order.id ?? order.Id } });
        applyAccept(order);
      } catch (e) {
        showToast(e.message || "Lỗi chấp nhận đơn", "error");
      }
      return;
    }
    applyAccept(order);
  };

  const handleAdminRejectOrder = async (order) => {
    if (useApi) {
      try {
        await api.patch("orders.reject", {}, { params: { id: order.id } });
        applyReject(order);
      } catch (e) {
        showToast(e.message || "Lỗi từ chối đơn", "error");
      }
      return;
    }
    applyReject(order);
  };
  const navigate = useNavigate();
  const location = useLocation();
  const { values, setFilter, clearFilters, searchString } = useUrlFilters(ORDER_FILTER_DEFAULTS, { storageKey: ORDER_FILTER_STORAGE });
  const filterStatus = values.status;
  const filterSupplier = values.supplier;
  const filterStore = values.storeId;
  const filterDateFrom = values.dateFrom;
  const filterDateTo = values.dateTo;
  const filterOsStatus = values.osStatus;
  const filterProduct = values.product;
  const filterReceiveAdjust = values.receiveAdjust === "1";

  const goOrderDetail = (id) => {
    navigate(`/dashboard/orders/${id}`, { state: { returnSearch: searchString || location.search } });
  };

  let list = orders;
  const storeIdUser = currentUser?.storeId ?? currentUser?.StoreId;
  if (isStoreUser && storeIdUser != null) list = list.filter((o) => (o.storeId ?? o.StoreId) === storeIdUser);
  if (filterStatus) {
    const s = (o) => o.status ?? o.Status;
    list = list.filter((o) => s(o) === filterStatus);
  }
  if (filterSupplier) {
    const sid = Number(filterSupplier);
    list = list.filter((o) => o.orderSuppliers?.some((os) => (os.supplierId ?? os.SupplierId) === sid));
  }
  if (filterStore) list = list.filter((o) => String(o.storeId ?? o.StoreId) === String(filterStore));
  if (filterDateFrom) list = list.filter((o) => (o.orderDate ?? o.OrderDate) >= filterDateFrom);
  if (filterDateTo) list = list.filter((o) => (o.orderDate ?? o.OrderDate) <= filterDateTo);
  if (filterOsStatus) {
    list = list.filter((o) =>
      (o.orderSuppliers || o.OrderSuppliers || []).some((os) => (os.status ?? os.Status) === filterOsStatus)
    );
  }
  if (filterReceiveAdjust) {
    list = list.filter((o) =>
      (o.orderSuppliers || o.OrderSuppliers || []).some((os) => {
        if ((os.status ?? os.Status) !== "Delivered") return false;
        const flagged = !!(os.receiveQtyAdjusted ?? os.ReceiveQtyAdjusted);
        const note = String(os.receiveNote ?? os.ReceiveNote ?? "").trim();
        const imgs = os.receiveImages ?? os.ReceiveImages ?? [];
        const hasImages = Array.isArray(imgs) && imgs.length > 0;
        return flagged || note.length > 0 || hasImages;
      })
    );
  }
  if (filterProduct.trim()) {
    const q = filterProduct.trim().toLowerCase();
    list = list.filter((o) =>
      (o.orderSuppliers || o.OrderSuppliers || []).some((os) =>
        (os.orderItems || os.OrderItems || []).some((it) =>
          String(it.productName ?? it.ProductName ?? "").toLowerCase().includes(q)
        )
      )
    );
  }

  // Đơn mới nhất trên cùng
  list = [...list].sort((a, b) => {
    const dA = a.orderDate ?? a.OrderDate ?? "";
    const dB = b.orderDate ?? b.OrderDate ?? "";
    if (dB !== dA) return String(dB).localeCompare(String(dA));
    return (b.id ?? b.Id ?? 0) - (a.id ?? a.Id ?? 0);
  });

  const totalAmountList = list.reduce((s, o) => s + computeOrderTotalFromItems(o), 0);
  const productFilterActive = !!filterProduct.trim();
  const productQtyOf = (row) =>
    productFilterActive
      ? getMatchedProductQtyInOrder(row, filterProduct, filterSupplier)
      : null;
  const colCount = (isAdmin ? 8 : 7) + (productFilterActive ? 1 : 0);

  const orderReceiveFlags = (row) => {
    const oss = row.orderSuppliers || row.OrderSuppliers || [];
    return oss.filter((os) => orderSupplierHasReceiveFlag(os));
  };

  const hasFilters =
    filterStatus ||
    filterSupplier ||
    filterStore ||
    filterDateFrom ||
    filterDateTo ||
    filterOsStatus ||
    filterProduct.trim() ||
    filterReceiveAdjust;
  const handleClearFilters = () => clearFilters();

  const [exporting, setExporting] = useState(false);
  const handleExportExcel = async () => {
    if (!list.length) {
      showToast("Không có đơn để xuất (thử bỏ bộ lọc).", "info");
      return;
    }
    setExporting(true);
    try {
      const label = filterStore
        ? `Don_dat_${(stores.find((s) => String(s.id ?? s.Id) === filterStore)?.name ?? "CH").replace(/\s+/g, "_")}`
        : "Tong_don_dat_tat_ca_CH";
      await exportOrdersSummaryExcel({ orders: list, stores, fileLabel: label });
      showToast(`Đã xuất ${list.length} đơn ra file Excel.`, "success");
    } catch (e) {
      showToast(e?.message || "Lỗi xuất Excel", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mt-12 w-full max-w-full min-w-0">
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-blue-gray-100 bg-blue-gray-50/50 px-4 py-3">
        <Typography variant="small" className="font-semibold text-blue-gray-700 shrink-0">Tổng tiền:</Typography>
        <strong className="text-green-700">{totalAmountList.toLocaleString("vi-VN")} đ</strong>
      </div>
      <Card className="border border-blue-gray-100 w-full max-w-full">
        <CardHeader className="p-4 pb-5 border-b">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Typography variant="h6" color="blue-gray">Danh sách đơn hàng</Typography>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outlined"
                  color="green"
                  className="flex items-center gap-1"
                  onClick={handleExportExcel}
                  disabled={exporting || list.length === 0}
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  {exporting ? "Đang xuất..." : "Xuất Excel tổng đơn"}
                </Button>
                {useApi && (
                  <Button size="sm" variant="outlined" onClick={handleRefresh} disabled={refreshing}>
                    {refreshing ? "Đang tải..." : "🔄 Làm mới"}
                  </Button>
                )}
              </div>
            </div>
            {/* Compact filter bar */}
            <div className="flex flex-col gap-2">
              {/* Row 1: status + store/supplier */}
              <div className="flex items-center gap-1.5">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilter("status", e.target.value)}
                  className="flex-1 min-w-0 rounded-lg border border-blue-gray-200 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">Tất cả TT</option>
                  <option value="Pending">Chờ duyệt</option>
                  <option value="Accepted">Đã chấp nhận</option>
                  <option value="Delivering">Đang giao (đơn tổng)</option>
                  <option value="Rejected">Từ chối</option>
                  <option value="Completed">Hoàn thành</option>
                </select>
                {isAdmin && (
                  <select
                    value={filterOsStatus}
                    onChange={(e) => setFilter("osStatus", e.target.value)}
                    className="flex-1 min-w-0 rounded-lg border border-blue-gray-200 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 max-w-[130px]"
                    title="Lọc theo trạng thái đơn NCC"
                  >
                    <option value="">TT đơn NCC</option>
                    <option value="Pending">NCC: Chờ</option>
                    <option value="Accepted">NCC: Chấp nhận</option>
                    <option value="Delivering">NCC: Đang giao</option>
                    <option value="Delivered">NCC: Đã giao</option>
                    <option value="Rejected">NCC: Từ chối</option>
                  </select>
                )}
                {isAdmin && (
                  <select
                    value={filterStore}
                    onChange={(e) => setFilter("storeId", e.target.value)}
                    className="flex-1 min-w-0 rounded-lg border border-blue-gray-200 bg-white px-2 py-2 text-sm focus:outline-none max-w-[120px]"
                  >
                    <option value="">Cửa hàng</option>
                    {stores.map((s) => (
                      <option key={s.id ?? s.Id} value={String(s.id ?? s.Id)}>{s.name ?? s.Name}</option>
                    ))}
                  </select>
                )}
                {isAdmin && (
                  <select
                    value={filterSupplier}
                    onChange={(e) => setFilter("supplier", e.target.value)}
                    className="flex-1 min-w-0 rounded-lg border border-blue-gray-200 bg-white px-2 py-2 text-sm focus:outline-none max-w-[110px]"
                  >
                    <option value="">NCC</option>
                    {suppliers.map((s) => (
                      <option key={s.id ?? s.Id} value={String(s.id ?? s.Id)}>{s.name ?? s.Name}</option>
                    ))}
                  </select>
                )}
                {hasFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 shrink-0"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
              {/* Row 2: product + receive flag + date range */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Tìm sản phẩm trong đơn…"
                  value={filterProduct}
                  onChange={(e) => setFilter("product", e.target.value)}
                  className="flex-1 min-w-0 rounded-lg border border-blue-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {isAdmin && (
                  <label className="flex items-center gap-2 text-sm text-blue-gray-700 shrink-0 cursor-pointer select-none px-1">
                    <input
                      type="checkbox"
                      checked={filterReceiveAdjust}
                      onChange={(e) => setFilter("receiveAdjust", e.target.checked ? "1" : "")}
                      className="rounded border-blue-gray-300"
                    />
                    CH đã xác nhận nhận (lệch / ghi chú / ảnh)
                  </label>
                )}
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilter("dateFrom", e.target.value)}
                  className="flex-1 min-w-0 sm:max-w-[160px] rounded-lg border border-blue-gray-200 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-blue-gray-400 text-sm shrink-0 hidden sm:inline">—</span>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilter("dateTo", e.target.value)}
                  className="flex-1 min-w-0 sm:max-w-[160px] rounded-lg border border-blue-gray-200 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <div className="px-4 py-2 border-b border-blue-gray-50 flex flex-wrap justify-between items-center gap-2">
            <Typography variant="small" color="gray">
              Hiển thị <strong>{list.length}</strong> đơn
              {productFilterActive ? (
                <> · SL của SP: <strong className="text-teal-800">{filterProduct.trim()}</strong></>
              ) : null}
            </Typography>
            <Typography variant="small" color="blue-gray"><strong>Tổng tiền:</strong> {totalAmountList.toLocaleString("vi-VN")} đ</Typography>
          </div>

          {/* Mobile: card list */}
          <div className="md:hidden divide-y divide-blue-gray-50">
            {list.length === 0 ? (
              <div className="py-12 text-center px-4">
                <Typography color="gray">Không có đơn nào thỏa bộ lọc. Thử xóa bộ lọc hoặc tạo đơn mới.</Typography>
              </div>
            ) : list.map((row) => {
              const nccNames = orderSupplierDisplayList(row);
              const spQty = productQtyOf(row);
              return (
              <div key={row.id} className="p-4 flex flex-col gap-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <Typography variant="small" className="font-semibold text-blue-gray-800">
                    #{row.id} — Đơn #{row.id}
                  </Typography>
                  {isAdmin && row.status === "Pending" ? (
                    <select
                      value=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "accept") handleAdminAcceptOrder(row);
                        else if (v === "reject") handleAdminRejectOrder(row);
                        e.target.value = "";
                      }}
                      className="w-full rounded-lg border border-blue-gray-200 bg-white px-2 py-1.5 text-sm text-blue-gray-700 outline-none focus:border-blue-500"
                    >
                      <option value="">Trạng thái: Chờ</option>
                      <option value="accept">Chấp nhận</option>
                      <option value="reject">Từ chối</option>
                    </select>
                  ) : (
                    <Chip size="sm" color={statusColors[row.status] || "gray"} value={orderStatusLabel(row.status)} className="w-fit" />
                  )}
                </div>
                {nccNames.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-center">
                    <Typography variant="small" color="blue-gray" className="font-medium shrink-0">
                      NCC:
                    </Typography>
                    {nccNames.map((name) => (
                      <Chip key={name} size="sm" color="teal" variant="ghost" value={name} className="normal-case text-[10px]" />
                    ))}
                  </div>
                )}
                <Typography variant="small" color="blue-gray">
                  <span className="font-medium">Cửa hàng:</span> {row.storeName}
                </Typography>
                <Typography variant="small" color="blue-gray">
                  <span className="font-medium">Ngày:</span> {row.orderDate ? new Date(row.orderDate).toLocaleDateString("vi-VN") : "—"}
                </Typography>
                {spQty && (
                  <Typography variant="small" className="text-teal-900">
                    <span className="font-medium">SL SP đang xem:</span>{" "}
                    <strong>{Number(spQty.qty).toLocaleString("vi-VN")}</strong>
                    {spQty.unit ? ` ${spQty.unit}` : ""}
                  </Typography>
                )}
                {isAdmin && orderReceiveFlags(row).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {orderReceiveFlags(row).map((os) => (
                      <Chip key={os.id ?? os.Id} size="sm" color="amber" value={`${os.supplierName ?? os.SupplierName}: đã nhận`} className="normal-case" />
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 pt-1">
                  <Typography as="a" href="#" className="text-xs font-semibold text-blue-600 hover:underline" onClick={(e) => { e.preventDefault(); goOrderDetail(row.id); }}>
                    Xem / Theo dõi
                  </Typography>
                  <span className="text-blue-gray-300">|</span>
                  <Tooltip content="Xuất đơn / In">
                    <IconButton variant="text" size="sm" onClick={() => exportOrderPrint(row, stores)}>
                      <PrinterIcon className="w-4 h-4" />
                    </IconButton>
                  </Tooltip>
                </div>
              </div>
            );})}
          </div>

          {/* Desktop: table */}
          <table className="hidden md:table w-full table-fixed" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th className="border-b border-blue-gray-50 py-3 px-3 text-left w-14"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">ID</Typography></th>
                <th className="border-b border-blue-gray-50 py-3 px-3 text-left w-24"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">Tên đơn</Typography></th>
                <th className="border-b border-blue-gray-50 py-3 px-3 text-left min-w-[120px]"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">NCC</Typography></th>
                <th className="border-b border-blue-gray-50 py-3 px-3 text-left"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">Tên cửa hàng</Typography></th>
                <th className="border-b border-blue-gray-50 py-3 px-3 text-left w-28"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">Ngày</Typography></th>
                {productFilterActive && (
                  <th className="border-b border-blue-gray-50 py-3 px-3 text-right w-28" title={filterProduct.trim()}>
                    <Typography variant="small" className="text-[11px] font-bold uppercase text-teal-700">SL SP</Typography>
                  </th>
                )}
                <th className="border-b border-blue-gray-50 py-3 px-3 text-left w-32"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">Trạng thái</Typography></th>
                {isAdmin && (
                  <th className="border-b border-blue-gray-50 py-3 px-3 text-left w-36"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">Nhận CH</Typography></th>
                )}
                <th className="border-b border-blue-gray-50 py-3 px-3 text-left w-44"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">Thao tác</Typography></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="py-12 text-center">
                    <Typography color="gray">Không có đơn nào thỏa bộ lọc. Thử xóa bộ lọc hoặc tạo đơn mới.</Typography>
                  </td>
                </tr>
              ) : list.map((row) => {
                const spQty = productQtyOf(row);
                return (
                <tr key={row.id} className="hover:bg-blue-gray-50/50 align-baseline">
                  <td className="py-3 px-3 border-b border-blue-gray-50 align-middle"><Typography variant="small" className="font-medium">#{row.id}</Typography></td>
                  <td className="py-3 px-3 border-b border-blue-gray-50 align-middle"><Typography variant="small">Đơn #{row.id}</Typography></td>
                  <td className="py-3 px-3 border-b border-blue-gray-50 align-middle min-w-0">
                    {orderSupplierDisplayList(row).length === 0 ? (
                      <Typography variant="small" color="gray" className="text-xs">—</Typography>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {orderSupplierDisplayList(row).map((name) => (
                          <Typography key={name} variant="small" className="truncate block text-xs" title={name}>{name}</Typography>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 border-b border-blue-gray-50 align-middle min-w-0"><Typography variant="small" className="truncate block" title={row.storeName}>{row.storeName}</Typography></td>
                  <td className="py-3 px-3 border-b border-blue-gray-50 align-middle whitespace-nowrap"><Typography variant="small">{row.orderDate ? new Date(row.orderDate).toLocaleDateString("vi-VN") : "—"}</Typography></td>
                  {productFilterActive && (
                    <td className="py-3 px-3 border-b border-blue-gray-50 align-middle text-right whitespace-nowrap">
                      <Typography variant="small" className="font-semibold text-teal-900">
                        {spQty ? Number(spQty.qty).toLocaleString("vi-VN") : "—"}
                        {spQty?.unit ? (
                          <span className="text-blue-gray-500 font-normal text-xs"> {spQty.unit}</span>
                        ) : null}
                      </Typography>
                    </td>
                  )}
                  <td className="py-3 px-3 border-b border-blue-gray-50 align-middle">
                    {isAdmin && row.status === "Pending" ? (
                      <select
                        value=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "accept") handleAdminAcceptOrder(row);
                          else if (v === "reject") handleAdminRejectOrder(row);
                          e.target.value = "";
                        }}
                        className="w-full max-w-[140px] rounded-lg border border-blue-gray-200 bg-white px-2 py-1.5 text-sm text-blue-gray-700 outline-none focus:border-blue-500"
                      >
                        <option value="">Trạng thái: Chờ</option>
                        <option value="accept">Chấp nhận</option>
                        <option value="reject">Từ chối</option>
                      </select>
                    ) : (
                      <Chip size="sm" color={statusColors[row.status] || "gray"} value={orderStatusLabel(row.status)} className="w-fit max-w-full truncate" />
                    )}
                  </td>
                  {isAdmin && (
                    <td className="py-3 px-3 border-b border-blue-gray-50 align-middle">
                      {orderReceiveFlags(row).length === 0 ? (
                        <Typography variant="small" color="gray" className="text-xs">—</Typography>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {orderReceiveFlags(row).map((os) => (
                            <Chip key={os.id ?? os.Id} size="sm" color="amber" value={os.supplierName ?? os.SupplierName ?? "NCC"} className="w-fit normal-case text-[10px]" />
                          ))}
                        </div>
                      )}
                    </td>
                  )}
                  <td className="py-3 px-3 border-b border-blue-gray-50 align-middle">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <Typography as="a" href="#" className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap shrink-0" onClick={(e) => { e.preventDefault(); goOrderDetail(row.id); }}>
                        Xem / Theo dõi
                      </Typography>
                      <span className="text-blue-gray-300 shrink-0">|</span>
                      <Tooltip content="Xuất đơn / In">
                        <IconButton variant="text" size="sm" className="shrink-0" onClick={() => exportOrderPrint(row, stores)}>
                          <PrinterIcon className="w-4 h-4" />
                        </IconButton>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

export default OrderList;
