/**
 * Xuất đơn hàng theo mẫu P-TASTE: In (HTML) + Excel.
 * Layout: header công ty, thông tin đơn/khách, bảng SP (STT, Tên, ĐVT, SL, Đơn giá, Chiết khấu, Đơn giá sau CK, Thành tiền), footer tổng + Còn phải thu + block chữ ký.
 */

// Mặc định chỉ để fallback. Khi xuất theo NCC, sẽ ưu tiên lấy từ supplier/os.
export const ORDER_EXPORT_CONFIG = {
  companyName: "CÔNG TY",
  address: "",
  hotline: "",
  email: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankName: "",
  preparerLabel: "Người lập",
};

function fmtNum(n) {
  return n == null || Number.isNaN(n) ? "" : Number(n).toLocaleString("vi-VN");
}

function getItem(q, p, discount = 0) {
  const quantity = Number(q) || 0;
  const price = Number(p) || 0;
  const discountAmt = Number(discount) || 0;
  const afterDiscount = price * quantity - discountAmt;
  return { quantity, price, discountAmt, afterDiscount, subtotal: afterDiscount };
}

/**
 * Tạo HTML in đơn theo từng NCC (mẫu P-TASTE).
 * @param {object} os - OrderSupplier { id, supplierName, orderItems, totalAmount, expectedDeliveryDate, status }
 * @param {object} order - Order { id, orderDate }
 * @param {object} store - { name, address, phone } (khách hàng = cửa hàng)
 * @param {object} options - { preparerName?: string, supplier?: { name, address, phone, email, bankAccountName, bankAccountNumber, bankName } }
 */
