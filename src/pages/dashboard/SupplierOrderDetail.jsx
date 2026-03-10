import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardBody, Typography, Button, Chip } from "@material-tailwind/react";
import { ArrowLeftIcon, DocumentArrowDownIcon, PhotoIcon, DocumentTextIcon } from "@heroicons/react/24/solid";
import { useData } from "@/context/DataContext";
import { useAuth, useToast } from "@/context";
import api from "@/api";

// Đơn con NCC: 5 trạng thái — Chờ, Chấp nhận, Từ chối, Đang giao, Giao hoàn thành
const osStatusColors = { Pending: "indigo", Accepted: "blue", Rejected: "red", Delivering: "orange", Delivered: "green" };
const orderStatusLabel = (s) => (s === "Completed" ? "Hoàn thành" : s === "Rejected" ? "Từ chối" : s === "Accepted" ? "Chấp nhận" : "Chờ");
const OS_STEPS_FULL = ["Pending", "Accepted", "Rejected", "Delivering", "Delivered"];
function osTimelineActiveIndices(status) {
  const s = String(status || "Pending");
  if (s === "Pending") return [0];
  if (s === "Rejected") return [0, 2];
  if (s === "Accepted") return [0, 1];
  if (s === "Delivering") return [0, 1, 3];
  if (s === "Delivered") return [0, 1, 3, 4];
  return [0];
}
const OS_STATUS_OPTIONS = [
  { value: "Pending", label: "Chờ (Pending)" },
  { value: "Accepted", label: "Chấp nhận (Accepted)" },
  { value: "Rejected", label: "Từ chối (Rejected)" },
  { value: "Delivering", label: "Đang giao (Delivering)" },
  { value: "Delivered", label: "Giao hoàn thành (Delivered)" },
];

/** Trong đơn con chỉ hiện 1 trong 2: đã Chấp nhận thì ẩn Từ chối, đã Từ chối thì ẩn Chấp nhận. */
function getStepsForDisplay(status) {
  const s = String(status || "Pending");
  if (s === "Rejected") return ["Pending", "Rejected"];
  if (s === "Accepted" || s === "Delivering" || s === "Delivered") return ["Pending", "Accepted", "Delivering", "Delivered"];
  return ["Pending", "Accepted", "Rejected", "Delivering", "Delivered"];
}

function getActiveIndicesForSteps(steps, status) {
  const s = String(status || "Pending");
  const idx = steps.indexOf(s);
  if (idx < 0) return [0];
  return Array.from({ length: idx + 1 }, (_, i) => i);
}

