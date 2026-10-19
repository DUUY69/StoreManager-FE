import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Typography } from "@material-tailwind/react";
import { useAuth, useData } from "@/context";
import api from "@/api";
import { getRedirectFromSearch } from "@/utils/authRedirect";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, currentUser } = useAuth();
  const { refetchInitialData } = useData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const useApi = api.USE_API;
  const afterLoginPath = getRedirectFromSearch(searchParams) || "/dashboard/home";

  useEffect(() => {
    if (currentUser?.role && api.getToken()) {
      navigate(afterLoginPath, { replace: true });
    }
  }, [currentUser?.role, afterLoginPath, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!useApi) {
      setError("Vui lòng bật API (USE_API) và dùng tài khoản trong DB để đăng nhập. Không còn dữ liệu mẫu.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("auth.login", { email, password });
      if (res?.token) api.setToken(res.token);
      if (res?.user) {
        if (typeof refetchInitialData === "function") await refetchInitialData();
        login(res.user);
        setTimeout(() => navigate(afterLoginPath, { replace: true }), 0);
      } else {
        setError("Đăng nhập thất bại.");
      }
    } catch (err) {
      const msg = err.status === 401
        ? "USER hoặc mật khẩu không đúng (cửa hàng: PASSION.20CH)."
        : (err.data?.message || err.message || "Đăng nhập lỗi");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="m-8 flex gap-4 min-h-[calc(100vh-4rem)]">
      <div className="w-full lg:w-3/5 mt-24">
        <div className="text-center">
          <Typography variant="h2" className="font-bold mb-4">Đăng nhập</Typography>
          <Typography variant="paragraph" color="blue-gray" className="text-lg font-normal">
            Nhập USER và mật khẩu (cửa hàng: PASSION.20CH; admin: admin@admin.vn).
          </Typography>
        </div>
        <form onSubmit={handleSubmit} className="mt-8 mb-2 mx-auto w-full max-w-[24rem] lg:w-1/2">
          <div className="mb-4 flex flex-col gap-1">
            <label className="text-sm font-medium text-blue-gray-700">USER / Email</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="vd: PASSION.20CH hoặc admin@admin.vn"
              autoComplete="username"
              className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-4 flex flex-col gap-1">
            <label className="text-sm font-medium text-blue-gray-700">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Mật khẩu tài khoản"
              autoComplete="current-password"
              className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <Typography variant="small" color="red" className="mb-2 block">{error}</Typography>}
          <Button type="submit" className="mt-6" fullWidth disabled={loading} data-testid="login-submit">
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>
        <div className="w-full lg:w-1/2 mx-auto mt-4 text-center">
          <Typography variant="small" color="gray">
            Dữ liệu lấy từ API/DB. Tài khoản do Admin tạo trong menu User.
          </Typography>
        </div>
      </div>
      <div className="w-2/5 hidden lg:block">
        <img src="/img/pattern.png" className="h-full w-full object-cover rounded-3xl" alt="" />
      </div>
    </section>
  );
}

export default Login;
