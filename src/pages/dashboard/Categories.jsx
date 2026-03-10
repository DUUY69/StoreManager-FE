import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Typography,
  Button,
  Input,
  IconButton,
} from "@material-tailwind/react";
import { PencilIcon, TrashIcon, PlusIcon } from "@heroicons/react/24/solid";
import { useData } from "@/context/DataContext";
import { useToast } from "@/context";
import api from "@/api";

export function Categories() {
  const { categories, setCategories, useApi, refetchCategories, apiLoading, apiError } = useData();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", description: "" });
    setOpen(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setForm({ name: row.name, description: row.description || "" });
    setOpen(true);
  };
  const handleSave = async () => {
    if (useApi) {
      setSaving(true);
      try {
        const id = editing?.id ?? editing?.Id;
        if (editing) {
          const updated = await api.put("categories.update", form, { params: { id } });
          setCategories((prev) => prev.map((c) => (c.id === id || c.Id === id ? { ...c, id: updated?.id ?? updated?.Id ?? id, name: updated?.name ?? updated?.Name ?? form.name, description: updated?.description ?? updated?.Description ?? form.description } : c)));
        } else {
          const created = await api.post("categories.create", form);
          const newId = created?.id ?? created?.Id;
          if (newId != null) setCategories((prev) => [...prev, { id: newId, name: form.name, description: form.description }]);
          else await refetchCategories();
        }
        setOpen(false);
        try { await refetchCategories(); } catch (_) {}
      } catch (e) {
        showToast(e.message || "Lỗi lưu danh mục", "error");
      } finally {
        setSaving(false);
      }
      return;
    }
    if (editing) {
      setCategories(categories.map((c) => (c.id === editing.id ? { ...editing, ...form } : c)));
    } else {
      const newId = Math.max(0, ...categories.map((c) => c.id)) + 1;
      setCategories([...categories, { id: newId, ...form }]);
    }
    setOpen(false);
  };
  const handleDelete = async (id) => {
    if (!window.confirm("Xóa danh mục này?")) return;
    if (useApi) {
      setSaving(true);
      try {
        await api.del("categories.delete", { params: { id } });
        setCategories((prev) => prev.filter((c) => (c.id ?? c.Id) !== id));
        try { await refetchCategories(); } catch (_) {}
      } catch (e) {
        showToast(e.message || "Lỗi xóa danh mục", "error");
      } finally {
        setSaving(false);
      }
      return;
    }
    setCategories(categories.filter((c) => c.id !== id));
  };
  const handleRefresh = async () => {
    if (!useApi) return;
    setRefreshing(true);
    try { await refetchCategories(); } catch (e) { showToast(e.message || "Lỗi tải danh mục", "error"); }
    finally { setRefreshing(false); }
  };

  return (
    <div className="mt-12">
      <Card className="border border-blue-gray-100">
        <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
          <Typography variant="h6" color="blue-gray">Quản lý Danh mục</Typography>
          <div className="flex items-center gap-2">
            {useApi && categories.length === 0 && !apiLoading && (
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
                <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">ID</Typography></th>
                <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">Tên</Typography></th>
                <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">Mô tả</Typography></th>
                <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">Thao tác</Typography></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((row) => {
                const r = { id: row.id ?? row.Id, name: row.name ?? row.Name, description: row.description ?? row.Description };
                return (
                <tr key={r.id}>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.id}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.name}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.description || "—"}</Typography></td>
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
            <CardHeader className="pb-2">{editing ? "Sửa Danh mục" : "Thêm Danh mục"}</CardHeader>
            <CardBody className="flex flex-col gap-3">
              <Input label="Tên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Mô tả" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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

export default Categories;
