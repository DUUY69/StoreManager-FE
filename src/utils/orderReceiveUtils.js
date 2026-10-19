/** SL đặt / SL thực nhận — dùng chung OrderDetail & SupplierOrderDetail */

export function lineOrderedQty(item) {
  return Number(item.quantity ?? item.Quantity ?? 0);
}

export function osIsDelivered(osStatus) {
  return String(osStatus ?? "").trim().toLowerCase() === "delivered";
}

export function lineReceivedQtyDisplay(item, osStatus) {
  if (!osIsDelivered(osStatus)) return null;
  const r = item.receivedQuantity ?? item.ReceivedQuantity;
  if (r != null && r !== "") return Number(r);
  return lineOrderedQty(item);
}

export function lineQtyMismatch(item, osStatus) {
  const o = lineOrderedQty(item);
  const r = lineReceivedQtyDisplay(item, osStatus);
  if (r == null) return false;
  return o !== r;
}

export function hasReceiveDiscrepancy(os) {
  const note = String(os.receiveNote ?? os.ReceiveNote ?? "").trim();
  if (note.length > 0) return true;
  return !!(os.receiveQtyAdjusted ?? os.ReceiveQtyAdjusted);
}

export function receiveDiscrepancyLabel(os) {
  const note = String(os.receiveNote ?? os.ReceiveNote ?? "").trim().toLowerCase();
  const adj = !!(os.receiveQtyAdjusted ?? os.ReceiveQtyAdjusted);
  if (note && /thiếu|không đủ|lệch|giao thiếu/.test(note)) return "Giao thiếu / lệch SL";
  if (note && /\bthừa\b|dư hàng/.test(note)) return "Giao thừa";
  if (note) return "Có ghi chú nhận";
  if (adj) return "SL thực nhận khác đơn";
  return null;
}

export function orderSupplierHasReceiveFlag(os) {
  if ((os.status ?? os.Status) !== "Delivered") return false;
  const flagged = !!(os.receiveQtyAdjusted ?? os.ReceiveQtyAdjusted);
  const note = String(os.receiveNote ?? os.ReceiveNote ?? "").trim();
  const imgs = os.receiveImages ?? os.ReceiveImages ?? [];
  return flagged || note.length > 0 || (Array.isArray(imgs) && imgs.length > 0);
}
