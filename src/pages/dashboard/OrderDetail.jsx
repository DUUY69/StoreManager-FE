import React, { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardBody, Typography, Button, Chip } from "@material-tailwind/react";
import { ArrowLeftIcon, PrinterIcon, CheckCircleIcon, PhotoIcon, DocumentTextIcon, DocumentArrowDownIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { useData } from "@/context/DataContext";
import { useAuth, useToast } from "@/context";
import api from "@/api";

// Đơn tổng: 4 trạng thái — Chờ, Từ chối, Chấp nhận, Hoàn thành
/** Map status đơn tổng sang index timeline (0=Chờ, 1=Chấp nhận/Từ chối, 2=Hoàn thành). */
function orderStatusToStepIndex(s) {
  if (!s) return 0;
  const x = String(s);
  if (x === "Completed") return 2;
  if (x === "Rejected" || x === "Accepted") return 1;
  return 0; // Pending -> Chờ
}
function orderStatusLabel(s) {
  if (!s) return "Chờ";
  const x = String(s);
  if (x === "Completed") return "Hoàn thành";
  if (x === "Rejected") return "Từ chối";
  if (x === "Accepted") return "Chấp nhận";
  return "Chờ";
}

// Đơn con NCC: 5 trạng thái — Chờ, Chấp nhận, Từ chối, Đang giao, Giao hoàn thành
const OS_STEPS_FULL = ["Pending", "Accepted", "Rejected", "Delivering", "Delivered"];
const osStatusColors = { Pending: "indigo", Accepted: "blue", Rejected: "red", Delivering: "orange", Delivered: "green" };
const OS_STATUS_OPTIONS = [
  { value: "Pending", label: "Chờ" },
  { value: "Accepted", label: "Chấp nhận" },
  { value: "Rejected", label: "Từ chối" },
  { value: "Delivering", label: "Đang giao" },
  { value: "Delivered", label: "Giao hoàn thành" },
];
/** Trong đơn con chỉ hiện 1 trong 2: đã Chấp nhận thì ẩn Từ chối, đã Từ chối thì ẩn Chấp nhận. */
function getOsStepsForDisplay(status) {
  const s = String(status || "Pending");
  if (s === "Rejected") return ["Pending", "Rejected"];
  if (s === "Accepted" || s === "Delivering" || s === "Delivered") return ["Pending", "Accepted", "Delivering", "Delivered"];
  return ["Pending", "Accepted", "Rejected", "Delivering", "Delivered"];
}
function getOsActiveIndicesForSteps(steps, status) {
  const s = String(status || "Pending");
  const idx = steps.indexOf(s);
  if (idx < 0) return [0];
  return Array.from({ length: idx + 1 }, (_, i) => i);
}
function osTimelineActiveIndices(status) {
  const s = String(status || "Pending");
  if (s === "Pending") return [0];
  if (s === "Rejected") return [0, 2];
  if (s === "Accepted") return [0, 1];
  if (s === "Delivering") return [0, 1, 3];
  if (s === "Delivered") return [0, 1, 3, 4];
  return [0];
}

function OrderTimeline({ currentStatus, createdDate, orderDate, showAcceptReject, onAccept, onReject }) {
  const currentIndex = orderStatusToStepIndex(currentStatus);
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Bước 1: Chờ chấp nhận */}
      <div className="flex items-center gap-1">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
            currentIndex >= 0 ? "bg-blue-500 text-white" : "bg-blue-gray-100 text-blue-gray-500"
          }`}
        >
          <CheckCircleIcon className="w-4 h-4" />
        </div>
        <span className="text-xs text-blue-gray-800 font-medium">Chờ</span>
      </div>
      <span className="text-blue-gray-300">→</span>
      {/* Bước 2: Chấp nhận hoặc Từ chối — chỉ hiển thị trạng thái, không còn nút ở đây */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
            currentIndex >= 1 ? "bg-blue-500 text-white" : "bg-blue-gray-100 text-blue-gray-500"
          }`}
        >
          {currentIndex >= 1 ? <CheckCircleIcon className="w-4 h-4" /> : "2"}
        </div>
        <span className={`text-xs ${currentIndex >= 1 ? "text-blue-gray-800 font-medium" : "text-blue-gray-400"}`}>
          {currentIndex >= 1 || currentStatus === "Rejected"
            ? `Trạng thái: ${currentStatus === "Rejected" ? "Từ chối" : "Chấp nhận"}`
            : "Chấp nhận hoặc Từ chối"}
        </span>
      </div>
      <span className="text-blue-gray-300">→</span>
      {/* Bước 3: Hoàn thành */}
      <div className="flex items-center gap-1">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
            currentIndex >= 2 ? "bg-blue-500 text-white" : "bg-blue-gray-100 text-blue-gray-500"
          }`}
        >
          {currentIndex >= 2 ? <CheckCircleIcon className="w-4 h-4" /> : "3"}
        </div>
        <span className={`text-xs ${currentIndex >= 2 ? "text-blue-gray-800 font-medium" : "text-blue-gray-400"}`}>
          Hoàn thành
        </span>
      </div>
      {(createdDate || orderDate) && (
        <Typography variant="small" color="gray" className="ml-2">
          Đặt: {orderDate || createdDate?.slice(0, 10)}
        </Typography>
      )}
    </div>
  );
}

function OrderSupplierTimeline({ os }) {
  const currentStatus = os.status ?? os.Status ?? "Pending";
  const steps = getOsStepsForDisplay(currentStatus);
  const activeSet = new Set(getOsActiveIndicesForSteps(steps, currentStatus));
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

function readFilesAsDataUrl(files) {
  return Promise.all(
    Array.from(files || []).map(
      (file) =>
        new Promise((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve({ dataUrl: r.result, fileName: file.name });
          r.readAsDataURL(file);
        })
    )
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { orders, setOrders, stores, useApi, refetchOrders } = useData();
  const { currentUser, isAdmin, isStoreUser } = useAuth();
  const { showToast } = useToast();

  const [confirmModal, setConfirmModal] = useState({ open: false, osId: null });
  const [lightbox, setLightbox] = useState(null);
  const [adminOsStatusEdit, setAdminOsStatusEdit] = useState({});
  const [adminOsNoteEdit, setAdminOsNoteEdit] = useState({});
  const [updatingOsId, setUpdatingOsId] = useState(null);
  const refReceived = useRef(null);
  const refInvoice = useRef(null);

  const orderIndex = orders.findIndex((o) => (o.id ?? o.Id) === Number(id));
  const order = orderIndex >= 0 ? orders[orderIndex] : null;
  const orderId = order ? (order.id ?? order.Id) : null;

  const isOrderCompleted = order ? String(order.status ?? order.Status) === "Completed" : false;

  // Store xác nhận nhận hàng khi: Đang giao hoặc Đã giao (Delivered)
  const canConfirmReceive = (os) => {
    const s = (os.status ?? os.Status ?? "").toLowerCase();
    return s === "delivering" || s === "delivered";
  };

  // Admin chấp nhận hoặc từ chối đơn khi đơn đang chờ (trạng thái từ API có thể status hoặc Status)
  const orderStatus = order ? (order.status ?? order.Status ?? "") : "";
  const canAdminAcceptOrRejectOrder = order && orderStatus === "Pending";

  const handleAdminAcceptOrder = async () => {
    const apply = () => {
      const next = orders.map((o) => {
        if ((o.id ?? o.Id) !== orderId) return o;
        return { ...o, status: "Accepted" };
      });
      setOrders(next);
    };
    if (useApi) {
      try {
        await api.patch("orders.accept", {}, { params: { id: orderId } });
        apply();
      } catch (e) {
        showToast(e.message || "Lỗi chấp nhận đơn", "error");
      }
      return;
    }
    apply();
  };

  const handleAdminRejectOrder = async () => {
    const apply = () => {
      const next = orders.map((o) => {
        if ((o.id ?? o.Id) !== orderId) return o;
        const newOrderSuppliers = (o.orderSuppliers || []).map((os) => ({ ...os, status: "Rejected" }));
        return { ...o, orderSuppliers: newOrderSuppliers, status: "Rejected" };
      });
      setOrders(next);
    };
    if (useApi) {
      try {
        await api.patch("orders.reject", {}, { params: { id: orderId } });
        apply();
      } catch (e) {
        showToast(e.message || "Lỗi từ chối đơn", "error");
      }
      return;
    }
    apply();
  };

  const handleAdminUpdateOsStatus = async (os) => {
    const osId = os.id ?? os.Id;
    const currentStatus = os.status ?? os.Status ?? "Pending";
    const newStatus = adminOsStatusEdit[osId] ?? currentStatus;
    if (newStatus === currentStatus) return;
    const note = newStatus === "Rejected" ? (adminOsNoteEdit[osId] ?? "").trim() || undefined : undefined;
    if (useApi) {
      setUpdatingOsId(osId);
      try {
        const payload = note != null ? { status: newStatus, note } : { status: newStatus };
        await api.patch("orderSuppliers.updateStatus", payload, { params: { id: osId } });
        const next = orders.map((o) => {
          if ((o.id ?? o.Id) !== orderId) return o;
          const newOrderSuppliers = (o.orderSuppliers || []).map((x) => {
            if ((x.id ?? x.Id) !== osId) return x;
            const updated = { ...x, status: newStatus };
            if (newStatus === "Accepted") updated.confirmDate = new Date().toISOString().slice(0, 10);
            if (newStatus === "Delivered") updated.actualDeliveryDate = new Date().toISOString().slice(0, 10);
            if (note != null) updated.note = note;
            return updated;
          });
          const allDone = newOrderSuppliers.every((x) => (x.status ?? x.Status) === "Delivered" || (x.status ?? x.Status) === "Rejected");
          return { ...o, orderSuppliers: newOrderSuppliers, status: allDone ? "Completed" : o.status };
        });
        setOrders(next);
        setAdminOsStatusEdit((prev) => ({ ...prev, [osId]: undefined }));
        setAdminOsNoteEdit((prev) => ({ ...prev, [osId]: undefined }));
        showToast("Đã cập nhật trạng thái đơn NCC.", "success");
      } catch (e) {
        showToast(e?.data?.message || e.message || "Lỗi cập nhật trạng thái đơn NCC", "error");
      } finally {
        setUpdatingOsId(null);
      }
      return;
    }
    const next = orders.map((o) => {
      if ((o.id ?? o.Id) !== orderId) return o;
      const newOrderSuppliers = (o.orderSuppliers || []).map((x) => {
        if ((x.id ?? x.Id) !== osId) return x;
        const updated = { ...x, status: newStatus };
        if (newStatus === "Accepted") updated.confirmDate = new Date().toISOString().slice(0, 10);
        if (newStatus === "Delivered") updated.actualDeliveryDate = new Date().toISOString().slice(0, 10);
        if (note != null) updated.note = note;
        return updated;
      });
      const allDone = newOrderSuppliers.every((x) => (x.status ?? x.Status) === "Delivered" || (x.status ?? x.Status) === "Rejected");
      return { ...o, orderSuppliers: newOrderSuppliers, status: allDone ? "Completed" : o.status };
    });
    setOrders(next);
    setAdminOsStatusEdit((prev) => ({ ...prev, [osId]: undefined }));
    setAdminOsNoteEdit((prev) => ({ ...prev, [osId]: undefined }));
  };

  const openUploadModal = (osId) => {
    setConfirmModal({ open: true, osId });
    setTimeout(() => { refReceived.current && (refReceived.current.value = ""); refInvoice.current && (refInvoice.current.value = ""); }, 0);
  };

  /** Cập nhật local: đơn NCC osId chuyển sang Delivered; nếu tất cả Delivered/Rejected thì đơn tổng Completed. */
  const applyConfirmReceiveToLocal = (osId) => {
    const next = orders.map((o) => {
      if ((o.id ?? o.Id) !== orderId) return o;
      const newOrderSuppliers = (o.orderSuppliers || []).map((os) =>
        (os.id ?? os.Id) === osId ? { ...os, status: "Delivered", actualDeliveryDate: new Date().toISOString().slice(0, 10) } : os
      );
      const allDone = newOrderSuppliers.every((os) => (os.status ?? os.Status) === "Delivered" || (os.status ?? os.Status) === "Rejected");
      return { ...o, orderSuppliers: newOrderSuppliers, status: allDone ? "Completed" : o.status };
    });
    setOrders(next);
  };

  /** Chỉ xác nhận đã nhận hàng (không mở modal, không ảnh). Không gọi refetch ngay để tránh dữ liệu server ghi đè làm UI trở lại trạng thái cũ. */
  const handleConfirmReceiveOnly = async (osId) => {
    if (useApi) {
      try {
        const formData = new FormData();
        formData.append("confirm", "1");
        await api.request("orderSuppliers.confirmReceive", { params: { id: osId }, formData });
        applyConfirmReceiveToLocal(osId);
      } catch (e) {
        const msg = e?.data?.message || e?.message || "Lỗi xác nhận nhận hàng";
        showToast(typeof msg === "string" ? msg : "Lỗi xác nhận nhận hàng", "error");
      }
      return;
    }
    applyConfirmReceiveToLocal(osId);
  };

  const handleConfirmReceiveWithImages = async () => {
    const { osId } = confirmModal;
    const receivedFiles = refReceived.current?.files ? Array.from(refReceived.current.files) : [];
    const invoiceFiles = refInvoice.current?.files ? Array.from(refInvoice.current.files) : [];
    if (useApi) {
      try {
        const formData = new FormData();
        receivedFiles.forEach((f) => formData.append("received", f));
        invoiceFiles.forEach((f) => formData.append("invoice", f));
        if (receivedFiles.length === 0 && invoiceFiles.length === 0) formData.append("confirm", "1");
        const res = await api.request("orderSuppliers.confirmReceive", { params: { id: osId }, formData });
        setConfirmModal({ open: false, osId: null });
        const updatedStatus = res?.Status ?? res?.status ?? "Delivered";
        const updatedImages = res?.ReceiveImages ?? res?.receiveImages ?? [];
        setOrders((prev) =>
          prev.map((o) => {
            if ((o.id ?? o.Id) !== orderId) return o;
            const newOrderSuppliers = (o.orderSuppliers || []).map((os) =>
              (os.id ?? os.Id) === osId
                ? { ...os, status: updatedStatus, actualDeliveryDate: res?.ActualDeliveryDate ?? res?.actualDeliveryDate ?? new Date().toISOString().slice(0, 10), receiveImages: updatedImages }
                : os
            );
            const allDone = newOrderSuppliers.every((x) => (x.status ?? x.Status) === "Delivered" || (x.status ?? x.Status) === "Rejected");
            return { ...o, orderSuppliers: newOrderSuppliers, status: allDone ? "Completed" : o.status };
          })
        );
      } catch (e) {
        const msg = e?.data?.message || e?.message || "Lỗi xác nhận nhận hàng";
        showToast(typeof msg === "string" ? msg : "Lỗi xác nhận nhận hàng", "error");
      }
      return;
    }
    const received = await readFilesAsDataUrl(receivedFiles);
    const invoice = await readFilesAsDataUrl(invoiceFiles);
    const receiveImages = [
      ...received.map((r, i) => ({ id: `r-${osId}-${i}`, type: "received", dataUrl: r.dataUrl, fileName: r.fileName })),
      ...invoice.map((r, i) => ({ id: `i-${osId}-${i}`, type: "invoice", dataUrl: r.dataUrl, fileName: r.fileName })),
    ];
    const next = orders.map((o) => {
      if ((o.id ?? o.Id) !== orderId) return o;
      const newOrderSuppliers = (o.orderSuppliers || []).map((os) =>
        (os.id ?? os.Id) === osId ? { ...os, status: "Delivered", actualDeliveryDate: new Date().toISOString().slice(0, 10), receiveImages: os.receiveImages ? [...os.receiveImages, ...receiveImages] : receiveImages } : os
      );
      const allDone = newOrderSuppliers.every((os) => os.status === "Delivered" || os.status === "Rejected");
      return { ...o, orderSuppliers: newOrderSuppliers, status: allDone ? "Completed" : o.status };
    });
    setOrders(next);
    setConfirmModal({ open: false, osId: null });
  };


  const computeOrderTotal = (o) => {
    const amt = Number(o?.totalAmount ?? o?.TotalAmount ?? 0);
    if (amt > 0) return amt;
    return (o?.orderSuppliers || []).reduce((sum, os) => sum + (os.orderItems || []).reduce((s, it) => s + (it.quantity ?? it.Quantity ?? 0) * Number((it.price ?? it.Price) || 0), 0), 0);
  };

  const handleExportOrder = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const storeName = stores.find((s) => s.id === order.storeId)?.name || order.storeName;
    const totalAmt = computeOrderTotal(order);
    const osList = order.orderSuppliers || [];
    let html = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Đơn hàng #${order.id}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; }
        .header { margin-bottom: 20px; }
        .totals { margin-top: 20px; padding: 12px; background: #f9f9f9; border: 1px solid #ddd; font-weight: bold; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="header">
        <h2>ĐƠN HÀNG #${order.id}</h2>
        <p><strong>Cửa hàng:</strong> ${storeName} | <strong>Ngày đặt:</strong> ${order.orderDate} | <strong>Trạng thái:</strong> ${order.status}</p>
      </div>
      <table><tr><th>NCC</th><th>Sản phẩm</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr>
    `;
    osList.forEach((os) => {
      (os.orderItems || []).forEach((it) => {
        const q = it.quantity ?? it.Quantity ?? 0;
        const p = Number((it.price ?? it.Price) || 0);
        html += `<tr><td>${os.supplierName ?? os.SupplierName ?? ""}</td><td>${it.productName ?? it.ProductName ?? ""}</td><td>${q} ${it.unit ?? it.Unit ?? ""}</td><td>${p.toLocaleString("vi-VN")} đ</td><td>${(q * p).toLocaleString("vi-VN")} đ</td></tr>`;
      });
    });
    html += `</table><div class="totals">Tổng tiền: ${totalAmt.toLocaleString("vi-VN")} đ</div></body></html>`;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 300);
  };

  /** Xuất đơn riêng theo từng NCC để gửi cho nhà cung cấp */
  const handleExportOrderBySupplier = (os) => {
    const w = window.open("", "_blank");
    if (!w) return;
    const storeName = stores.find((s) => s.id === order.storeId)?.name || order.storeName;
    const total = (os.orderItems || []).reduce((sum, it) => sum + it.quantity * Number(it.price || 0), 0);
    let html = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Đơn #${order.id} - ${os.supplierName}</title>
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
        <p><strong>Đơn tổng #${order.id}</strong> | <strong>Cửa hàng:</strong> ${storeName} | <strong>Ngày đặt:</strong> ${order.orderDate}</p>
        <p class="ncc-title"><strong>Nhà cung cấp:</strong> ${os.supplierName} | Trạng thái: ${os.status}</p>
      </div>
      <table>
        <tr><th>Sản phẩm</th><th>Số lượng</th><th>Đơn vị</th><th>Đơn giá</th><th>Thành tiền</th></tr>
    `;
    (os.orderItems || []).forEach((it) => {
      const subtotal = it.quantity * Number(it.price || 0);
      html += `<tr><td>${it.productName}</td><td>${it.quantity}</td><td>${it.unit}</td><td>${Number(it.price).toLocaleString("vi-VN")} đ</td><td>${subtotal.toLocaleString("vi-VN")} đ</td></tr>`;
    });
    html += `
      </table>
      <p style="margin-top:12px;font-weight:bold;">Tổng tiền đơn NCC này: ${total.toLocaleString("vi-VN")} đ</p>
      <p style="margin-top:8px;color:#666;">Giao dự kiến: ${os.expectedDeliveryDate || "-"}</p>
      </body></html>
    `;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 300);
  };

  if (!order) {
    return (
      <div className="mt-12">
        <Typography>Không tìm thấy đơn hàng.</Typography>
        <Button className="mt-2" onClick={() => navigate("/dashboard/orders")}>Quay lại</Button>
      </div>
    );
  }

  const isStoreOrder = isAdmin || (isStoreUser && currentUser?.storeId === order.storeId);
  /** Chỉ Store (cửa hàng của đơn) mới được xác nhận nhận hàng / gửi ảnh; Admin không gọi API này được. */
  const orderStoreId = order.storeId ?? order.StoreId;
  const userStoreId = currentUser?.storeId ?? currentUser?.StoreId;
  const canStoreConfirmAndUpload = isStoreUser && (userStoreId != null && String(userStoreId) === String(orderStoreId));

  return (
    <div className="mt-12">
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="text" className="flex items-center gap-1 w-fit" onClick={() => navigate("/dashboard/orders")}>
          <ArrowLeftIcon className="w-4 h-4" /> Quay lại danh sách
        </Button>
        <Button size="sm" variant="outlined" className="flex items-center gap-1 w-fit" onClick={handleExportOrder}>
          <PrinterIcon className="w-4 h-4" /> Xuất đơn / In
        </Button>
      </div>

      <Card className="border border-blue-gray-100 mb-6">
        <CardHeader className="p-4 border-b flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <Typography variant="h5">Đơn hàng #{order.id}</Typography>
            <Typography variant="small" color="gray">{order.storeName} · {order.orderDate}</Typography>
            <Typography variant="small" className="block mt-1">Tổng số dòng: {order.totalItemCount ?? (order.orderSuppliers || []).reduce((s, os) => s + (os.orderItems || []).length, 0)}. Trạng thái: {orderStatusLabel(orderStatus)}.</Typography>
            <div className="mt-2 rounded bg-blue-gray-50 px-3 py-2 text-sm">
              <strong className="text-blue-gray-700">Tổng tiền: </strong>
              <span className="font-semibold text-green-700">{computeOrderTotal(order).toLocaleString("vi-VN")} đ</span>
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-wrap items-center gap-2">
            <Chip color={orderStatus === "Completed" ? "green" : orderStatus === "Rejected" ? "red" : orderStatus === "Accepted" ? "amber" : "blue"} value={orderStatusLabel(orderStatus)} />
            {isAdmin && isOrderCompleted && (
              <Typography variant="small" color="gray" className="border-l border-blue-gray-200 pl-4">Hoàn thành (tự động khi tất cả đơn NCC xong)</Typography>
            )}
            {isAdmin && canAdminAcceptOrRejectOrder && (
              <>
                <Button size="sm" color="green" className="flex items-center gap-1 whitespace-nowrap" onClick={handleAdminAcceptOrder} title="Admin chấp nhận đơn, chuyển sang xử lý">
                  <CheckCircleIcon className="w-4 h-4" /> Chấp nhận đơn
                </Button>
                <Button size="sm" color="red" variant="outlined" className="flex items-center gap-1 whitespace-nowrap" onClick={handleAdminRejectOrder} title="Admin từ chối đơn">
                  <XMarkIcon className="w-4 h-4" /> Từ chối đơn
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardBody className="p-4">
          <Typography variant="h6" color="blue-gray" className="mb-2">Quy trình đơn tổng</Typography>
          <OrderTimeline
            currentStatus={orderStatus}
            createdDate={order.createdDate}
            orderDate={order.orderDate}
            showAcceptReject={isAdmin && canAdminAcceptOrRejectOrder}
            onAccept={handleAdminAcceptOrder}
            onReject={handleAdminRejectOrder}
          />
          {isAdmin && canAdminAcceptOrRejectOrder && (
            <Typography variant="small" color="gray" className="mt-2">Đơn đang chờ duyệt. Chọn <strong>Chấp nhận đơn</strong> hoặc <strong>Từ chối đơn</strong> ở trên.</Typography>
          )}
        </CardBody>
      </Card>

      <Typography variant="h6" className="mb-3">Chi tiết đơn hàng (1 bảng, cột NCC)</Typography>
      <Card className="border border-blue-gray-100 mb-6">
        <CardBody className="p-4 overflow-x-auto">
          <table className="w-full table-auto min-w-[500px]">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 border-b border-blue-gray-100"><Typography variant="small" className="font-bold text-blue-gray-500">NCC</Typography></th>
                <th className="text-left py-2 px-3 border-b border-blue-gray-100"><Typography variant="small" className="font-bold text-blue-gray-500">Sản phẩm</Typography></th>
                <th className="text-left py-2 px-3 border-b border-blue-gray-100"><Typography variant="small" className="font-bold text-blue-gray-500">Số lượng</Typography></th>
                <th className="text-left py-2 px-3 border-b border-blue-gray-100"><Typography variant="small" className="font-bold text-blue-gray-500">Đơn giá</Typography></th>
                <th className="text-right py-2 px-3 border-b border-blue-gray-100"><Typography variant="small" className="font-bold text-blue-gray-500">Thành tiền</Typography></th>
              </tr>
            </thead>
            <tbody>
              {(order.orderSuppliers || []).flatMap((os) =>
                (os.orderItems || []).map((item) => {
                  const q = item.quantity ?? item.Quantity ?? 0;
                  const p = Number((item.price ?? item.Price) || 0);
                  return (
                    <tr key={`${os.id ?? os.Id}-${item.id ?? item.Id}`} className="border-b border-blue-gray-50">
                      <td className="py-2 px-3"><Typography variant="small">{os.supplierName ?? os.SupplierName ?? ""}</Typography></td>
                      <td className="py-2 px-3"><Typography variant="small">{item.productName ?? item.ProductName ?? ""}</Typography></td>
                      <td className="py-2 px-3"><Typography variant="small">{q} {item.unit ?? item.Unit ?? ""}</Typography></td>
                      <td className="py-2 px-3"><Typography variant="small">{p.toLocaleString("vi-VN")} đ</Typography></td>
                      <td className="py-2 px-3 text-right"><Typography variant="small">{(q * p).toLocaleString("vi-VN")} đ</Typography></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="mt-3 font-semibold text-green-700">
            Tổng tiền: {computeOrderTotal(order).toLocaleString("vi-VN")} đ
          </div>
        </CardBody>
      </Card>

      <Typography variant="h6" className="mb-3">Theo dõi từng NCC</Typography>
      {(order.orderSuppliers || []).map((os) => (
        <Card key={os.id ?? os.Id} className="border border-blue-gray-100 mb-4">
          <CardHeader className="p-4 border-b flex flex-col gap-4 bg-blue-gray-50/50 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <Typography variant="h6">{os.supplierName ?? os.SupplierName}</Typography>
              <OrderSupplierTimeline os={os} />
            </div>
            <div className="flex flex-shrink-0 flex-wrap items-center gap-4">
              {isStoreOrder && (
                <Button size="sm" variant="outlined" className="flex items-center gap-1 whitespace-nowrap" onClick={() => handleExportOrderBySupplier(os)}>
                  <DocumentArrowDownIcon className="w-4 h-4" /> Xuất đơn NCC / Gửi
                </Button>
              )}
              <Chip size="sm" color={osStatusColors[os.status ?? os.Status] || "gray"} value={os.status ?? os.Status} />
              {isAdmin && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={adminOsStatusEdit[os.id ?? os.Id] ?? (os.status ?? os.Status) ?? "Pending"}
                    onChange={(e) => setAdminOsStatusEdit((prev) => ({ ...prev, [os.id ?? os.Id]: e.target.value }))}
                    className="rounded-lg border border-blue-gray-200 bg-white px-3 py-1.5 text-sm text-blue-gray-700 min-w-[140px]"
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
                  {(adminOsStatusEdit[os.id ?? os.Id] ?? os.status ?? os.Status) === "Rejected" && (
                    <input
                      type="text"
                      placeholder="Lý do từ chối (tùy chọn)"
                      value={adminOsNoteEdit[os.id ?? os.Id] ?? ""}
                      onChange={(e) => setAdminOsNoteEdit((prev) => ({ ...prev, [os.id ?? os.Id]: e.target.value }))}
                      className="rounded-lg border border-blue-gray-200 px-3 py-1.5 text-sm min-w-[160px]"
                    />
                  )}
                  <Button
                    size="sm"
                    color="blue"
                    onClick={() => handleAdminUpdateOsStatus(os)}
                    disabled={updatingOsId === (os.id ?? os.Id) || (adminOsStatusEdit[os.id ?? os.Id] ?? os.status ?? os.Status) === (os.status ?? os.Status)}
                  >
                    {updatingOsId === (os.id ?? os.Id) ? "Đang cập nhật..." : "Cập nhật trạng thái"}
                  </Button>
                </div>
              )}
              {os.status === "Rejected" && (os.note ?? os.Note) && (
                <Typography variant="small" className="text-red-700 bg-red-50 px-3 py-1.5 rounded">
                  Lý do từ chối: {os.note ?? os.Note}
                </Typography>
              )}
              {canStoreConfirmAndUpload && canConfirmReceive(os) && (
                <Button size="sm" color="teal" className="flex items-center gap-1 whitespace-nowrap" onClick={() => handleConfirmReceiveOnly(os.id ?? os.Id)} title="Xác nhận đã nhận hàng (trạng thái chuyển sang Giao hoàn thành)">
                  <CheckCircleIcon className="w-4 h-4" /> Xác nhận đã nhận hàng
                </Button>
              )}
              {canStoreConfirmAndUpload && (
                <Button size="sm" color="blue" variant="outlined" className="flex items-center gap-1 whitespace-nowrap" onClick={() => openUploadModal(os.id ?? os.Id)} title="Gửi ảnh hàng nhận được / hóa đơn">
                  <PhotoIcon className="w-4 h-4" /> Gửi ảnh
                </Button>
              )}
            </div>
          </CardHeader>
          {((os.receiveImages || os.ReceiveImages)?.length > 0) && (
            <div className="px-4 pt-2 pb-4 border-b border-blue-gray-100 bg-white">
              <Typography variant="h6" color="blue-gray" className="mb-2">Ảnh Store đã gửi (xác nhận nhận hàng)</Typography>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Typography variant="small" className="font-medium text-blue-gray-600 mb-1 flex items-center gap-1">
                    <PhotoIcon className="w-4 h-4" /> Ảnh hàng nhận được
                  </Typography>
                  <div className="flex flex-wrap gap-2">
                    {(os.receiveImages || os.ReceiveImages || [])
                      .filter((img) => (img.type || img.Type) === "received")
                      .map((img) => {
                        const raw = img.dataUrl || img.imageUrl || img.DataUrl || img.ImageUrl;
                        const src = raw && raw.startsWith("/") ? (api.BASE_URL || "").replace(/\/$/, "") + raw : raw;
                        const id = img.id ?? img.Id ?? src;
                        return (
                          <div key={id} className="relative">
                            <img src={src} alt={img.fileName || img.FileName || ""} className="h-20 w-20 object-cover rounded border cursor-pointer hover:opacity-90" onClick={() => setLightbox(src)} />
                            <Typography variant="small" className="block truncate w-20 text-xs text-gray-500">{img.fileName || img.FileName || ""}</Typography>
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
                    {(os.receiveImages || os.ReceiveImages || [])
                      .filter((img) => (img.type || img.Type) === "invoice")
                      .map((img) => {
                        const raw = img.dataUrl || img.imageUrl || img.DataUrl || img.ImageUrl;
                        const src = raw && raw.startsWith("/") ? (api.BASE_URL || "").replace(/\/$/, "") + raw : raw;
                        const id = img.id ?? img.Id ?? src;
                        return (
                          <div key={id} className="relative">
                            <img src={src} alt={img.fileName || img.FileName || ""} className="h-20 w-20 object-cover rounded border cursor-pointer hover:opacity-90" onClick={() => setLightbox(src)} />
                            <Typography variant="small" className="block truncate w-20 text-xs text-gray-500">{img.fileName || img.FileName || ""}</Typography>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          )}
          <CardBody className="p-4 pt-2">
            {os.expectedDeliveryDate && <Typography variant="small" color="gray">Giao dự kiến: {os.expectedDeliveryDate}</Typography>}
          </CardBody>
        </Card>
      ))}

      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmModal({ open: false, osId: null })}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="p-4 border-b">
              <Typography variant="h6">Gửi ảnh (Store)</Typography>
              <Typography variant="small" color="gray">Chọn ảnh hàng nhận được và/hoặc hóa đơn đã ký để gửi. Nếu chưa xác nhận nhận hàng, gửi ảnh sẽ đồng thời chuyển trạng thái sang Giao hoàn thành.</Typography>
            </CardHeader>
            <CardBody className="flex flex-col gap-4 p-4">
              <div>
                <label className="block text-sm font-medium text-blue-gray-700 mb-1">
                  <PhotoIcon className="w-4 h-4 inline mr-1" /> Ảnh đơn hàng nhận được
                </label>
                <input ref={refReceived} type="file" multiple accept="image/*" className="block w-full text-sm text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-gray-700 mb-1">
                  <DocumentTextIcon className="w-4 h-4 inline mr-1" /> Hóa đơn đã ký
                </label>
                <input ref={refInvoice} type="file" multiple accept="image/*" className="block w-full text-sm text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outlined" onClick={() => setConfirmModal({ open: false, osId: null })}>Hủy</Button>
                <Button color="blue" onClick={handleConfirmReceiveWithImages}>Gửi ảnh</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Xem ảnh" className="max-w-full max-h-full object-contain rounded" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

export default OrderDetail;
