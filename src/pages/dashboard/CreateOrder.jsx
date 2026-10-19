import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, Typography, Button, Input, IconButton } from "@material-tailwind/react";
import { FilterSelect } from "@/components/FilterSelect";
import { PlusIcon, TrashIcon, XMarkIcon, CheckCircleIcon, ShoppingCartIcon } from "@heroicons/react/24/solid";
import { useData } from "@/context/DataContext";
import { useAuth, useToast } from "@/context";
import api from "@/api";

const QUICK_INPUT_UNITS = {
  "ml": { bigUnit: "L", rate: 1000 },
  "gr": { bigUnit: "kg", rate: 1000 },
  "cm": { bigUnit: "m", rate: 100 },
};

function getConversionInfo(product) {
  // Chỉ dùng conversionUnit từ Product nếu bigUnit KHÁC unit gốc và có rate hợp lệ
  if (
    product.conversionUnit &&
    product.conversionRate &&
    product.conversionRate > 1 &&
    product.conversionUnit.toLowerCase().trim() !== (product.unit || "").toLowerCase().trim()
  ) {
    return { bigUnit: product.conversionUnit, rate: product.conversionRate };
  }
  // Không fallback QUICK_INPUT_UNITS nữa — chỉ dùng quy đổi do admin cài đặt
  return null;
}

