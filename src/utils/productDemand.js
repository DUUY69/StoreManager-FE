/** Nhu cầu theo SP — logic dùng chung Dashboard + màn riêng. */

export function getWeekRange(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    from: monday.toISOString().slice(0, 10),
    to: sunday.toISOString().slice(0, 10),
  };
}

export function orderDateInRange(orderDateRaw, dateFrom, dateTo) {
  const d = String(orderDateRaw ?? "").slice(0, 10);
  if (!d) return false;
  if (dateFrom && d < dateFrom) return false;
  if (dateTo && d > dateTo) return false;
  return true;
}

export function normalizeSearchText(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** SL đặt còn mở theo SP + NCC (đơn chưa hoàn thành/từ chối; dòng NCC chưa giao xong). */
export function computeProductDemandOpen(orders, dateFrom, dateTo) {
  const map = new Map();
  for (const o of orders || []) {
    const st = o.status ?? o.Status;
    if (["Completed", "Rejected"].includes(st)) continue;
    if (!orderDateInRange(o.orderDate ?? o.OrderDate, dateFrom, dateTo)) continue;
    for (const os of o.orderSuppliers || o.OrderSuppliers || []) {
      const ost = os.status ?? os.Status;
      if (["Rejected", "Delivered"].includes(ost)) continue;
      const supplierId = os.supplierId ?? os.SupplierId;
      const supplierName = (os.supplierName ?? os.SupplierName) || "—";
      for (const it of os.orderItems || os.OrderItems || []) {
        const pid = it.productId ?? it.ProductId;
        const name = it.productName ?? it.ProductName ?? `SP #${pid}`;
        const unit = it.unit ?? it.Unit ?? "";
        const q = Number(it.quantity ?? it.Quantity ?? 0);
        const key = `${pid}-${supplierId ?? "x"}`;
        const cur = map.get(key) || {
          productId: pid,
          supplierId,
          supplierName,
          productName: name,
          unit,
          totalQty: 0,
          lines: 0,
        };
        cur.totalQty += q;
        cur.lines += 1;
        cur.productName = name || cur.productName;
        cur.supplierName = supplierName || cur.supplierName;
        map.set(key, cur);
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      b.totalQty - a.totalQty
      || String(a.supplierName).localeCompare(String(b.supplierName), "vi")
      || String(a.productName).localeCompare(String(b.productName), "vi")
  );
}

export function filterProductDemandRows(rows, searchText) {
  const q = normalizeSearchText(searchText);
  if (!q) return rows;
  return rows.filter((row) => {
    const hay = normalizeSearchText(`${row.productName} ${row.supplierName} ${row.unit}`);
    return hay.includes(q);
  });
}

export function formatDemandDateRangeLabel(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return "Tất cả ngày đặt";
  return `${dateFrom || "…"} → ${dateTo || "…"}`;
}

export function getMonthRange(offsetMonths = 0) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
}

export function filterOrdersByOrderDate(orders, dateFrom, dateTo) {
  return (orders || []).filter((o) =>
    orderDateInRange(o.orderDate ?? o.OrderDate, dateFrom, dateTo)
  );
}

export function filterProductDemandRowsBySupplier(rows, supplierId) {
  if (!supplierId) return rows;
  const sid = Number(supplierId);
  return rows.filter((row) => Number(row.supplierId) === sid);
}

/**
 * Tổng SL của SP khớp tên (và NCC nếu có) trong 1 đơn.
 * Dùng khi lọc danh sách đơn từ Nhu cầu SP.
 */
export function getMatchedProductQtyInOrder(order, productQuery, supplierId) {
  const q = String(productQuery ?? "").trim().toLowerCase();
  if (!q) return null;
  const sid =
    supplierId != null && String(supplierId).trim() !== ""
      ? Number(supplierId)
      : null;
  let qty = 0;
  let unit = "";
  for (const os of order.orderSuppliers || order.OrderSuppliers || []) {
    if (sid != null && Number.isFinite(sid) && Number(os.supplierId ?? os.SupplierId) !== sid) {
      continue;
    }
    for (const it of os.orderItems || os.OrderItems || []) {
      const name = String(it.productName ?? it.ProductName ?? "").toLowerCase();
      if (!name.includes(q)) continue;
      qty += Number(it.quantity ?? it.Quantity ?? 0);
      if (!unit) unit = it.unit ?? it.Unit ?? "";
    }
  }
  return { qty, unit };
}

/** Ghi chú quy tắc hiển thị — dùng chung Dashboard + màn Nhu cầu SP. */
export const PRODUCT_DEMAND_RULES_NOTE = [
  "Hiển thị khi: đơn chưa Hoàn thành / Từ chối, và dòng NCC chưa Giao xong (Chờ · Chấp nhận · Đang giao).",
  "Biến mất khi: NCC đã Giao, hoặc đơn Hoàn thành / Từ chối.",
  "Lọc thời gian theo ngày đặt đơn — không theo ngày giao.",
];
