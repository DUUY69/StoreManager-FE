import React, { useState } from "react";
import { Card, CardHeader, CardBody, Typography, Button, Input, IconButton, Chip, Select, Option } from "@material-tailwind/react";
import { FilterSelect } from "@/components/FilterSelect";
import { PencilIcon, TrashIcon, PlusIcon, FunnelIcon } from "@heroicons/react/24/solid";
import { useData } from "@/context/DataContext";
import { useToast } from "@/context";
import api from "@/api";

const normProduct = (p) => ({ id: p?.id ?? p?.Id, code: p?.code ?? p?.Code, name: p?.name ?? p?.Name, supplierId: p?.supplierId ?? p?.SupplierId, categoryId: p?.categoryId ?? p?.CategoryId, unit: p?.unit ?? p?.Unit, price: p?.price ?? p?.Price, status: p?.status ?? p?.Status });

export function Products() {
  const { products, setProducts, suppliers, categories, useApi, refetchProducts, apiLoading, apiError } = useData();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: "", name: "", supplierId: 1, categoryId: 1, unit: "cái", price: 0, status: "Active" });
  const [filterSearch, setFilterSearch] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filteredProducts = products.map(normProduct).filter((p) => {
    const matchSearch = !filterSearch || [p.code, p.name].some((v) => String(v || "").toLowerCase().includes(filterSearch.toLowerCase()));
    const matchSup = !filterSupplier || p.supplierId === Number(filterSupplier);
    const matchCat = !filterCategory || p.categoryId === Number(filterCategory);
    const matchStatus = !filterStatus || p.status === filterStatus;
    return matchSearch && matchSup && matchCat && matchStatus;
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ code: "", name: "", supplierId: suppliers[0]?.id ?? suppliers[0]?.Id ?? 1, categoryId: categories[0]?.id ?? categories[0]?.Id ?? 1, unit: "cái", price: 0, status: "Active" });
    setOpen(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({ ...row });
    setOpen(true);
  };
  const handleSave = async () => {
    if (useApi) {
      setSaving(true);
      try {
        const body = { code: form.code, name: form.name, supplierId: form.supplierId, categoryId: form.categoryId, unit: form.unit, price: form.price, status: form.status };
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
        showToast(e.message || "Lỗi lưu sản phẩm", "error");
      } finally {
        setSaving(false);
      }
      return;
    }
    const supName = suppliers.find((s) => s.id === form.supplierId)?.name;
    const catName = categories.find((c) => c.id === form.categoryId)?.name;
    if (editing) {
      setProducts(products.map((p) => (p.id === editing.id ? { ...editing, ...form, supplierName: supName, categoryName: catName } : p)));
    } else {
      const newId = Math.max(0, ...products.map((p) => p.id)) + 1;
      setProducts([...products, { id: newId, ...form, supplierName: supName, categoryName: catName }]);
    }
    setOpen(false);
  };
  const handleDelete = async (id) => {
    if (!window.confirm("Xóa sản phẩm này?")) return;
    if (useApi) {
      setSaving(true);
      try {
        await api.del("products.delete", { params: { id } });
        setProducts((prev) => prev.filter((p) => (p.id ?? p.Id) !== id));
        try { await refetchProducts(); } catch (_) {}
      } catch (e) {
        showToast(e.message || "Lỗi xóa sản phẩm", "error");
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
            <div className="flex flex-row flex-wrap items-center justify-between gap-2">
              <Typography variant="h6" color="blue-gray">Quản lý Sản phẩm</Typography>
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
            <div className="flex flex-row flex-wrap items-end gap-4 w-full">
              <div className="flex items-center gap-1 text-blue-gray-500 shrink-0">
                <FunnelIcon className="w-4 h-4" />
                <Typography variant="small" className="font-medium">Bộ lọc:</Typography>
              </div>
              <div className="w-[180px] shrink-0">
                <Input placeholder="Tìm mã, tên..." value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} className="!min-w-0" />
              </div>
              <div className="w-[180px] shrink-0">
                <FilterSelect label="NCC" value={filterSupplier} onChange={setFilterSupplier} options={suppliers.map((s) => ({ value: String(s.id ?? s.Id), label: s.name ?? s.Name }))} placeholder="Tất cả" />
              </div>
              <div className="w-[160px] shrink-0">
                <FilterSelect label="Danh mục" value={filterCategory} onChange={setFilterCategory} options={categories.map((c) => ({ value: String(c.id ?? c.Id), label: c.name ?? c.Name }))} placeholder="Tất cả" />
              </div>
              <div className="w-[120px] shrink-0">
                <FilterSelect label="Trạng thái" value={filterStatus} onChange={setFilterStatus} options={[{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]} placeholder="Tất cả" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] table-auto">
            <thead>
              <tr>
                {["Mã", "Tên", "NCC", "Danh mục", "Đơn vị", "Giá", "Trạng thái", "Thao tác"].map((el) => (
                  <th key={el} className="border-b border-blue-gray-50 py-3 px-4 text-left">
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
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{suppliers.find((s) => (s.id ?? s.Id) === row.supplierId)?.name || row.supplierId}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{categories.find((c) => (c.id ?? c.Id) === row.categoryId)?.name || row.categoryId}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.unit}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{Number(row.price).toLocaleString("vi-VN")} đ</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Chip size="sm" color={row.status === "Active" ? "green" : "gray"} value={row.status} /></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50 flex gap-1">
                    <IconButton variant="text" size="sm" onClick={() => openEdit(row)}><PencilIcon className="w-4 h-4" /></IconButton>
                    <IconButton variant="text" size="sm" color="red" onClick={() => handleDelete(row.id)}><TrashIcon className="w-4 h-4" /></IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-2">{editing ? "Sửa Sản phẩm" : "Thêm Sản phẩm"}</CardHeader>
            <CardBody className="flex flex-col gap-3">
              <Input label="Mã" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              <Input label="Tên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Select label="Nhà cung cấp" value={String(form.supplierId)} onChange={(v) => setForm({ ...form, supplierId: Number(v) })}>
                {suppliers.map((s) => { const sid = s.id ?? s.Id; return (<Option key={sid} value={String(sid)}>{s.name ?? s.Name}</Option>); })}
              </Select>
              <Select label="Danh mục" value={String(form.categoryId)} onChange={(v) => setForm({ ...form, categoryId: Number(v) })}>
                {categories.map((c) => { const cid = c.id ?? c.Id; return (<Option key={cid} value={String(cid)}>{c.name ?? c.Name}</Option>); })}
              </Select>
              <Input label="Đơn vị" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              <Input type="number" label="Giá" value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })} />
              <Select label="Trạng thái" value={form.status} onChange={(v) => setForm({ ...form, status: v })}>
                <Option value="Active">Active</Option>
                <Option value="Inactive">Inactive</Option>
              </Select>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outlined" onClick={() => setOpen(false)}>Hủy</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

export default Products;