export function CreateOrder() {
  const { products, suppliers, orders, setOrders, stores, useApi, refetchOrders } = useData();
  const { currentUser, isAdmin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [cartOpen, setCartOpen] = useState(false); // mobile cart drawer

  useEffect(() => {
    if (isAdmin) navigate("/dashboard/home", { replace: true });
  }, [isAdmin, navigate]);
  if (isAdmin) return null;

  const [search, setSearch] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [cart, setCart] = useState([]);

  const filteredProducts = useMemo(() => products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.code && p.code.toLowerCase().includes(search.toLowerCase()));
    const matchSup = !filterSupplier || p.supplierId === Number(filterSupplier);
    return p.status === "Active" && matchSearch && matchSup;
  }), [products, search, filterSupplier]);

  const addToCart = (p) => {
    const sup = suppliers.find((s) => s.id === p.supplierId);
    const convInfo = getConversionInfo(p);
    const existing = cart.find((c) => c.productId === p.id);
    // Nếu có quy đổi → mặc định nhập theo đơn vị lớn (bigUnit), không cho toggle
    const useQuickInput = !!(convInfo);
    if (existing) {
      setCart(cart.map((c) => c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { productId: p.id, productName: p.name, supplierId: p.supplierId, supplierName: sup?.name || "", quantity: 1, unit: p.unit, price: p.price, convInfo, useQuickInput }]);
    }
  };

  const updateQty = (productId, delta) =>
    setCart(cart.map((c) => c.productId === productId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter((c) => c.quantity > 0));

  const setQty = (productId, val) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) setCart(cart.map((c) => c.productId === productId ? { ...c, quantity: num } : c));
  };

  const removeFromCart = (productId) => setCart(cart.filter((c) => c.productId !== productId));

  // Khi đặt hàng: lưu theo đơn vị order (Unit lớn = Chai, Hộp...)
  // convInfo chỉ dùng để hiển thị thông tin tham khảo, không quy đổi khi lưu đơn
  const getActualQty = (item) => item.quantity;
  // luôn hiện đơn vị order (Unit lớn)
  const getDisplayUnit = (item) => item.unit;

  const effectiveStoreId = isAdmin ? Number(selectedStoreId) || null : currentUser?.storeId;
  const store = stores.find((s) => s.id === effectiveStoreId);

  const cartBySupplier = useMemo(() => {
    const map = {};
    cart.forEach((c) => { if (!map[c.supplierId]) map[c.supplierId] = { supplierName: c.supplierName, items: [] }; map[c.supplierId].items.push(c); });
    return Object.values(map);
  }, [cart]);

  const totalAmt = cart.reduce((s, c) => s + getActualQty(c) * Number(c.price || 0), 0);

  const doSubmit = async () => {
    if (cart.length === 0) { showToast("Chưa có sản phẩm.", "error"); return; }
    const storeIdToUse = effectiveStoreId ?? currentUser?.storeId;
    if (!storeIdToUse) { showToast("Không xác định được cửa hàng.", "error"); return; }
    const supplierIds = [...new Set(cart.map((c) => c.supplierId))];
    const payload = supplierIds.map((supId) => ({
      supplierId: supId,
      orderItems: cart.filter((c) => c.supplierId === supId).map((it) => ({
        productId: it.productId, productName: it.productName,
        quantity: getActualQty(it), unit: it.unit, price: it.price,
      })),
    }));
    if (useApi) {
      setSubmitting(true);
      try {
        await api.post("orders.create", { storeId: Number(storeIdToUse), orderSuppliers: payload });
        await refetchOrders();
        setCart([]); setConfirmModal(false); setCartOpen(false);
        showToast("Tạo đơn thành công!", "success");
        navigate("/dashboard/orders");
      } catch (e) {
        showToast(e?.data?.message || e?.message || "Lỗi tạo đơn", "error");
      } finally { setSubmitting(false); }
      return;
    }
    const newId = Math.max(0, ...orders.map((o) => o.id)) + 1;
    setOrders([...orders, { id: newId, storeId: storeIdToUse, storeName: store?.name || "", status: "Pending", orderDate: new Date().toISOString().slice(0, 10), orderSuppliers: supplierIds.map((supId) => ({ id: newId * 100 + supId, orderId: newId, supplierId: supId, supplierName: suppliers.find((s) => s.id === supId)?.name || "", status: "Pending", orderItems: cart.filter((c) => c.supplierId === supId).map((it, i) => ({ id: newId * 1000 + supId * 10 + i, productId: it.productId, productName: it.productName, quantity: getActualQty(it), unit: it.unit, price: it.price })) })) }]);
    setCart([]); setConfirmModal(false); setCartOpen(false);
    showToast("Tạo đơn thành công!", "success");
    navigate("/dashboard/orders");
  };

  return (
    <div className="mt-4 md:mt-8 pb-24 lg:pb-4">

      {/* ── Tiêu đề + chọn cửa hàng (Admin) ── */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <Typography variant="h5" color="blue-gray" className="text-base md:text-xl">
          Tạo đơn {store ? `— ${store.name}` : ""}
        </Typography>
        {isAdmin && (
          <div className="w-full sm:w-56">
            <FilterSelect label="Cửa hàng" value={selectedStoreId} onChange={setSelectedStoreId}
              options={stores.map((s) => ({ value: String(s.id), label: s.name }))} placeholder="-- Chọn cửa hàng --" />
          </div>
        )}
      </div>

      {/* ── Search + Filter compact ── */}
      <div className="flex items-center gap-1.5 mb-3">
        {/* Search */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            placeholder="🔍 Tìm sản phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-blue-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        {/* Filter NCC — compact select */}
        <select
          value={filterSupplier}
          onChange={(e) => setFilterSupplier(e.target.value)}
          className="rounded-lg border border-blue-gray-200 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 max-w-[110px] truncate"
        >
          <option value="">Tất cả NCC</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {/* Xóa lọc */}
        {(search || filterSupplier) && (
          <button onClick={() => { setSearch(""); setFilterSupplier(""); }}
            className="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Layout: mobile = 1 cột, desktop = 2 cột ── */}
      <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-4">

        {/* ── Danh sách sản phẩm ── */}
        <div className="bg-white rounded-xl border border-blue-gray-100 overflow-hidden">
          {(search || filterSupplier) && (
            <div className="px-3 py-1.5 bg-blue-gray-50 text-xs text-gray-500 border-b border-blue-gray-100">
              {filteredProducts.length} sản phẩm
            </div>
          )}
          <div className="divide-y divide-blue-gray-50 max-h-[60vh] lg:max-h-[480px] overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">Không tìm thấy sản phẩm</div>
            ) : filteredProducts.map((p) => {
              const convInfo = getConversionInfo(p);
              const inCart = cart.find((c) => c.productId === p.id);
              return (
                <div key={p.id} className={`flex items-center gap-2 px-3 py-2.5 ${inCart ? "bg-blue-50/60" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-blue-gray-800 leading-tight">{p.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {convInfo
                        ? <span className="text-blue-600 font-medium">1 {p.unit} = {convInfo.rate} {convInfo.bigUnit}</span>
                        : <span>{p.unit}</span>
                      }
                      <span className="mx-1 text-gray-300">·</span>
                      <span>{Number(p.price).toLocaleString("vi-VN")} đ</span>
                    </div>
                  </div>
                  {/* Nếu đã có trong giỏ: hiện -/qty/+ ngay tại đây */}
                  {inCart ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => updateQty(p.id, -1)}
                        className="w-8 h-8 rounded-full bg-blue-gray-100 text-blue-gray-700 flex items-center justify-center text-base font-bold hover:bg-red-100 hover:text-red-600">−</button>
                      <input
                        type="number"
                        min="0"
                        value={inCart.quantity}
                        onChange={(e) => setQty(p.id, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-14 h-8 border-2 border-blue-400 rounded-lg text-center text-sm font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      <button onClick={() => addToCart(p)}
                        className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700">
                        <PlusIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(p)}
                      className="w-8 h-8 rounded-full bg-blue-gray-100 text-blue-gray-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors shrink-0">
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Giỏ đơn — desktop: cột phải, mobile: ẩn (dùng drawer) ── */}
        <div className="hidden lg:flex flex-col bg-white rounded-xl border border-blue-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-blue-gray-100 flex items-center justify-between">
            <Typography variant="h6" className="text-sm">Giỏ đơn ({cart.length} SP)</Typography>
            {cart.length > 0 && (
              <Button size="sm" color="blue" onClick={() => setConfirmModal(true)}>Đặt đơn →</Button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto max-h-[480px] divide-y divide-blue-gray-50">
            {cart.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">Chưa có sản phẩm</div>
            ) : cart.map((c) => (
              <div key={c.productId} className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-1 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm leading-tight truncate">{c.productName}</div>
                    <span className="text-xs bg-blue-gray-100 text-blue-gray-600 px-1.5 py-0.5 rounded">{c.supplierName}</span>
                  </div>
                  <IconButton variant="text" size="sm" color="red" onClick={() => removeFromCart(c.productId)} className="-mt-0.5 -mr-1">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </IconButton>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outlined" className="px-2 py-0.5 min-w-[28px] text-xs" onClick={() => updateQty(c.productId, -1)}>−</Button>
                  <input type="number" min="0" step={c.useQuickInput ? "0.1" : "1"} value={c.quantity}
                    onChange={(e) => setQty(c.productId, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="border-2 border-blue-300 rounded-lg px-1.5 py-0.5 text-sm font-bold text-center w-16 focus:outline-none focus:ring-2 focus:ring-blue-500 text-blue-700" />
                  <span className="text-xs text-blue-gray-500">{getDisplayUnit(c)}</span>
                  <Button size="sm" variant="outlined" className="px-2 py-0.5 min-w-[28px] text-xs" onClick={() => updateQty(c.productId, 1)}>+</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile: Sticky bottom bar ── */}
      {cart.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-30 lg:hidden px-3 pb-2">
          <button onClick={() => setCartOpen(true)}
            className="w-full bg-blue-600 text-white rounded-xl py-3 flex items-center justify-between px-4 shadow-lg">
            <div className="flex items-center gap-2">
              <ShoppingCartIcon className="h-5 w-5" />
              <span className="font-semibold">{cart.length} sản phẩm</span>
            </div>
            <span className="font-bold">Xem giỏ đơn →</span>
          </button>
        </div>
      )}

      {/* ── Mobile: Cart Drawer (bottom sheet) ── */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 flex max-h-[min(88dvh,100%)] flex-col overflow-hidden rounded-t-2xl bg-white" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-blue-gray-100 shrink-0">
              <Typography variant="h6">Giỏ đơn ({cart.length} SP)</Typography>
              <button onClick={() => setCartOpen(false)} className="p-1.5 rounded-full hover:bg-blue-gray-50">
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="min-h-0 flex-1 divide-y divide-blue-gray-50 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
              {cart.map((c) => (
                <div key={c.productId} className="flex items-center gap-2 px-3 py-2.5">
                  {/* Tên + NCC */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm leading-tight truncate">{c.productName}</div>
                    <span className="text-xs text-blue-gray-400">{c.supplierName}</span>
                  </div>
                  {/* -  input  unit  + */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => updateQty(c.productId, -1)}
                      className="w-8 h-8 rounded-full bg-blue-gray-100 flex items-center justify-center text-base font-bold hover:bg-red-100 hover:text-red-600">−</button>
                    <input
                      type="number" min="0"
                      value={c.quantity}
                      onChange={(e) => setQty(c.productId, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-14 h-8 border-2 border-blue-400 rounded-lg text-center text-sm font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <span className="text-xs text-blue-gray-500 min-w-[24px]">{getDisplayUnit(c)}</span>
                    <button onClick={() => updateQty(c.productId, 1)}
                      className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700">
                      <PlusIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Xóa */}
                  <button onClick={() => removeFromCart(c.productId)}
                    className="shrink-0 p-1.5 text-red-400 hover:text-red-600">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-blue-gray-100 shrink-0">
              <Button color="blue" fullWidth onClick={() => { setCartOpen(false); setConfirmModal(true); }}>
                Đặt đơn ({cart.length} SP) →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal xác nhận ── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-xl shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-blue-gray-100 shrink-0">
              <div>
                <Typography variant="h6" color="blue-gray">Xác nhận đơn hàng</Typography>
                {store && <Typography variant="small" color="gray">{store.name}</Typography>}
              </div>
              <button onClick={() => setConfirmModal(false)} className="p-1.5 rounded-full hover:bg-blue-gray-50">
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 flex flex-col gap-4">
              {cartBySupplier.map((group, gi) => (
                <div key={gi}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase text-blue-gray-500 tracking-wide">{group.supplierName}</span>
                    <div className="flex-1 h-px bg-blue-gray-100" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {group.items.map((c) => {
                      const actualQty = getActualQty(c);
                      const displayQty = c.quantity;
                      const displayUnit = getDisplayUnit(c);
                      const total = actualQty * Number(c.price || 0);
                      return (
                        <div key={c.productId} className="flex items-center justify-between text-sm">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-blue-gray-800">{c.productName}</span>
                          </div>
                          <div className="shrink-0 text-right ml-3">
                            <span className="font-semibold">{displayQty} {displayUnit}</span>
                            {c.useQuickInput && c.convInfo && (
                              <div className="text-xs text-gray-400">= {actualQty} {c.unit}</div>
                            )}
                            {total > 0 && <div className="text-xs text-gray-500">{total.toLocaleString("vi-VN")} đ</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {totalAmt > 0 && (
                <div className="border-t border-blue-gray-100 pt-3 flex justify-between items-center">
                  <span className="font-semibold text-blue-gray-700">Tổng tiền dự kiến</span>
                  <span className="font-bold text-blue-600 text-base">{totalAmt.toLocaleString("vi-VN")} đ</span>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-blue-gray-100 flex gap-3 shrink-0 bg-gray-50 rounded-b-2xl sm:rounded-b-xl">
              <Button variant="outlined" color="blue-gray" fullWidth onClick={() => setConfirmModal(false)} disabled={submitting}>Quay lại</Button>
              <Button color="blue" fullWidth onClick={doSubmit} disabled={submitting} className="flex items-center justify-center gap-2">
                <CheckCircleIcon className="h-4 w-4" />
                {submitting ? "Đang gửi..." : "Xác nhận đặt đơn"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateOrder;
