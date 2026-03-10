/**
 * Test nhanh API orders: đăng nhập → GET /api/orders → in số đơn.
 * Chạy: node scripts/test-orders-api.mjs
 * Cần BE đang chạy (npm run dev hoặc dotnet run).
 */
const BASE = process.env.VITE_API_BASE_URL || 'https://localhost:5001';

async function main() {
  console.log('Base URL:', BASE);
  try {
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@cafe.vn', password: '123456' }),
    });
    if (!loginRes.ok) {
      console.error('Login failed:', loginRes.status, await loginRes.text());
      process.exit(1);
    }
    const { token } = await loginRes.json();
    if (!token) {
      console.error('No token in response');
      process.exit(1);
    }
    console.log('Login OK, token received');

    const ordersRes = await fetch(`${BASE}/api/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!ordersRes.ok) {
      console.error('Orders API failed:', ordersRes.status, await ordersRes.text());
      process.exit(1);
    }
    const orders = await ordersRes.json();
    const count = Array.isArray(orders) ? orders.length : 0;
    console.log('Orders API OK. Số đơn trả về:', count);
    if (count > 0) {
      orders.slice(0, 3).forEach((o, i) => {
        console.log(`  [${i + 1}] Id=${o.id ?? o.Id}, Store=${o.storeName ?? o.StoreName}, Status=${o.status ?? o.Status}`);
      });
      if (count > 3) console.log('  ...');
    }
  } catch (e) {
    console.error('Lỗi:', e.message);
    process.exit(1);
  }
}

main();