function OrderSupplierTimeline({ os }) {
  const currentStatus = os.status ?? os.Status ?? "Pending";
  const steps = getStepsForDisplay(currentStatus);
  const activeSet = new Set(getActiveIndicesForSteps(steps, currentStatus));
  return (
    <div className="flex flex-wrap gap-2 items-center mt-2">
      {steps.map((step, i) => {
        const active = activeSet.has(i);
        return (
          <div key={step} className="flex items-center gap-1">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                active ? "bg-teal-500 text-white" : "bg-blue-gray-100 text-blue-gray-500"
              }`}
            >
              {active ? "✓" : i + 1}
            </div>
            <span className={`text-[10px] ${active ? "text-blue-gray-800 font-medium" : "text-blue-gray-400"}`}>{step}</span>
            {i < steps.length - 1 && <span className="text-blue-gray-300 text-xs">→</span>}
          </div>
        );
      })}
      {os.confirmDate && currentStatus !== "Rejected" && <span className="text-[10px] text-gray-500 ml-1">Confirm: {os.confirmDate}</span>}
      {currentStatus === "Rejected" && (os.note ?? os.Note) && <span className="text-[10px] text-red-600 ml-1">Lý do: {os.note ?? os.Note}</span>}
    </div>
  );
}

export function SupplierOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { orders, setOrders, stores, useApi, refetchOrders } = useData();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState("");
  const [updating, setUpdating] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const osId = Number(id);
  let found = null;
  let order = null;
  let orderIndex = -1;
  let osIndex = -1;
  for (let i = 0; i < orders.length; i++) {
    const list = orders[i].orderSuppliers || orders[i].OrderSuppliers || [];
    const idx = list.findIndex((os) => (os.id ?? os.Id) === osId);
    if (idx >= 0) {
      found = list[idx];
      order = orders[i];
      orderIndex = i;
      osIndex = idx;
      break;
    }
  }

  const supplierIdUser = currentUser?.supplierId ?? currentUser?.SupplierId;
  const isMyOrder = found && Number(found.supplierId ?? found.SupplierId) === Number(supplierIdUser);
  const orderStatus = order?.status ?? order?.Status ?? "";
  const visibleStatuses = ["Accepted", "Completed"];
  const isParentVisibleToSupplier = visibleStatuses.includes(orderStatus);

  useEffect(() => {
    if (found) setSelectedStatus(((found.status ?? found.Status) || "Pending"));
  }, [found?.id, found?.status, found?.Status]);

  if (!found || !isMyOrder || !isParentVisibleToSupplier) {
    return (
      <div className="mt-12">
        <Typography>Không tìm thấy đơn hoặc không có quyền (đơn tổng chưa được chấp nhận hoặc đã bị từ chối).</Typography>
        <Button className="mt-2" onClick={() => navigate("/dashboard/supplier-orders")}>Quay lại</Button>
      </div>
    );
  }

  const updateStatus = async (newStatus, note) => {
    const withNote = newStatus === "Rejected" && note != null;
    const payload = withNote ? { status: newStatus, note } : { status: newStatus };
    const applyLocal = () => {
      const next = orders.map((o, i) => {
        if (i !== orderIndex) return o;
        const supps = o.orderSuppliers || o.OrderSuppliers || [];
        return {
          ...o,
          orderSuppliers: supps.map((os, j) => {
            if (j !== osIndex) return os;
            const updated = { ...os, status: newStatus };
            if (newStatus === "Accepted") updated.confirmDate = new Date().toISOString().slice(0, 10);
            if (newStatus === "Delivered") updated.actualDeliveryDate = new Date().toISOString().slice(0, 10);
            if (withNote) updated.note = note;
            return updated;
          }),
        };
      });
      setOrders(next);
      setSelectedStatus(newStatus);
    };
    if (useApi) {
      setUpdating(true);
      try {
        await api.patch("supplierOrders.updateStatus", payload, { params: { id: osId } });
        applyLocal();
      } catch (e) {
        showToast(e.message || "Lỗi cập nhật trạng thái", "error");
      } finally {
        setUpdating(false);
      }
      return;
    }
    applyLocal();
  };

  const handleApplyStatus = () => {
    const current = found.status ?? found.Status ?? "Pending";
    if (!selectedStatus || selectedStatus === current) return;
    if (selectedStatus === "Rejected") {
      const note = window.prompt("Lý do từ chối (tùy chọn):\nVí dụ: Hết hàng, không cung cấp được.", found.note ?? found.Note ?? "");
      if (note !== null) updateStatus("Rejected", note);
    } else {
      updateStatus(selectedStatus);
    }
  };

  const storeName = order?.storeName ?? order?.StoreName ?? stores?.find((s) => (s.id ?? s.Id) === (order?.storeId ?? order?.StoreId))?.name ?? "";

  const handleExportOrderBySupplier = () => {
    const w = window.open("", "_blank");
    if (!w || !order) return;
    const os = found;
    const total = (os.orderItems || os.OrderItems || []).reduce((sum, it) => sum + (it.quantity ?? it.Quantity) * Number((it.price ?? it.Price) || 0), 0);
    let html = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Đơn #${order.id ?? order.Id} - ${os.supplierName ?? os.SupplierName}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
        .header { margin-bottom: 20px; }
        .ncc-title { font-size: 16px; margin: 10px 0 5px; color: #1976d2; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="header">
        <h2>ĐƠN HÀNG THEO NCC</h2>
        <p><strong>Đơn tổng #${order.id ?? order.Id}</strong> | <strong>Cửa hàng:</strong> ${storeName} | <strong>Ngày đặt:</strong> ${order.orderDate ?? order.OrderDate}</p>
        <p class="ncc-title"><strong>Nhà cung cấp:</strong> ${os.supplierName ?? os.SupplierName} | Trạng thái: ${os.status ?? os.Status}</p>
      </div>
      <table>
        <tr><th>Sản phẩm</th><th>Số lượng</th><th>Đơn vị</th><th>Đơn giá</th><th>Thành tiền</th></tr>
    `;
    (os.orderItems || os.OrderItems || []).forEach((it) => {
      const q = it.quantity ?? it.Quantity;
      const p = Number((it.price ?? it.Price) || 0);
      const subtotal = q * p;
      html += `<tr><td>${it.productName ?? it.ProductName}</td><td>${q}</td><td>${it.unit ?? it.Unit}</td><td>${Number(p).toLocaleString("vi-VN")} đ</td><td>${subtotal.toLocaleString("vi-VN")} đ</td></tr>`;
    });
    html += `
      </table>
      <p style="margin-top:12px;font-weight:bold;">Tổng cộng đơn NCC này: ${total.toLocaleString("vi-VN")} đ</p>
      </body></html>
    `;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  const os = found;
  const orderItems = os.orderItems ?? os.OrderItems ?? [];
  const receiveImages = os.receiveImages ?? os.ReceiveImages ?? [];

  return (
    <div className="mt-12">
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="text" className="flex items-center gap-1 w-fit" onClick={() => navigate("/dashboard/supplier-orders")}>
          <ArrowLeftIcon className="w-4 h-4" /> Quay lại danh sách
        </Button>
        <Button size="sm" variant="outlined" className="flex items-center gap-1 w-fit" onClick={handleExportOrderBySupplier}>
          <DocumentArrowDownIcon className="w-4 h-4" /> Xuất đơn NCC / Gửi
        </Button>
      </div>

      <Card className="border border-blue-gray-100 mb-6">
        <CardHeader className="p-4 border-b flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <Typography variant="h5">Đơn hàng #{order.id ?? order.Id}</Typography>
            <Typography variant="small" color="gray">{storeName} · {order.orderDate ?? order.OrderDate}</Typography>
            <Typography variant="small" className="block mt-1">Đơn NCC #{os.id ?? os.Id}. Trạng thái đơn tổng: {orderStatusLabel(order.status ?? order.Status)}.</Typography>
          </div>
          <div className="flex-shrink-0 flex flex-wrap items-center gap-2">
            <Chip color={(order.status ?? order.Status) === "Completed" ? "green" : (order.status ?? order.Status) === "Rejected" ? "red" : (order.status ?? order.Status) === "Accepted" ? "amber" : "blue"} value={orderStatusLabel(order.status ?? order.Status)} />
          </div>
        </CardHeader>
        <CardBody className="p-4">
          <Typography variant="small" color="gray">Thông tin đơn tổng (Cửa hàng đặt). NCC xử lý đơn con bên dưới.</Typography>
        </CardBody>
      </Card>

      <Typography variant="h6" className="mb-3">Chi tiết đơn NCC & quy trình</Typography>
      <Card className="border border-blue-gray-100 mb-4">
        <CardHeader className="p-4 border-b flex flex-col gap-4 bg-blue-gray-50/50 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <Typography variant="h6">{os.supplierName ?? os.SupplierName}</Typography>
            <OrderSupplierTimeline os={os} />
          </div>
          <div className="flex-shrink-0 flex flex-wrap items-center gap-4">
            <Button size="sm" variant="outlined" className="flex items-center gap-1 whitespace-nowrap" onClick={handleExportOrderBySupplier}>
              <DocumentArrowDownIcon className="w-4 h-4" /> Xuất đơn NCC / Gửi
            </Button>
            <Chip size="sm" color={(osStatusColors[os.status ?? os.Status] || "gray")} value={os.status ?? os.Status} />
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-blue-gray-600">Trạng thái đơn NCC</label>
                <select
                  value={String(selectedStatus || (os.status ?? os.Status) || "Pending")}
                  onChange={(e) => setSelectedStatus(e.target.value || (os.status ?? os.Status) || "Pending")}
                  className="min-w-[200px] rounded-lg border border-blue-gray-200 bg-white px-3 py-2 text-sm text-blue-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  {OS_STATUS_OPTIONS.filter((opt) => {
                    const cur = os.status ?? os.Status ?? "Pending";
                    if (cur === "Accepted" && opt.value === "Rejected") return false;
                    if (cur === "Rejected" && opt.value === "Accepted") return false;
                    return true;
                  }).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <Button
                size="sm"
                color="blue"
                onClick={handleApplyStatus}
                disabled={updating || !selectedStatus || selectedStatus === (os.status ?? os.Status)}
              >
                {updating ? "Đang cập nhật..." : "Cập nhật trạng thái"}
              </Button>
            </div>
            {os.status === "Rejected" && (os.note ?? os.Note) && (
              <Typography variant="small" className="text-red-700 bg-red-50 px-3 py-1.5 rounded">
                Lý do từ chối: {os.note ?? os.Note}
              </Typography>
            )}
          </div>
        </CardHeader>
        <CardBody className="p-4">
          {receiveImages.length > 0 && (
            <div className="mb-4">
              <Typography variant="h6" color="blue-gray" className="mb-2">Ảnh đơn đã giao (Store đã gửi)</Typography>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Typography variant="small" className="font-medium text-blue-gray-600 mb-1 flex items-center gap-1">
                    <PhotoIcon className="w-4 h-4" /> Ảnh hàng nhận được
                  </Typography>
                  <div className="flex flex-wrap gap-2">
                    {receiveImages.filter((img) => (img.type ?? img.Type) === "received").map((img) => {
                      const raw = img.dataUrl ?? img.imageUrl ?? img.DataUrl ?? img.ImageUrl;
                      const src = raw && raw.startsWith("/") ? (api.BASE_URL || "").replace(/\/$/, "") + raw : raw;
                      const id = img.id ?? img.Id ?? src;
                      return (
                        <div key={id} className="relative">
                          <img src={src} alt={img.fileName ?? img.FileName ?? ""} className="h-20 w-20 object-cover rounded border cursor-pointer hover:opacity-90" onClick={() => setLightbox(src)} />
                          <Typography variant="small" className="block truncate w-20 text-xs text-gray-500">{img.fileName ?? img.FileName ?? ""}</Typography>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Typography variant="small" className="font-medium text-blue-gray-600 mb-1 flex items-center gap-1">
                    <DocumentTextIcon className="w-4 h-4" /> Hóa đơn đã ký
                  </Typography>
                  <div className="flex flex-wrap gap-2">
                    {receiveImages.filter((img) => (img.type ?? img.Type) === "invoice").map((img) => {
                      const raw = img.dataUrl ?? img.imageUrl ?? img.DataUrl ?? img.ImageUrl;
                      const src = raw && raw.startsWith("/") ? (api.BASE_URL || "").replace(/\/$/, "") + raw : raw;
                      const id = img.id ?? img.Id ?? src;
                      return (
                        <div key={id} className="relative">
                          <img src={src} alt={img.fileName ?? img.FileName ?? ""} className="h-20 w-20 object-cover rounded border cursor-pointer hover:opacity-90" onClick={() => setLightbox(src)} />
                          <Typography variant="small" className="block truncate w-20 text-xs text-gray-500">{img.fileName ?? img.FileName ?? ""}</Typography>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
          <table className="w-full table-auto">
            <thead>
              <tr>
                <th className="text-left py-2 px-3"><Typography variant="small" className="font-bold text-blue-gray-500">Sản phẩm</Typography></th>
                <th className="text-left py-2 px-3"><Typography variant="small" className="font-bold text-blue-gray-500">Số lượng</Typography></th>
                <th className="text-left py-2 px-3"><Typography variant="small" className="font-bold text-blue-gray-500">Đơn giá</Typography></th>
                <th className="text-right py-2 px-3"><Typography variant="small" className="font-bold text-blue-gray-500">Thành tiền</Typography></th>
              </tr>
            </thead>
            <tbody>
              {orderItems.map((item, idx) => {
                const q = item.quantity ?? item.Quantity ?? 0;
                const p = Number((item.price ?? item.Price) || 0);
                return (
                  <tr key={item.id ?? item.Id ?? idx}>
                    <td className="py-2 px-3"><Typography variant="small">{item.productName ?? item.ProductName}</Typography></td>
                    <td className="py-2 px-3"><Typography variant="small">{q} {item.unit ?? item.Unit}</Typography></td>
                    <td className="py-2 px-3"><Typography variant="small">{p.toLocaleString("vi-VN")} đ</Typography></td>
                    <td className="py-2 px-3 text-right"><Typography variant="small">{(q * p).toLocaleString("vi-VN")} đ</Typography></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Typography variant="small" className="mt-2 font-semibold text-green-700">
            Tổng tiền: {orderItems.reduce((s, it) => s + (it.quantity ?? it.Quantity ?? 0) * Number((it.price ?? it.Price) || 0), 0).toLocaleString("vi-VN")} đ
          </Typography>
          {(os.expectedDeliveryDate ?? os.ExpectedDeliveryDate) && (
            <Typography variant="small" color="gray" className="mt-2 block">Giao dự kiến: {String(os.expectedDeliveryDate ?? os.ExpectedDeliveryDate).slice(0, 10)}</Typography>
          )}
          <Typography variant="small" color="gray" className="mt-2 block">
            Chọn trạng thái rồi bấm &quot;Cập nhật trạng thái&quot;. Từ chối (Rejected) có thể nhập lý do.
          </Typography>
        </CardBody>
      </Card>

      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Xem ảnh" className="max-w-full max-h-full object-contain rounded" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

export default SupplierOrderDetail;
