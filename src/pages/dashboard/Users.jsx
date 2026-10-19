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

const normUser = (u) => ({ id: u?.id ?? u?.Id, code: u?.code ?? u?.Code ?? "", email: u?.email ?? u?.Email, name: u?.name ?? u?.Name, phone: u?.phone ?? u?.Phone, role: u?.role ?? u?.Role, storeId: u?.storeId ?? u?.StoreId, supplierId: u?.supplierId ?? u?.SupplierId, storeName: u?.storeName ?? u?.StoreName, supplierName: u?.supplierName ?? u?.SupplierName, status: u?.status ?? u?.Status });

export function Users() {
  const { users, setUsers, stores, suppliers, useApi, refetchUsers, apiLoading, apiError } = useData();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: "", email: "", name: "", password: "", role: "StoreUser", storeId: null, supplierId: null, status: "Active" });
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

  const localNextCode = () => {
    const list = (users || []).map((u) => String(u.code ?? u.Code ?? "").trim()).filter(Boolean);
    const nums = list.map((c) => (/^\d+$/.test(c) ? Number(c) : NaN)).filter((n) => !Number.isNaN(n));
    if (nums.length) return String(Math.max(...nums) + 1);

    let prefix = "U";
    let max = 0;
    let width = 3;
    for (const c of list) {
      const m = c.match(/^([A-Za-z]+)(\d+)$/);
      if (!m) continue;
      const n = Number(m[2]);
      if (n >= max) {
        max = n;
        prefix = m[1];
        width = Math.max(3, m[2].length);
      }
    }
    if (max > 0) return `${prefix}${String(max + 1).padStart(width, "0")}`;
    return "U001";
  };

  const generateNextCode = async () => {
    const fallback = localNextCode();
    if (!useApi) return fallback;
    try {
      const res = await api.get("users.nextCode");
      const code = String(res?.nextCode ?? res?.NextCode ?? "").trim();
      if (code) return code;
    } catch (_) {}
    return fallback;
  };

  const openAdd = async () => {
    setEditing(null);
    const quick = localNextCode();
    setForm({ code: quick, email: "", name: "", password: "", role: "StoreUser", storeId: stores[0]?.id ?? stores[0]?.Id ?? null, supplierId: null, status: "Active" });
    setOpen(true);
    const nextCode = await generateNextCode();
    if (nextCode && nextCode !== quick) {
      setForm((f) => ({ ...f, code: nextCode }));
    }
  };
  const openEdit = (row) => {
    const r = normUser(row);
    setEditing(row);
    setForm({ code: r.code ?? "", email: r.email, name: r.name, password: "", role: r.role, storeId: r.storeId, supplierId: r.supplierId, status: r.status });
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
        const body = { code: form.code || null, email: form.email, name: form.name, role: form.role, storeId: form.storeId, supplierId: form.supplierId, status: form.status };
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
        <CardHeader className="p-4 border-b">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <Typography variant="h6" color="blue-gray">User</Typography>
            <div className="flex items-center gap-2">
              {useApi && users.length === 0 && !apiLoading && (
                <Button size="sm" variant="outlined" onClick={handleRefresh} disabled={refreshing}>{refreshing ? "Đang tải..." : "Tải lại"}</Button>
              )}
              <Button size="sm" className="flex items-center gap-1" onClick={openAdd}>
                <PlusIcon className="w-4 h-4" /> Thêm
              </Button>
            </div>
          </div>
        </CardHeader>
        {apiError && <Typography variant="small" color="red" className="px-4 pb-1 block">{apiError}</Typography>}
        <CardBody className="overflow-x-auto p-0">
          {/* Desktop table */}
          <table className="hidden md:table w-full min-w-[640px] table-auto">
            <thead>
              <tr>
                {["Mã", "Email", "Tên", "Role", "Store/NCC", "Trạng thái", "Thao tác"].map((el) => (
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
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.code || "—"}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.email}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.name}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Chip size="sm" color="blue" value={r.role} /></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50">
                    <Typography variant="small">
                      {r.storeName ?? (r.storeId ? (() => { const x = stores.find((s) => (s.id ?? s.Id) === r.storeId); return x?.name ?? x?.Name; })() : null) ?? r.supplierName ?? (r.supplierId ? (() => { const x = suppliers.find((s) => (s.id ?? s.Id) === r.supplierId); return x?.name ?? x?.Name; })() : null) ?? "—"}
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

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-blue-gray-50">
            {users.map((row, idx) => {
              const r = normUser(row);
              const storeSupplierName = r.storeName
                ?? (r.storeId ? (() => { const x = stores.find((s) => (s.id ?? s.Id) === r.storeId); return x?.name ?? x?.Name; })() : null)
                ?? r.supplierName
                ?? (r.supplierId ? (() => { const x = suppliers.find((s) => (s.id ?? s.Id) === r.supplierId); return x?.name ?? x?.Name; })() : null);
              return (
                <div key={r.id} className={`p-3 ${idx % 2 === 0 ? "bg-white" : "bg-blue-gray-50/40"}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Typography variant="small" className="font-semibold text-blue-gray-800 leading-tight">{r.name}</Typography>
                    <Chip size="sm" color="blue" value={r.role} />
                  </div>
                  <Typography variant="small" color="blue-gray" className="text-xs mb-0.5">
                    Email: {r.email}
                  </Typography>
                  {storeSupplierName && (
                    <Typography variant="small" color="blue-gray" className="text-xs mb-0.5">
                      Store/NCC: {storeSupplierName}
                    </Typography>
                  )}
                  <div className="flex gap-1 mt-2">
                    <IconButton variant="text" size="sm" onClick={() => openEdit(row)} title="Sửa"><PencilIcon className="w-4 h-4" /></IconButton>
                    <IconButton variant="text" size="sm" onClick={() => handleResetPassword(row)} disabled={resettingId === r.id} title="Reset mật khẩu"><KeyIcon className="w-4 h-4" /></IconButton>
                    <IconButton variant="text" size="sm" color="red" onClick={() => handleDelete(r.id)} title="Xóa"><TrashIcon className="w-4 h-4" /></IconButton>
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
          <Card className="w-full max-w-md max-h-[min(92dvh,100%)] flex flex-col overflow-hidden rounded-t-2xl sm:max-h-[90vh] sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-2 shrink-0">{editing ? "Sửa User" : "Thêm User"}</CardHeader>
            <CardBody className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-4" style={{ WebkitOverflowScrolling: "touch" }}>
              <Input label="Mã (tự sinh)" placeholder="VD: U001 hoặc mã nhân viên" value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} />
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
            </CardBody>
            <div className="shrink-0 px-4 pb-4 pt-2 border-t border-blue-gray-50 bg-white flex gap-2 justify-end">
              <Button variant="outlined" onClick={() => setOpen(false)}>Hủy</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
            </div>
          </Card>
          </div>
        </div>
      )}

      {passwordResultModal.open && (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/40" style={{ WebkitOverflowScrolling: "touch" }} onClick={() => setPasswordResultModal((p) => ({ ...p, open: false }))}>
          <div className="flex min-h-[100dvh] min-h-[100vh] items-end justify-center p-0 sm:items-center sm:p-4">
          <Card className="w-full max-w-md max-h-[min(92dvh,100%)] flex flex-col overflow-hidden rounded-t-2xl sm:max-h-[90vh] sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-2 shrink-0">{passwordResultModal.title}</CardHeader>
            <CardBody className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-4" style={{ WebkitOverflowScrolling: "touch" }}>
              <Typography variant="small" color="blue-gray">Email: <strong>{passwordResultModal.email}</strong></Typography>
              <Typography variant="small" color="blue-gray">Mật khẩu (chỉ hiển thị 1 lần – hãy sao chép hoặc gửi cho user):</Typography>
              <div className="flex gap-2">
                <Input readOnly value={passwordResultModal.password} className="font-mono" />
                <Button size="sm" onClick={copyPassword}>Sao chép</Button>
              </div>
              <Typography variant="small" color="gray">User dùng email + mật khẩu này để đăng nhập, sau đó nên đổi mật khẩu (menu user → Đổi mật khẩu).</Typography>
            </CardBody>
            <div className="shrink-0 px-4 pb-4 pt-2 border-t border-blue-gray-50 bg-white flex justify-end">
              <Button onClick={() => setPasswordResultModal((p) => ({ ...p, open: false }))}>Đóng</Button>
            </div>
          </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;
