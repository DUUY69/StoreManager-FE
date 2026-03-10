import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardBody, Typography, Button, Input } from "@material-tailwind/react";
import { Cog6ToothIcon, KeyIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@/context";
import { useLocation } from "react-router-dom";
import api from "@/api";

export function Settings() {
  const { currentUser } = useAuth();
  const { hash } = useLocation();
  const [form, setForm] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    phone: currentUser?.phone || "",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (currentUser) {
      setForm({ name: currentUser.name || "", email: currentUser.email || "", phone: currentUser.phone || "" });
    }
  }, [currentUser?.id, currentUser?.name, currentUser?.email, currentUser?.phone]);

  useEffect(() => {
    if (hash === "#change-password") setShowPassword(true);
  }, [hash]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setMessage("");
    if (api.USE_API) {
      setSaving(true);
      try {
        await api.put("auth.updateProfile", form);
        setMessage("Đã cập nhật thông tin.");
      } catch (err) {
        setMessage(err.message || "Lỗi cập nhật.");
      } finally {
        setSaving(false);
      }
      return;
    }
    setMessage("Demo: Đã lưu (chưa kết nối BE).");
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      setPasswordError("Mật khẩu mới và xác nhận không khớp.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Mật khẩu mới tối thiểu 6 ký tự.");
      return;
    }
    if (api.USE_API) {
      setSaving(true);
      try {
        await api.post("auth.changePassword", { currentPassword, newPassword });
        setMessage("Đổi mật khẩu thành công. Có thể đăng xuất và đăng nhập lại.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowPassword(false);
      } catch (err) {
        setPasswordError(err.message || "Đổi mật khẩu thất bại.");
      } finally {
        setSaving(false);
      }
      return;
    }
    setMessage("Demo: Đổi mật khẩu (chưa kết nối BE).");
    setShowPassword(false);
  };

  return (
    <div className="mt-12">
      <Typography variant="h5" color="blue-gray" className="mb-8 flex items-center gap-2">
        <Cog6ToothIcon className="w-6 h-6" /> Cài đặt
      </Typography>

      <Card className="border border-blue-gray-100">
        <CardHeader className="py-5 px-6 border-b border-blue-gray-100">
          <Typography variant="h6" color="blue-gray">Thông tin cá nhân</Typography>
        </CardHeader>
        <CardBody className="p-6 pt-6 flex flex-col gap-8 max-w-md">
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
            <Input label="Tên hiển thị" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="!border-t-blue-gray-200" />
            <Input type="email" label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="!border-t-blue-gray-200" />
            <Input label="Số điện thoại" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="VD: 0901234567" className="!border-t-blue-gray-200" />
            {message && <Typography variant="small" color={message.startsWith("Lỗi") ? "red" : "green"}>{message}</Typography>}
            <div className="pt-2">
              <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu thông tin"}</Button>
            </div>
          </form>

          <hr className="border-t border-blue-gray-100" />

          <div>
            <Typography variant="h6" color="blue-gray" className="mb-4 flex items-center gap-2">
              <KeyIcon className="w-5 h-5" /> Đổi mật khẩu
            </Typography>
            {!showPassword ? (
              <Button size="sm" variant="outlined" onClick={() => setShowPassword(true)}>Đổi mật khẩu</Button>
            ) : (
              <form onSubmit={handleChangePassword} className="flex flex-col gap-6">
                <Input type="password" label="Mật khẩu hiện tại" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="!border-t-blue-gray-200" />
                <Input type="password" label="Mật khẩu mới" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} className="!border-t-blue-gray-200" />
                <Input type="password" label="Xác nhận mật khẩu mới" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="!border-t-blue-gray-200" />
                {passwordError && <Typography variant="small" color="red">{passwordError}</Typography>}
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outlined" onClick={() => { setShowPassword(false); setPasswordError(""); }}>Hủy</Button>
                  <Button type="submit" disabled={saving}>{saving ? "Đang xử lý..." : "Đổi mật khẩu"}</Button>
                </div>
              </form>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default Settings;
