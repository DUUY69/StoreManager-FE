import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input, Button, Typography } from "@material-tailwind/react";
import { useAuth, useData } from "@/context";
import { usersData } from "@/data";
import api from "@/api";

const DEMO_PASSWORD = "123456";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const { refetchInitialData } = useData();
  const navigate = useNavigate();
  const useApi = api.USE_API;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (useApi) {
      setLoading(true);
      try {
        const res = await api.post("auth.login", { email, password });
        if (res?.token) api.setToken(res.token);
        if (res?.user) {
          if (typeof refetchInitialData === "function") await refetchInitialData();
          login(res.user);
          // Navigate sau một tick để context (role NCC/Store/Admin) kịp cập nhật, tránh hiển thị nhầm menu Admin
          setTimeout(() => navigate("/dashboard/home", { replace: true }), 0);
        } else {
          setError("Đăng nhập thất bại.");
        }
      } catch (err) {
        const msg = err.status === 401
          ? "Email hoặc mật khẩu không đúng. Kiểm tra tài khoản trong DB (vd: admin@cafe.vn, q7@cafe.vn) và mật khẩu 123456."
          : (err.data?.message || err.message || "Đăng nhập lỗi");
        setError(msg);
      } finally {
        setLoading(false);
      }
      return;
    }
    const user = usersData.find((u) => String(u.email).toLowerCase() === String(email).toLowerCase().trim());
    if (!user) {
      setError("Email không tồn tại. Demo: admin@cafe.vn, q1@cafe.vn, ncc_caphe@supplier.vn ...");
      return;
    }
    if (password !== DEMO_PASSWORD) {
      setError("Mật khẩu demo: 123456");
      return;
    }
    login(user);
    navigate("/dashboard/home", { replace: true });
  };

  return (
    <section className="m-8 flex gap-4">
      <div className="w-full lg:w-3/5 mt-24">
        <div className="text-center">
          <Typography variant="h2" className="font-bold mb-4">Đăng nhập</Typography>
          <Typography variant="paragraph" color="blue-gray" className="text-lg font-normal">
            Nhập email và mật khẩu. {!useApi && "Demo: mật khẩu chung là 123456."}
          </Typography>
        </div>
        <form onSubmit={handleSubmit} className="mt-8 mb-2 mx-auto w-96 max-w-screen-lg lg:w-1/2">
          <div className="mb-4">
            <Input type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="vd: admin@cafe.vn" />
          </div>
          <div className="mb-4">
            <Input type="password" label="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder={useApi ? "Mật khẩu tài khoản" : "Demo: 123456"} />
          </div>
          {error && <Typography variant="small" color="red" className="mb-2 block">{error}</Typography>}
          <Button type="submit" className="mt-6" fullWidth disabled={loading} data-testid="login-submit">{loading ? "Đang đăng nhập..." : "Đăng nhập"}</Button>
        </form>
        <div className="w-full lg:w-1/2 mx-auto mt-4 text-center">
          <Typography variant="small" color="gray">
            {useApi ? "Dùng tài khoản từ BE (Quản lý User)." : "Demo: admin@cafe.vn, q1@cafe.vn, ncc_caphe@supplier.vn ... Mật khẩu: 123456"}
          </Typography>
        </div>
      </div>
      <div className="w-2/5 h-full hidden lg:block">
        <img src="/img/pattern.png" className="h-full w-full object-cover rounded-3xl" alt="" />
      </div>
    </section>
  );
}

export default Login;
