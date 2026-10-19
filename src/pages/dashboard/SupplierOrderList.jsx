import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardHeader, CardBody, Typography, Chip, Button } from "@material-tailwind/react";
import { XMarkIcon, ArrowDownTrayIcon } from "@heroicons/react/24/solid";
import { useData } from "@/context/DataContext";
import { useAuth, useToast } from "@/context";
import api from "@/api";
import * as XLSX from "xlsx";
import { useUrlFilters, LIST_FILTER_PATHS } from "@/utils/urlFilters";

const SUPPLIER_ORDER_FILTER_STORAGE = LIST_FILTER_PATHS["/supplier-orders"];

const SUPPLIER_ORDER_FILTER_DEFAULTS = {
  status: "",
  supplierId: "",
  dateFrom: "",
  dateTo: "",
};

const statusColors = { Pending: "indigo", Accepted: "blue", Rejected: "red", Delivering: "orange", Delivered: "green" };
const statusLabels = { Pending: "Chờ xử lý", Accepted: "Đã xác nhận", Rejected: "Từ chối", Delivering: "Đang giao", Delivered: "Đã giao" };

export function SupplierOrderList() {
  const { orders, setOrders, suppliers } = useData();
  const { currentUser, isAdmin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { values, setFilter, clearFilters, searchString } = useUrlFilters(SUPPLIER_ORDER_FILTER_DEFAULTS, { storageKey: SUPPLIER_ORDER_FILTER_STORAGE });
  const filterStatus = values.status;
  const filterSupplier = values.supplierId;
  const filterDateFrom = values.dateFrom;
  const filterDateTo = values.dateTo;
  const [updatingId, setUpdatingId] = useState(null);

  const goDetail = (osId) => {
    navigate(`/dashboard/supplier-orders/${osId}`, {
      state: { returnSearch: searchString || location.search, returnPath: location.pathname },
    });
  };

  const supplierIdUser = currentUser?.supplierId ?? currentUser?.SupplierId;

  // NCC xem tất cả trạng thái, Admin xem tất cả
  const visibleStatuses = ["Pending", "Accepted", "Completed", "Rejected", "Delivering", "Delivered"];
  let list = orders
    .filter((o) => isAdmin ? true : true) // NCC thấy tất cả đơn có sản phẩm của mình
    .flatMap((o) => (o.orderSuppliers || []).map((os) => ({ ...os, order: o })));

  if (!isAdmin) {
    list = list.filter((os) => Number(os.supplierId ?? os.SupplierId) === Number(supplierIdUser));
  } else if (filterSupplier) {
    list = list.filter((os) => String(os.supplierId ?? os.SupplierId) === filterSupplier);
  }

  if (filterStatus) list = list.filter((os) => os.status === filterStatus);
  if (filterDateFrom) list = list.filter((os) => (os.order?.orderDate || "") >= filterDateFrom);
  if (filterDateTo) list = list.filter((os) => (os.order?.orderDate || "") <= filterDateTo);

  const hasFilters = filterStatus || filterDateFrom || filterDateTo || filterSupplier;

  // Xuất Excel — mỗi dòng điền đầy đủ tất cả cột
  const exportExcel = () => {
    const rows = [];
    let stt = 1;
    list.forEach((os) => {
      const items = os.orderItems || [];
      const maĐH = `#${os.id}`;
      const ngay = os.order?.orderDate ? new Date(os.order.orderDate).toLocaleDateString("vi-VN") : "";
      const khachHang = os.order?.storeName || "";
      if (items.length === 0) {
        rows.push({
          STT: stt++,
          "Mã ĐH": maĐH,
          "Ngày đơn hàng": ngay,
          "Khách hàng": khachHang,
          "Mã hàng hóa": "",
          "Tên hàng": "",
          "ĐVT": "",
          "Số lượng": "",
          "Đơn giá": "",
        });
      } else {
        items.forEach((it) => {
          rows.push({
            STT: stt++,
            "Mã ĐH": maĐH,
            "Ngày đơn hàng": ngay,
            "Khách hàng": khachHang,
            "Mã hàng hóa": it.productId ?? "",
            "Tên hàng": it.productName ?? it.ProductName ?? "",
            "ĐVT": it.unit ?? it.Unit ?? "",
            "Số lượng": it.quantity ?? it.Quantity ?? 0,
            "Đơn giá": Number((it.price ?? it.Price) || 0),
          });
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 6 }, { wch: 10 }, { wch: 14 }, { wch: 30 },
      { wch: 14 }, { wch: 40 }, { wch: 8 }, { wch: 10 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    const sheetName = filterSupplier
      ? (suppliers.find((s) => String(s.id) === filterSupplier)?.name || "NCC") + "_DonHang"
      : "DanhSach_DonHang";
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, `${sheetName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const applyOsStatusLocal = (osId, newStatus) => {
    setOrders((prev) =>
      prev.map((o) => ({
        ...o,
        orderSuppliers: (o.orderSuppliers || o.OrderSuppliers || []).map((os) => {
          if ((os.id ?? os.Id) !== osId) return os;
          const updated = { ...os, status: newStatus };
          if (newStatus === "Accepted") {
            updated.confirmDate = new Date().toISOString().slice(0, 10);
          }
          if (newStatus === "Delivered") {
            updated.actualDeliveryDate = new Date().toISOString().slice(0, 10);
          }
          return updated;
        }),
      }))
    );
  };

  // Admin cập nhật trạng thái nhanh — giữ vị trí cuộn, không reload trang
  const handleStatusChange = async (osId, newStatus) => {
    setUpdatingId(osId);
    try {
      await api.patch("supplierOrders.updateStatus", { status: newStatus }, { params: { id: osId } });
      applyOsStatusLocal(osId, newStatus);
      showToast("Đã cập nhật trạng thái.", "success");
    } catch (e) {
      showToast(e?.data?.message || e?.message || "Lỗi cập nhật", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="mt-4 md:mt-12 w-full max-w-full min-w-0">
      <Card className="border border-blue-gray-100 w-full max-w-full">
        <CardHeader className="p-4 border-b">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Typography variant="h6" color="blue-gray">
                {isAdmin ? "Đơn hàng theo NCC" : "Đơn cần xử lý"}
              </Typography>
              {hasFilters && (
                <Button variant="text" size="sm" className="flex items-center gap-1 text-red-600" onClick={clearFilters}>
                  <XMarkIcon className="w-4 h-4" /> Xóa bộ lọc
                </Button>
              )}
              {list.length > 0 && (
                <Button size="sm" variant="outlined" color="green" className="flex items-center gap-1" onClick={exportExcel}>
                  <ArrowDownTrayIcon className="w-4 h-4" /> Xuất Excel
                </Button>
              )}
            </div>
            {/* Compact filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {isAdmin && (
                <select value={filterSupplier} onChange={(e) => setFilter("supplierId", e.target.value)}
                  className="rounded-lg border border-blue-gray-200 bg-white px-2 py-2 text-sm focus:outline-none max-w-[140px]">
                  <option value="">Tất cả NCC</option>
                  {suppliers.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
              )}
              <select value={filterStatus} onChange={(e) => setFilter("status", e.target.value)}
                className="rounded-lg border border-blue-gray-200 bg-white px-2 py-2 text-sm focus:outline-none max-w-[130px]">
                <option value="">Tất cả TT</option>
                {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input type="date" value={filterDateFrom} onChange={(e) => setFilter("dateFrom", e.target.value)}
                className="rounded-lg border border-blue-gray-200 px-2 py-2 text-sm focus:outline-none flex-1 min-w-[120px]" />
              <span className="text-gray-400 text-sm">—</span>
              <input type="date" value={filterDateTo} onChange={(e) => setFilter("dateTo", e.target.value)}
                className="rounded-lg border border-blue-gray-200 px-2 py-2 text-sm focus:outline-none flex-1 min-w-[120px]" />
              {hasFilters && (
                <button onClick={clearFilters} className="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <div className="px-4 py-2 border-b border-blue-gray-50">
            <Typography variant="small" color="gray">Hiển thị <strong>{list.length}</strong> đơn con</Typography>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-blue-gray-50">
            {list.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">Không có đơn nào</div>
            ) : list.map((os) => (
              <div key={os.id} className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Typography variant="small" className="font-semibold">#{os.id} — {os.order?.storeName}</Typography>
                    {isAdmin && <Typography variant="small" color="blue-gray" className="text-xs">NCC: {os.supplierName}</Typography>}
                    <Typography variant="small" color="gray" className="text-xs">
                      Đơn #{os.orderId} · {os.order?.orderDate ? new Date(os.order.orderDate).toLocaleDateString("vi-VN") : ""}
                    </Typography>
                  </div>
                  <Chip size="sm" color={statusColors[os.status] || "gray"} value={statusLabels[os.status] || os.status} />
                </div>
                {(os.orderItems || []).length > 0 && (
                  <div className="text-xs text-gray-600 bg-blue-gray-50/50 rounded p-2">
                    {(os.orderItems || []).map((it, i) => (
                      <div key={i}>{it.productName}: <strong>{it.quantity} {it.unit}</strong></div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {isAdmin && (
                    <select value={os.status} disabled={updatingId === os.id} onChange={(e) => handleStatusChange(os.id, e.target.value)}
                      className="rounded-lg border border-blue-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none">
                      {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  )}
                  <button onClick={() => goDetail(os.id)}
                    className="text-xs font-semibold text-blue-600 hover:underline">
                    Xem chi tiết →
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: bảng chi tiết từng sản phẩm trong đơn */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Mã ĐH</th>
                  <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Ngày đơn hàng</th>
                  <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Khách hàng</th>
                  <th className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">Mã hàng hóa</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Tên hàng</th>
                  <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">ĐVT</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Số lượng</th>
                  <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">Trạng thái</th>
                  <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 10 : 9} className="py-12 text-center text-gray-400">Không có đơn nào</td></tr>
                ) : list.flatMap((os, osIdx) => {
                  const items = os.orderItems || [];
                  if (items.length === 0) {
                    // Đơn không có sản phẩm — hiện 1 dòng trống
                    return [(
                      <tr key={`${os.id}-empty`} className={osIdx % 2 === 0 ? "bg-white" : "bg-blue-50/40"}>
                        <td className="px-3 py-2 font-medium text-blue-gray-700">#{os.id}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{os.order?.orderDate ? new Date(os.order.orderDate).toLocaleDateString("vi-VN") : "—"}</td>
                        <td className="px-3 py-2">{os.order?.storeName || "—"}</td>
                        <td className="px-3 py-2 text-gray-400" colSpan={3}>—</td>
                        <td className="px-3 py-2 text-right text-gray-400">—</td>
                        <td className="px-3 py-2 text-center">
                          {isAdmin ? (
                            <select value={os.status} disabled={updatingId === os.id} onChange={(e) => handleStatusChange(os.id, e.target.value)}
                              className="rounded border border-blue-gray-200 bg-white px-1.5 py-1 text-xs focus:outline-none">
                              {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          ) : (
                            <Chip size="sm" color={statusColors[os.status] || "gray"} value={statusLabels[os.status] || os.status} className="w-fit mx-auto" />
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => goDetail(os.id)} className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap">Xem →</button>
                        </td>
                      </tr>
                    )];
                  }
                  // Mỗi sản phẩm = 1 dòng, dòng đầu hiện Mã ĐH + Ngày + Khách hàng, các dòng sau để trống
                  return items.map((it, itIdx) => (
                    <tr key={`${os.id}-${itIdx}`} className={osIdx % 2 === 0 ? "bg-white hover:bg-blue-gray-50/30" : "bg-blue-50/40 hover:bg-blue-50/70"}>
                      <td className="px-3 py-2 font-medium text-blue-gray-700 whitespace-nowrap">
                        {itIdx === 0 ? `#${os.id}` : ""}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                        {itIdx === 0 ? (os.order?.orderDate ? new Date(os.order.orderDate).toLocaleDateString("vi-VN") : "—") : ""}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {itIdx === 0 ? (os.order?.storeName || "—") : ""}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs font-mono">{it.productId ?? "—"}</td>
                      <td className="px-3 py-2 font-medium text-blue-gray-800">{it.productName ?? it.ProductName ?? "—"}</td>
                      <td className="px-3 py-2 text-center text-gray-600">{it.unit ?? it.Unit ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold text-blue-gray-800">{it.quantity ?? it.Quantity ?? 0}</td>
                      <td className="px-3 py-2 text-center">
                        {itIdx === 0 ? (
                          isAdmin ? (
                            <select value={os.status} disabled={updatingId === os.id} onChange={(e) => handleStatusChange(os.id, e.target.value)}
                              className="rounded border border-blue-gray-200 bg-white px-1.5 py-1 text-xs focus:outline-none">
                              {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          ) : (
                            <Chip size="sm" color={statusColors[os.status] || "gray"} value={statusLabels[os.status] || os.status} className="w-fit mx-auto" />
                          )
                        ) : ""}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {itIdx === 0 ? (
                          <button onClick={() => goDetail(os.id)} className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap">Xem →</button>
                        ) : ""}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default SupplierOrderList;
