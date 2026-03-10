import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { FilterSelect } from "@/components/FilterSelect";
import { PrinterIcon, FunnelIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { useData } from "@/context/DataContext";
import { useAuth, useToast } from "@/context";
import api from "@/api";

// Đơn tổng: 4 trạng thái — Chờ, Từ chối, Chấp nhận, Hoàn thành
const statusColors = { Pending: "blue", Rejected: "red", Accepted: "amber", Completed: "green" };
const orderStatusLabel = (s) => {
  if (!s) return "Chờ";
  const x = String(s);
  if (x === "Completed") return "Hoàn thành";
  if (x === "Rejected") return "Từ chối";
  if (x === "Accepted") return "Chấp nhận";
  return "Chờ";
};

function computeOrderTotalFromItems(order) {
  const amt = Number(order.totalAmount ?? order.TotalAmount ?? 0);
  if (amt > 0) return amt;
  return (order.orderSuppliers || []).reduce((sum, os) => sum + (os.orderItems || []).reduce((s, it) => s + (it.quantity ?? 0) * Number((it.price ?? it.Price) || 0), 0), 0);
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
  const handleRefresh = async () => {
    if (!useApi) return;
    setRefreshing(true);
    try { await refetchOrders(); } catch (e) { showToast(e.message || "Lỗi tải đơn", "error"); }
    finally { setRefreshing(false); }
  };

  const applyAccept = (order) => {
    setOrders(orders.map((o) => {
      if (o.id !== order.id) return o;
      return { ...o, status: "Accepted" };
    }));
  };

  const applyReject = (order) => {
    setOrders(orders.map((o) => {
      if (o.id !== order.id) return o;
      const newOrderSuppliers = (o.orderSuppliers || []).map((os) => ({ ...os, status: "Rejected" }));
      return { ...o, orderSuppliers: newOrderSuppliers, status: "Rejected" };
    }));
  };

  const handleAdminAcceptOrder = async (order) => {
    if (useApi) {
      try {
        await api.patch("orders.accept", {}, { params: { id: order.id } });
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
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterStore, setFilterStore] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  let list = orders;
  const storeIdUser = currentUser?.storeId ?? currentUser?.StoreId;
  if (isStoreUser && storeIdUser != null) list = list.filter((o) => (o.storeId ?? o.StoreId) === storeIdUser);
  if (filterStatus) {
    const s = (o) => o.status ?? o.Status;
    list = list.filter((o) => s(o) === filterStatus);
  }
  if (filterSupplier) {
    const sid = Number(filterSupplier);
    list = list.filter((o) => o.orderSuppliers?.some((os) => os.supplierId === sid));
  }
  if (filterStore) list = list.filter((o) => o.storeId === Number(filterStore));
  if (filterDateFrom) list = list.filter((o) => o.orderDate >= filterDateFrom);
  if (filterDateTo) list = list.filter((o) => o.orderDate <= filterDateTo);

  // Đơn mới nhất trên cùng
  list = [...list].sort((a, b) => {
    const dA = a.orderDate ?? a.OrderDate ?? "";
    const dB = b.orderDate ?? b.OrderDate ?? "";
    if (dB !== dA) return String(dB).localeCompare(String(dA));
    return (b.id ?? b.Id ?? 0) - (a.id ?? a.Id ?? 0);
  });

  const totalAmountList = list.reduce((s, o) => s + computeOrderTotalFromItems(o), 0);

  const hasFilters = filterStatus || filterSupplier || filterStore || filterDateFrom || filterDateTo;
  const clearFilters = () => {
    setFilterStatus("");
    setFilterSupplier("");
    setFilterStore("");
    setFilterDateFrom("");
    setFilterDateTo("");
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
                {useApi && list.length === 0 && orders.length === 0 && !apiLoading && (
                  <Button size="sm" variant="outlined" onClick={handleRefresh} disabled={refreshing}>{refreshing ? "Đang tải..." : "Tải lại"}</Button>
                )}
                {hasFilters && (
                <Button variant="text" size="sm" className="flex items-center gap-1 text-red-600" onClick={clearFilters}>
                  <XMarkIcon className="w-4 h-4" /> Xóa bộ lọc
                </Button>
              )}
              </div>
            </div>
            <div className="flex flex-row flex-wrap items-end gap-6 w-full">
              <div className="flex items-center gap-1 text-blue-gray-500 shrink-0">
                <FunnelIcon className="w-4 h-4" />
                <Typography variant="small" className="font-medium">Bộ lọc:</Typography>
              </div>
              <div className="w-[172px] shrink-0">
                <FilterSelect label="Trạng thái" value={filterStatus} onChange={setFilterStatus} options={[{ value: "", label: "Tất cả" }, { value: "Pending", label: "Chờ" }, { value: "Rejected", label: "Từ chối" }, { value: "Accepted", label: "Chấp nhận" }, { value: "Completed", label: "Hoàn thành" }]} placeholder="Tất cả" />
              </div>
              {isAdmin && (
                <div className="w-[172px] shrink-0">
                  <FilterSelect label="Cửa hàng" value={filterStore} onChange={setFilterStore} options={stores.map((s) => ({ value: String(s.id ?? s.Id), label: s.name ?? s.Name }))} placeholder="Tất cả" />
                </div>
              )}
              {isAdmin && (
                <div className="w-[172px] shrink-0">
                  <FilterSelect label="NCC" value={filterSupplier} onChange={setFilterSupplier} options={suppliers.map((s) => ({ value: String(s.id ?? s.Id), label: s.name ?? s.Name }))} placeholder="Tất cả" />
                </div>
              )}
              <div className="w-[172px] shrink-0">
                <Input type="date" label="Từ ngày" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="!min-w-0" />
              </div>
              <div className="w-[172px] shrink-0">
                <Input type="date" label="Đến ngày" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="!min-w-0" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <div className="px-4 py-2 border-b border-blue-gray-50 flex flex-wrap justify-between items-center gap-2">
            <Typography variant="small" color="gray">Hiển thị <strong>{list.length}</strong> đơn</Typography>
            <Typography variant="small" color="blue-gray"><strong>Tổng tiền:</strong> {totalAmountList.toLocaleString("vi-VN")} đ</Typography>
          </div>
          <table className="w-full table-fixed" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th className="border-b border-blue-gray-50 py-3 px-3 text-left w-14"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">ID</Typography></th>
                <th className="border-b border-blue-gray-50 py-3 px-3 text-left w-24"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">Tên đơn</Typography></th>
                <th className="border-b border-blue-gray-50 py-3 px-3 text-left"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">Tên cửa hàng</Typography></th>
                <th className="border-b border-blue-gray-50 py-3 px-3 text-left w-28"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">Ngày</Typography></th>
                <th className="border-b border-blue-gray-50 py-3 px-3 text-left w-32"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">Trạng thái</Typography></th>
                <th className="border-b border-blue-gray-50 py-3 px-3 text-left w-40"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">Thao tác</Typography></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Typography color="gray">Không có đơn nào thỏa bộ lọc. Thử xóa bộ lọc hoặc tạo đơn mới.</Typography>
                  </td>
                </tr>
              ) : list.map((row) => (
                <tr key={row.id} className="hover:bg-blue-gray-50/50 align-baseline">
                  <td className="py-3 px-3 border-b border-blue-gray-50 align-middle"><Typography variant="small" className="font-medium">#{row.id}</Typography></td>
                  <td className="py-3 px-3 border-b border-blue-gray-50 align-middle"><Typography variant="small">Đơn #{row.id}</Typography></td>
                  <td className="py-3 px-3 border-b border-blue-gray-50 align-middle min-w-0"><Typography variant="small" className="truncate block" title={row.storeName}>{row.storeName}</Typography></td>
                  <td className="py-3 px-3 border-b border-blue-gray-50 align-middle whitespace-nowrap"><Typography variant="small">{row.orderDate}</Typography></td>
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
                  <td className="py-3 px-3 border-b border-blue-gray-50 align-middle">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <Typography as="a" href="#" className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap shrink-0" onClick={(e) => { e.preventDefault(); navigate(`/dashboard/orders/${row.id}`); }}>
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
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

export default OrderList;
