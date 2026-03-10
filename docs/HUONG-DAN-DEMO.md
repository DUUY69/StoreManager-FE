# Hướng dẫn demo – Multi-Supplier Order Management System

## Chạy dự án

```bash
npm install
npm run dev
```

Mở http://localhost:5173 → mặc định vào **Dashboard** (đăng nhập sẵn với user Admin).

## Đăng nhập / Đổi user (demo)

- Vào **Đăng xuất** (menu góc phải navbar) → chuyển về trang **Đăng nhập**.
- Hoặc truy cập: http://localhost:5173/auth/sign-in
- Trên trang Đăng nhập: **Chọn tài khoản demo** (dropdown) → bấm **Đăng nhập**.
- Menu bên trái sẽ thay đổi theo **role** của user đã chọn.

## Các user demo

| User            | Role          | Ghi chú                          |
|-----------------|---------------|-----------------------------------|
| Admin System    | Admin         | Quản lý NCC, Category, Product, Store, User; xem Report |
| Nguyễn Văn A    | StoreUser     | Store 1 – Tạo đơn, xem đơn       |
| Trần Thị B      | StoreUser     | Store 2                          |
| Lê Văn C        | SupplierUser  | NCC 1 – Xử lý đơn NCC            |
| Phạm Thị D      | SupplierUser  | NCC 2                            |

## Luồng demo nhanh

1. **Admin**: Đăng nhập Admin → menu: Dashboard, Nhà cung cấp, Danh mục, Sản phẩm, Cửa hàng, User, Danh sách đơn, Báo cáo. Thử Thêm/Sửa/Xóa ở từng danh mục.
2. **Store**: Đăng nhập “Nguyễn Văn A” (Store 1) → **Tạo đơn** → chọn sản phẩm (lọc NCC, Danh mục) → thêm vào giỏ → **Submit đơn** → vào **Danh sách đơn** → **Xem chi tiết** (đơn tách theo từng NCC).
3. **NCC**: Đăng nhập “Lê Văn C” (NCC 1) → **Đơn cần xử lý** → chọn một đơn → **Confirm** / **Reject** / **Đang giao** / **Đã giao**.

## Dữ liệu

- Toàn bộ dữ liệu hiện là **mock** trong `src/data/*.js`.
- CRUD (Thêm/Sửa/Xóa) đang lưu trong **state** (DataContext), tải lại trang sẽ mất.
- Sau này chỉ cần thay bằng gọi API BE; giao diện và luồng giữ nguyên.

## Cấu trúc thêm

- **Auth**: `src/context/AuthContext.jsx` – currentUser, login, logout.
- **Data (mock)**: `src/context/DataContext.jsx` – suppliers, categories, products, stores, users, orders (CRUD trong bộ nhớ).
- **Routes**: `src/routes.jsx` – `dashboardRoutesConfig` (theo role), `getDashboardRoutesForRole(role)`.
- **Trang mới**: `src/pages/dashboard/` – DashboardHome, Suppliers, Categories, Products, Stores, Users, CreateOrder, OrderList, OrderDetail, SupplierOrderList, SupplierOrderDetail, Reports; `src/pages/auth/Login.jsx`.
