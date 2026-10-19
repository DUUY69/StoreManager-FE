import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { buildReturnSearch, LIST_FILTER_PATHS } from "@/utils/urlFilters";
import { Card, CardHeader, CardBody, Typography, Button, Chip } from "@material-tailwind/react";
import { ArrowLeftIcon, PrinterIcon, CheckCircleIcon, PhotoIcon, DocumentTextIcon, DocumentArrowDownIcon, XMarkIcon, TrashIcon, PencilIcon } from "@heroicons/react/24/solid";
import { useData } from "@/context/DataContext";
import { useAuth, useToast } from "@/context";
import api from "@/api";
import { printOrderBySupplier, exportOrderToExcel } from "@/utils/orderExport";
import { MobileScrollModal, MobileScrollModalBody } from "@/components/MobileScrollModal";

// ── Đơn tổng: 3 bước ─────────────────────────────────────────────────────────
// Chờ → Đang giao → Hoàn thành
function orderStatusToStep(s) {
  if (!s) return 0;
  if (s === "Completed") return 2;
  if (s === "Delivering" || s === "Accepted") return 1;
  if (s === "Rejected") return -1; // từ chối
  return 0;
}
function orderStatusLabel(s) {
  if (!s) return "Chờ";
  if (s === "Completed") return "Hoàn thành";
  if (s === "Rejected") return "Từ chối";
  if (s === "Delivering" || s === "Accepted") return "Đang giao";
  return "Chờ";
}

// ── Đơn con NCC: 3 bước ──────────────────────────────────────────────────────
// Chờ → Đang giao → Đã giao
const OS_STEPS = [
  { value: "Pending",    label: "Chờ" },
  { value: "Delivering", label: "Đang giao" },
  { value: "Delivered",  label: "Đã giao" },
];
// Các option cho select (Admin)
const OS_STATUS_OPTIONS = [
  { value: "Pending",    label: "Chờ" },
  { value: "Accepted",   label: "NCC đã xác nhận" },
  { value: "Delivering", label: "Đang giao" },
  { value: "Delivered",  label: "Đã giao" },
  { value: "Rejected",   label: "Từ chối" },
];
const osStatusColors = { Pending: "indigo", Accepted: "blue", Delivering: "orange", Delivered: "green", Rejected: "red" };

function osStepIndex(status) {
  if (status === "Delivered") return 2;
  if (status === "Delivering" || status === "Accepted") return 1;
  return 0;
}

function osChipStatus(parentOrderStatus, rawOsStatus) {
  const raw = rawOsStatus ?? "Pending";
  if (raw === "Accepted") return "Accepted";
  return osDisplayStatusForUi(parentOrderStatus ?? "", raw);
}

/** Đơn tổng Completed mà OS còn Pending/Accepted/Delivering = dữ liệu lệch hoặc bản ghi cũ — chip + timeline hiển thị Đã giao. Logic nghiệp vụ (từ chối, nút nhận hàng) vẫn dùng raw từ API. */
function osDisplayStatusForUi(parentOrderStatus, rawOsStatus) {
  const p = parentOrderStatus ?? "";
  const r = rawOsStatus ?? "Pending";
  if (p !== "Completed") return r;
  if (r === "Delivered" || r === "Rejected") return r;
  if (r === "Pending" || r === "Accepted" || r === "Delivering") return "Delivered";
  return r;
}

/** Timeline "Đã giao" ≠ đủ hàng: thiếu/thừa nằm ở ghi chú nhận / cờ chỉnh SL. */
function receiveNoteTrim(os) {
  return String(os.receiveNote ?? os.ReceiveNote ?? "").trim();
}

function hasReceiveDiscrepancy(os) {
  if (receiveNoteTrim(os).length > 0) return true;
  return !!(os.receiveQtyAdjusted ?? os.ReceiveQtyAdjusted);
}

/** Chip ngắn cạnh NCC (heuristic tiếng Việt trên ghi chú). */
function receiveDiscrepancyChipLabel(os) {
  const note = receiveNoteTrim(os).toLowerCase();
  const adj = !!(os.receiveQtyAdjusted ?? os.ReceiveQtyAdjusted);
  if (note && /thiếu|không đủ|lệch sl|chênh lệch/.test(note) && !/\bthừa\b|dư hàng|giao thừa/.test(note)) {
    return "Nhận: báo thiếu / lệch";
  }
  if (note && (/\bthừa\b|dư hàng|giao thừa|nhận dư/.test(note))) {
    return "Nhận: báo thừa";
  }
  if (note) return "Nhận: có ghi chú";
  if (adj) return "Nhận: SL thực tế khác đơn";
  return null;
}

/** SL đặt (Quantity). */
function lineOrderedQty(item) {
  return Number(item.quantity ?? item.Quantity ?? 0);
}

/** SL thực nhận: đã giao (raw hoặc suy ra từ đơn tổng Completed) → ReceivedQuantity hoặc bằng đặt nếu null. */
function lineReceivedQtyDisplay(item, osRawStatus, parentOrderStatus) {
  const disp = osDisplayStatusForUi(parentOrderStatus ?? "", osRawStatus ?? "");
  const raw = String(osRawStatus ?? "").trim().toLowerCase();
  const delivered = raw === "delivered" || String(disp).toLowerCase() === "delivered";
  if (!delivered) return null;
  const r = item.receivedQuantity ?? item.ReceivedQuantity;
  if (r != null && r !== "") return Number(r);
  return lineOrderedQty(item);
}

/** Đơn NCC đã có SL nhận — admin chỉnh qua API admin-update-receive (không sửa Quantity đặt). */
function isOsDeliveredForReceive(os, parentOrderStatus) {
  const raw = String(os.status ?? os.Status ?? "").trim().toLowerCase();
  if (raw === "delivered") return true;
  const items = os.orderItems || os.OrderItems || [];
  if (items.some((it) => (it.receivedQuantity ?? it.ReceivedQuantity) != null && (it.receivedQuantity ?? it.ReceivedQuantity) !== "")) {
    return true;
  }
  return osDisplayStatusForUi(parentOrderStatus ?? "", os.status ?? os.Status ?? "") === "Delivered";
}

function lineQtyMismatch(item, osRawStatus, parentOrderStatus) {
  const o = lineOrderedQty(item);
  const r = lineReceivedQtyDisplay(item, osRawStatus, parentOrderStatus);
  if (r == null) return false;
  return o !== r;
}

function lineSubtotalByReceived(item, osRawStatus, parentOrderStatus, price) {
  const p = Number(price || 0);
  const r = lineReceivedQtyDisplay(item, osRawStatus, parentOrderStatus);
  const q = r != null ? r : lineOrderedQty(item);
  return q * p;
}

