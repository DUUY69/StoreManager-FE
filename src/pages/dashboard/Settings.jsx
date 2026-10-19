import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardBody, Typography, Button, Input, Switch } from "@material-tailwind/react";
import { Cog6ToothIcon, KeyIcon, SparklesIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@/context";
import { useLocation } from "react-router-dom";
import api from "@/api";

const AI_DEFAULTS = {
  liteMode: false,
  enabled: true,
  provider: "openrouter",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "openai/gpt-oss-120b:free",
  apiKey: "",
  useForPlanning: true,
  useForResponseFormat: false,
  useForIntentSummary: false,
  useForGeneralChat: true,
  maxTokens: 400,
  temperature: 0.2,
  apiKeyConfigured: false,
  apiKeyHint: "",
};

export function Settings() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "Admin";
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

  const [aiForm, setAiForm] = useState(AI_DEFAULTS);
  const [aiMessage, setAiMessage] = useState("");
  const [aiSaving, setAiSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setForm({ name: currentUser.name || "", email: currentUser.email || "", phone: currentUser.phone || "" });
    }
  }, [currentUser?.id, currentUser?.name, currentUser?.email, currentUser?.phone]);

  useEffect(() => {
    if (hash === "#change-password") setShowPassword(true);
    if (hash === "#ai" && isAdmin) loadAiSettings();
  }, [hash, isAdmin]);

  const loadAiSettings = async () => {
    if (!api.USE_API || !isAdmin) return;
    setAiLoading(true);
    setAiMessage("");
    try {
      const data = await api.get("assistant.aiSettingsGet");
      setAiForm({
        liteMode: !!data.liteMode,
        enabled: !!data.enabled,
        provider: data.provider || "openrouter",
        baseUrl: data.baseUrl || "https://openrouter.ai/api/v1",
        model: data.model || "openai/gpt-oss-120b:free",
        apiKey: "",
        useForPlanning: !!data.useForPlanning,
        useForResponseFormat: !!data.useForResponseFormat,
        useForIntentSummary: !!data.useForIntentSummary,
        useForGeneralChat: data.useForGeneralChat !== false,
        maxTokens: data.maxTokens ?? 400,
        temperature: data.temperature ?? 0.2,
        apiKeyConfigured: !!data.apiKeyConfigured,
        apiKeyHint: data.apiKeyHint || "",
      });
    } catch (err) {
      setAiMessage(err.message || "Không tải được cấu hình AI.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadAiSettings();
  }, [isAdmin]);

  const handleSaveAi = async (e) => {
    e.preventDefault();
    if (!api.USE_API || !isAdmin) return;
    setAiSaving(true);
    setAiMessage("");
    try {
      const payload = {
        liteMode: aiForm.liteMode,
        enabled: aiForm.enabled,
        provider: aiForm.provider,
        baseUrl: aiForm.baseUrl,
        model: aiForm.model,
        apiKey: aiForm.apiKey?.trim() || null,
        useForPlanning: aiForm.useForPlanning,
        useForResponseFormat: aiForm.useForResponseFormat,
        useForIntentSummary: aiForm.useForIntentSummary,
        useForGeneralChat: aiForm.useForGeneralChat,
        maxTokens: Number(aiForm.maxTokens) || 400,
        temperature: Number(aiForm.temperature) || 0.2,
      };
      const data = await api.put("assistant.aiSettingsPut", payload);
      setAiForm((prev) => ({
        ...prev,
        apiKey: "",
        apiKeyConfigured: !!data.apiKeyConfigured,
        apiKeyHint: data.apiKeyHint || "",
      }));
      setAiMessage("Đã lưu cấu hình AI. Trợ lý dùng ngay, không cần restart.");
    } catch (err) {
      setAiMessage(err.message || "Lỗi lưu cấu hình AI.");
    } finally {
      setAiSaving(false);
    }
  };

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

      {isAdmin && (
        <Card id="ai" className="border border-blue-gray-100 mt-8">
          <CardHeader className="py-5 px-6 border-b border-blue-gray-100">
            <Typography variant="h6" color="blue-gray" className="flex items-center gap-2">
              <SparklesIcon className="w-5 h-5" /> Cấu hình AI (OpenRouter)
            </Typography>
          </CardHeader>
          <CardBody className="p-6 pt-6 flex flex-col gap-6 max-w-xl">
            <Typography variant="small" color="gray">
              LLM hỗ trợ hiểu câu hỏi tự nhiên. Cảnh báo vận hành chạy tự động theo dữ liệu hệ thống.
            </Typography>
            {aiLoading ? (
              <Typography variant="small" color="gray">Đang tải...</Typography>
            ) : (
              <form onSubmit={handleSaveAi} className="flex flex-col gap-5">
                <div className="flex flex-col gap-3">
                  <Switch
                    label="Bật LLM (Enabled)"
                    checked={aiForm.enabled}
                    onChange={(e) => setAiForm({ ...aiForm, enabled: e.target.checked })}
                  />
                  <Switch
                    label="Chế độ nhẹ (tắt LLM, chỉ tra cứu theo rule)"
                    checked={aiForm.liteMode}
                    onChange={(e) => setAiForm({ ...aiForm, liteMode: e.target.checked })}
                  />
                  <Switch
                    label="Dùng AI chọn skill (UseForPlanning)"
                    checked={aiForm.useForPlanning}
                    onChange={(e) => setAiForm({ ...aiForm, useForPlanning: e.target.checked })}
                  />
                  <Switch
                    label="Trả lời câu ngoài skill (toán, hỏi chung)"
                    checked={aiForm.useForGeneralChat}
                    onChange={(e) => setAiForm({ ...aiForm, useForGeneralChat: e.target.checked })}
                  />
                </div>
                <Input label="Provider" value={aiForm.provider} onChange={(e) => setAiForm({ ...aiForm, provider: e.target.value })} className="!border-t-blue-gray-200" />
                <Input label="Base URL" value={aiForm.baseUrl} onChange={(e) => setAiForm({ ...aiForm, baseUrl: e.target.value })} className="!border-t-blue-gray-200" />
                <Input label="Model" value={aiForm.model} onChange={(e) => setAiForm({ ...aiForm, model: e.target.value })} placeholder="openai/gpt-oss-120b:free" className="!border-t-blue-gray-200" />
                <Input
                  type="password"
                  label="API Key OpenRouter"
                  value={aiForm.apiKey}
                  onChange={(e) => setAiForm({ ...aiForm, apiKey: e.target.value })}
                  placeholder={aiForm.apiKeyConfigured ? `Đã cấu hình (${aiForm.apiKeyHint}) — để trống nếu giữ key cũ` : "sk-or-v1-..."}
                  className="!border-t-blue-gray-200"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input type="number" label="Max tokens" value={aiForm.maxTokens} onChange={(e) => setAiForm({ ...aiForm, maxTokens: e.target.value })} className="!border-t-blue-gray-200" />
                  <Input type="number" step="0.1" label="Temperature" value={aiForm.temperature} onChange={(e) => setAiForm({ ...aiForm, temperature: e.target.value })} className="!border-t-blue-gray-200" />
                </div>
                {aiMessage && (
                  <Typography variant="small" color={aiMessage.startsWith("Lỗi") || aiMessage.includes("Không") ? "red" : "green"}>
                    {aiMessage}
                  </Typography>
                )}
                <div className="pt-2">
                  <Button type="submit" disabled={aiSaving}>{aiSaving ? "Đang lưu..." : "Lưu cấu hình AI"}</Button>
                </div>
              </form>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

export default Settings;
