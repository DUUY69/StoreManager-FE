# Cấu hình API FE – BE

## File môi trường (.env)

- **`.env`**: Copy từ `.env.example`, sửa theo máy/local. Không commit file này.
- **Biến dùng:**
  - `VITE_API_BASE_URL`: Base URL backend (vd: `https://localhost:5001`), không có `/` cuối.
  - `VITE_USE_API`: `true` = gọi API thật, `false` = dùng mock DataContext.

## Mapping API (api-mapping.json)

**Một nơi quản lý toàn bộ endpoint.** Khi BE đổi path hoặc thêm API, chỉ cần sửa file này, không cần tìm từng chỗ gọi trong code.

- **Key** dạng `nhóm.hành động`, ví dụ: `auth.login`, `suppliers.list`, `orders.getById`.
- **path**: Có thể có tham số `:id`, khi gọi truyền `params: { id: 1 }`.
- **query**: Truyền qua `options.query` trong `api.get('suppliers.list', { query: { status: 'Active' } })`.

Ví dụ gọi trong code:

```js
import api from "@/api";

// GET /api/suppliers?status=Active
const list = await api.get("suppliers.list", { query: { status: "Active" } });

// GET /api/suppliers/1
const one = await api.get("suppliers.getById", { params: { id: 1 } });

// PATCH /api/supplier-orders/5/status (Rejected + note hoặc Delivering)
await api.patch("supplierOrders.updateStatus", { status: "Rejected", note: "Hết hàng tạm thời" }, { params: { id: 5 } });
```

Token: client tự đọc từ `localStorage` (key `admin_dashboard_token`). Sau login lưu token bằng `api.setToken(res.token)`.
