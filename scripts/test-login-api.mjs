/**
 * Test API login: check-db rồi login với email/password.
 * Chạy: node scripts/test-login-api.mjs [email] [password]
 * Cần BE đang chạy (dotnet run). Mặc định: https://localhost:5001
 */
const BASE = process.env.VITE_API_BASE_URL || "https://localhost:5001";
const email = process.argv[2] || "q7@cafe.vn";
const password = process.argv[3] || "123456";

// Cho phép HTTPS localhost (cert tự ký) khi gọi từ Node
if (BASE.startsWith("https://") && BASE.includes("localhost")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

async function main() {
  console.log("Base URL:", BASE);
  console.log("Email:", email, "| Password:", "***");

  // 1. Check DB (nếu BE có endpoint /api/auth/check-db)
  try {
    const checkRes = await fetch(`${BASE}/api/auth/check-db`);
    if (checkRes.ok) {
      const info = await checkRes.json();
      console.log("\n[check-db]", JSON.stringify(info, null, 2));
      if (info.connected === false) {
        console.error("DB không kết nối được. Kiểm tra ConnectionString trong appsettings.json");
        process.exit(1);
      }
      if (info.userCount === 0) {
        console.error("Bảng Users trống. Chạy script seed: BE/Database/02_SeedData.sql");
        process.exit(1);
      }
      if (email === "q7@cafe.vn" && info.q7Exists === false) {
        console.warn("Cảnh báo: User q7@cafe.vn không tồn tại trong DB.");
      }
    }
  } catch (e) {
    console.warn("(check-db không khả dụng hoặc BE chưa build mới)", e.message);
  }

  // 2. Login
  console.log("\n[login] POST /api/auth/login ...");
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const bodyText = await loginRes.text();
  console.log("Status:", loginRes.status);
  if (loginRes.ok) {
    const data = JSON.parse(bodyText);
    console.log("OK. Token:", data.token ? `${data.token.slice(0, 20)}...` : "không có");
    if (data.user) console.log("User:", data.user.email, "| Role:", data.user.role);
  } else {
    console.log("Body:", bodyText.slice(0, 300));
    if (loginRes.status === 401) {
      console.error("\n401 = Email hoặc mật khẩu sai, hoặc DB không có user / hash lỗi.");
      console.error("Kiểm tra: 1) ConnectionString trỏ đúng DB có bảng Users. 2) Đã chạy seed 02_SeedData.sql. 3) Mật khẩu 123456.");
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Lỗi:", e.message);
  process.exit(1);
});
