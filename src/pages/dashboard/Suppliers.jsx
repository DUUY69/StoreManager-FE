import React, { useState } from "react";
import { Card, CardHeader, CardBody, Typography, Button, Input, IconButton, Chip } from "@material-tailwind/react";
import { FilterSelect } from "@/components/FilterSelect";
import { PencilIcon, TrashIcon, PlusIcon, FunnelIcon } from "@heroicons/react/24/solid";
import { useData } from "@/context/DataContext";
import { useToast } from "@/context";
import api from "@/api";

export function Suppliers() {
  const { suppliers, setSuppliers, useApi, refetchSuppliers, apiLoading, apiError } = useData();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: "", name: "", contact: "", email: "", address: "", status: "Active" });
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
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

  const openAdd = () => {
    setEditing(null);
    setForm({ code: "", name: "", contact: "", email: "", address: "", status: "Active" });
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
            <div className="flex flex-row flex-wrap items-center justify-between gap-2">
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
            <div className="flex flex-row flex-wrap items-end gap-4 w-full">
              <div className="flex items-center gap-1 text-blue-gray-500 shrink-0">
                <FunnelIcon className="w-4 h-4" />
                <Typography variant="small" className="font-medium">Bộ lọc:</Typography>
              </div>
              <div className="w-[220px] shrink-0">
                <Input placeholder="Tìm mã, tên, email..." value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} className="!min-w-0" />
              </div>
              <div className="w-[140px] shrink-0">
                <FilterSelect label="Trạng thái" value={filterStatus} onChange={setFilterStatus} options={[{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]} placeholder="Tất cả" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] table-auto">
            <thead>
              <tr>
                {["Mã", "Tên", "Liên hệ", "Email", "Địa chỉ", "Trạng thái", "Thao tác"].map((el) => (
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
            <CardHeader className="pb-2">{editing ? "Sửa Nhà cung cấp" : "Thêm Nhà cung cấp"}</CardHeader>
            <CardBody className="flex flex-col gap-3">
              <Input label="Mã" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              <Input label="Tên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Liên hệ" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
              <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Địa chỉ" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outlined" onClick={() => setOpen(false)} disabled={saving}>Hủy</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

export default Suppliers;
