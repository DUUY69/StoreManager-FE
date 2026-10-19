/** Xuất Excel tổng đơn đã đặt — nhóm theo cửa hàng (theo yêu cầu admin). */

function storeLabel(order, stores) {
  const sid = order.storeId ?? order.StoreId;
  const fromOrder = order.storeName ?? order.StoreName;
  if (fromOrder) return String(fromOrder);
  const s = (stores || []).find((x) => String(x.id ?? x.Id) === String(sid));
  return s?.name ?? s?.Name ?? "—";
}

function orderStatusVi(s) {
  const x = String(s || "");
  if (x === "Completed") return "Hoàn thành";
  if (x === "Rejected") return "Từ chối";
  if (x === "Delivering" || x === "Accepted") return "Đang giao";
  if (x === "Pending") return "Chờ duyệt";
  return x || "—";
}

function osStatusVi(s) {
  const x = String(s || "");
  if (x === "Delivered") return "Đã giao";
  if (x === "Delivering") return "Đang giao";
  if (x === "Accepted") return "Chấp nhận";
  if (x === "Rejected") return "Từ chối";
  if (x === "Pending") return "Chờ";
  return x || "—";
}

function formatDateVi(d) {
  if (!d) return "";
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split("-");
  if (y && m && day) return `${day}/${m}/${y}`;
  try {
    return new Date(d).toLocaleDateString("vi-VN");
  } catch {
    return s;
  }
}

function lineReceivedQty(it, osSt, parentSt) {
  const raw = String(osSt ?? "").trim().toLowerCase();
  const parent = String(parentSt ?? "").trim();
  const inferredDel = parent === "Completed" && ["pending", "accepted", "delivering"].includes(raw);
  const delivered = raw === "delivered" || inferredDel;
  if (!delivered) return null;
  const r = it.receivedQuantity ?? it.ReceivedQuantity;
  if (r != null && r !== "") return Number(r);
  return Number(it.quantity ?? it.Quantity ?? 0);
}

export function computeOrderTotalForExport(order) {
  const amt = Number(order.totalAmount ?? order.TotalAmount ?? 0);
  if (amt > 0) return amt;
  const pstat = order.status ?? order.Status ?? "";
  return (order.orderSuppliers || order.OrderSuppliers || []).reduce((sum, os) => {
    const osSt = os.status ?? os.Status ?? "";
    return (
      sum +
      (os.orderItems || os.OrderItems || []).reduce((s, it) => {
        const qOrd = Number(it.quantity ?? it.Quantity ?? 0);
        const r = lineReceivedQty(it, osSt, pstat);
        const q = r != null ? r : qOrd;
        return s + q * Number((it.price ?? it.Price) || 0);
      }, 0)
    );
  }, 0);
}

function safeSheetName(name, used) {
  let base = String(name || "CH")
    .replace(/[\\/?*[\]:]/g, " ")
    .trim()
    .slice(0, 28);
  if (!base) base = "CH";
  let n = base;
  let i = 1;
  while (used.has(n)) {
    n = `${base.slice(0, 25)}_${i++}`;
  }
  used.add(n);
  return n;
}

/**
 * @param {{ orders: object[], stores: object[], fileLabel?: string }} opts
 * orders: danh sách đã lọc (đúng như trên màn hình)
 */