export function buildOrderPrintHtml(os, order, store = {}, options = {}) {
  const cfg = ORDER_EXPORT_CONFIG;
  const orderId = order?.id ?? order?.Id ?? "";
  const orderDate = order?.orderDate ?? order?.OrderDate ?? "";
  const supplierName = os?.supplierName ?? os?.SupplierName ?? "";
  const supplier = options.supplier || {};
  const headerCompanyName = supplier.name || supplierName || cfg.companyName;
  const headerAddress = supplier.address || cfg.address || "";
  const headerHotline = supplier.phone || cfg.hotline || "";
  const headerEmail = supplier.email || cfg.email || "";
  const headerBankAccountName = supplier.bankAccountName || cfg.bankAccountName || headerCompanyName;
  const headerBankAccountNumber = supplier.bankAccountNumber || cfg.bankAccountNumber || "";
  const headerBankName = supplier.bankName || cfg.bankName || "";
  const hasPaymentInfo = Boolean(headerBankAccountNumber || headerBankName || supplier.bankAccountName);
  const items = os?.orderItems ?? os?.OrderItems ?? [];
  const storeName = store?.name ?? store?.Name ?? "";
  const storeAddress = store?.address ?? store?.Address ?? "";
  const storePhone = store?.phone ?? store?.Phone ?? "";
  const docNumber = `DH${String(orderId).padStart(6, "0")}-${os?.id ?? os?.Id ?? ""}`;

  let totalQty = 0;
  let totalAmount = 0;
  const rows = items.map((it, i) => {
    const q = it.quantity ?? it.Quantity ?? 0;
    const p = Number((it.price ?? it.Price) || 0);
    const disc = Number((it.discountAmount ?? it.DiscountAmount) || 0);
    const { afterDiscount, subtotal } = getItem(q, p, disc);
    totalQty += q;
    totalAmount += subtotal;
    const priceAfterDisc = q > 0 ? afterDiscount / q : 0;
    return {
      stt: i + 1,
      name: it.productName ?? it.ProductName ?? "",
      unit: it.unit ?? it.Unit ?? "cái",
      qty: q,
      price: p,
      discount: disc,
      priceAfterDisc,
      subtotal,
    };
  });

  const receivable = totalAmount; // Còn phải thu = tổng tiền đơn (có thể trừ đã thanh toán sau)
  const preparerLine = options.preparerName || "Người lập đơn - Ký và ghi rõ họ tên";

  const th = (t) => `<th style="border:1px solid #333;padding:6px 8px;text-align:left;background:#f0f0f0;font-size:12px;">${t}</th>`;
  const td = (t, align = "left") => `<td style="border:1px solid #333;padding:6px 8px;text-align:${align};font-size:12px;">${t}</td>`;

  let tableRows = `
    <tr>${th("STT")}${th("TÊN SẢN PHẨM")}${th("ĐVT")}${th("SỐ LƯỢNG")}${th("ĐƠN GIÁ")}${th("CHIẾT KHẤU")}${th("ĐƠN GIÁ SAU CK")}${th("THÀNH TIỀN")}</tr>
  `;
  rows.forEach((r) => {
    tableRows += `<tr>
      ${td(r.stt, "center")}${td(r.name)}${td(r.unit, "center")}${td(fmtNum(r.qty), "right")}
      ${td(fmtNum(r.price), "right")}${td(fmtNum(r.discount), "right")}${td(fmtNum(r.priceAfterDisc), "right")}${td(fmtNum(r.subtotal), "right")}
    </tr>`;
  });
  tableRows += `<tr><td colspan="3" style="border:1px solid #333;padding:6px 8px;font-weight:bold;">Tổng cộng</td>${td(fmtNum(totalQty), "right")}<td colspan="4" style="border:1px solid #333;padding:6px 8px;text-align:right;font-weight:bold;">${fmtNum(totalAmount)} đ</td></tr>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Đơn hàng ${docNumber}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; padding: 16px; color: #222; max-width: 900px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
  .company { flex: 1; min-width: 200px; }
  .company h1 { font-size: 16px; margin: 0 0 4px 0; font-weight: bold; }
  .company p { margin: 2px 0; font-size: 12px; color: #444; }
  .doc-info { text-align: right; min-width: 220px; font-size: 12px; }
  .doc-info p { margin: 2px 0; }
  .title-center { text-align: center; font-size: 18px; font-weight: bold; margin: 12px 0; }
  .customer { margin: 12px 0; padding: 8px; background: #f9f9f9; border: 1px solid #ddd; }
  .customer p { margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  .receivable { margin: 12px 0; padding: 8px; font-weight: bold; font-size: 14px; border: 1px solid #333; }
  .signature-table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  .signature-table td { border: 1px solid #333; padding: 8px; text-align: center; vertical-align: top; width: 20%; font-size: 11px; }
  .signature-table .role { font-weight: bold; margin-bottom: 4px; }
  .preparer-line { margin-top: 8px; font-size: 12px; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
</head>
<body>
  <div class="header">
    <div class="company">
      <h1>${headerCompanyName}</h1>
      ${headerAddress ? `<p>${headerAddress}</p>` : ``}
      ${headerHotline ? `<p><strong>Hotline:</strong> ${headerHotline}</p>` : ``}
      ${headerEmail ? `<p><strong>E-mail:</strong> ${headerEmail}</p>` : ``}
    </div>
    <div class="doc-info">
      <p><strong>Ngày đặt hàng:</strong> ${orderDate}</p>
      <p><strong>Số đơn hàng:</strong> ${docNumber}</p>
      ${
        hasPaymentInfo
          ? `<p><strong>Thông tin thanh toán:</strong></p>
             ${headerBankAccountName ? `<p>Tên tài khoản: ${headerBankAccountName}</p>` : ``}
             ${headerBankAccountNumber ? `<p>Số tài khoản: ${headerBankAccountNumber}</p>` : ``}
             ${headerBankName ? `<p>Ngân hàng: ${headerBankName}</p>` : ``}`
          : ``
      }
    </div>
  </div>
  <div class="title-center">ĐƠN HÀNG (ORDER)</div>
  <div class="customer">
    <p><strong>Khách hàng:</strong> ${storeName}</p>
    <p><strong>Số điện thoại nhận hàng:</strong> ${storePhone || "—"}</p>
    <p><strong>Địa chỉ giao hàng:</strong> ${storeAddress || "—"}</p>
    <p><strong>Ghi chú:</strong> Đơn theo NCC: ${supplierName}. Giao dự kiến: ${os?.expectedDeliveryDate ?? "—"}.</p>
  </div>
  <table>
    ${tableRows}
  </table>
  <div class="receivable">Còn phải thu: ${fmtNum(receivable)} đ</div>
  <table class="signature-table">
    <tr>
      <td><div class="role">${cfg.preparerLabel}</div>Ký và ghi rõ họ tên</td>
      <td><div class="role">Thủ kho 1</div>Ký và ghi rõ họ tên</td>
      <td><div class="role">Thủ kho 2</div>Ký và ghi rõ họ tên</td>
      <td><div class="role">Giao nhận</div>Ký và ghi rõ họ tên</td>
      <td><div class="role">Khách hàng</div>Ký và ghi rõ họ tên</td>
    </tr>
  </table>
  <p class="preparer-line">${preparerLine}</p>
</body>
</html>`;
  return html;
}

/**
 * Mở cửa sổ in đơn (theo NCC).
 */
