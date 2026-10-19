import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardBody, Typography, Button, Input, IconButton, Chip, Select, Option } from "@material-tailwind/react";
import { PencilIcon, TrashIcon, PlusIcon, XMarkIcon, ClipboardDocumentListIcon } from "@heroicons/react/24/solid";
import { useData } from "@/context/DataContext";
import { useToast } from "@/context";
import api from "@/api";
import { useUrlFilters } from "@/utils/urlFilters";

const SUPPLIER_FILTER_DEFAULTS = { q: "", status: "" };

export function Suppliers() {
  const { suppliers, setSuppliers, useApi, refetchSuppliers, apiLoading, apiError } = useData();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: "", name: "", contact: "", email: "", address: "", status: "Active" });
  const { values, setFilter, clearFilters } = useUrlFilters(SUPPLIER_FILTER_DEFAULTS);
  const filterSearch = values.q;
  const filterStatus = values.status;
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const norm = (s) => ({ id: s?.id ?? s?.Id, code: s?.code ?? s?.Code, name: s?.name ?? s?.Name, contact: s?.contact ?? s?.Contact, email: s?.email ?? s?.Email, address: s?.address ?? s?.Address, status: s?.status ?? s?.Status });
  const filteredSuppliers = suppliers
    .map(norm)
    .filter((s) => {
      const matchSearch = !filterSearch || [s.code, s.name, s.email].some((v) => String(v || "").toLowerCase().includes(filterSearch.toLowerCase()));
      const matchStatus = !filterStatus || s.status === filterStatus;
      return matchSearch && matchStatus;
    });

  const localNextCode = () => {
    const nums = (suppliers || [])
      .map((s) => {
        const raw = String(s.code ?? s.Code ?? "").trim();
        return /^\d+$/.test(raw) ? Number(raw) : NaN;
      })
      .filter((n) => !Number.isNaN(n));
    if (!nums.length) return "1";
    return String(Math.max(...nums) + 1);
  };

  const generateNextCode = async () => {
    const fallback = localNextCode();
    if (!useApi) return fallback;
    try {
      const res = await api.get("suppliers.nextCode");
      const code = String(res?.nextCode ?? res?.NextCode ?? "").trim();
      if (code) return code;
    } catch (_) {}
    return fallback;
  };

  const openAdd = async () => {
    setEditing(null);
    const quick = localNextCode();
    setForm({ code: quick, name: "", contact: "", email: "", address: "", status: "Active" });
    setOpen(true);
    const nextCode = await generateNextCode();
    if (nextCode && nextCode !== quick) {
      setForm((f) => ({ ...f, code: nextCode }));
    }
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
        if (editing) {
          const updated = await api.put("suppliers.update", { ...form }, { params: { id: editing.id } });
          const u = { id: updated?.id ?? updated?.Id ?? editing.id, code: updated?.code ?? updated?.Code, name: updated?.name ?? updated?.Name, contact: updated?.contact ?? updated?.Contact, email: updated?.email ?? updated?.Email, address: updated?.address ?? updated?.Address, status: updated?.status ?? updated?.Status };
          setSuppliers((prev) => prev.map((s) => (s.id === editing.id ? { ...s, ...u } : s)));
        } else {
          const created = await api.post("suppliers.create", form);
          const id = created?.id ?? created?.Id;
          if (id != null) {
            const c = { id, code: created?.code ?? created?.Code ?? form.code, name: created?.name ?? created?.Name ?? form.name, contact: created?.contact ?? created?.Contact ?? form.contact, email: created?.email ?? created?.Email ?? form.email, address: created?.address ?? created?.Address ?? form.address, status: created?.status ?? created?.Status ?? form.status };
            setSuppliers((prev) => [...prev, c]);
          } else {
            await refetchSuppliers();
          }
        }
        setOpen(false);
        try {
          await refetchSuppliers();
        } catch (_) {
          // Đã cập nhật local ở trên, refetch chỉ để đồng bộ
        }
      } catch (e) {
        showToast(e.message || "Lỗi lưu NCC", "error");
      } finally {
        setSaving(false);
      }
      return;
    }
    if (editing) {
      setSuppliers(suppliers.map((s) => (s.id === editing.id ? { ...editing, ...form } : s)));
    } else {
      const newId = Math.max(0, ...suppliers.map((s) => s.id)) + 1;
      setSuppliers([...suppliers, { id: newId, ...form }]);
    }
    setOpen(false);
  };
  const handleDelete = async (id) => {
    if (!window.confirm("Xóa nhà cung cấp này?")) return;
    if (useApi) {
      setSaving(true);
      try {
        await api.del("suppliers.delete", { params: { id } });
        setSuppliers((prev) => prev.filter((s) => s.id !== id));
        try {
          await refetchSuppliers();
        } catch (_) {}
      } catch (e) {
        showToast(e.message || "Lỗi xóa NCC", "error");
      } finally {
        setSaving(false);
      }
      return;
    }
    setSuppliers(suppliers.filter((s) => s.id !== id));
  };

  const handleRefresh = async () => {
    if (!useApi) return;
    setRefreshing(true);
    try {
      await refetchSuppliers();
    } catch (e) {
      showToast(e.message || "Lỗi tải danh sách NCC", "error");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="mt-12">
      <Card className="border border-blue-gray-100">
        <CardHeader className="p-4 border-b">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <Typography variant="h6" color="blue-gray">Nhà cung cấp</Typography>
              <div className="flex items-center gap-2">
                {useApi && suppliers.length === 0 && !apiLoading && (
                  <>
                    <Typography variant="small" color="gray">Chưa có dữ liệu hoặc lỗi kết nối.</Typography>
                    <Button size="sm" variant="outlined" onClick={handleRefresh} disabled={refreshing}>
                      {refreshing ? "Đang tải..." : "Tải lại"}
                    </Button>
                  </>
                )}
                <Button size="sm" className="flex items-center gap-1" onClick={openAdd}>
                  <PlusIcon className="w-4 h-4" /> Thêm
                </Button>
              </div>
            </div>
            {apiError && (
              <Typography variant="small" color="red" className="mt-1 block">{apiError}</Typography>
            )}
            <div className="flex items-center gap-1.5 mb-1">
              <input
                type="text"
                placeholder="🔍 Tìm mã, tên, email..."
                value={filterSearch}
                onChange={(e) => setFilter("q", e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-blue-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilter("status", e.target.value)}
                className="rounded-lg border border-blue-gray-200 bg-white px-2 py-2 text-sm focus:outline-none max-w-[100px]"
              >
                <option value="">Tất cả</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
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
          </div>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          {/* Desktop table */}
          <table className="hidden md:table w-full min-w-[640px] table-auto">
            <thead>
              <tr>
                {["Mã NCC", "Tên NCC", "Liên hệ", "Email", "Địa chỉ", "Trạng thái", "Thao tác"].map((el) => (
                  <th key={el} className="border-b border-blue-gray-50 py-3 px-4 text-left">
                    <Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">{el}</Typography>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.code}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.name}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.contact}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.email}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.address}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50">
                    <Chip size="sm" color={row.status === "Active" ? "green" : "gray"} value={row.status} />
                  </td>
                  <td className="py-3 px-4 border-b border-blue-gray-50 flex gap-1">
                    <IconButton variant="text" size="sm" onClick={() => openEdit(row)} title="Sửa"><PencilIcon className="w-4 h-4" /></IconButton>
                    <IconButton variant="text" size="sm" color="blue" onClick={() => navigate(`/dashboard/supplier-orders-admin?supplierId=${row.id}`)} title="Xem đơn hàng"><ClipboardDocumentListIcon className="w-4 h-4" /></IconButton>
                    <IconButton variant="text" size="sm" color="red" onClick={() => handleDelete(row.id)} title="Xóa"><TrashIcon className="w-4 h-4" /></IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-blue-gray-50">
            {filteredSuppliers.map((row, idx) => (
              <div key={row.id} className={`p-3 ${idx % 2 === 0 ? "bg-white" : "bg-blue-gray-50/40"}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Typography variant="small" className="font-semibold text-blue-gray-800 leading-tight">{row.name}</Typography>
                  <Chip size="sm" color={row.status === "Active" ? "green" : "gray"} value={row.status} />
                </div>
                <Typography variant="small" color="blue-gray" className="text-xs mb-1">
                  Mã: {row.code || "—"} | SĐT: {row.contact || "—"} | Email: {row.email || "—"}
                </Typography>
                <div className="flex gap-1 mt-2">
                  <IconButton variant="text" size="sm" onClick={() => openEdit(row)} title="Sửa"><PencilIcon className="w-4 h-4" /></IconButton>
                  <IconButton variant="text" size="sm" color="blue" onClick={() => navigate(`/dashboard/supplier-orders-admin?supplierId=${row.id}`)} title="Xem đơn"><ClipboardDocumentListIcon className="w-4 h-4" /></IconButton>
                  <IconButton variant="text" size="sm" color="red" onClick={() => handleDelete(row.id)} title="Xóa"><TrashIcon className="w-4 h-4" /></IconButton>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-md max-h-[95vh] sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-2 shrink-0">{editing ? "Sửa Nhà cung cấp" : "Thêm Nhà cung cấp"}</CardHeader>
            <CardBody className="flex flex-col gap-3 overflow-y-auto flex-1 px-4 pb-4">
              <Input label="Mã NCC (tự sinh)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              <Input label="Tên NCC" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Liên hệ" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
              <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Địa chỉ" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <Select label="Trạng thái" value={form.status} onChange={(v) => setForm({ ...form, status: v })}>
                <Option value="Active">Active</Option>
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

export default Suppliers;
