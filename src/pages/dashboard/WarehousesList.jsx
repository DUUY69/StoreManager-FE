import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardBody, Typography, Button, Input, IconButton, Chip, Select, Option } from "@material-tailwind/react";
import { PencilIcon, TrashIcon, PlusIcon, EyeIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { useToast } from "@/context";
import { useAuth } from "@/context/AuthContext";
import api from "@/api";
import { useData } from "@/context/DataContext";
import { useUrlFilters } from "@/utils/urlFilters";

const WAREHOUSE_LIST_FILTER_DEFAULTS = { q: "", status: "" };

export function WarehousesList() {
  const { isAdmin } = useAuth();
  const { suppliers = [] } = useData();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: "", name: "", status: "Active", supplierId: null });
  const [saving, setSaving] = useState(false);
  const { values, setFilter, clearFilters } = useUrlFilters(WAREHOUSE_LIST_FILTER_DEFAULTS);
  const filterSearch = values.q;
  const filterStatus = values.status;
  const { showToast } = useToast();
  const navigate = useNavigate();

  const fetchList = async () => {
    if (!api.USE_API) return;
    setLoading(true);
    try {
      const data = await api.get("warehouses.list", { query: { status: filterStatus || undefined } });
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast(e.message || "Lỗi tải danh sách kho", "error");
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [filterStatus]);

  const norm = (w) => ({
    id: w?.id ?? w?.Id,
    code: w?.code ?? w?.Code,
    name: w?.name ?? w?.Name,
    status: w?.status ?? w?.Status,
    supplierId: w?.supplierId ?? w?.SupplierId ?? null,
    supplierName: w?.supplierName ?? w?.SupplierName ?? null,
  });
  const filtered = list.map(norm).filter((w) => {
    const matchSearch = !filterSearch || [w.code, w.name].some((v) => String(v || "").toLowerCase().includes(filterSearch.toLowerCase()));
    return matchSearch;
  });

  const openAdd = () => {
    setEditing(null);
    setForm({ code: "", name: "", status: "Active", supplierId: null });
    setOpen(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({ code: row.code, name: row.name, status: row.status || "Active", supplierId: row.supplierId ?? null });
    setOpen(true);
  };
  const handleSave = async () => {
    if (!api.USE_API) return;
    setSaving(true);
    try {
      const id = editing?.id ?? editing?.Id;
      const payload = { code: form.code, name: form.name, status: form.status, supplierId: form.supplierId || null };
      if (editing) {
        await api.put("warehouses.update", payload, { params: { id } });
        setList((prev) => prev.map((w) => ((w.id ?? w.Id) === id ? { ...norm(w), ...form } : w)));
      } else {
        const created = await api.post("warehouses.create", payload);
        const newId = created?.id ?? created?.Id;
        if (newId != null) setList((prev) => [...prev, { id: newId, ...form }]);
        else await fetchList();
      }
      setOpen(false);
      await fetchList();
    } catch (e) {
      showToast(e.message || "Lỗi lưu kho", "error");
    } finally {
      setSaving(false);
    }
  };
  const handleView = (row) => {
    navigate("/dashboard/warehouse", { state: { warehouseId: row.id, warehouseName: row.name, warehouseCode: row.code } });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Xóa kho này?")) return;
    setSaving(true);
    try {
      await api.del("warehouses.delete", { params: { id } });
      setList((prev) => prev.filter((w) => (w.id ?? w.Id) !== id));
      await fetchList();
    } catch (e) {
      showToast(e.message || "Lỗi xóa kho", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-12">
      <Card className="border border-blue-gray-100">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 p-4 border-b">
          <Typography variant="h6" color="blue-gray">Danh sách Kho</Typography>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outlined" onClick={fetchList} disabled={loading}>{loading ? "Đang tải..." : "Tải lại"}</Button>
            {!isAdmin && (
              <Button size="sm" className="flex items-center gap-1" onClick={openAdd}>
                <PlusIcon className="w-4 h-4" /> Thêm
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1.5 w-full mt-2">
            <input
              type="text"
              placeholder="🔍 Tìm mã, tên kho..."
              value={filterSearch}
              onChange={(e) => setFilter("q", e.target.value)}
              className="flex-1 min-w-0 rounded-lg border border-blue-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilter("status", e.target.value)}
              className="rounded-lg border border-blue-gray-200 bg-white px-2 py-2 text-sm focus:outline-none max-w-[110px]"
            >
              <option value="">Tất cả</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Đang sử dụng">Đang dùng</option>
            </select>
            {(filterSearch || filterStatus) && (
              <button
                onClick={() => clearFilters()}
                className="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 shrink-0"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[500px] table-auto">
            <thead>
              <tr>
                {["Mã kho", "Tên kho", "NCC quản lý", "Trạng thái", "Thao tác"].map((el) => (
                  <th key={el} className="border-b border-blue-gray-50 py-3 px-4 text-left">
                    <Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">{el}</Typography>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-500">Đang tải...</td></tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.code}</Typography></td>
                    <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.name}</Typography></td>
                    <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.supplierName || "—"}</Typography></td>
                    <td className="py-3 px-4 border-b border-blue-gray-50"><Chip size="sm" color={row.status === "Active" || row.status === "Đang sử dụng" ? "green" : "gray"} value={row.status} /></td>
                    <td className="py-3 px-4 border-b border-blue-gray-50 flex gap-1 items-center">
                      <IconButton variant="text" size="sm" onClick={() => handleView(row)} title="Xem giao diện kho"><EyeIcon className="w-4 h-4" /></IconButton>
                      {!isAdmin && (
                        <>
                          <IconButton variant="text" size="sm" onClick={() => openEdit(row)}><PencilIcon className="w-4 h-4" /></IconButton>
                          <IconButton variant="text" size="sm" color="red" onClick={() => handleDelete(row.id)}><TrashIcon className="w-4 h-4" /></IconButton>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-md max-h-[95vh] sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-2 shrink-0">{editing ? "Sửa Kho" : "Thêm Kho"}</CardHeader>
            <CardBody className="flex flex-col gap-3 overflow-y-auto flex-1 px-4 pb-4">
              <Input label="Mã kho" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              <Input label="Tên kho" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Select
                label="NCC quản lý kho"
                value={form.supplierId != null ? String(form.supplierId) : ""}
                onChange={(v) => setForm({ ...form, supplierId: v ? parseInt(v, 10) : null })}
              >
                <Option value="">— Không chọn —</Option>
                {(suppliers || []).map((s) => (
                  <Option key={s.id ?? s.Id} value={String(s.id ?? s.Id)}>{s.name ?? s.Name ?? s.code ?? s.Code}</Option>
                ))}
              </Select>
              <Select label="Trạng thái" value={form.status} onChange={(v) => setForm({ ...form, status: v })}>
                <Option value="Active">Active</Option>
                <Option value="Đang sử dụng">Đang sử dụng</Option>
                <Option value="Inactive">Inactive</Option>
              </Select>
            </CardBody>
            <div className="shrink-0 px-4 pb-4 pt-2 border-t border-blue-gray-50 bg-white flex gap-2 justify-end">
              <Button variant="outlined" onClick={() => setOpen(false)} disabled={saving}>Hủy</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default WarehousesList;