export function printOrderBySupplier(os, order, store, options = {}) {
  const html = buildOrderPrintHtml(os, order, store, options);
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    w.close();
  }, 300);
  return true;
}

/**
 * Xuất đơn theo NCC ra file Excel (.xlsx).
 * @param {object} os - OrderSupplier
 * @param {object} order - Order
 * @param {object} store - Store (khách hàng)
 * @param {string} filename - Tên file (tùy chọn)
 * @param {object} XLSXModule - Module xlsx (từ import('xlsx')) - nếu không truyền sẽ dùng window.XLSX
 */
export function exportOrderToExcel(os, order, store = {}, filename = null, XLSXModule = null) {
  try {
    const XLSX = XLSXModule || window.XLSX;
    if (!XLSX) {
      console.warn("XLSX not loaded. Cần cài package xlsx và truyền vào hoặc load script.");
      return false;
    }

    const orderId = order?.id ?? order?.Id ?? "";
    const orderDate = order?.orderDate ?? order?.OrderDate ?? "";
    const supplierName = os?.supplierName ?? os?.SupplierName ?? "";
    const items = os?.orderItems ?? os?.OrderItems ?? [];
    const storeName = store?.name ?? store?.Name ?? "";
    const docNumber = filename || `Don_hang_${orderId}_NCC_${os?.id ?? os?.Id}_${supplierName?.replace(/\s+/g, "_") || "export"}.xlsx`;

    const cfg = ORDER_EXPORT_CONFIG;
    const supplierNameForHeader = (os?.supplierName ?? os?.SupplierName ?? "") || cfg.companyName;
    const supplier = (typeof store?.supplier === "object" && store?.supplier) || null;
    const companyName = supplier?.name || supplierNameForHeader;
    const companyAddress = supplier?.address || cfg.address || "";
    const companyPhone = supplier?.phone || cfg.hotline || "";
    const companyEmail = supplier?.email || cfg.email || "";
    const bankAccountName = supplier?.bankAccountName || cfg.bankAccountName || companyName;
    const bankAccountNumber = supplier?.bankAccountNumber || cfg.bankAccountNumber || "";
    const bankName = supplier?.bankName || cfg.bankName || "";
    const hasPaymentInfo = Boolean(bankAccountNumber || bankName || supplier?.bankAccountName);
    const headerRows = [
      [companyName],
      [companyAddress],
      ["Hotline: " + companyPhone, "Email: " + companyEmail],
      [],
      ["ĐƠN HÀNG (ORDER)"],
      [],
      ["Ngày đặt hàng", orderDate, "Số đơn hàng", `DH${String(orderId).padStart(6, "0")}-${os?.id ?? os?.Id}`],
      ["Khách hàng", storeName],
      ["Nhà cung cấp", supplierName],
      ...(hasPaymentInfo
        ? [
            ...(bankAccountName ? [["Tên tài khoản", bankAccountName]] : []),
            ...(bankAccountNumber ? [["Số tài khoản", bankAccountNumber]] : []),
            ...(bankName ? [["Ngân hàng", bankName]] : []),
          ]
        : []),
      [],
      ["STT", "Tên sản phẩm", "ĐVT", "Số lượng", "Đơn giá", "Chiết khấu", "Đơn giá sau CK", "Thành tiền"],
    ];

    let totalQty = 0;
    let totalAmt = 0;
    const dataRows = items.map((it, i) => {
      const q = it.quantity ?? it.Quantity ?? 0;
      const p = Number((it.price ?? it.Price) || 0);
      const disc = Number((it.discountAmount ?? it.DiscountAmount) || 0);
      const { afterDiscount, subtotal } = getItem(q, p, disc);
      totalQty += q;
      totalAmt += subtotal;
      const priceAfterDisc = q > 0 ? afterDiscount / q : 0;
      return [i + 1, it.productName ?? it.ProductName ?? "", it.unit ?? it.Unit ?? "cái", q, p, disc, priceAfterDisc, subtotal];
    });
    headerRows.push(...dataRows);
    headerRows.push([]);
    headerRows.push(["Tổng cộng", "", "", totalQty, "", "", "", totalAmt]);
    headerRows.push([]);
    headerRows.push(["Còn phải thu", "", "", "", "", "", "", totalAmt]);

    const ws = XLSX.utils.aoa_to_sheet(headerRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Don hang");
    XLSX.writeFile(wb, docNumber.endsWith(".xlsx") ? docNumber : docNumber + ".xlsx");
    return true;
  } catch (e) {
    console.error("exportOrderToExcel", e);
    return false;
  }
}
