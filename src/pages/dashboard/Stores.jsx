import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Typography,
  Button,
  Input,
  IconButton,
  Chip,
  Select,
  Option,
} from "@material-tailwind/react";
import { PencilIcon, TrashIcon, PlusIcon } from "@heroicons/react/24/solid";
import { useData } from "@/context/DataContext";
import { useToast } from "@/context";
import api from "@/api";

export function Stores() {
  const { stores, setStores, useApi, refetchStores, apiLoading, apiError } = useData();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: "", name: "", address: "", phone: "", status: "Active" });
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm({ code: "", name: "", address: "", phone: "", status: "Active" });
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
        const id = editing?.id ?? editing?.Id;
        if (editing) {
          const updated = await api.put("stores.update", form, { params: { id } });
          const u = { id: updated?.id ?? updated?.Id ?? id, code: updated?.code ?? updated?.Code, name: updated?.name ?? updated?.Name, address: updated?.address ?? updated?.Address, phone: updated?.phone ?? updated?.Phone, status: updated?.status ?? updated?.Status };
          setStores((prev) => prev.map((s) => ((s.id ?? s.Id) === id ? { ...s, ...u } : s)));
        } else {
          const created = await api.post("stores.create", form);
          const newId = created?.id ?? created?.Id;
          if (newId != null) setStores((prev) => [...prev, { id: newId, ...form, ...created }]);
          else await refetchStores();
        }
        setOpen(false);
        try { await refetchStores(); } catch (_) {}
      } catch (e) {
        showToast(e.message || "Lỗi lưu cửa hàng", "error");
      } finally {
        setSaving(false);
      }
      return;
    }
    if (editing) {
      setStores(stores.map((s) => (s.id === editing.id ? { ...editing, ...form } : s)));
    } else {
      const newId = Math.max(0, ...stores.map((s) => s.id)) + 1;
      setStores([...stores, { id: newId, ...form }]);
    }
    setOpen(false);
  };
  const handleDelete = async (id) => {
    if (!window.confirm("Xóa cửa hàng này?")) return;
    if (useApi) {
      setSaving(true);
      try {
        await api.del("stores.delete", { params: { id } });
        setStores((prev) => prev.filter((s) => (s.id ?? s.Id) !== id));
        try { await refetchStores(); } catch (_) {}
      } catch (e) {
        showToast(e.message || "Lỗi xóa cửa hàng", "error");
      } finally {
        setSaving(false);
      }
      return;
    }
    setStores(stores.filter((s) => s.id !== id));
  };
  const handleRefresh = async () => {
    if (!useApi) return;
    setRefreshing(true);
    try { await refetchStores(); } catch (e) { showToast(e.message || "Lỗi tải cửa hàng", "error"); }
    finally { setRefreshing(false); }
  };

  return (
    <div className="mt-12">
      <Card className="border border-blue-gray-100">
        <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
          <Typography variant="h6" color="blue-gray">Cửa hàng</Typography>
          <div className="flex items-center gap-2">
            {useApi && stores.length === 0 && !apiLoading && (
              <Button size="sm" variant="outlined" onClick={handleRefresh} disabled={refreshing}>{refreshing ? "Đang tải..." : "Tải lại"}</Button>
            )}
            <Button size="sm" className="flex items-center gap-1" onClick={openAdd}>
              <PlusIcon className="w-4 h-4" /> Thêm
            </Button>
          </div>
        </CardHeader>
        {apiError && <Typography variant="small" color="red" className="px-4 pb-1 block">{apiError}</Typography>}
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] table-auto">
            <thead>
              <tr>
                {["Mã", "Tên", "Địa chỉ", "Điện thoại", "Trạng thái", "Thao tác"].map((el) => (
                  <th key={el} className="border-b border-blue-gray-50 py-3 px-4 text-left">
                    <Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">{el}</Typography>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stores.map((row) => {
                const r = { id: row.id ?? row.Id, code: row.code ?? row.Code, name: row.name ?? row.Name, address: row.address ?? row.Address, phone: row.phone ?? row.Phone, status: row.status ?? row.Status };
                return (
                <tr key={r.id}>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.code}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.name}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.address}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.phone}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Chip size="sm" color={r.status === "Active" ? "green" : "gray"} value={r.status} /></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50 flex gap-1">
                    <IconButton variant="text" size="sm" onClick={() => openEdit(row)}><PencilIcon className="w-4 h-4" /></IconButton>
                    <IconButton variant="text" size="sm" color="red" onClick={() => handleDelete(r.id)}><TrashIcon className="w-4 h-4" /></IconButton>
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-2">{editing ? "Sửa Cửa hàng" : "Thêm Cửa hàng"}</CardHeader>
            <CardBody className="flex flex-col gap-3">
              <Input label="Mã" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              <Input label="Tên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Địa chỉ" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <Input label="Điện thoại" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Select label="Trạng thái" value={form.status} onChange={(v) => setForm({ ...form, status: v })}>
                <Option value="Active">Active</Option>
                <Option value="Inactive">Inactive</Option>
              </Select>
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

export default Stores;
