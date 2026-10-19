import React, { useState, useEffect } from "react";
import { useUrlFilters } from "@/utils/urlFilters";

const PRODUCT_FILTER_DEFAULTS = { q: "", supplier: "", status: "" };
import { Card, CardHeader, CardBody, Typography, Button, Input, IconButton, Chip, Select, Option } from "@material-tailwind/react";
import { FilterSelect } from "@/components/FilterSelect";
import { PencilIcon, TrashIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { useData } from "@/context/DataContext";
import { useAuth, useToast } from "@/context";
import api from "@/api";

const normProduct = (p) => ({
  id: p?.id ?? p?.Id,
  code: p?.code ?? p?.Code,
  name: p?.name ?? p?.Name,
  supplierId: p?.supplierId ?? p?.SupplierId,
  supplierName: p?.supplierName ?? p?.SupplierName,
  categoryId: p?.categoryId ?? p?.CategoryId,
  unit: p?.unit ?? p?.Unit,
  description: p?.description ?? p?.Description ?? "",
  tkKho: p?.tkKho ?? p?.TkKho ?? "",
  conversionUnit: p?.conversionUnit ?? p?.ConversionUnit ?? "",
  conversionRate: p?.conversionRate ?? p?.ConversionRate ?? null,
  conversionOperation: p?.conversionOperation ?? p?.ConversionOperation ?? "",
  price: p?.price ?? p?.Price ?? 0,
  price1: p?.price1 ?? p?.Price1 ?? null,
  price2: p?.price2 ?? p?.Price2 ?? null,
  price3: p?.price3 ?? p?.Price3 ?? null,
  priceFixed: p?.priceFixed ?? p?.PriceFixed ?? null,
  status: p?.status ?? p?.Status,
  sortOrder: p?.sortOrder ?? p?.SortOrder ?? null,
});

export function Products() {
  const { products, setProducts, suppliers, useApi, refetchProducts, apiLoading, apiError } = useData();
  const { showToast } = useToast();
  const { isSupplierUser, currentUser } = useAuth();
  const mySupplierId = currentUser?.supplierId ?? currentUser?.SupplierId;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    code: "", name: "", supplierId: 1, categoryId: null, unit: "cái",
    description: "", tkKho: "", conversionUnit: "", conversionRate: null, conversionOperation: "",
    price: 0, price1: null, price2: null, price3: null, priceFixed: null, status: "Active", sortOrder: null
  });
  const { values, setFilter, clearFilters } = useUrlFilters(PRODUCT_FILTER_DEFAULTS);
  const filterSearch = values.q;
  const filterSupplier = values.supplier;
  const filterStatus = values.status;
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingSortOrder, setEditingSortOrder] = useState(null);

  // ── Tồn kho NCC (chỉ SupplierUser) ──
  const [supplierStock, setSupplierStock] = useState({}); // { productId: quantity }
  const [editingStock, setEditingStock] = useState(null); // { productId, value }
  const [savingStock, setSavingStock] = useState(false);

  useEffect(() => {
    if (!isSupplierUser || !useApi) return;
    api.get("warehouse.supplierStock")
      .then((list) => {
        const map = {};
        (Array.isArray(list) ? list : []).forEach((s) => { map[s.productId ?? s.ProductId] = s.quantity ?? s.Quantity ?? 0; });
        setSupplierStock(map);
      })
      .catch(() => {});
  }, [isSupplierUser, useApi]);

  const saveStockQuick = async (productId, value) => {
    const qty = parseFloat(value);
    if (isNaN(qty) || qty < 0) return;
    setSavingStock(true);
    try {
      await api.post("warehouse.updateSupplierStock", { productId, quantity: qty, setAbsolute: true });
      setSupplierStock((prev) => ({ ...prev, [productId]: qty }));
      showToast(`✅ Đã cập nhật tồn kho: ${qty}`, "success");
    } catch (e) {
      showToast(e?.data?.message || e?.message || "Lỗi cập nhật tồn kho", "error");
    } finally {
      setSavingStock(false);
      setEditingStock(null);
    }
  }; // { id, value }

  // Lưu SortOrder nhanh không cần mở form
  const saveSortOrderQuick = async (productId, value) => {
    const product = products.find((p) => (p.id ?? p.Id) === productId);
    if (!product) return;
    const norm = normProduct(product);
    const newSortOrder = value === "" ? null : Number(value);
    if (useApi) {
      try {
        const body = {
          code: norm.code, name: norm.name, supplierId: norm.supplierId, categoryId: norm.categoryId ?? null,
          unit: norm.unit, description: norm.description || null, tkKho: norm.tkKho || null,
          conversionUnit: norm.conversionUnit || null, conversionRate: norm.conversionRate ?? null,
          conversionOperation: norm.conversionOperation || null,
          price: norm.price, price1: norm.price1 ?? null, price2: norm.price2 ?? null,
          price3: norm.price3 ?? null, priceFixed: norm.priceFixed ?? null,
          status: norm.status, sortOrder: newSortOrder,
        };
        await api.put("products.update", body, { params: { id: productId } });
        setProducts((prev) => prev.map((p) => (p.id ?? p.Id) === productId ? { ...p, sortOrder: newSortOrder, SortOrder: newSortOrder } : p));
        showToast(`🚩 Đã cập nhật ưu tiên: ${newSortOrder ?? "bỏ"}`, "success");
      } catch (e) {
        showToast(e?.data?.message || e?.message || "Lỗi cập nhật ưu tiên", "error");
      }
    } else {
      setProducts((prev) => prev.map((p) => (p.id ?? p.Id) === productId ? { ...p, sortOrder: newSortOrder } : p));
    }
    setEditingSortOrder(null);
  };

  const filteredProducts = products.map(normProduct).filter((p) => {
    if (isSupplierUser && mySupplierId != null && p.supplierId !== mySupplierId) return false;
    const matchSearch = !filterSearch || [p.code, p.name].some((v) => String(v || "").toLowerCase().includes(filterSearch.toLowerCase()));
    const matchSup = !filterSupplier || p.supplierId === Number(filterSupplier);
    const matchStatus = !filterStatus || p.status === filterStatus;
    return matchSearch && matchSup && matchStatus;
  });

  // Tự sinh mã tiếp theo: lấy từ API hoặc tính local
  const generateNextCode = async () => {
    if (useApi) {
      try {
        const res = await api.get("products.nextCode");
        return res?.nextCode ?? "";
      } catch (_) {}
    }
    // Fallback: tính local
    const nums = products.map((p) => parseInt((p.code ?? p.Code) || "0", 10)).filter((n) => !isNaN(n));
    return String((nums.length > 0 ? Math.max(...nums) : 0) + 1);
  };

  const openAdd = async () => {
    setEditing(null);
    const supplierId = isSupplierUser && mySupplierId != null ? mySupplierId : (suppliers[0]?.id ?? suppliers[0]?.Id ?? 1);
    const nextCode = await generateNextCode();
    setForm({ code: nextCode, name: "", supplierId, categoryId: null, unit: "cái", description: "", tkKho: "", conversionUnit: "", conversionRate: null, conversionOperation: "", price: 0, price1: null, price2: null, price3: null, priceFixed: null, status: "Active", sortOrder: null });
    setOpen(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({ ...row, sortOrder: row.sortOrder ?? null });
    setOpen(true);
  };
  const handleSave = async () => {
    if (useApi) {
      setSaving(true);
      try {
        const body = {
          code: form.code, name: form.name, supplierId: form.supplierId, categoryId: form.categoryId ?? null, unit: form.unit,
          description: form.description || null, tkKho: form.tkKho || null,
          conversionUnit: form.conversionUnit || null, conversionRate: form.conversionRate ?? null, conversionOperation: form.conversionOperation || null,
          price: form.price, price1: form.price1 ?? null, price2: form.price2 ?? null, price3: form.price3 ?? null, priceFixed: form.priceFixed ?? null,
          status: form.status, sortOrder: form.sortOrder != null ? Number(form.sortOrder) : null
        };
        const id = editing?.id ?? editing?.Id;
        if (editing) {
          const updated = await api.put("products.update", body, { params: { id } });
          const u = normProduct(updated ?? {});
          if (u.id != null) setProducts((prev) => prev.map((p) => ((p.id ?? p.Id) === id ? { ...p, ...u } : p)));
        } else {
          const created = await api.post("products.create", body);
          const newId = created?.id ?? created?.Id;
          if (newId != null) setProducts((prev) => [...prev, { ...normProduct(created ?? {}), id: newId }]);
          else await refetchProducts();
        }
        setOpen(false);
        try { await refetchProducts(); } catch (_) {}
      } catch (e) {
        // Hiện lỗi chi tiết từ BE
        const msg = e?.data?.message || e?.data?.title || e?.message || "Lỗi lưu sản phẩm";
        showToast(typeof msg === "string" ? msg : JSON.stringify(msg), "error");
      } finally {
        setSaving(false);
      }
      return;
    }
    const supName = suppliers.find((s) => s.id === form.supplierId)?.name;
    if (editing) {
      setProducts(products.map((p) => (p.id === editing.id ? { ...editing, ...form, supplierName: supName } : p)));
    } else {
      const newId = Math.max(0, ...products.map((p) => p.id)) + 1;
      setProducts([...products, { id: newId, ...form, supplierName: supName }]);
    }
    setOpen(false);
  };
  const handleDelete = async (id) => {
    if (!window.confirm("Xóa sản phẩm này? (tồn kho và dòng đơn liên quan cũng bị gỡ)")) return;
    if (useApi) {
      setSaving(true);
      try {
        await api.del("products.delete", { params: { id } });
        setProducts((prev) => prev.filter((p) => (p.id ?? p.Id) !== id));
        try { await refetchProducts(); } catch (_) {}
        showToast("Đã xóa sản phẩm.", "success");
      } catch (e) {
        const msg = e?.data?.message || e?.message || "Lỗi xóa sản phẩm";
        showToast(typeof msg === "string" ? msg : "Lỗi xóa sản phẩm", "error");
      } finally {
        setSaving(false);
      }
      return;
    }
    setProducts(products.filter((p) => p.id !== id));
  };
  const handleRefresh = async () => {
    if (!useApi) return;
    setRefreshing(true);
    try { await refetchProducts(); } catch (e) { showToast(e.message || "Lỗi tải sản phẩm", "error"); }
    finally { setRefreshing(false); }
  };

  return (
    <div className="mt-12">
      <Card className="border border-blue-gray-100">
        <CardHeader className="p-4 border-b">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <Typography variant="h6" color="blue-gray">Sản phẩm</Typography>
              <div className="flex items-center gap-2">
                {useApi && products.length === 0 && !apiLoading && (
                  <Button size="sm" variant="outlined" onClick={handleRefresh} disabled={refreshing}>{refreshing ? "Đang tải..." : "Tải lại"}</Button>
                )}
                <Button size="sm" className="flex items-center gap-1" onClick={openAdd}>
                  <PlusIcon className="w-4 h-4" /> Thêm
                </Button>
              </div>
            </div>
            {apiError && <Typography variant="small" color="red" className="mb-1 block">{apiError}</Typography>}
            <div className="flex items-center gap-1.5 mb-1">
              <input
                type="text"
                placeholder="🔍 Tìm mã, tên..."
                value={filterSearch}
                onChange={(e) => setFilter("q", e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-blue-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {!isSupplierUser && (
                <select
                  value={filterSupplier}
                  onChange={(e) => setFilter("supplier", e.target.value)}
                  className="rounded-lg border border-blue-gray-200 bg-white px-2 py-2 text-sm focus:outline-none max-w-[110px]"
                >
                  <option value="">NCC</option>
                  {suppliers.map((s) => {
                    const sid = s.id ?? s.Id;
                    return <option key={sid} value={String(sid)}>{s.name ?? s.Name}</option>;
                  })}
                </select>
              )}
              <select
                value={filterStatus}
                onChange={(e) => setFilter("status", e.target.value)}
                className="rounded-lg border border-blue-gray-200 bg-white px-2 py-2 text-sm focus:outline-none max-w-[90px]"
              >
                <option value="">Tất cả</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              {(filterSearch || filterSupplier || filterStatus) && (
                <button
                  onClick={() => clearFilters()}
                  className="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 shrink-0"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          {/* Desktop table */}
          <table className="hidden md:table w-full min-w-[1100px] table-auto">
            <thead>
              <tr>
                {["Mã", "Tên", "NCC", "Đơn vị", "TK Kho", "Quy đổi", "Mô tả", "Giá", "Giá 1", "Giá 2", "Giá 3", "Giá CĐ", "Trạng thái", ...(isSupplierUser ? ["📦 Tồn kho"] : ["🚩 Ưu tiên"]), "Thao tác"].map((el) => (
                  <th key={el} className="border-b border-blue-gray-50 py-3 px-4 text-left whitespace-nowrap" title={el === "Quy đổi" ? "1 ĐV lớn = ? ĐV nhỏ" : el}>
                    <Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">{el}</Typography>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.code}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.name}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.supplierName ?? suppliers.find((s) => (s.id ?? s.Id) === row.supplierId)?.name ?? row.supplierId}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.unit}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.tkKho || "—"}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50 whitespace-nowrap" title={`Quy đổi: 1 ${row.unit || 'ĐV lớn'} = ${row.conversionRate || '?'} ${row.conversionUnit || 'ĐV nhỏ'}`}><Typography variant="small" color="blue-gray">{row.conversionUnit && row.conversionRate != null && row.conversionRate > 1 ? `1 ${row.unit} = ${row.conversionRate} ${row.conversionUnit}` : (row.conversionUnit || "—")}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50 max-w-[100px] truncate" title={row.description}><Typography variant="small">{row.description || "—"}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{Number(row.price || 0).toLocaleString("vi-VN")} đ</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.price1 != null ? Number(row.price1).toLocaleString("vi-VN") : "—"}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.price2 != null ? Number(row.price2).toLocaleString("vi-VN") : "—"}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.price3 != null ? Number(row.price3).toLocaleString("vi-VN") : "—"}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.priceFixed != null ? Number(row.priceFixed).toLocaleString("vi-VN") : "—"}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Chip size="sm" color={row.status === "Active" ? "green" : "gray"} value={row.status} /></td>
                  {/* Tồn kho (SupplierUser) hoặc Ưu tiên (Admin) */}
                  {isSupplierUser ? (
                    <td className="py-3 px-4 border-b border-blue-gray-50 text-center">
                      {editingStock?.productId === row.id ? (
                        <input
                          type="number" min="0" autoFocus
                          className="w-16 rounded border border-blue-400 px-1.5 py-0.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                          value={editingStock.value}
                          onChange={(e) => setEditingStock({ productId: row.id, value: e.target.value })}
                          onBlur={() => saveStockQuick(row.id, editingStock.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveStockQuick(row.id, editingStock.value);
                            if (e.key === "Escape") setEditingStock(null);
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => setEditingStock({ productId: row.id, value: supplierStock[row.id] ?? 0 })}
                          className="group inline-flex items-center gap-1"
                          title="Click để cập nhật tồn kho"
                        >
                          <span className={`text-sm font-semibold ${(supplierStock[row.id] ?? 0) > 0 ? "text-green-600" : "text-gray-400"} group-hover:text-blue-600`}>
                            {supplierStock[row.id] ?? 0} {row.unit}
                          </span>
                        </button>
                      )}
                    </td>
                  ) : (
                    <td className="py-3 px-4 border-b border-blue-gray-50 text-center">
                      {editingSortOrder?.id === row.id ? (
                        <input
                          type="number" min="1" autoFocus
                          className="w-14 rounded border border-orange-300 px-1.5 py-0.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
                          value={editingSortOrder.value}
                          onChange={(e) => setEditingSortOrder({ id: row.id, value: e.target.value })}
                          onBlur={() => saveSortOrderQuick(row.id, editingSortOrder.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveSortOrderQuick(row.id, editingSortOrder.value);
                            if (e.key === "Escape") setEditingSortOrder(null);
                          }}
                        />
                      ) : (
                        <button onClick={() => setEditingSortOrder({ id: row.id, value: row.sortOrder ?? "" })} className="group inline-flex items-center gap-1" title="Click để đặt số ưu tiên">
                          {row.sortOrder != null
                            ? <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full group-hover:bg-orange-100">🚩 {row.sortOrder}</span>
                            : <span className="text-gray-300 text-xs group-hover:text-orange-400 group-hover:font-medium">+ đặt</span>}
                        </button>
                      )}
                    </td>
                  )}
                  <td className="py-3 px-4 border-b border-blue-gray-50 flex gap-1">
                    <IconButton variant="text" size="sm" onClick={() => openEdit(row)}><PencilIcon className="w-4 h-4" /></IconButton>
                    <IconButton variant="text" size="sm" color="red" onClick={() => handleDelete(row.id)}><TrashIcon className="w-4 h-4" /></IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-blue-gray-50">
            {filteredProducts.map((row, idx) => {
              const supName = row.supplierName ?? suppliers.find((s) => (s.id ?? s.Id) === row.supplierId)?.name ?? row.supplierId;
              const convText = row.conversionUnit && row.conversionRate != null && row.conversionRate > 1
                ? `1 ${row.unit} = ${row.conversionRate} ${row.conversionUnit}`
                : null;
              return (
                <div key={row.id} className={`p-3 ${idx % 2 === 0 ? "bg-white" : "bg-blue-gray-50/40"}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Typography variant="small" className="font-semibold text-blue-gray-800 leading-tight">{row.name}</Typography>
                    <Chip size="sm" color={row.status === "Active" ? "green" : "gray"} value={row.status} />
                  </div>
                  <Typography variant="small" color="blue-gray" className="text-xs mb-0.5">
                    Mã: {row.code || "—"} | ĐVT: {row.unit || "—"} | Giá: {Number(row.price || 0).toLocaleString("vi-VN")} đ
                  </Typography>
                  <Typography variant="small" color="blue-gray" className="text-xs mb-0.5">
                    NCC: {supName || "—"}{convText ? ` | Quy đổi: ${convText}` : ""}
                  </Typography>
                  {row.sortOrder != null && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full w-fit">🚩 Ưu tiên: {row.sortOrder}</span>
                  )}
                  {isSupplierUser && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">📦 Tồn kho:</span>
                      {editingStock?.productId === row.id ? (
                        <input
                          type="number" min="0" autoFocus
                          className="w-16 rounded border border-blue-400 px-1.5 py-0.5 text-sm text-center focus:outline-none"
                          value={editingStock.value}
                          onChange={(e) => setEditingStock({ productId: row.id, value: e.target.value })}
                          onBlur={() => saveStockQuick(row.id, editingStock.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveStockQuick(row.id, editingStock.value); if (e.key === "Escape") setEditingStock(null); }}
                        />
                      ) : (
                        <button onClick={() => setEditingStock({ productId: row.id, value: supplierStock[row.id] ?? 0 })}
                          className={`text-sm font-semibold ${(supplierStock[row.id] ?? 0) > 0 ? "text-green-600" : "text-gray-400"} hover:text-blue-600`}>
                          {supplierStock[row.id] ?? 0} {row.unit}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex gap-1 mt-2">
                    <IconButton variant="text" size="sm" onClick={() => openEdit(row)}><PencilIcon className="w-4 h-4" /></IconButton>
                    <IconButton variant="text" size="sm" color="red" onClick={() => handleDelete(row.id)}><TrashIcon className="w-4 h-4" /></IconButton>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/40" style={{ WebkitOverflowScrolling: "touch" }} onClick={() => setOpen(false)}>
          <div className="flex min-h-[100dvh] min-h-[100vh] items-end justify-center p-0 sm:items-center sm:p-4">
          <Card className="w-full max-w-md max-h-[min(92dvh,100%)] flex flex-col rounded-t-2xl sm:max-h-[90vh] sm:rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-2 shrink-0">{editing ? "Sửa Sản phẩm" : "Thêm Sản phẩm"}</CardHeader>
            <CardBody className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-4" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-blue-gray-700">Mã</label>
                <input className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-blue-gray-700">Tên</label>
                <input className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              {isSupplierUser ? (
                <Typography variant="small" color="gray">Sản phẩm thuộc NCC của bạn (không đổi được).</Typography>
              ) : (
                <FilterSelect
                  label="Nhà cung cấp"
                  value={String(form.supplierId)}
                  onChange={(v) => setForm({ ...form, supplierId: Number(v) })}
                  options={suppliers.map((s) => { const sid = s.id ?? s.Id; return { value: String(sid), label: s.name ?? s.Name }; })}
                  placeholder="-- Chọn NCC --"
                />
              )}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-blue-gray-700">Đơn vị</label>
                <input
                  list="unit-options"
                  className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="Chọn hoặc gõ đơn vị..."
                />
                <datalist id="unit-options">
                  {["cái", "kg", "gr", "L", "ml", "m", "cm", "Túi", "Bích", "Thùng", "chai", "hộp", "lon", "gói", "bộ", "đôi", "tấm", "cuộn"].map(u => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-blue-gray-700">TK Kho</label>
                <input className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="VD: 1561" value={form.tkKho || ""} onChange={(e) => setForm({ ...form, tkKho: e.target.value })} />
              </div>
              <Typography variant="small" className="font-medium text-blue-gray-600">Quy đổi đơn vị (nếu có)</Typography>
              <div className="bg-blue-gray-50 rounded p-2 text-xs text-blue-gray-600">
                Quy đổi: <strong>1 {form.unit || "ĐV lớn"}</strong> = <strong>{form.conversionRate ?? "?"} {form.conversionUnit || "ĐV nhỏ"}</strong>
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <label className="text-sm font-medium text-blue-gray-700">Đơn vị quy đổi</label>
                  <input
                    list="conv-unit-options"
                    className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="VD: Thùng, Túi, Bích..."
                    value={form.conversionUnit || ""}
                    onChange={(e) => setForm({ ...form, conversionUnit: e.target.value })}
                  />
                  <datalist id="conv-unit-options">
                    {["Thùng", "Túi", "Bích", "kg", "gr", "L", "ml", "chai", "hộp", "lon", "gói", "cái"].map(u => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
                <div className="w-28 flex flex-col gap-1">
                  <label className="text-sm font-medium text-blue-gray-700">Tỷ lệ</label>
                  <input type="number" className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="VD: 10" value={form.conversionRate ?? ""} onChange={(e) => setForm({ ...form, conversionRate: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
                <div className="w-28 flex flex-col gap-1">
                  <label className="text-sm font-medium text-blue-gray-700">Phép tính</label>
                  <select className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={form.conversionOperation || ""} onChange={(e) => setForm({ ...form, conversionOperation: e.target.value })}>
                    <option value="">—</option>
                    <option value="Nhân">Nhân</option>
                    <option value="Chia">Chia</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-blue-gray-700">Mô tả</label>
                <input className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Mô tả hàng hóa/dịch vụ" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <Typography variant="small" className="font-medium text-blue-gray-600">Đơn giá</Typography>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-blue-gray-700">Giá (mặc định)</label>
                  <input type="number" className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.price ?? ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-blue-gray-700">Đơn giá bán 1</label>
                  <input type="number" className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.price1 ?? ""} onChange={(e) => setForm({ ...form, price1: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-blue-gray-700">Đơn giá bán 2</label>
                  <input type="number" className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.price2 ?? ""} onChange={(e) => setForm({ ...form, price2: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-blue-gray-700">Đơn giá bán 3</label>
                  <input type="number" className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.price3 ?? ""} onChange={(e) => setForm({ ...form, price3: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-sm font-medium text-blue-gray-700">Đơn giá cố định</label>
                  <input type="number" className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.priceFixed ?? ""} onChange={(e) => setForm({ ...form, priceFixed: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-blue-gray-700">Trạng thái</label>
                <select className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-blue-gray-700">🚩 Số ưu tiên kiểm kho</label>
                <input
                  type="number"
                  min="1"
                  placeholder="VD: 1, 2, 3... (để trống = không ưu tiên)"
                  className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.sortOrder ?? ""}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value === "" ? null : Number(e.target.value) })}
                />
                <span className="text-xs text-gray-400">Số nhỏ = ưu tiên cao hơn. Để trống = hiện sau cùng.</span>
              </div>
            </CardBody>
            <div className="flex shrink-0 gap-2 justify-end border-t border-blue-gray-50 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
              <Button variant="outlined" onClick={() => setOpen(false)}>Hủy</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
            </div>
          </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default Products;
