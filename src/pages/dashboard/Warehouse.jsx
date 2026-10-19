import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardHeader, CardBody, Typography, Button, Input } from "@material-tailwind/react";
import { ArchiveBoxIcon, PencilSquareIcon, PlusCircleIcon } from "@heroicons/react/24/solid";
import { useAuth, useToast } from "@/context";
import { useData } from "@/context/DataContext";
import api from "@/api";
import { useUrlFilters } from "@/utils/urlFilters";

const WAREHOUSE_FILTER_DEFAULTS = { dateFrom: "", dateTo: "", sDateFrom: "", sDateTo: "" };

export function Warehouse() {
  const location = useLocation();
  const { warehouseId, warehouseName, warehouseCode } = location.state ?? {};
  const { isSupplierUser, isAdmin, isStoreUser, currentUser } = useAuth();
  const { useApi, stores = [] } = useData();
  const { showToast } = useToast();
  const { values, setFilter } = useUrlFilters(WAREHOUSE_FILTER_DEFAULTS);
  const dateFrom = values.dateFrom;
  const dateTo = values.dateTo;
  const supplierDateFrom = values.sDateFrom;
  const supplierDateTo = values.sDateTo;
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(false);
  const [storeStock, setStoreStock] = useState([]);
  const [storeStockLoading, setStoreStockLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [stockFormProductId, setStockFormProductId] = useState("");
  const [stockFormQuantity, setStockFormQuantity] = useState("");
  const [stockFormSetAbsolute, setStockFormSetAbsolute] = useState(false);
  const [stockFormSubmitting, setStockFormSubmitting] = useState(false);
  const [supplierStockModalOpen, setSupplierStockModalOpen] = useState(false);
  const [supplierTransactions, setSupplierTransactions] = useState([]);
  const [supplierTransactionsLoading, setSupplierTransactionsLoading] = useState(false);
  const [storeProducts, setStoreProducts] = useState([]);
  const [adjustProductId, setAdjustProductId] = useState("");
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustStoreId, setAdjustStoreId] = useState("");
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustUnit, setAdjustUnit] = useState(""); // đơn vị nhập: base, g, kg, ml, l

  // Lấy thông tin sản phẩm được chọn
  const getSelectedProduct = (productId) => {
    const id = parseInt(productId, 10);
    return (storeProducts || []).find(p => (p.id ?? p.Id) === id);
  };
  const selectedProduct = getSelectedProduct(adjustProductId);
  const productUnit = selectedProduct?.unit ?? selectedProduct?.Unit ?? "";
  const conversionUnit = selectedProduct?.conversionUnit ?? selectedProduct?.ConversionUnit ?? "";
  const conversionRate = parseFloat(selectedProduct?.conversionRate ?? selectedProduct?.ConversionRate ?? 1) || 1;

  // Chuẩn hóa đơn vị: Gr = g (gam)
  const normalizedUnit = /^gr$/i.test(productUnit) ? "g" : productUnit;

  // Chỉ quy đổi với đơn vị g, kg, ml, l (Chai/Hộp/Bịt/Túi không quy đổi)
  const canConvert = /^(g|kg|ml|l)$/i.test(normalizedUnit);

  // Tính số lượng base từ đơn vị nhập
  const calcBaseQty = (inputQty, unit) => {
    const qty = parseFloat(inputQty) || 0;
    if (unit === "base" || !unit || !canConvert) return qty;
    if (/^l$/i.test(normalizedUnit)) {
      if (/^ml$/i.test(unit)) return qty;
      if (/^l$/i.test(unit)) return qty * 1000;
    }
    if (/^g$/i.test(normalizedUnit)) {
      if (/^g$/i.test(unit)) return qty;
      if (/^kg$/i.test(unit)) return qty * 1000;
    }
    return qty;
  };

  // Tồn kho tại NCC (chỉ SupplierUser)
  useEffect(() => {
    if (!useApi || !isSupplierUser) {
      setStock([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const list = await api.get("warehouse.supplierStock");
        if (!cancelled) setStock(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setStock([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [useApi, isSupplierUser]);

  // Tồn kho cửa hàng (Admin/StoreUser)
  useEffect(() => {
    if (!useApi || !(isAdmin || isStoreUser)) {
      setStoreStock([]);
      return;
    }
    let cancelled = false;
    setStoreStockLoading(true);
    const query = isStoreUser && currentUser?.storeId != null ? { storeId: currentUser.storeId } : {};
    api.get("warehouse.stock", { query })
      .then((list) => { if (!cancelled) setStoreStock(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) setStoreStock([]); })
      .finally(() => { if (!cancelled) setStoreStockLoading(false); });
    return () => { cancelled = true; };
  }, [useApi, isAdmin, isStoreUser, currentUser?.storeId]);

  // Lịch sử nhập/xuất (Admin/StoreUser)
  useEffect(() => {
    if (!useApi || !(isAdmin || isStoreUser)) {
      setTransactions([]);
      return;
    }
    let cancelled = false;
    setTransactionsLoading(true);
    const query = {};
    if (isStoreUser && currentUser?.storeId != null) query.storeId = currentUser.storeId;
    if (dateFrom) query.dateFrom = dateFrom;
    if (dateTo) query.dateTo = dateTo;
    api.get("warehouse.transactions", { query })
      .then((list) => { if (!cancelled) setTransactions(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) setTransactions([]); })
      .finally(() => { if (!cancelled) setTransactionsLoading(false); });
    return () => { cancelled = true; };
  }, [useApi, isAdmin, isStoreUser, currentUser?.storeId, dateFrom, dateTo]);

  // Danh sách sản phẩm cho Store điều chỉnh tồn
  useEffect(() => {
    if (!useApi || !(isAdmin || isStoreUser)) {
      setStoreProducts([]);
      return;
    }
    let cancelled = false;
    api.get("products.list")
      .then((list) => { if (!cancelled) setStoreProducts(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) setStoreProducts([]); });
    return () => { cancelled = true; };
  }, [useApi, isAdmin, isStoreUser]);

  // Danh sách sản phẩm NCC (để nhập tồn tay)
  useEffect(() => {
    if (!useApi || !isSupplierUser || !currentUser?.supplierId) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    setProductsLoading(true);
    api.get("products.list", { query: { supplierId: currentUser.supplierId } })
      .then((list) => { if (!cancelled) setProducts(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) setProducts([]); })
      .finally(() => { if (!cancelled) setProductsLoading(false); });
    return () => { cancelled = true; };
  }, [useApi, isSupplierUser, currentUser?.supplierId]);

  // Lịch sử nhập/xuất tồn kho NCC
  useEffect(() => {
    if (!useApi || !isSupplierUser) {
      setSupplierTransactions([]);
      return;
    }
    let cancelled = false;
    setSupplierTransactionsLoading(true);
    const query = {};
    if (supplierDateFrom) query.dateFrom = supplierDateFrom;
    if (supplierDateTo) query.dateTo = supplierDateTo;
    api.get("warehouse.supplierTransactions", { query })
      .then((list) => { if (!cancelled) setSupplierTransactions(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) setSupplierTransactions([]); })
      .finally(() => { if (!cancelled) setSupplierTransactionsLoading(false); });
    return () => { cancelled = true; };
  }, [useApi, isSupplierUser, supplierDateFrom, supplierDateTo]);

  const handleStoreAdjustSubmit = async (e) => {
    e.preventDefault();
    const productId = parseInt(adjustProductId, 10);
    const inputQty = parseFloat(adjustQuantity);
    if (!productId || isNaN(inputQty) || inputQty === 0) {
      showToast("Chọn sản phẩm và nhập số lượng (dương = thêm, âm = bớt).", "error");
      return;
    }
    const storeId = isStoreUser
      ? (currentUser?.storeId ?? currentUser?.StoreId)
      : parseInt(adjustStoreId, 10);
    if (!storeId) {
      showToast(isStoreUser ? "Không xác định được cửa hàng." : "Vui lòng chọn cửa hàng.", "error");
      return;
    }
    // Tính số lượng base (đơn vị gốc)
    const baseQty = calcBaseQty(inputQty, adjustUnit);
    setAdjustSubmitting(true);
    try {
      await api.post("warehouse.adjust", {
        productId,
        storeId: storeId || 0,
        quantityDelta: baseQty,
        note: adjustNote.trim() || undefined,
      });
      showToast("Đã điều chỉnh tồn kho.", "success");
      setAdjustQuantity("");
      setAdjustNote("");
      setAdjustUnit("");
      setAdjustModalOpen(false);
      const list = await api.get("warehouse.stock", { query: storeId ? { storeId } : {} });
      setStoreStock(Array.isArray(list) ? list : []);
      const txList = await api.get("warehouse.transactions", { query: storeId ? { storeId } : {} });
      setTransactions(Array.isArray(txList) ? txList : []);
    } catch (err) {
      const msg = err?.data?.message ?? err?.message ?? "Lỗi điều chỉnh tồn kho";
      showToast(typeof msg === "string" ? msg : "Lỗi điều chỉnh tồn kho", "error");
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const handleSupplierStockSubmit = async (e) => {
    e.preventDefault();
    const productId = parseInt(stockFormProductId, 10);
    const qty = parseFloat(stockFormQuantity);
    if (!productId || isNaN(qty)) {
      showToast("Chọn sản phẩm và nhập số lượng.", "error");
      return;
    }
    setStockFormSubmitting(true);
    try {
      await api.post("warehouse.updateSupplierStock", { productId, quantity: qty, setAbsolute: stockFormSetAbsolute });
      showToast("Đã cập nhật tồn kho.", "success");
      setStockFormQuantity("");
      setSupplierStockModalOpen(false);
      const list = await api.get("warehouse.supplierStock");
      setStock(Array.isArray(list) ? list : []);
      const txList = await api.get("warehouse.supplierTransactions");
      setSupplierTransactions(Array.isArray(txList) ? txList : []);
    } catch (err) {
      const msg = err?.data?.message ?? err?.message ?? "Lỗi cập nhật tồn kho";
      showToast(typeof msg === "string" ? msg : "Lỗi cập nhật tồn kho", "error");
    } finally {
      setStockFormSubmitting(false);
    }
  };

  const showSupplierStock = isSupplierUser;

  return (
    <div className="mt-12 w-full max-w-full min-w-0">
      <Typography variant="h5" color="blue-gray" className="mb-4 flex items-center gap-2">
        <ArchiveBoxIcon className="w-6 h-6" /> Kho
        {(warehouseId != null && (warehouseName || warehouseCode)) && (
          <span className="text-sm font-normal text-blue-gray-500 ml-2">
            — Đang xem: {warehouseName || warehouseCode}
          </span>
        )}
      </Typography>

      {(isAdmin || isStoreUser) && useApi && (
        <>
          <p className="hidden md:block text-sm text-blue-gray-500 mb-4">
            Khi bạn <strong>Xác nhận đã nhận hàng</strong> trên chi tiết đơn, tồn kho cửa hàng sẽ <strong>tự động cập nhật</strong>.
          </p>
          <Card className="border border-blue-gray-100 mb-6">
            <CardHeader className="p-4 border-b flex flex-row items-center justify-between flex-wrap gap-2">
              <Typography variant="h6">Tồn kho cửa hàng</Typography>
              <div className="flex items-center gap-2">
                {!isAdmin && (
                  <Button size="sm" color="blue" className="flex items-center gap-1" onClick={() => setAdjustModalOpen(true)}>
                    <PencilSquareIcon className="w-4 h-4" /> Cập nhật tồn
                  </Button>
                )}
                {storeStockLoading && <Typography variant="small" color="gray">Đang tải...</Typography>}
              </div>
            </CardHeader>
            <CardBody className="overflow-x-auto p-0">
              {/* Mobile: card list */}
              <div className="md:hidden divide-y divide-blue-gray-50">
                {storeStock.length === 0 && !storeStockLoading ? (
                  <div className="py-8 text-center px-4"><Typography color="gray">Chưa có tồn kho. Nhập kho từ đơn NCC để cập nhật.</Typography></div>
                ) : storeStock.map((row) => (
                  <div key={`${row.productId ?? row.ProductId}-${row.storeId ?? row.StoreId}`} className="p-4 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <Typography variant="small" className="font-semibold text-blue-gray-800">{row.productName ?? row.ProductName}</Typography>
                      <Typography variant="small" color="blue-gray" className="text-xs">{row.productCode ?? row.ProductCode}</Typography>
                    </div>
                    <Typography variant="small" color="blue-gray">
                      <span className="font-medium">SL:</span> {Number(row.quantity ?? row.Quantity ?? 0)} {row.unit ?? row.Unit ?? ""}
                    </Typography>
                    <Typography variant="small" color="blue-gray">
                      <span className="font-medium">Cửa hàng:</span> {row.storeName ?? row.StoreName}
                    </Typography>
                    <Typography variant="small" color="gray">
                      <span className="font-medium">Cập nhật:</span> {row.updatedAt ? new Date(row.updatedAt).toLocaleString("vi-VN") : (row.UpdatedAt ? new Date(row.UpdatedAt).toLocaleString("vi-VN") : "")}
                    </Typography>
                  </div>
                ))}
              </div>
              {/* Desktop: table */}
              <table className="hidden md:table w-full min-w-[500px] table-auto">
                <thead>
                  <tr>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Mã SP</Typography></th>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Tên sản phẩm</Typography></th>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Cửa hàng</Typography></th>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-right"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">SL</Typography></th>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-center"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">ĐVT</Typography></th>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Cập nhật</Typography></th>
                  </tr>
                </thead>
                <tbody>
                  {storeStock.length === 0 && !storeStockLoading ? (
                    <tr><td colSpan={6} className="py-8 text-center"><Typography color="gray">Chưa có tồn kho. Nhập kho từ đơn NCC để cập nhật.</Typography></td></tr>
                  ) : storeStock.map((row) => (
                    <tr key={`${row.productId ?? row.ProductId}-${row.storeId ?? row.StoreId}`} className="hover:bg-blue-gray-50/50 border-b border-blue-gray-50">
                      <td className="py-3 px-4"><Typography variant="small">{row.productCode ?? row.ProductCode}</Typography></td>
                      <td className="py-3 px-4"><Typography variant="small">{row.productName ?? row.ProductName}</Typography></td>
                      <td className="py-3 px-4"><Typography variant="small">{row.storeName ?? row.StoreName}</Typography></td>
                      <td className="py-3 px-4 text-right"><Typography variant="small" className="font-medium">{Number(row.quantity ?? row.Quantity ?? 0)}</Typography></td>
                      <td className="py-3 px-4 text-center"><Typography variant="small" color="blue-gray">{row.unit ?? row.Unit ?? ""}</Typography></td>
                      <td className="py-3 px-4"><Typography variant="small" color="gray">{row.updatedAt ? new Date(row.updatedAt).toLocaleString("vi-VN") : (row.UpdatedAt ? new Date(row.UpdatedAt).toLocaleString("vi-VN") : "")}</Typography></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
          <Card className="border border-blue-gray-100 mb-6">
            <CardHeader className="p-4 border-b flex flex-col gap-3 md:flex-row md:items-center md:justify-between flex-wrap">
              <Typography variant="h6">Lịch sử nhập/xuất kho</Typography>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <input type="date" value={dateFrom} onChange={(e) => setFilter("dateFrom", e.target.value)} className="rounded border border-blue-gray-200 px-2 py-1 text-sm" />
                <span className="text-gray-500 hidden md:inline">–</span>
                <input type="date" value={dateTo} onChange={(e) => setFilter("dateTo", e.target.value)} className="rounded border border-blue-gray-200 px-2 py-1 text-sm" />
              </div>
            </CardHeader>
            <CardBody className="overflow-x-auto p-0">
              {transactionsLoading && <div className="p-4 text-center"><Typography color="gray">Đang tải...</Typography></div>}
              {!transactionsLoading && (
                <>
                  {/* Mobile: card list */}
                  <div className="md:hidden divide-y divide-blue-gray-50">
                    {transactions.length === 0 ? (
                      <div className="py-8 text-center px-4"><Typography color="gray">Chưa có giao dịch.</Typography></div>
                    ) : transactions.map((t) => (
                      <div key={t.id ?? t.Id} className="p-4 flex flex-col gap-1">
                        <Typography variant="small" className="font-semibold text-blue-gray-800">{t.productName ?? t.ProductName}</Typography>
                        <Typography variant="small" color="blue-gray">
                          <span className="font-medium">Loại:</span> {t.transactionType ?? t.TransactionType ?? ""} &nbsp;|&nbsp; <span className="font-medium">SL:</span> {t.quantityDelta ?? t.QuantityDelta ?? 0} {t.unit ?? t.Unit ?? ""}
                        </Typography>
                        <Typography variant="small" color="gray">
                          <span className="font-medium">Ghi chú:</span> {(t.note ?? t.Note) || "—"}
                        </Typography>
                        <Typography variant="small" color="gray">
                          <span className="font-medium">Ngày:</span> {t.createdAt ? new Date(t.createdAt).toLocaleString("vi-VN") : (t.CreatedAt ? new Date(t.CreatedAt).toLocaleString("vi-VN") : "")}
                        </Typography>
                      </div>
                    ))}
                  </div>
                  {/* Desktop: table */}
                  <table className="hidden md:table w-full min-w-[600px] table-auto">
                    <thead>
                      <tr>
                        <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Sản phẩm</Typography></th>
                        <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Loại</Typography></th>
                        <th className="border-b border-blue-gray-50 py-3 px-4 text-right"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">SL</Typography></th>
                        <th className="border-b border-blue-gray-50 py-3 px-4 text-center"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">ĐVT</Typography></th>
                        <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Ghi chú</Typography></th>
                        <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Ngày</Typography></th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 ? (
                        <tr><td colSpan={6} className="py-8 text-center"><Typography color="gray">Chưa có giao dịch.</Typography></td></tr>
                      ) : transactions.map((t) => (
                        <tr key={t.id ?? t.Id} className="hover:bg-blue-gray-50/50 border-b border-blue-gray-50">
                          <td className="py-3 px-4"><Typography variant="small">{t.productName ?? t.ProductName}</Typography></td>
                          <td className="py-3 px-4"><Typography variant="small">{t.transactionType ?? t.TransactionType ?? ""}</Typography></td>
                          <td className="py-3 px-4 text-right"><Typography variant="small">{t.quantityDelta ?? t.QuantityDelta ?? 0}</Typography></td>
                          <td className="py-3 px-4 text-center"><Typography variant="small" color="blue-gray">{t.unit ?? t.Unit ?? ""}</Typography></td>
                          <td className="py-3 px-4"><Typography variant="small" color="gray">{(t.note ?? t.Note) || "—"}</Typography></td>
                          <td className="py-3 px-4"><Typography variant="small">{t.createdAt ? new Date(t.createdAt).toLocaleString("vi-VN") : (t.CreatedAt ? new Date(t.CreatedAt).toLocaleString("vi-VN") : "")}</Typography></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </CardBody>
          </Card>

          {adjustModalOpen && (
            <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/50 p-4" style={{ WebkitOverflowScrolling: "touch" }} onClick={() => !adjustSubmitting && setAdjustModalOpen(false)}>
              <div className="flex min-h-full items-end justify-center sm:items-center">
              <Card className="w-full max-w-lg max-h-[min(92dvh,100%)] flex flex-col overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
                <CardHeader className="p-4 border-b flex flex-row items-center justify-between shrink-0">
                  <Typography variant="h6" className="flex items-center gap-2">
                    <PencilSquareIcon className="w-5 h-5" /> Điều chỉnh tồn kho (thêm / bớt)
                  </Typography>
                  <Button variant="text" size="sm" onClick={() => setAdjustModalOpen(false)} disabled={adjustSubmitting}>Đóng</Button>
                </CardHeader>
                <CardBody className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4" style={{ WebkitOverflowScrolling: "touch" }}>
                  <form onSubmit={handleStoreAdjustSubmit} className="flex flex-col gap-4">
                    {isAdmin && (
                      <div>
                        <label className="block text-sm font-medium text-blue-gray-700 mb-1">Cửa hàng</label>
                        <select
                          value={adjustStoreId}
                          onChange={(e) => setAdjustStoreId(e.target.value)}
                          className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm"
                          required={isAdmin}
                        >
                          <option value="">-- Chọn cửa hàng --</option>
                          {(stores || []).map((s) => (
                            <option key={s.id ?? s.Id} value={s.id ?? s.Id}>{s.name ?? s.Name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-blue-gray-700 mb-1">Sản phẩm</label>
                      <select
                        value={adjustProductId}
                        onChange={(e) => { setAdjustProductId(e.target.value); setAdjustQuantity(""); setAdjustUnit(""); }}
                        className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm"
                        required
                      >
                        <option value="">-- Chọn sản phẩm --</option>
                        {(storeProducts || []).map((p) => (
                          <option key={p.id ?? p.Id} value={p.id ?? p.Id}>
                            {p.code ?? p.Code} – {p.name ?? p.Name} {p.unit ? `(${p.unit})` : ""}
                          </option>
                        ))}
                      </select>
                      {selectedProduct && (
                        <p className="text-xs text-blue-gray-500 mt-1">
                          Quy đổi: {conversionUnit || productUnit} = {conversionRate} {productUnit}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-gray-700 mb-1">
                        Số lượng (+ thêm, − bớt) {adjustUnit && adjustUnit !== "base" ? `(${adjustUnit})` : `(base: ${productUnit || conversionUnit || "sp"})`}
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="any"
                          value={adjustQuantity}
                          onChange={(e) => setAdjustQuantity(e.target.value)}
                          placeholder="VD: 5 hoặc -3"
                          className="!border-blue-gray-200 flex-1"
                          required
                        />
                        {canConvert && (
                          <select
                            value={adjustUnit || "base"}
                            onChange={(e) => setAdjustUnit(e.target.value)}
                            className="rounded border border-blue-gray-200 px-2 py-2 text-sm w-20"
                          >
                            <option value="base">{normalizedUnit}</option>
                            {/^ml$/i.test(normalizedUnit) && <option value="l">l</option>}
                            {/^l$/i.test(normalizedUnit) && <option value="ml">ml</option>}
                            {/^g$/i.test(normalizedUnit) && <option value="kg">kg</option>}
                            {/^kg$/i.test(normalizedUnit) && <option value="g">g</option>}
                          </select>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-gray-700 mb-1">Ghi chú (tùy chọn)</label>
                      <Input
                        value={adjustNote}
                        onChange={(e) => setAdjustNote(e.target.value)}
                        placeholder="VD: Kiểm kê, hao hụt..."
                        className="!border-blue-gray-200"
                      />
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <Button variant="outlined" size="sm" onClick={() => setAdjustModalOpen(false)} disabled={adjustSubmitting}>Hủy</Button>
                      <Button type="submit" size="sm" color="blue" disabled={adjustSubmitting}>
                        {adjustSubmitting ? "Đang lưu..." : "Cập nhật tồn"}
                      </Button>
                    </div>
                    <p className="text-xs text-blue-gray-500 mt-2 border-t pt-2">
                      Muốn thêm <strong>sản phẩm mới</strong> vào danh mục? Admin thêm tại menu <strong>Sản phẩm</strong>; NCC thêm sản phẩm của mình tại menu <strong>Sản phẩm</strong>. <strong>NCC mới</strong> do Admin thêm tại menu <strong>Nhà cung cấp</strong>.
                    </p>
                  </form>
                </CardBody>
              </Card>
              </div>
            </div>
          )}
        </>
      )}

      {showSupplierStock && (
        <>
          <p className="text-sm text-blue-gray-500 mb-4">
            Tồn kho sản phẩm tại NCC của bạn. Bấm <strong>Cập nhật tồn</strong> để thêm/sửa số lượng. Khi giao đơn (Delivered) hệ thống tự trừ tồn.
          </p>
          <Card className="border border-blue-gray-100">
            <CardHeader className="p-4 border-b flex flex-row items-center justify-between flex-wrap gap-2">
              <Typography variant="h6">Tồn kho theo sản phẩm</Typography>
              <div className="flex items-center gap-2">
                <Button size="sm" color="blue" className="flex items-center gap-1" onClick={() => setSupplierStockModalOpen(true)}>
                  <PlusCircleIcon className="w-4 h-4" /> Cập nhật tồn
                </Button>
                {loading && <Typography variant="small" color="gray">Đang tải...</Typography>}
              </div>
            </CardHeader>
            <CardBody className="overflow-x-auto p-0">
              {/* Mobile: card list */}
              <div className="md:hidden divide-y divide-blue-gray-50">
                {stock.length === 0 ? (
                  <div className="py-8 text-center px-4"><Typography color="gray">Chưa có dữ liệu tồn kho.</Typography></div>
                ) : stock.map((row) => (
                  <div key={`${row.supplierId ?? row.SupplierId}-${row.productId ?? row.ProductId}`} className="p-4 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <Typography variant="small" className="font-semibold text-blue-gray-800">{row.productName ?? row.ProductName}</Typography>
                      <Typography variant="small" color="blue-gray" className="text-xs">{row.productCode ?? row.ProductCode}</Typography>
                    </div>
                    <Typography variant="small" color="blue-gray">
                      <span className="font-medium">Số lượng:</span> {Number(row.quantity ?? row.Quantity ?? 0)}
                    </Typography>
                    <Typography variant="small" color="gray">
                      <span className="font-medium">Cập nhật:</span> {row.updatedAt ? new Date(row.updatedAt).toLocaleString("vi-VN") : (row.UpdatedAt ? new Date(row.UpdatedAt).toLocaleString("vi-VN") : "")}
                    </Typography>
                  </div>
                ))}
              </div>
              {/* Desktop: table */}
              <table className="hidden md:table w-full min-w-[500px] table-auto">
                <thead>
                  <tr>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Mã SP</Typography></th>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Tên sản phẩm</Typography></th>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-right"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Số lượng</Typography></th>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Cập nhật</Typography></th>
                  </tr>
                </thead>
                <tbody>
                  {stock.length === 0 ? (
                    <tr><td colSpan={4} className="py-8 text-center"><Typography color="gray">Chưa có dữ liệu tồn kho.</Typography></td></tr>
                  ) : stock.map((row) => (
                    <tr key={`${row.supplierId ?? row.SupplierId}-${row.productId ?? row.ProductId}`} className="hover:bg-blue-gray-50/50">
                      <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.productCode ?? row.ProductCode}</Typography></td>
                      <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.productName ?? row.ProductName}</Typography></td>
                      <td className="py-3 px-4 border-b border-blue-gray-50 text-right"><Typography variant="small" className="font-medium">{Number(row.quantity ?? row.Quantity ?? 0)}</Typography></td>
                      <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small" color="gray">{row.updatedAt ? new Date(row.updatedAt).toLocaleString("vi-VN") : (row.UpdatedAt ? new Date(row.UpdatedAt).toLocaleString("vi-VN") : "")}</Typography></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
          <Card className="border border-blue-gray-100 mt-6">
            <CardHeader className="p-4 border-b flex flex-col gap-3 md:flex-row md:items-center md:justify-between flex-wrap">
              <Typography variant="h6">Lịch sử nhập/xuất kho</Typography>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <input type="date" value={supplierDateFrom} onChange={(e) => setFilter("sDateFrom", e.target.value)} className="rounded border border-blue-gray-200 px-2 py-1 text-sm" />
                <span className="text-gray-500 hidden md:inline">–</span>
                <input type="date" value={supplierDateTo} onChange={(e) => setFilter("sDateTo", e.target.value)} className="rounded border border-blue-gray-200 px-2 py-1 text-sm" />
              </div>
            </CardHeader>
            <CardBody className="overflow-x-auto p-0">
              {supplierTransactionsLoading && <div className="p-4 text-center"><Typography color="gray">Đang tải...</Typography></div>}
              {!supplierTransactionsLoading && (
                <>
                  {/* Mobile: card list */}
                  <div className="md:hidden divide-y divide-blue-gray-50">
                    {supplierTransactions.length === 0 ? (
                      <div className="py-8 text-center px-4"><Typography color="gray">Chưa có giao dịch.</Typography></div>
                    ) : supplierTransactions.map((t) => (
                      <div key={t.id ?? t.Id} className="p-4 flex flex-col gap-1">
                        <Typography variant="small" className="font-semibold text-blue-gray-800">{t.productName ?? t.ProductName}</Typography>
                        <Typography variant="small" color="blue-gray">
                          <span className="font-medium">Loại:</span> {t.transactionType ?? t.TransactionType ?? ""} &nbsp;|&nbsp; <span className="font-medium">SL:</span> {t.quantityDelta ?? t.QuantityDelta ?? 0} {t.unit ?? t.Unit ?? ""}
                        </Typography>
                        <Typography variant="small" color="gray">
                          <span className="font-medium">Ghi chú:</span> {(t.note ?? t.Note) || "—"}
                        </Typography>
                        <Typography variant="small" color="gray">
                          <span className="font-medium">Ngày:</span> {t.createdAt ? new Date(t.createdAt).toLocaleString("vi-VN") : (t.CreatedAt ? new Date(t.CreatedAt).toLocaleString("vi-VN") : "")}
                        </Typography>
                      </div>
                    ))}
                  </div>
                  {/* Desktop: table */}
                  <table className="hidden md:table w-full min-w-[600px] table-auto">
                    <thead>
                      <tr>
                        <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Sản phẩm</Typography></th>
                        <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Loại</Typography></th>
                        <th className="border-b border-blue-gray-50 py-3 px-4 text-right"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">SL</Typography></th>
                        <th className="border-b border-blue-gray-50 py-3 px-4 text-center"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">ĐVT</Typography></th>
                        <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Ghi chú</Typography></th>
                        <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Ngày</Typography></th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierTransactions.length === 0 ? (
                        <tr><td colSpan={6} className="py-8 text-center"><Typography color="gray">Chưa có giao dịch.</Typography></td></tr>
                      ) : supplierTransactions.map((t) => (
                        <tr key={t.id ?? t.Id} className="hover:bg-blue-gray-50/50 border-b border-blue-gray-50">
                          <td className="py-3 px-4"><Typography variant="small">{t.productName ?? t.ProductName}</Typography></td>
                          <td className="py-3 px-4"><Typography variant="small">{t.transactionType ?? t.TransactionType ?? ""}</Typography></td>
                          <td className="py-3 px-4 text-right"><Typography variant="small">{t.quantityDelta ?? t.QuantityDelta ?? 0}</Typography></td>
                          <td className="py-3 px-4 text-center"><Typography variant="small" color="blue-gray">{t.unit ?? t.Unit ?? ""}</Typography></td>
                          <td className="py-3 px-4"><Typography variant="small" color="gray">{(t.note ?? t.Note) || "—"}</Typography></td>
                          <td className="py-3 px-4"><Typography variant="small">{t.createdAt ? new Date(t.createdAt).toLocaleString("vi-VN") : (t.CreatedAt ? new Date(t.CreatedAt).toLocaleString("vi-VN") : "")}</Typography></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </CardBody>
          </Card>

          {supplierStockModalOpen && (
            <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/50 p-4" style={{ WebkitOverflowScrolling: "touch" }} onClick={() => !stockFormSubmitting && setSupplierStockModalOpen(false)}>
              <div className="flex min-h-full items-end justify-center sm:items-center">
              <Card className="w-full max-w-lg max-h-[min(92dvh,100%)] flex flex-col overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
                <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
                  <Typography variant="h6" className="flex items-center gap-2">
                    <PlusCircleIcon className="w-5 h-5" /> Nhập tồn kho tay (NCC)
                  </Typography>
                  <Button variant="text" size="sm" onClick={() => setSupplierStockModalOpen(false)} disabled={stockFormSubmitting}>Đóng</Button>
                </CardHeader>
                <CardBody className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4" style={{ WebkitOverflowScrolling: "touch" }}>
                  <form onSubmit={handleSupplierStockSubmit} className="flex flex-col gap-4">
                    <div>
                      <label className="block text-sm font-medium text-blue-gray-700 mb-1">Sản phẩm</label>
                      <select
                        value={stockFormProductId}
                        onChange={(e) => setStockFormProductId(e.target.value)}
                        className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm"
                        required
                      >
                        <option value="">-- Chọn sản phẩm --</option>
                        {products.map((p) => (
                          <option key={p.id ?? p.Id} value={p.id ?? p.Id}>{p.code ?? p.Code} – {p.name ?? p.Name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-gray-700 mb-1">Số lượng</label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={stockFormQuantity}
                        onChange={(e) => setStockFormQuantity(e.target.value)}
                        placeholder="0"
                        className="!border-blue-gray-200"
                        required
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={stockFormSetAbsolute}
                        onChange={(e) => setStockFormSetAbsolute(e.target.checked)}
                        className="rounded border-blue-gray-300"
                      />
                      <span className="text-sm">Set tuyệt đối (thay vì cộng thêm)</span>
                    </label>
                    <div className="flex gap-2 justify-end pt-2">
                      <Button variant="outlined" size="sm" onClick={() => setSupplierStockModalOpen(false)} disabled={stockFormSubmitting}>Hủy</Button>
                      <Button type="submit" size="sm" color="blue" disabled={stockFormSubmitting || productsLoading}>
                        {stockFormSubmitting ? "Đang lưu..." : "Cập nhật tồn"}
                      </Button>
                    </div>
                    <p className="text-xs text-blue-gray-500 mt-2 border-t pt-2">Thêm sản phẩm mới tại menu Sản phẩm (chỉ sửa được sản phẩm của NCC bạn).</p>
                  </form>
                </CardBody>
              </Card>
              </div>
            </div>
          )}
        </>
      )}

      {!showSupplierStock && !(isAdmin || isStoreUser) && (
        <p className="text-sm text-blue-gray-500">Bạn không có quyền xem mục này.</p>
      )}
    </div>
  );
}

export default Warehouse;