export async function exportOrdersSummaryExcel({ orders, stores, fileLabel = "Tong_don_dat" }) {
  const XLSX = await import("xlsx");
  const sorted = [...orders].sort((a, b) => {
    const sa = storeLabel(a, stores);
    const sb = storeLabel(b, stores);
    if (sa !== sb) return sa.localeCompare(sb, "vi");
    const dB = b.orderDate ?? b.OrderDate ?? "";
    const dA = a.orderDate ?? a.OrderDate ?? "";
    if (dB !== dA) return String(dB).localeCompare(String(dA));
    return (b.id ?? b.Id ?? 0) - (a.id ?? a.Id ?? 0);
  });

  const summaryRows = [];
  let stt = 1;
  sorted.forEach((o) => {
    const oss = o.orderSuppliers || o.OrderSuppliers || [];
    summaryRows.push({
      STT: stt++,
      "Mã đơn": `#${o.id ?? o.Id}`,
      "Cửa hàng": storeLabel(o, stores),
      "Ngày đặt": formatDateVi(o.orderDate ?? o.OrderDate),
      "Trạng thái đơn": orderStatusVi(o.status ?? o.Status),
      "Số NCC": oss.length,
      "Tổng tiền (đ)": computeOrderTotalForExport(o),
      "Ghi chú": o.note ?? o.Note ?? "",
    });
  });

  const detailRows = [];
  let sttD = 1;
  sorted.forEach((o) => {
    const oid = o.id ?? o.Id;
    const ch = storeLabel(o, stores);
    const ngay = formatDateVi(o.orderDate ?? o.OrderDate);
    const ttDon = orderStatusVi(o.status ?? o.Status);
    (o.orderSuppliers || o.OrderSuppliers || []).forEach((os) => {
      const ncc = os.supplierName ?? os.SupplierName ?? "";
      const osSt = os.status ?? os.Status ?? "";
      const items = os.orderItems || os.OrderItems || [];
      if (!items.length) {
        detailRows.push({
          STT: sttD++,
          "Mã đơn": `#${oid}`,
          "Cửa hàng": ch,
          "Ngày đặt": ngay,
          "Trạng thái đơn": ttDon,
          NCC: ncc,
          "TT đơn NCC": osStatusVi(osSt),
          "Sản phẩm": "",
          "SL đặt": "",
          "SL thực nhận": "",
          ĐVT: "",
          "Đơn giá (đ)": "",
          "Thành tiền (đ)": "",
        });
        return;
      }
      items.forEach((it) => {
        const qOrd = Number(it.quantity ?? it.Quantity ?? 0);
        const qRec = lineReceivedQty(it, osSt, o.status ?? o.Status);
        const p = Number((it.price ?? it.Price) || 0);
        const qBill = qRec != null ? qRec : qOrd;
        detailRows.push({
          STT: sttD++,
          "Mã đơn": `#${oid}`,
          "Cửa hàng": ch,
          "Ngày đặt": ngay,
          "Trạng thái đơn": ttDon,
          NCC: ncc,
          "TT đơn NCC": osStatusVi(osSt),
          "Sản phẩm": it.productName ?? it.ProductName ?? "",
          "SL đặt": qOrd,
          "SL thực nhận": qRec != null ? qRec : "",
          ĐVT: it.unit ?? it.Unit ?? "",
          "Đơn giá (đ)": p,
          "Thành tiền (đ)": qBill * p,
        });
      });
    });
  });

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary["!cols"] = [
    { wch: 6 },
    { wch: 10 },
    { wch: 36 },
    { wch: 12 },
    { wch: 14 },
    { wch: 8 },
    { wch: 16 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Tong_hop_don");

  const wsDetail = XLSX.utils.json_to_sheet(detailRows);
  wsDetail["!cols"] = [
    { wch: 6 },
    { wch: 10 },
    { wch: 28 },
    { wch: 12 },
    { wch: 14 },
    { wch: 22 },
    { wch: 12 },
    { wch: 36 },
    { wch: 8 },
    { wch: 12 },
    { wch: 8 },
    { wch: 12 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, "Chi_tiet_san_pham");

  const byStore = new Map();
  sorted.forEach((o) => {
    const ch = storeLabel(o, stores);
    if (!byStore.has(ch)) byStore.set(ch, []);
    byStore.get(ch).push(o);
  });

  const usedNames = new Set(["Tong_hop_don", "Chi_tiet_san_pham"]);
  [...byStore.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "vi"))
    .forEach(([ch, storeOrders]) => {
      const rows = [];
      let n = 1;
      storeOrders.forEach((o) => {
        rows.push({
          STT: n++,
          "Mã đơn": `#${o.id ?? o.Id}`,
          "Ngày đặt": formatDateVi(o.orderDate ?? o.OrderDate),
          "Trạng thái": orderStatusVi(o.status ?? o.Status),
          "Tổng tiền (đ)": computeOrderTotalForExport(o),
        });
        (o.orderSuppliers || o.OrderSuppliers || []).forEach((os) => {
          (os.orderItems || os.OrderItems || []).forEach((it) => {
            const qOrd = Number(it.quantity ?? it.Quantity ?? 0);
            const qRec = lineReceivedQty(it, os.status ?? os.Status, o.status ?? o.Status);
            const p = Number((it.price ?? it.Price) || 0);
            const qBill = qRec != null ? qRec : qOrd;
            rows.push({
              STT: "",
              "Mã đơn": "",
              "Ngày đặt": os.supplierName ?? os.SupplierName ?? "",
              "Trạng thái": it.productName ?? it.ProductName ?? "",
              "Tổng tiền (đ)": `${qOrd}${qRec != null && qRec !== qOrd ? ` → ${qRec}` : ""} ${it.unit ?? it.Unit ?? ""} × ${p.toLocaleString("vi-VN")} = ${(qBill * p).toLocaleString("vi-VN")}`,
            });
          });
        });
        rows.push({ STT: "", "Mã đơn": "", "Ngày đặt": "", "Trạng thái": "", "Tổng tiền (đ)": "" });
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 6 }, { wch: 10 }, { wch: 14 }, { wch: 40 }, { wch: 36 }];
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName(ch, usedNames));
    });

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${fileLabel}_${date}.xlsx`);
  return true;
}