// ── Timeline đơn tổng ─────────────────────────────────────────────────────────
function OrderTimeline({ currentStatus, orderDate }) {
  const step = orderStatusToStep(currentStatus);
  const rejected = currentStatus === "Rejected";
  const steps = ["Chờ", "Đang giao", "Hoàn thành"];
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium
              ${rejected && i === 1 ? "bg-red-500 text-white"
                : step >= i ? "bg-blue-500 text-white"
                : "bg-blue-gray-100 text-blue-gray-400"}`}>
              {step >= i && !rejected ? <CheckCircleIcon className="w-4 h-4" /> : rejected && i === 1 ? "✕" : i + 1}
            </div>
            <span className={`text-xs font-medium ${step >= i && !rejected ? "text-blue-gray-800" : rejected && i === 1 ? "text-red-600" : "text-blue-gray-400"}`}>
              {rejected && i === 1 ? "Từ chối" : label}
            </span>
          </div>
          {i < steps.length - 1 && <span className="text-blue-gray-300 text-xs">→</span>}
        </React.Fragment>
      ))}
      {orderDate && (
        <Typography variant="small" color="gray" className="ml-2">
          Đặt: {new Date(orderDate).toLocaleDateString("vi-VN")}
        </Typography>
      )}
    </div>
  );
}

// ── Timeline đơn con NCC ──────────────────────────────────────────────────────
function OsTimeline({ status }) {
  const s = status ?? "Pending";
  const rejected = s === "Rejected";
  const idx = osStepIndex(s);
  return (
    <div className="flex flex-wrap gap-1.5 items-center mt-1">
      {OS_STEPS.map((step, i) => (
        <React.Fragment key={step.value}>
          <div className="flex items-center gap-1">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px]
              ${idx >= i && !rejected ? "bg-teal-500 text-white" : "bg-blue-gray-100 text-blue-gray-400"}`}>
              {idx >= i && !rejected ? "✓" : i + 1}
            </div>
            <span className={`text-[10px] ${idx >= i && !rejected ? "text-blue-gray-700 font-medium" : "text-blue-gray-400"}`}>
              {step.label}
            </span>
          </div>
          {i < OS_STEPS.length - 1 && <span className="text-blue-gray-300 text-[10px]">→</span>}
        </React.Fragment>
      ))}
      {rejected && <Chip size="sm" color="red" value="Từ chối" className="ml-1" />}
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
  const { orders, setOrders, stores, suppliers, useApi } = useData();
  const { currentUser, isAdmin, isStoreUser } = useAuth();
  const { showToast } = useToast();

  const [confirmModal, setConfirmModal] = useState({ open: false, osId: null });
  const [receiveConfirmModal, setReceiveConfirmModal] = useState({
    open: false,
    mode: "store", // store | admin
    osId: null,
    lines: [], // { itemId, productName, unit, orderedQty, actualQty }
    note: "",
    saving: false,
  });
  const location = useLocation();
  const backToOrders = () => navigate(`/dashboard/orders${buildReturnSearch(location, LIST_FILTER_PATHS["/orders"])}`);
  const [lightbox, setLightbox] = useState(null);
  const [updatingOsId, setUpdatingOsId] = useState(null);
  // Admin edit items
  const [editingItem, setEditingItem] = useState(null); // { osId, itemId, qty, receivedQty, price, note, editReceived }
  const [deletingItem, setDeletingItem] = useState(null);
  const refInvoice = useRef(null);

  const orderIndex = orders.findIndex((o) => (o.id ?? o.Id) === Number(id));
  const order = orderIndex >= 0 ? orders[orderIndex] : null;
  const orderId = order ? (order.id ?? order.Id) : null;

  const isOrderCompleted = order ? String(order.status ?? order.Status) === "Completed" : false;
  const orderStatus = order ? (order.status ?? order.Status ?? "") : "";

  const parentOrderInDelivery = ["Accepted", "Delivering", "Completed"].includes(String(orderStatus || ""));

  /** Cửa hàng / Admin bấm 「Đã nhận」: Delivering; NCC Accepted khi đơn tổng đã Đang giao; Delivered chưa xác nhận. */
  const canConfirmReceive = (os) => {
    const s = (os.status ?? os.Status ?? "").toLowerCase();
    const alreadyReceived = os.receivedBy != null || os.ReceivedBy != null
      || os.receivedDate != null || os.ReceivedDate != null;
    if (alreadyReceived) return false;
    if (s === "delivering") return true;
    if (s === "delivered") return true;
    if (s === "accepted" && parentOrderInDelivery) return true;
    return false;
  };

  const receiveBlockedReason = (os) => {
    const s = (os.status ?? os.Status ?? "").toLowerCase();
    if (s === "rejected") return "Đơn NCC đã từ chối.";
    if (s === "pending") {
      return "Chưa nhận được — đơn NCC đang Chờ. Admin cần chấp nhận đơn tổng trước.";
    }
    if (s === "accepted" && !parentOrderInDelivery) {
      return "NCC đã xác nhận — chờ Admin chấp nhận đơn tổng (Chấp nhận → Đang giao).";
    }
    if ((os.receivedBy ?? os.ReceivedBy) != null) return "Cửa hàng đã xác nhận nhận hàng.";
    return null;
  };

  // Admin chuyển đơn tổng sang Đang giao khi đang Pending
  const canAdminStartDelivery = order && orderStatus === "Pending";

  const handleAdminStartDelivery = async () => {
    if (useApi) {
      try {
        await api.patch("orders.accept", {}, { params: { id: orderId } });
        setOrders((prev) =>
          prev.map((o) => {
            if ((o.id ?? o.Id) !== orderId) return o;
            const newOs = (o.orderSuppliers || o.OrderSuppliers || []).map((os) =>
              (os.status ?? os.Status) === "Pending" ? { ...os, status: "Delivering" } : os
            );
            return { ...o, status: "Accepted", orderSuppliers: newOs };
          })
        );
        showToast("Đã xác nhận đơn. Các đơn NCC (đang Chờ) đã chuyển sang Đang giao.", "success");
      } catch (e) { showToast(e.message || "Lỗi", "error"); }
      return;
    }
    setOrders(orders.map((o) => {
      if ((o.id ?? o.Id) !== orderId) return o;
      const newOs = (o.orderSuppliers || o.OrderSuppliers || []).map((os) =>
        (os.status ?? os.Status) === "Pending" ? { ...os, status: "Delivering" } : os
      );
      return { ...o, status: "Accepted", orderSuppliers: newOs };
    }));
    showToast("Đã xác nhận đơn (offline). Các đơn NCC Pending → Delivering.", "success");
  };

  const handleAdminRejectOrder = async () => {
    if (!confirm("Từ chối đơn hàng này?")) return;
    if (useApi) {
      try {
        await api.patch("orders.reject", {}, { params: { id: orderId } });
        setOrders(orders.map((o) => (o.id ?? o.Id) !== orderId ? o
          : { ...o, status: "Rejected", orderSuppliers: (o.orderSuppliers || []).map((os) => ({ ...os, status: "Rejected" })) }));
        showToast("Đã từ chối đơn.", "success");
      } catch (e) { showToast(e.message || "Lỗi", "error"); }
      return;
    }
    setOrders(orders.map((o) => (o.id ?? o.Id) !== orderId ? o
      : { ...o, status: "Rejected", orderSuppliers: (o.orderSuppliers || []).map((os) => ({ ...os, status: "Rejected" })) }));
  };

  // Admin hoàn tác từ chối đơn tổng (Rejected → Pending/Chờ), đưa các đơn NCC về Chờ
  const handleAdminRestoreOrder = async () => {
    if (!confirm("Hoàn tác từ chối đơn này? Đơn tổng và các đơn NCC sẽ về trạng thái 'Chờ' để xử lý lại.")) return;
    const applyLocal = () =>
      setOrders(orders.map((o) => (o.id ?? o.Id) !== orderId ? o
        : {
            ...o,
            status: "Pending",
            orderSuppliers: (o.orderSuppliers || o.OrderSuppliers || []).map((os) =>
              (os.status ?? os.Status) === "Rejected" ? { ...os, status: "Pending", note: undefined } : os
            ),
          }));
    if (useApi) {
      try {
        await api.patch("orders.restore", {}, { params: { id: orderId } });
        applyLocal();
        showToast("Đã hoàn tác từ chối. Đơn về trạng thái Chờ.", "success");
      } catch (e) { showToast(e.message || "Lỗi", "error"); }
      return;
    }
    applyLocal();
  };

  // Admin cập nhật trạng thái đơn con NCC — gọi thẳng khi chọn dropdown
  const handleAdminUpdateOsStatus = async (os, newStatus) => {
    const osId = os.id ?? os.Id;
    const currentStatus = os.status ?? os.Status ?? "Pending";
    if (newStatus === currentStatus) return;

    let note = undefined;
    if (newStatus === "Rejected") {
      const reason = prompt("Lý do từ chối (tùy chọn):");
      note = reason?.trim() || undefined;
    }

    const applyLocal = () => {
      setOrders(orders.map((o) => {
        if ((o.id ?? o.Id) !== orderId) return o;
        const newOs = (o.orderSuppliers || []).map((x) => {
          if ((x.id ?? x.Id) !== osId) return x;
          const upd = { ...x, status: newStatus };
          if (note != null) upd.note = note;
          return upd;
        });
        const allDone = newOs.every((x) => ["Delivered", "Rejected"].includes(x.status ?? x.Status));
        return { ...o, orderSuppliers: newOs, status: allDone ? "Completed" : o.status };
      }));
    };

    if (useApi) {
      setUpdatingOsId(osId);
      try {
        await api.patch("orderSuppliers.updateStatus", note != null ? { status: newStatus, note } : { status: newStatus }, { params: { id: osId } });
        applyLocal();
        showToast("Đã cập nhật trạng thái.", "success");
      } catch (e) { showToast(e?.data?.message || e.message || "Lỗi", "error"); }
      finally { setUpdatingOsId(null); }
      return;
    }
    applyLocal();
  };

  // Admin xóa sản phẩm khỏi đơn
  const handleDeleteItem = async (osId, itemId) => {
    if (!confirm("Xóa sản phẩm này khỏi đơn?")) return;
    setDeletingItem(itemId);
    try {
      if (useApi) await api.delete("orderItems.delete", { params: { id: itemId } });
      setOrders(orders.map((o) => {
        if ((o.id ?? o.Id) !== orderId) return o;
        return {
          ...o,
          orderSuppliers: (o.orderSuppliers || []).map((os) =>
            (os.id ?? os.Id) !== osId ? os
              : { ...os, orderItems: (os.orderItems || []).filter((it) => (it.id ?? it.Id) !== itemId) }
          )
        };
      }));
      showToast("Đã xóa sản phẩm.", "success");
    } catch (e) { showToast(e?.data?.message || e.message || "Lỗi xóa", "error"); }
    finally { setDeletingItem(null); }
  };

  const startEditOrderItem = (os, item) => {
    const osId = os.id ?? os.Id;
    const itemId = item.id ?? item.Id;
    const qOrd = lineOrderedQty(item);
    const qRec = lineReceivedQtyDisplay(item, os.status ?? os.Status ?? "", orderStatus);
    const editReceived = isAdmin && isOsDeliveredForReceive(os, orderStatus);
    setEditingItem({
      osId,
      itemId,
      qty: qOrd,
      receivedQty: qRec != null ? qRec : qOrd,
      price: Number((item.price ?? item.Price) || 0),
      note: item.note ?? item.Note ?? "",
      editReceived,
    });
  };

  // Admin cập nhật sản phẩm (SL đặt/giá/ghi chú) hoặc SL thực nhận khi đã giao
  const handleSaveItem = async () => {
    if (!editingItem) return;
    const { osId, itemId, qty, receivedQty, price, note, editReceived } = editingItem;
    try {
      if (useApi && editReceived) {
        const rq = Number(receivedQty);
        if (!Number.isFinite(rq) || rq < 0 || !Number.isInteger(rq)) {
          showToast("SL thực nhận phải là số nguyên ≥ 0.", "error");
          return;
        }
        const os = (order?.orderSuppliers || []).find((x) => (x.id ?? x.Id) === osId);
        if (!os) return;
        const qtyPayload = (os.orderItems || os.OrderItems || []).map((it) => {
          const id = it.id ?? it.Id;
          const ordered = lineOrderedQty(it);
          const currentRec = lineReceivedQtyDisplay(it, os.status ?? os.Status ?? "", orderStatus);
          const q = id === itemId ? rq : (currentRec != null ? currentRec : ordered);
          return { orderItemId: id, quantity: q };
        });
        const receiveNoteTrim = String(os.receiveNote ?? os.ReceiveNote ?? "").trim();
        const res = await api.patch(
          "orderSuppliers.adminUpdateReceive",
          { receiveNote: receiveNoteTrim, receiveItemQuantities: qtyPayload },
          { params: { id: osId } }
        );
        mergeOrderSupplierFromReceiveResponse(osId, res);
        if (Number(price) !== Number((os.orderItems || []).find((it) => (it.id ?? it.Id) === itemId)?.price) || note != null) {
          await api.patch("orderItems.update", { price: Number(price), note }, { params: { id: itemId } });
        }
        setEditingItem(null);
        showToast("Đã cập nhật SL thực nhận.", "success");
        return;
      }
      if (useApi) {
        await api.patch("orderItems.update", { quantity: Number(qty), price: Number(price), note }, { params: { id: itemId } });
      }
      setOrders(orders.map((o) => {
        if ((o.id ?? o.Id) !== orderId) return o;
        return {
          ...o,
          orderSuppliers: (o.orderSuppliers || []).map((os) =>
            (os.id ?? os.Id) !== osId ? os
              : {
                  ...os,
                  orderItems: (os.orderItems || []).map((it) =>
                    (it.id ?? it.Id) !== itemId ? it
                      : { ...it, quantity: Number(qty), price: Number(price), note }
                  )
                }
          )
        };
      }));
      setEditingItem(null);
      showToast(editReceived ? "Đã cập nhật SL thực nhận." : "Đã cập nhật sản phẩm.", "success");
    } catch (e) {
      const msg = e?.data?.message || e.message || "Lỗi cập nhật";
      showToast(typeof msg === "string" ? msg : "Lỗi cập nhật", "error");
    }
  };

  const openUploadModal = (osId) => {
    setConfirmModal({ open: true, osId });
    setTimeout(() => { refInvoice.current && (refInvoice.current.value = ""); }, 0);
  };

  const mergeOrderSupplierFromReceiveResponse = (osId, res) => {
    const updatedStatus = res?.Status ?? res?.status ?? "Delivered";
    const updatedImages = res?.ReceiveImages ?? res?.receiveImages ?? [];
    const receiveNote = res?.ReceiveNote ?? res?.receiveNote ?? null;
    const receiveQtyAdjusted = !!(res?.ReceiveQtyAdjusted ?? res?.receiveQtyAdjusted);
    const rawItems = res?.OrderItems ?? res?.orderItems ?? [];
    const mappedItems = rawItems.map((it) => ({
      id: it.id ?? it.Id,
      productId: it.productId ?? it.ProductId,
      productName: it.productName ?? it.ProductName,
      quantity: it.quantity ?? it.Quantity,
      receivedQuantity: it.receivedQuantity ?? it.ReceivedQuantity ?? null,
      unit: it.unit ?? it.Unit,
      price: it.price ?? it.Price,
      note: it.note ?? it.Note ?? null,
    }));
    setOrders((prev) =>
      prev.map((o) => {
        if ((o.id ?? o.Id) !== orderId) return o;
        const newOrderSuppliers = (o.orderSuppliers || []).map((os) =>
          (os.id ?? os.Id) === osId
            ? {
                ...os,
                status: updatedStatus,
                actualDeliveryDate: res?.ActualDeliveryDate ?? res?.actualDeliveryDate ?? new Date().toISOString().slice(0, 10),
                receiveImages: updatedImages.length ? updatedImages.map((img) => ({
                  id: img.id ?? img.Id,
                  type: img.type ?? img.Type,
                  imageUrl: img.imageUrl ?? img.ImageUrl,
                  fileName: img.fileName ?? img.FileName,
                })) : (os.receiveImages || os.ReceiveImages),
                receiveNote,
                receiveQtyAdjusted,
                orderItems: mappedItems.length ? mappedItems : (os.orderItems || os.OrderItems || []),
              }
            : os
        );
        const allDone = newOrderSuppliers.every((x) => (x.status ?? x.Status) === "Delivered" || (x.status ?? x.Status) === "Rejected");
        return { ...o, orderSuppliers: newOrderSuppliers, status: allDone ? "Completed" : o.status };
      })
    );
  };

  const buildReceiveModalLines = (os, forAdmin) => (os.orderItems || os.OrderItems || []).map((it) => {
    const itemId = it.id ?? it.Id;
    const q = Number(it.quantity ?? it.Quantity ?? 0);
    const received = it.receivedQuantity ?? it.ReceivedQuantity;
    return {
      itemId,
      productName: it.productName ?? it.ProductName ?? "",
      unit: it.unit ?? it.Unit ?? "",
      orderedQty: q,
      actualQty: forAdmin && received != null ? Number(received) : q,
    };
  });

  const openReceiveConfirmModal = (osId) => {
    const os = (order?.orderSuppliers || []).find((x) => (x.id ?? x.Id) === osId);
    if (!os) return;
    setReceiveConfirmModal({
      open: true,
      mode: "store",
      osId,
      lines: buildReceiveModalLines(os, false),
      note: "",
      saving: false,
    });
  };

  const openAdminEditReceiveModal = (osId) => {
    const os = (order?.orderSuppliers || []).find((x) => (x.id ?? x.Id) === osId);
    if (!os) return;
    setReceiveConfirmModal({
      open: true,
      mode: "admin",
      osId,
      lines: buildReceiveModalLines(os, true),
      note: (os.receiveNote ?? os.ReceiveNote) || "",
      saving: false,
    });
  };

  useEffect(() => {
    const osIdFromNav = location.state?.adminEditReceiveOsId;
    if (!osIdFromNav || !order || !isAdmin) return;
    const os = (order.orderSuppliers || []).find((x) => (x.id ?? x.Id) === Number(osIdFromNav));
    if (!os || (os.status ?? os.Status) !== "Delivered") return;
    openAdminEditReceiveModal(Number(osIdFromNav));
    navigate(location.pathname, { replace: true, state: { returnSearch: location.state?.returnSearch } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ mở modal khi điều hướng từ đơn NCC
  }, [location.state?.adminEditReceiveOsId, order?.id, isAdmin]);

  const updateReceiveLineQty = (itemId, value) => {
    const n = value === "" ? "" : Number(value);
    setReceiveConfirmModal((prev) => ({
      ...prev,
      lines: prev.lines.map((row) => (row.itemId === itemId ? { ...row, actualQty: n === "" ? "" : n } : row)),
    }));
  };

  const submitReceiveConfirm = async () => {
    const { osId, lines, note } = receiveConfirmModal;
    for (const row of lines) {
      const q = row.actualQty === "" ? NaN : Number(row.actualQty);
      if (!Number.isFinite(q) || q < 0 || !Number.isInteger(q)) {
        showToast("Vui lòng nhập số lượng là số nguyên ≥ 0 cho từng dòng.", "error");
        return;
      }
    }
    const receiveNoteTrim = (note || "").trim();
    const qtyPayload = lines.map((row) => ({
      orderItemId: row.itemId,
      quantity: Number(row.actualQty),
    }));
    const anyQtyDiff = lines.some((row) => Number(row.actualQty) !== row.orderedQty);
    const receiveQtyAdjusted = anyQtyDiff || receiveNoteTrim.length > 0;

    const isAdminEdit = receiveConfirmModal.mode === "admin";
    setReceiveConfirmModal((p) => ({ ...p, saving: true }));
    if (useApi) {
      try {
        let res;
        if (isAdminEdit) {
          res = await api.patch(
            "orderSuppliers.adminUpdateReceive",
            { receiveNote: receiveNoteTrim, receiveItemQuantities: qtyPayload },
            { params: { id: osId } }
          );
        } else {
          const formData = new FormData();
          formData.append("confirm", "1");
          formData.append("receiveNote", receiveNoteTrim);
          formData.append("receiveItemQuantities", JSON.stringify(qtyPayload));
          res = await api.request("orderSuppliers.confirmReceive", { params: { id: osId }, formData });
        }
        mergeOrderSupplierFromReceiveResponse(osId, res);
        setReceiveConfirmModal({ open: false, mode: "store", osId: null, lines: [], note: "", saving: false });
        showToast(
          isAdminEdit
            ? "Admin đã cập nhật SL nhận. Tồn kho cửa hàng đã điều chỉnh theo chênh lệch."
            : "Đã xác nhận nhận hàng. Tồn kho cửa hàng đã được cập nhật.",
          "success"
        );
        if (!isAdminEdit && !receiveQtyAdjusted) {
          showToast("Nếu SL khớp đặt và không ghi chú, admin không có cảnh báo — dùng ảnh \"Hóa đơn\" hoặc ghi chú nếu cần admin đối chiếu.", "info");
        }
      } catch (e) {
        const msg = e?.data?.message || e?.message || (isAdminEdit ? "Lỗi cập nhật SL nhận" : "Lỗi xác nhận nhận hàng");
        showToast(typeof msg === "string" ? msg : (isAdminEdit ? "Lỗi cập nhật SL nhận" : "Lỗi xác nhận nhận hàng"), "error");
        setReceiveConfirmModal((p) => ({ ...p, saving: false }));
      }
      return;
    }
    const next = orders.map((o) => {
      if ((o.id ?? o.Id) !== orderId) return o;
      const newOrderSuppliers = (o.orderSuppliers || []).map((os) => {
        if ((os.id ?? os.Id) !== osId) return os;
        const idToQty = Object.fromEntries(lines.map((r) => [r.itemId, Number(r.actualQty)]));
        const newItems = (os.orderItems || os.OrderItems || []).map((it) => {
          const id = it.id ?? it.Id;
          return idToQty[id] != null ? { ...it, quantity: idToQty[id] } : it;
        });
        return {
          ...os,
          status: "Delivered",
          actualDeliveryDate: new Date().toISOString().slice(0, 10),
          receiveNote: receiveNoteTrim || null,
          receiveQtyAdjusted,
          orderItems: newItems,
        };
      });
      const allDone = newOrderSuppliers.every((x) => (x.status ?? x.Status) === "Delivered" || (x.status ?? x.Status) === "Rejected");
      return { ...o, orderSuppliers: newOrderSuppliers, status: allDone ? "Completed" : o.status };
    });
    setOrders(next);
    setReceiveConfirmModal({ open: false, mode: "store", osId: null, lines: [], note: "", saving: false });
    showToast("Đã xác nhận nhận hàng (chế độ offline).", "success");
  };

  const handleConfirmReceiveWithImages = async () => {
    const { osId } = confirmModal;
    // Chỉ gửi hóa đơn đã ký
    const invoiceFiles = refInvoice.current?.files ? Array.from(refInvoice.current.files) : [];
    if (useApi) {
      try {
        const formData = new FormData();
        invoiceFiles.forEach((f) => formData.append("invoice", f));
        if (invoiceFiles.length === 0) formData.append("confirm", "1");
        const res = await api.request("orderSuppliers.confirmReceive", { params: { id: osId }, formData });
        setConfirmModal({ open: false, osId: null });
        showToast("Đã gửi hóa đơn.", "success");
        mergeOrderSupplierFromReceiveResponse(osId, res);
      } catch (e) {
        const msg = e?.data?.message || e?.message || "Lỗi gửi hóa đơn";
        showToast(typeof msg === "string" ? msg : "Lỗi gửi hóa đơn", "error");
      }
      return;
    }
    const invoice = await readFilesAsDataUrl(invoiceFiles);
    const receiveImages = invoice.map((r, i) => ({ id: `i-${osId}-${i}`, type: "invoice", dataUrl: r.dataUrl, fileName: r.fileName }));
    const next = orders.map((o) => {
      if ((o.id ?? o.Id) !== orderId) return o;
      const newOrderSuppliers = (o.orderSuppliers || []).map((os) =>
        (os.id ?? os.Id) === osId ? { ...os, receiveImages: os.receiveImages ? [...os.receiveImages, ...receiveImages] : receiveImages } : os
      );
      return { ...o, orderSuppliers: newOrderSuppliers };
    });
    setOrders(next);
    setConfirmModal({ open: false, osId: null });
  };


  const computeOrderTotal = (o) => {
    const amt = Number(o?.totalAmount ?? o?.TotalAmount ?? 0);
    if (amt > 0) return amt;
    return (o?.orderSuppliers || []).reduce((sum, os) => {
      const osSt = os.status ?? os.Status ?? "";
      const pstat = o.status ?? o.Status ?? "";
      return sum + (os.orderItems || []).reduce((s, it) => s + lineSubtotalByReceived(it, osSt, pstat, it.price ?? it.Price), 0);
    }, 0);
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
      <table><tr><th>NCC</th><th>Sản phẩm</th><th>SL đặt</th><th>SL thực nhận</th><th>Đơn giá</th><th>Thành tiền</th></tr>
    `;
    osList.forEach((os) => {
      const osRaw = os.status ?? os.Status ?? "";
      (os.orderItems || []).forEach((it) => {
        const qOrd = lineOrderedQty(it);
        const qRec = lineReceivedQtyDisplay(it, osRaw, order.status ?? order.Status ?? "");
        const p = Number((it.price ?? it.Price) || 0);
        const sub = lineSubtotalByReceived(it, osRaw, order.status ?? order.Status ?? "", p);
        const u = it.unit ?? it.Unit ?? "";
        html += `<tr><td>${os.supplierName ?? os.SupplierName ?? ""}</td><td>${it.productName ?? it.ProductName ?? ""}</td><td>${qOrd} ${u}</td><td>${qRec != null ? `${qRec} ${u}` : "—"}</td><td>${p.toLocaleString("vi-VN")} đ</td><td>${sub.toLocaleString("vi-VN")} đ</td></tr>`;
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
    const storeId = order?.storeId ?? order?.StoreId;
    const store = (stores || []).find((s) => String(s.id ?? s.Id) === String(storeId)) || {
      name: order?.storeName ?? order?.StoreName,
      address: "",
      phone: "",
    };
    const supplierId = os?.supplierId ?? os?.SupplierId;
    const supplier = (suppliers || []).find((x) => String(x.id ?? x.Id) === String(supplierId)) || null;
    const ok = printOrderBySupplier(os, order, store, {
      preparerName: currentUser?.name ?? currentUser?.Name ?? "",
      supplier: supplier
        ? {
            name: supplier.name ?? supplier.Name,
            address: supplier.address ?? supplier.Address,
            phone: supplier.contact ?? supplier.Contact ?? supplier.phone ?? supplier.Phone,
            email: supplier.email ?? supplier.Email,
          }
        : { name: os?.supplierName ?? os?.SupplierName },
    });
    if (!ok) showToast("Không mở được cửa sổ in (popup bị chặn).", "error");
  };

  const handleExportOrderBySupplierExcel = async (os) => {
    try {
      const storeId = order?.storeId ?? order?.StoreId;
      const store = (stores || []).find((s) => String(s.id ?? s.Id) === String(storeId)) || {
        name: order?.storeName ?? order?.StoreName,
        address: "",
        phone: "",
      };
      const supplierId = os?.supplierId ?? os?.SupplierId;
      const supplier = (suppliers || []).find((x) => String(x.id ?? x.Id) === String(supplierId)) || null;
      const storeWithSupplier = {
        ...store,
        supplier: supplier
          ? {
              name: supplier.name ?? supplier.Name,
              address: supplier.address ?? supplier.Address,
              phone: supplier.contact ?? supplier.Contact ?? supplier.phone ?? supplier.Phone,
              email: supplier.email ?? supplier.Email,
            }
          : { name: os?.supplierName ?? os?.SupplierName },
      };
      const XLSX = await import("xlsx");
      const ok = exportOrderToExcel(os, order, storeWithSupplier, null, XLSX);
      if (!ok) showToast("Không thể xuất Excel.", "error");
    } catch (e) {
      showToast("Lỗi xuất Excel.", "error");
    }
  };

  if (!order) {
    return (
      <div className="mt-12">
        <Typography>Không tìm thấy đơn hàng.</Typography>
        <Button className="mt-2" onClick={backToOrders}>Quay lại</Button>
      </div>
    );
  }

  const isStoreOrder = isAdmin || (isStoreUser && currentUser?.storeId === order.storeId);
  const orderStoreId = order.storeId ?? order.StoreId;
  const userStoreId = currentUser?.storeId ?? currentUser?.StoreId;
  const canStoreConfirmAndUpload = isStoreUser && (userStoreId != null && String(userStoreId) === String(orderStoreId));
  /** Admin quản lý đơn cũng xác nhận nhận hàng (BE cho phép role Admin). */
  const canConfirmReceiveUi = isAdmin || canStoreConfirmAndUpload;

  return (
    <div className="mt-12">
      {/* Header nav */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="text" className="flex items-center gap-1 w-fit" onClick={backToOrders}>
          <ArrowLeftIcon className="w-4 h-4" /> Quay lại danh sách
        </Button>
        <Button size="sm" variant="outlined" className="flex items-center gap-1 w-fit" onClick={handleExportOrder}>
          <PrinterIcon className="w-4 h-4" /> Xuất đơn / In
        </Button>
      </div>

      {/* Thông tin đơn tổng */}
      <Card className="border border-blue-gray-100 mb-6">
        <CardHeader className="p-4 border-b flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <Typography variant="h5">Đơn hàng #{order.id}</Typography>
            <Typography variant="small" color="gray">
              {order.storeName} · {order.orderDate ? new Date(order.orderDate).toLocaleDateString("vi-VN") : ""}
            </Typography>
            <div className="mt-2 rounded bg-blue-gray-50 px-3 py-2 text-sm inline-block">
              <strong className="text-blue-gray-700">Tổng tiền: </strong>
              <span className="font-semibold text-green-700">{computeOrderTotal(order).toLocaleString("vi-VN")} đ</span>
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-wrap items-center gap-2">
            <Chip
              color={orderStatus === "Completed" ? "green" : orderStatus === "Rejected" ? "red" : orderStatus === "Delivering" ? "orange" : "indigo"}
              value={orderStatusLabel(orderStatus)}
            />
            {/* Admin: chuyển sang Đang giao hoặc Từ chối */}
            {isAdmin && canAdminStartDelivery && (
              <>
                <Button size="sm" color="orange" className="flex items-center gap-1 whitespace-nowrap" onClick={handleAdminStartDelivery}>
                  <CheckCircleIcon className="w-4 h-4" /> Chấp nhận → Đang giao
                </Button>
                <Button size="sm" color="red" variant="outlined" className="flex items-center gap-1 whitespace-nowrap" onClick={handleAdminRejectOrder}>
                  <XMarkIcon className="w-4 h-4" /> Từ chối đơn
                </Button>
              </>
            )}
            {/* Admin: hoàn tác khi lỡ từ chối */}
            {isAdmin && orderStatus === "Rejected" && (
              <Button size="sm" color="green" variant="outlined" className="flex items-center gap-1 whitespace-nowrap" onClick={handleAdminRestoreOrder}>
                <CheckCircleIcon className="w-4 h-4" /> Hoàn tác từ chối
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody className="p-4">
          <Typography variant="h6" color="blue-gray" className="mb-2">Quy trình đơn tổng</Typography>
          <OrderTimeline currentStatus={orderStatus} orderDate={order.orderDate} />
          {isAdmin && canAdminStartDelivery && (
            <Typography variant="small" color="gray" className="mt-2">
              Đơn đang chờ. Nhấn <strong>Chấp nhận → Đang giao</strong> để chuyển <strong>mỗi đơn NCC đang Chờ</strong> sang <strong>Đang giao</strong> — sau đó cửa hàng (tài khoản Store) mới thấy nút <strong>Đã nhận hàng</strong> trên từng NCC.
            </Typography>
          )}
          {isStoreUser && orderStatus === "Pending" && (
            <Typography variant="small" className="text-amber-800 mt-2 block bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              Đơn đang chờ Admin chấp nhận. Khi chuyển sang <strong>Đang giao</strong>, mỗi NCC <strong>Đang giao</strong> sẽ có nút <strong>Đã nhận hàng</strong> bên dưới.
            </Typography>
          )}
        </CardBody>
      </Card>

      {/* Bảng chi tiết sản phẩm */}
      <Typography variant="h6" className="mb-3">Chi tiết đơn hàng</Typography>
      <Card className="border border-blue-gray-100 mb-6">
        <CardBody className="p-0">

          {/* ── Mobile: card list ── */}
          <div className="md:hidden divide-y divide-blue-gray-50">
            {(order.orderSuppliers || []).flatMap((os, osIdx) =>
              (os.orderItems || []).map((item, itemIdx) => {
                const osId = os.id ?? os.Id;
                const itemId = item.id ?? item.Id;
                const osRaw = os.status ?? os.Status ?? "";
                const qOrd = lineOrderedQty(item);
                const qRec = lineReceivedQtyDisplay(item, osRaw, orderStatus);
                const p = Number((item.price ?? item.Price) || 0);
                const mismatch = lineQtyMismatch(item, osRaw, orderStatus);
                const isEditing = editingItem !== null && editingItem?.itemId != null && editingItem?.itemId === itemId;
                return (
                  <div key={`m-${osIdx}-${itemIdx}`} className={`p-3 ${(osIdx + itemIdx) % 2 === 0 ? "bg-white" : "bg-blue-50/30"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-blue-gray-800 truncate">{item.productName ?? item.ProductName}</p>
                        <p className="text-xs text-blue-gray-400">{os.supplierName ?? os.SupplierName}</p>
                      </div>
                      {isAdmin && !isEditing && (
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => startEditOrderItem(os, item)}
                            className="text-blue-500 p-1" title={isOsDeliveredForReceive(os, orderStatus) ? "Sửa SL thực nhận" : "Sửa"}>
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteItem(osId, itemId)} disabled={deletingItem === itemId}
                            className="text-red-400 p-1" title="Xóa">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    {isEditing && editingItem ? (
                      <div className="mt-2 flex flex-col gap-2">
                        <div className="flex gap-2">
                          {editingItem.editReceived ? (
                            <>
                              <div className="flex-1">
                                <label className="text-xs text-gray-500">SL đặt</label>
                                <p className="mt-0.5 text-sm font-semibold text-blue-gray-800">{qOrd} {item.unit ?? item.Unit}</p>
                              </div>
                              <div className="flex-1">
                                <label className="text-xs text-amber-800 font-medium">SL thực nhận</label>
                                <input type="number" min="0" step="1" inputMode="numeric" value={editingItem.receivedQty}
                                  onChange={(e) => setEditingItem({ ...editingItem, receivedQty: e.target.value })}
                                  className="w-full rounded border border-amber-300 px-2 py-1.5 text-sm mt-0.5" />
                              </div>
                            </>
                          ) : (
                            <div className="flex-1">
                              <label className="text-xs text-gray-500">SL đặt</label>
                              <input type="number" min="0" value={editingItem.qty}
                                onChange={(e) => setEditingItem({ ...editingItem, qty: e.target.value })}
                                className="w-full rounded border border-blue-gray-200 px-2 py-1.5 text-sm mt-0.5" />
                            </div>
                          )}
                          <div className="flex-1">
                            <label className="text-xs text-gray-500">Đơn giá</label>
                            <input type="number" min="0" value={editingItem.price}
                              onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                              className="w-full rounded border border-blue-gray-200 px-2 py-1.5 text-sm mt-0.5" />
                          </div>
                        </div>
                        <input type="text" value={editingItem.note ?? ""} placeholder="Ghi chú..."
                          onChange={(e) => setEditingItem({ ...editingItem, note: e.target.value })}
                          className="w-full rounded border border-blue-gray-200 px-2 py-1.5 text-sm" />
                        <div className="flex gap-2">
                          <button onClick={handleSaveItem} className="flex-1 bg-green-500 text-white text-sm py-1.5 rounded font-semibold">Lưu</button>
                          <button onClick={() => setEditingItem(null)} className="flex-1 bg-gray-100 text-gray-600 text-sm py-1.5 rounded">Hủy</button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1.5 space-y-1 text-sm">
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-blue-gray-700">
                          <span><span className="text-gray-500 text-xs">Đặt:</span> <span className={mismatch ? "font-semibold text-amber-800" : "font-semibold"}>{qOrd} {item.unit ?? item.Unit}</span></span>
                          <span><span className="text-gray-500 text-xs">Nhận:</span>{" "}
                            <span className={mismatch ? "font-semibold text-amber-800" : "font-semibold"}>
                              {qRec != null ? `${qRec} ${item.unit ?? item.Unit}` : "—"}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-xs">{p.toLocaleString("vi-VN")} đ/đv</span>
                          <span className="font-semibold text-blue-gray-800">{lineSubtotalByReceived(item, osRaw, orderStatus, p).toLocaleString("vi-VN")} đ</span>
                        </div>
                      </div>
                    )}
                    {!isEditing && (item.note ?? item.Note) && (
                      <p className="text-xs text-gray-400 mt-1 italic">{item.note ?? item.Note}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* ── Desktop: table ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="text-left py-2.5 px-3 font-semibold">NCC</th>
                  <th className="text-left py-2.5 px-3 font-semibold">Sản phẩm</th>
                  <th className="text-center py-2.5 px-3 font-semibold whitespace-nowrap">SL đặt</th>
                  <th className="text-center py-2.5 px-3 font-semibold whitespace-nowrap">SL thực nhận</th>
                  <th className="text-left py-2.5 px-3 font-semibold whitespace-nowrap">Đơn giá</th>
                  <th className="text-right py-2.5 px-3 font-semibold whitespace-nowrap">Thành tiền</th>
                  <th className="text-left py-2.5 px-3 font-semibold">Ghi chú</th>
                  {isAdmin && <th className="py-2.5 px-3 font-semibold text-center">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {(order.orderSuppliers || []).flatMap((os, osIdx) =>
                  (os.orderItems || []).map((item, itemIdx) => {
                    const osId = os.id ?? os.Id;
                    const itemId = item.id ?? item.Id;
                    const osRaw = os.status ?? os.Status ?? "";
                    const qOrd = lineOrderedQty(item);
                    const qRec = lineReceivedQtyDisplay(item, osRaw, orderStatus);
                    const p = Number((item.price ?? item.Price) || 0);
                    const mismatch = lineQtyMismatch(item, osRaw, orderStatus);
                    const rowIdx = (order.orderSuppliers || []).slice(0, osIdx).reduce((s, o) => s + (o.orderItems || []).length, 0) + itemIdx;
                    const isEditing = editingItem !== null && editingItem?.itemId != null && editingItem?.itemId === itemId;
                    return (
                      <tr key={`d-${osIdx}-${itemIdx}-${itemId}`} className={rowIdx % 2 === 0 ? "bg-white" : "bg-blue-50/40"}>
                        <td className="py-2 px-3 text-blue-gray-600 font-medium">{os.supplierName ?? os.SupplierName ?? ""}</td>
                        <td className="py-2 px-3 text-blue-gray-800">{item.productName ?? item.ProductName ?? ""}</td>
                        <td className={`py-2 px-3 text-center font-semibold ${mismatch ? "text-amber-900 bg-amber-50/80" : ""}`}>
                          {isEditing && editingItem && !editingItem.editReceived ? (
                            <input type="number" min="0" value={editingItem.qty}
                              onChange={(e) => setEditingItem({ ...editingItem, qty: e.target.value })}
                              className="w-20 rounded border border-blue-gray-200 px-2 py-1 text-sm" />
                          ) : `${qOrd} ${item.unit ?? item.Unit ?? ""}`}
                        </td>
                        <td className={`py-2 px-3 text-center font-semibold ${mismatch ? "text-amber-900 bg-amber-50/80" : "text-blue-gray-800"}`}>
                          {isEditing && editingItem?.editReceived ? (
                            <input type="number" min="0" step="1" inputMode="numeric" value={editingItem.receivedQty}
                              onChange={(e) => setEditingItem({ ...editingItem, receivedQty: e.target.value })}
                              className="w-20 rounded border border-amber-400 bg-amber-50 px-2 py-1 text-sm font-semibold" />
                          ) : qRec != null ? `${qRec} ${item.unit ?? item.Unit ?? ""}` : "—"}
                        </td>
                        <td className="py-2 px-3 text-gray-600">
                          {isEditing && editingItem ? (
                            <input type="number" min="0" value={editingItem.price}
                              onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                              className="w-28 rounded border border-blue-gray-200 px-2 py-1 text-sm" />
                          ) : `${p.toLocaleString("vi-VN")} đ`}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold">
                          {isEditing && editingItem
                            ? `${(Number(editingItem.editReceived ? editingItem.receivedQty : editingItem.qty) * Number(editingItem.price)).toLocaleString("vi-VN")} đ`
                            : `${lineSubtotalByReceived(item, osRaw, orderStatus, p).toLocaleString("vi-VN")} đ`}
                        </td>
                        <td className="py-2 px-3 text-gray-500 text-xs">
                          {isEditing && editingItem ? (
                            <input type="text" value={editingItem.note ?? ""}
                              onChange={(e) => setEditingItem({ ...editingItem, note: e.target.value })}
                              placeholder="Ghi chú..."
                              className="w-32 rounded border border-blue-gray-200 px-2 py-1 text-sm" />
                          ) : (item.note ?? item.Note ?? "—")}
                        </td>
                        {isAdmin && (
                          <td className="py-2 px-3 text-center">
                            {isEditing ? (
                              <div className="flex items-center gap-1 justify-center">
                                <button onClick={handleSaveItem} className="text-xs text-green-600 hover:underline font-semibold">Lưu</button>
                                <button onClick={() => setEditingItem(null)} className="text-xs text-gray-400 hover:underline">Hủy</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 justify-center">
                                <button onClick={() => startEditOrderItem(os, item)}
                                  className="text-blue-500 hover:text-blue-700" title={isOsDeliveredForReceive(os, orderStatus) ? "Sửa SL thực nhận" : "Sửa"}>
                                  <PencilIcon className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDeleteItem(osId, itemId)}
                                  disabled={deletingItem === itemId}
                                  className="text-red-400 hover:text-red-600" title="Xóa">
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-blue-gray-50 font-semibold text-green-700">
            Tổng tiền: {computeOrderTotal(order).toLocaleString("vi-VN")} đ
          </div>
        </CardBody>
      </Card>

      {/* Theo dõi từng NCC */}
      <Typography variant="h6" className="mb-3">Theo dõi từng NCC</Typography>
      {(order.orderSuppliers || []).map((os) => {
        const osId = os.id ?? os.Id;
        const rawOsStatus = os.status ?? os.Status ?? "Pending";
        const osStatus = osChipStatus(orderStatus, rawOsStatus);
        const recvDiscrepancy = osStatus === "Delivered" && hasReceiveDiscrepancy(os);
        const recvChipLabel = recvDiscrepancy ? receiveDiscrepancyChipLabel(os) : null;
        return (
          <Card key={osId} className="border border-blue-gray-100 mb-4">
            {/* Header NCC */}
            <div className="p-3 border-b bg-blue-gray-50/50">
              {/* Row 1: tên NCC + chip + actions — tất cả cùng hàng */}
              <div className="flex flex-wrap items-center gap-2">
                <Typography variant="h6" className="mr-1">{os.supplierName ?? os.SupplierName}</Typography>
                <OsTimeline status={osStatus} />
                <Chip size="sm" color={osStatusColors[osStatus] || "gray"}
                  value={OS_STATUS_OPTIONS.find(o => o.value === osStatus)?.label || osStatus} />
                {recvChipLabel && (
                  <Chip size="sm" color="amber" variant="gradient" value={recvChipLabel} className="font-medium" />
                )}

                {/* Spacer đẩy actions sang phải trên desktop */}
                <div className="flex-1" />

                {/* Admin: dropdown đổi trạng thái — đã bỏ, dùng SupplierOrderList để quản lý */}

                {/* Store: xác nhận đã nhận hàng + gửi ảnh — chỉ khi đang Delivering */}
                {isAdmin && isOsDeliveredForReceive(os, orderStatus) && (
                  <Button size="sm" color="amber" variant="outlined" className="flex items-center gap-1"
                    onClick={() => openAdminEditReceiveModal(osId)}>
                    <PencilIcon className="w-4 h-4" /> Chỉnh SL nhận (tất cả dòng)
                  </Button>
                )}

                {canConfirmReceiveUi && canConfirmReceive(os) && (
                  <>
                    <Button size="sm" color="teal" className="flex items-center gap-1 shrink-0"
                      onClick={() => openReceiveConfirmModal(osId)}>
                      <CheckCircleIcon className="w-4 h-4" /> Đã nhận hàng
                    </Button>
                    <Button size="sm" color="blue" variant="outlined" className="flex items-center gap-1 shrink-0"
                      onClick={() => openUploadModal(osId)}>
                      <PhotoIcon className="w-4 h-4" /> Hóa đơn
                    </Button>
                  </>
                )}
                {canConfirmReceiveUi && !canConfirmReceive(os) && receiveBlockedReason(os) && (
                  <Typography variant="small" className="text-blue-gray-600 max-w-xs">
                    {receiveBlockedReason(os)}
                  </Typography>
                )}

                {/* Xuất đơn */}
                {isStoreOrder && (
                  <>
                    <Button size="sm" variant="outlined" className="flex items-center gap-1" onClick={() => handleExportOrderBySupplier(os)}>
                      <DocumentArrowDownIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">In đơn</span>
                    </Button>
                    <Button size="sm" variant="outlined" className="flex items-center gap-1" onClick={() => handleExportOrderBySupplierExcel(os)}>
                      <DocumentTextIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">Excel</span>
                    </Button>
                  </>
                )}
              </div>

              {/* Lý do từ chối */}
              {rawOsStatus === "Rejected" && (os.note ?? os.Note) && (
                <Typography variant="small" className="text-red-600 mt-1.5">Lý do: {os.note ?? os.Note}</Typography>
              )}
              {osStatus === "Delivered" && (os.receiveNote ?? os.ReceiveNote) && (
                <Typography variant="small" className="text-amber-900 mt-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 block max-w-full">
                  <span className="font-semibold text-amber-950">Chênh lệch / thiếu-thừa khi nhận (so với đơn hoặc phiếu giao):</span>{" "}
                  <span className="text-amber-900">{os.receiveNote ?? os.ReceiveNote}</span>
                </Typography>
              )}
              {osStatus === "Delivered" && !(os.receiveNote ?? os.ReceiveNote) && (os.receiveQtyAdjusted ?? os.ReceiveQtyAdjusted) && (
                <Typography variant="small" className="text-amber-700 mt-1 block">
                  Số lượng thực nhận đã chỉnh so với đơn — Admin thấy trong mục thông báo (chuông).
                </Typography>
              )}
              {updatingOsId === osId && (
                <Typography variant="small" color="gray" className="mt-1">Đang lưu...</Typography>
              )}
            </div>

            {/* Danh sách sản phẩm của NCC này */}
            {(os.orderItems || []).length > 0 && (
              <div className="border-b border-blue-gray-50">
                {/* Mobile: compact list */}
                <div className="md:hidden divide-y divide-blue-gray-50">
                  {(os.orderItems || []).map((item, i) => {
                    const qOrd = lineOrderedQty(item);
                    const qRec = lineReceivedQtyDisplay(item, rawOsStatus, orderStatus);
                    const p = Number((item.price ?? item.Price) || 0);
                    const mismatch = lineQtyMismatch(item, rawOsStatus, orderStatus);
                    return (
                      <div key={i} className={`px-3 py-2 flex items-center justify-between gap-2 ${i % 2 === 0 ? "bg-white" : "bg-blue-50/30"}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-blue-gray-800 truncate">{item.productName ?? item.ProductName}</p>
                          {(item.note ?? item.Note) && <p className="text-xs text-gray-400 italic">{item.note ?? item.Note}</p>}
                          <p className="text-xs text-blue-gray-600 mt-0.5">
                            <span className="text-gray-500">Đặt:</span>{" "}
                            <span className={mismatch ? "font-semibold text-amber-800" : "font-medium"}>{qOrd} {item.unit ?? item.Unit}</span>
                            {" · "}
                            <span className="text-gray-500">Nhận:</span>{" "}
                            <span className={mismatch ? "font-semibold text-amber-800" : "font-medium"}>
                              {qRec != null ? `${qRec} ${item.unit ?? item.Unit}` : "—"}
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-gray-500">{p.toLocaleString("vi-VN")} đ/đv</p>
                          <p className="text-sm font-semibold">{lineSubtotalByReceived(item, rawOsStatus, orderStatus, p).toLocaleString("vi-VN")} đ</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop: mini table */}
                <table className="hidden md:table w-full text-sm">
                  <thead>
                    <tr className="bg-blue-gray-50 text-blue-gray-600 text-xs">
                      <th className="text-left px-3 py-2 font-medium">Sản phẩm</th>
                      <th className="text-center px-3 py-2 font-medium whitespace-nowrap">SL đặt</th>
                      <th className="text-center px-3 py-2 font-medium whitespace-nowrap">SL thực nhận</th>
                      <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Đơn giá</th>
                      <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Thành tiền</th>
                      <th className="text-left px-3 py-2 font-medium">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(os.orderItems || []).map((item, i) => {
                      const qOrd = lineOrderedQty(item);
                      const qRec = lineReceivedQtyDisplay(item, rawOsStatus, orderStatus);
                      const p = Number((item.price ?? item.Price) || 0);
                      const mismatch = lineQtyMismatch(item, rawOsStatus, orderStatus);
                      return (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-blue-50/30"}>
                          <td className="px-3 py-2 font-medium text-blue-gray-800">{item.productName ?? item.ProductName}</td>
                          <td className={`px-3 py-2 text-center ${mismatch ? "text-amber-900 font-semibold bg-amber-50/80" : ""}`}>{qOrd} {item.unit ?? item.Unit}</td>
                          <td className={`px-3 py-2 text-center ${mismatch ? "text-amber-900 font-semibold bg-amber-50/80" : "text-blue-gray-800"}`}>
                            {qRec != null ? `${qRec} ${item.unit ?? item.Unit}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">{p.toLocaleString("vi-VN")} đ</td>
                          <td className="px-3 py-2 text-right font-semibold">{lineSubtotalByReceived(item, rawOsStatus, orderStatus, p).toLocaleString("vi-VN")} đ</td>
                          <td className="px-3 py-2 text-xs text-gray-400 italic">{item.note ?? item.Note ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Ảnh đã gửi */}
            {((os.receiveImages || os.ReceiveImages)?.length > 0) && (
              <div className="px-4 pt-2 pb-4 border-b border-blue-gray-100 bg-white">
                <Typography variant="h6" color="blue-gray" className="mb-2">Ảnh xác nhận nhận hàng</Typography>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {["received", "invoice"].map((type) => (
                    <div key={type}>
                      <Typography variant="small" className="font-medium text-blue-gray-600 mb-1">
                        {type === "received" ? "📦 Ảnh hàng nhận" : "🧾 Hóa đơn đã ký"}
                      </Typography>
                      <div className="flex flex-wrap gap-2">
                        {(os.receiveImages || os.ReceiveImages || [])
                          .filter((img) => (img.type || img.Type) === type)
                          .map((img) => {
                            const raw = img.dataUrl || img.imageUrl || img.DataUrl || img.ImageUrl;
                            const src = raw?.startsWith("/") ? (api.BASE_URL || "").replace(/\/$/, "") + raw : raw;
                            return (
                              <img key={img.id ?? img.Id ?? src} src={src} alt=""
                                className="h-20 w-20 object-cover rounded border cursor-pointer hover:opacity-90"
                                onClick={() => setLightbox(src)} />
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {os.expectedDeliveryDate && (
              <div className="px-4 py-2">
                <Typography variant="small" color="gray">Giao dự kiến: {os.expectedDeliveryDate}</Typography>
              </div>
            )}
          </Card>
        );
      })}

      {/* Modal xác nhận nhận hàng (SL thực tế + ghi chú) */}
      {receiveConfirmModal.open && (
        <MobileScrollModal
          open
          zIndex="z-[55]"
          onClose={() => !receiveConfirmModal.saving && setReceiveConfirmModal({ open: false, mode: "store", osId: null, lines: [], note: "", saving: false })}
        >
          <div className="shrink-0 border-b border-blue-gray-100 p-4">
            <Typography variant="h6">
              {receiveConfirmModal.mode === "admin" ? "Admin chỉnh SL nhận hàng" : "Xác nhận đã nhận hàng"}
            </Typography>
            <Typography variant="small" color="gray" className="mt-1">
              {receiveConfirmModal.mode === "admin" ? (
                <>Cửa hàng xác nhận sai — admin sửa <strong>SL thực nhận</strong> và ghi chú. Tồn kho CH tự điều chỉnh theo chênh lệch.</>
              ) : (
                <>Kiểm tra <strong>SL thực nhận</strong> và ghi chú. Admin chỉ thấy cảnh báo trên Trang chủ / chuông khi: SL <strong>khác</strong> đặt, có <strong>ghi chú</strong>, hoặc cửa hàng đã gửi <strong>ảnh hóa đơn</strong> (nút &quot;Hóa đơn&quot;).</>
              )}
            </Typography>
          </div>
          <MobileScrollModalBody className="flex flex-col gap-3 p-4">
            <div className="overflow-hidden rounded border border-blue-gray-100 text-sm">
              <table className="w-full text-left">
                <thead className="bg-blue-gray-50 text-xs text-blue-gray-600">
                  <tr>
                    <th className="px-2 py-2 font-medium">Sản phẩm</th>
                    <th className="px-2 py-2 font-medium text-center w-20">Đơn</th>
                    <th className="px-2 py-2 font-medium text-center w-24">Thực nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {receiveConfirmModal.lines.map((row) => (
                    <tr key={row.itemId} className="border-t border-blue-gray-50">
                      <td className="px-2 py-2">
                        <span className="font-medium text-blue-gray-800">{row.productName}</span>
                        <span className="block text-xs text-gray-500">{row.unit}</span>
                      </td>
                      <td className="px-2 py-2 text-center text-blue-gray-700">{row.orderedQty}</td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          className="w-full rounded border border-blue-gray-200 px-2 py-1.5 text-sm text-center"
                          value={row.actualQty === "" ? "" : row.actualQty}
                          onChange={(e) => updateReceiveLineQty(row.itemId, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <label htmlFor="receive-confirm-note" className="mb-1 block text-sm font-medium text-blue-gray-700">Ghi chú (tùy chọn)</label>
              <textarea
                id="receive-confirm-note"
                rows={3}
                className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Ví dụ: thiếu 2 thùng, NCC giao nhầm mã…"
                value={receiveConfirmModal.note}
                onChange={(e) => setReceiveConfirmModal((p) => ({ ...p, note: e.target.value }))}
              />
            </div>
          </MobileScrollModalBody>
          <div className="flex shrink-0 gap-2 justify-end border-t border-blue-gray-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button variant="outlined" disabled={receiveConfirmModal.saving}
              onClick={() => setReceiveConfirmModal({ open: false, mode: "store", osId: null, lines: [], note: "", saving: false })}>Hủy</Button>
            <Button color={receiveConfirmModal.mode === "admin" ? "amber" : "teal"} disabled={receiveConfirmModal.saving} onClick={submitReceiveConfirm}>
              {receiveConfirmModal.saving ? "Đang lưu…" : receiveConfirmModal.mode === "admin" ? "Lưu chỉnh sửa" : "Xác nhận & lưu"}
            </Button>
          </div>
        </MobileScrollModal>
      )}

      {/* Modal gửi ảnh */}
      {confirmModal.open && (
        <MobileScrollModal open maxWidth="max-w-md" zIndex="z-50" onClose={() => setConfirmModal({ open: false, osId: null })}>
          <div className="shrink-0 border-b border-blue-gray-100 p-4">
            <Typography variant="h6">Gửi hóa đơn đã ký</Typography>
            <Typography variant="small" color="gray">
              Ảnh hóa đơn giúp đối soát. Sau khi gửi, đơn NCC chuyển <strong>Delivered</strong> và admin thấy mục cảnh báo trên Trang chủ / chuông (kèm ảnh chứng từ).
            </Typography>
          </div>
          <MobileScrollModalBody className="flex flex-col gap-4 p-4">
            <div>
              <label htmlFor="receive-invoice-file" className="mb-1 block text-sm font-medium text-blue-gray-700">Ảnh hóa đơn đã ký</label>
              <input id="receive-invoice-file" ref={refInvoice} type="file" accept="image/*"
                className="block w-full text-sm text-gray-500 file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-blue-700" />
            </div>
          </MobileScrollModalBody>
          <div className="flex shrink-0 gap-2 justify-end border-t border-blue-gray-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button variant="outlined" onClick={() => setConfirmModal({ open: false, osId: null })}>Hủy</Button>
            <Button color="blue" onClick={handleConfirmReceiveWithImages}>Gửi ảnh</Button>
          </div>
        </MobileScrollModal>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

export default OrderDetail;
