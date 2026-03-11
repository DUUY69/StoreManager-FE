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
import { PencilIcon, TrashIcon, PlusIcon, KeyIcon } from "@heroicons/react/24/solid";
import { useData } from "@/context/DataContext";
import { useToast } from "@/context";
import api from "@/api";

const ROLES = ["Admin", "StoreUser", "SupplierUser"];

function randomPassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const normUser = (u) => ({ id: u?.id ?? u?.Id, email: u?.email ?? u?.Email, name: u?.name ?? u?.Name, phone: u?.phone ?? u?.Phone, role: u?.role ?? u?.Role, storeId: u?.storeId ?? u?.StoreId, supplierId: u?.supplierId ?? u?.SupplierId, status: u?.status ?? u?.Status });

export function Users() {
  const { users, setUsers, stores, suppliers, useApi, refetchUsers, apiLoading, apiError } = useData();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "StoreUser", storeId: null, supplierId: null, status: "Active" });
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [resettingId, setResettingId] = useState(null);
  const [passwordResultModal, setPasswordResultModal] = useState({ open: false, title: "", email: "", password: "" });

  const copyPassword = () => {
    if (passwordResultModal.password && navigator.clipboard) {
      navigator.clipboard.writeText(passwordResultModal.password);
      showToast("Đã sao chép mật khẩu vào clipboard. Gửi cho user và bảo họ đổi mật khẩu sau khi đăng nhập.", "success");
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ email: "", name: "", password: "", role: "StoreUser", storeId: stores[0]?.id ?? stores[0]?.Id ?? null, supplierId: null, status: "Active" });
    setOpen(true);
  };
  const openEdit = (row) => {
    const r = normUser(row);
    setEditing(row);
    setForm({ email: r.email, name: r.name, password: "", role: r.role, storeId: r.storeId, supplierId: r.supplierId, status: r.status });
    setOpen(true);
  };
  const generatePassword = () => {
    const pass = randomPassword(10);
    setForm((f) => ({ ...f, password: pass }));
  };

  const handleSave = async () => {
    if (useApi) {
      setSaving(true);
      try {
        const body = { email: form.email, name: form.name, role: form.role, storeId: form.storeId, supplierId: form.supplierId, status: form.status };
        if (form.password) body.password = form.password;
        const id = editing?.id ?? editing?.Id;
        if (editing) {
          const updated = await api.put("users.update", body, { params: { id } });
          const u = normUser(updated ?? {});
          if (u.id != null) setUsers((prev) => prev.map((u2) => ((u2.id ?? u2.Id) === id ? { ...u2, ...u } : u2)));
          setOpen(false);
        } else {
          const res = await api.post("users.create", body);
          const created = res?.user;
          const newId = created?.id ?? created?.Id;
          if (newId != null) setUsers((prev) => [...prev, { ...normUser(created ?? {}), id: newId }]);
          else try { await refetchUsers(); } catch (_) {}
          setOpen(false);
          const pwd = res?.tempPassword || form.password || null;
          if (pwd) setPasswordResultModal({ open: true, title: "User đã tạo – Lưu mật khẩu (chỉ hiển thị 1 lần)", email: form.email, password: pwd });
        }
        try { await refetchUsers(); } catch (_) {}
      } catch (e) {
        showToast(e.message || "Lỗi lưu user", "error");
      } finally {
        setSaving(false);
      }
      return;
    }
    if (editing) {
      setUsers(users.map((u) => (u.id === editing.id ? { ...editing, ...form } : u)));
    } else {
      const newId = Math.max(0, ...users.map((u) => u.id)) + 1;
      const createdPassword = form.password || randomPassword(10);
      setUsers([...users, { id: newId, ...form, password: undefined }]);
      setOpen(false);
      setPasswordResultModal({ open: true, title: "User đã tạo – Lưu mật khẩu (chỉ hiển thị 1 lần)", email: form.email, password: createdPassword });
    }
  };
  const handleDelete = async (id) => {
    if (!window.confirm("Xóa user này?")) return;
    if (useApi) {
      setSaving(true);
      try {
        await api.del("users.delete", { params: { id } });
        setUsers((prev) => prev.filter((u) => (u.id ?? u.Id) !== id));
        try { await refetchUsers(); } catch (_) {}
      } catch (e) {
        showToast(e.message || "Lỗi xóa user", "error");
      } finally {
        setSaving(false);
      }
      return;
    }
    setUsers(users.filter((u) => u.id !== id));
  };
  const handleRefresh = async () => {
    if (!useApi) return;
    setRefreshing(true);
    try { await refetchUsers(); } catch (e) { showToast(e.message || "Lỗi tải user", "error"); }
    finally { setRefreshing(false); }
  };

  const handleResetPassword = async (row) => {
    const r = normUser(row);
    if (!window.confirm(`Reset mật khẩu cho ${r.name} (${r.email})? User sẽ nhận mật khẩu mới.`)) return;
    if (useApi) {
      setResettingId(r.id);
      try {
        const res = await api.post("users.resetPassword", {}, { params: { id: r.id } });
        const newPass = res?.tempPassword || res?.newPassword || res?.password;
        setPasswordResultModal({
          open: true,
          title: "Mật khẩu mới (Reset) – Gửi cho user",
          email: r.email,
          password: newPass || "(BE không trả về – kiểm tra email user hoặc cấu hình BE)",
        });
      } catch (e) {
        showToast(e.message || "Lỗi reset mật khẩu", "error");
      } finally {
        setResettingId(null);
      }
      return;
    }
    const tempPass = randomPassword(10);
    setPasswordResultModal({ open: true, title: "Mật khẩu tạm (Demo) – Gửi cho user", email: r.email, password: tempPass });
  };

  return (
    <div className="mt-12">
      <Card className="border border-blue-gray-100">
        <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
          <Typography variant="h6" color="blue-gray">User</Typography>
          <div className="flex items-center gap-2">
            {useApi && users.length === 0 && !apiLoading && (
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
                {["Email", "Tên", "Role", "Store/NCC", "Trạng thái", "Thao tác"].map((el) => (
                  <th key={el} className="border-b border-blue-gray-50 py-3 px-4 text-left">
                    <Typography variant="small" className="text-[11px] font-bold uppercase text-blue-gray-400">{el}</Typography>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((row) => {
                const r = normUser(row);
                return (
                <tr key={r.id}>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.email}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.name}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Chip size="sm" color="blue" value={r.role} /></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50">
                    <Typography variant="small">
                      {r.storeId ? (() => { const x = stores.find((s) => (s.id ?? s.Id) === r.storeId); return x?.name ?? x?.Name ?? "-"; })() : r.supplierId ? (() => { const x = suppliers.find((s) => (s.id ?? s.Id) === r.supplierId); return x?.name ?? x?.Name ?? "-"; })() : "-"}
                    </Typography>
                  </td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Chip size="sm" color={r.status === "Active" ? "green" : "gray"} value={r.status} /></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50 flex gap-1 items-center">
                    <IconButton variant="text" size="sm" onClick={() => openEdit(row)} title="Sửa"><PencilIcon className="w-4 h-4" /></IconButton>
                    <IconButton variant="text" size="sm" onClick={() => handleResetPassword(row)} disabled={resettingId === r.id} title="Reset mật khẩu"><KeyIcon className="w-4 h-4" /></IconButton>
                    <IconButton variant="text" size="sm" color="red" onClick={() => handleDelete(r.id)} title="Xóa"><TrashIcon className="w-4 h-4" /></IconButton>
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
            <CardHeader className="pb-2">{editing ? "Sửa User" : "Thêm User"}</CardHeader>
            <CardBody className="flex flex-col gap-3">
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Tên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              {!editing && (
                <div className="flex gap-2 items-end">
                  <Input type="password" label="Mật khẩu (để trống nếu BE tự sinh)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Tùy chọn" className="flex-1" />
                  <Button type="button" size="sm" variant="outlined" onClick={generatePassword}>Tự sinh</Button>
                </div>
              )}
              <Select label="Role" value={form.role} onChange={(v) => setForm({ ...form, role: v, storeId: v === "StoreUser" ? stores[0]?.id : null, supplierId: v === "SupplierUser" ? suppliers[0]?.id : null })}>
                {ROLES.map((r) => (<Option key={r} value={r}>{r}</Option>))}
              </Select>
              {form.role === "StoreUser" && (
                <Select label="Cửa hàng" value={String(form.storeId || "")} onChange={(v) => setForm({ ...form, storeId: v ? Number(v) : null })}>
                  {stores.map((s) => (<Option key={s.id ?? s.Id} value={String(s.id ?? s.Id)}>{s.name ?? s.Name}</Option>))}
                </Select>
              )}
              {form.role === "SupplierUser" && (
                <Select label="Nhà cung cấp" value={String(form.supplierId || "")} onChange={(v) => setForm({ ...form, supplierId: v ? Number(v) : null })}>
                  {suppliers.map((s) => (<Option key={s.id ?? s.Id} value={String(s.id ?? s.Id)}>{s.name ?? s.Name}</Option>))}
                </Select>
              )}
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

      {passwordResultModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPasswordResultModal((p) => ({ ...p, open: false }))}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-2">{passwordResultModal.title}</CardHeader>
            <CardBody className="flex flex-col gap-3">
              <Typography variant="small" color="blue-gray">Email: <strong>{passwordResultModal.email}</strong></Typography>
              <Typography variant="small" color="blue-gray">Mật khẩu (chỉ hiển thị 1 lần – hãy sao chép hoặc gửi cho user):</Typography>
              <div className="flex gap-2">
                <Input readOnly value={passwordResultModal.password} className="font-mono" />
                <Button size="sm" onClick={copyPassword}>Sao chép</Button>
              </div>
              <Typography variant="small" color="gray">User dùng email + mật khẩu này để đăng nhập, sau đó nên đổi mật khẩu (menu user → Đổi mật khẩu).</Typography>
              <div className="flex justify-end pt-2">
                <Button onClick={() => setPasswordResultModal((p) => ({ ...p, open: false }))}>Đóng</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

export default Users;
