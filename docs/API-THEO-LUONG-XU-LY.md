# API cần trong từng luồng xử lý – Kiểm tra & Luồng chạy

Tài liệu ánh xạ **luồng nghiệp vụ** → **API cần dùng** → **FE có gọi?** → **BE có endpoint?** để đảm bảo luồng chạy đúng.

---

## 1. Luồng 1: Đăng nhập / Đăng xuất

| Bước | API (api-mapping key) | FE gọi? | BE endpoint | Ghi chú |
|------|------------------------|--------|-------------|---------|
| Đăng nhập (email + password) | `auth.login` POST /api/auth/login | ✅ Login.jsx | ✅ AuthController | Sau login gọi `refetchInitialData()` để tải dữ liệu |
| Lấy user hiện tại (nếu cần) | `auth.me` GET /api/auth/me | ❌ Không dùng | ✅ AuthController | Có thể dùng để refresh thông tin user |
| Đăng xuất | — | Chỉ xóa token/local, không gọi API | — | — |

**Kết luận:** Luồng đăng nhập dùng đúng API; luồng chạy ổn.

---

## 2. Luồng 2: Thiết lập dữ liệu nền (Admin) – CRUD NCC, Danh mục, SP, Cửa hàng, User

| Trang | API list | API create | API update | API delete | API đặc biệt | FE gọi? | BE có? |
|-------|----------|------------|------------|------------|--------------|--------|-------|
| **Nhà cung cấp** | suppliers.list | suppliers.create | suppliers.update | suppliers.delete | — | ✅ DataContext + Suppliers.jsx | ✅ DB |
| **Danh mục** | categories.list | categories.create | categories.update | categories.delete | — | ✅ DataContext + Categories.jsx | ✅ DB |
| **Sản phẩm** | products.list | products.create | products.update | products.delete | — | ✅ DataContext + Products.jsx | ✅ DB |
| **Cửa hàng** | stores.list | stores.create | stores.update | stores.delete | — | ✅ DataContext + Stores.jsx | ✅ DB |
| **User** | users.list | users.create | users.update | users.delete | users.resetPassword | ✅ DataContext + Users.jsx | ⚠️ Stub (1 user cứng) |

**Kết luận:** CRUD NCC, Danh mục, SP, Cửa hàng nối đủ API và BE dùng DB. User: FE gọi đủ API, BE vẫn stub.

---

## 3. Luồng 3: Tạo đơn hàng (StoreUser / Admin)

| Bước | API | FE gọi? | BE có? |
|------|-----|--------|--------|
| Lấy cửa hàng, sản phẩm (dropdown) | stores.list, products.list (đã tải trong DataContext) | ✅ Dùng từ context | ✅ |
| Submit đơn | `orders.create` POST /api/orders | ✅ CreateOrder.jsx | ✅ OrdersController (stub/DB tùy BE) |

**Kết luận:** Tạo đơn gọi đúng `orders.create`; luồng chạy được.

---

## 4. Luồng 4: Admin duyệt đơn (Chấp nhận / Từ chối)

| Hành động | API | FE gọi? | BE có? |
|-----------|-----|--------|--------|
| Danh sách đơn | orders.list | ✅ DataContext | ✅ OrdersController |
| Chi tiết đơn (trong list) | — | Dùng orders từ context | — |
| **Chấp nhận đơn** | `orders.accept` PATCH /api/orders/:id/accept | ✅ OrderList.jsx, OrderDetail.jsx | ✅ OrdersController |
| **Từ chối đơn** | `orders.reject` PATCH /api/orders/:id/reject | ✅ OrderList.jsx, OrderDetail.jsx | ✅ OrdersController |

**Kết luận:** Luồng duyệt đơn dùng đủ API; BE có đủ route.

---

## 5. Luồng 5: NCC xử lý đơn (SupplierUser)

| Hành động | API | FE gọi? | BE có? |
|-----------|-----|--------|--------|
| Danh sách đơn NCC | orders.list (FE lọc theo supplierId) hoặc supplierOrders.list | ✅ Dùng orders từ context, lọc theo currentUser.supplierId | ✅ supplier-orders (stub) |
| Chi tiết đơn NCC | — | Dùng order/orderSupplier từ context | — |
| **Confirm / Reject / Đang giao / Đã giao / Báo giao thiếu** | `supplierOrders.updateStatus` PATCH /api/supplier-orders/:id/status | ✅ SupplierOrderDetail.jsx | ✅ SupplierOrdersController |

**Ghi chú:** FE không gọi `supplierOrders.list`; dùng `orders.list` rồi lọc theo `supplierId`. Cả hai cách đều hợp lệ. Nếu muốn tải riêng đơn NCC có thể dùng `supplierOrders.list`.

**Kết luận:** Cập nhật trạng thái đơn NCC gọi đúng API; luồng chạy.

---

## 6. Luồng 6: Store/Admin – Chi tiết đơn: Xác nhận nhận hàng & Nhập kho

| Hành động | API | FE gọi? | BE có? |
|-----------|-----|--------|--------|
| **Xác nhận đã nhận hàng** (kèm ảnh) | `orderSuppliers.confirmReceive` PATCH /api/order-suppliers/:id/confirm-receive | ✅ OrderDetail.jsx (api.request + formData) | ✅ OrderSuppliersController |
| **Nhập kho** | `orderSuppliers.stockIn` POST /api/order-suppliers/:id/stock-in | ✅ OrderDetail.jsx | ✅ OrderSuppliersController |

**Kết luận:** Cả hai hành động đều gọi đúng API; BE có đủ endpoint.

---

## 7. Luồng 7: Admin đóng đơn tổng

| Hành động | API | FE gọi? | BE có? |
|-----------|-----|--------|--------|
| **Chấp nhận đơn tổng** | `orders.confirmTotal` PATCH /api/orders/:id/confirm-total | ✅ OrderDetail.jsx | ✅ OrdersController |

**Kết luận:** Luồng đóng đơn dùng đúng API.

---

## 8. Luồng 6 (tiếp): Admin cập nhật trạng thái đơn NCC (khi NCC không dùng hệ thống)

| Hành động | API | FE gọi? | BE có? |
|-----------|-----|--------|--------|
| Cập nhật trạng thái 1 đơn NCC (dropdown + nút) | `orderSuppliers.updateStatus` PATCH /api/order-suppliers/:id/status | ✅ OrderDetail.jsx | ✅ OrderSuppliersController |

**Kết luận:** Cập nhật trạng thái đơn NCC từ màn Chi tiết đơn gọi đúng API.

---

## 9. Luồng 8: Quản lý kho (StoreUser)

| Hành động | API | FE gọi? | BE có? |
|-----------|-----|--------|--------|
| Tồn kho theo cửa hàng | warehouse.stock GET /api/warehouse/stock?storeId= | ✅ Warehouse.jsx | ✅ WarehouseController (stub) |
| Lịch sử nhập/xuất | warehouse.transactions GET /api/warehouse/transactions?storeId=&dateFrom=&dateTo= | ✅ Warehouse.jsx | ✅ WarehouseController (stub) |

**Kết luận:** FE gọi đủ API kho; BE có route (dữ liệu stub).

---

## 10. Luồng 9: Báo cáo (Admin)

| Nguồn dữ liệu | API (nếu dùng) | FE hiện tại | BE có? |
|---------------|-----------------|-------------|--------|
| Báo cáo theo NCC/Cửa hàng/ngày | reports.summary GET /api/reports/summary | ❌ Dùng orders/suppliers/stores từ context, tính trên FE | ✅ ReportsController (stub) |

**Kết luận:** Báo cáo đang dùng dữ liệu từ context (orders.list, suppliers.list, stores.list), không gọi `reports.summary`. Có thể chuyển sang gọi API khi BE có báo cáo thật.

---

## 11. Luồng 10: Dashboard Home & Cài đặt

| Thành phần | API | FE hiện tại | BE có? |
|------------|-----|-------------|--------|
| Thống kê dashboard | dashboard.stats GET /api/dashboard/stats | ❌ Dùng orders từ context, tính trên FE | ✅ DashboardController (stub) |
| Cập nhật profile | auth.updateProfile PUT /api/auth/profile | ✅ Settings.jsx | ✅ AuthController |
| Đổi mật khẩu | auth.changePassword POST /api/auth/change-password | ✅ Settings.jsx | ✅ AuthController |

**Kết luận:** Profile và đổi mật khẩu gọi đúng API. Dashboard dùng dữ liệu từ context, không gọi dashboard.stats.

---

## 12. Tổng hợp: API mapping vs FE vs BE

| Nhóm API | Key | Method | Path | FE gọi | BE có |
|----------|-----|--------|------|--------|-------|
| Auth | auth.login | POST | /api/auth/login | ✅ | ✅ |
| Auth | auth.me | GET | /api/auth/me | ❌ | ✅ |
| Auth | auth.changePassword | POST | /api/auth/change-password | ✅ | ✅ |
| Auth | auth.updateProfile | PUT | /api/auth/profile | ✅ | ✅ |
| Suppliers | *.list, create, update, delete | GET/POST/PUT/DELETE | /api/suppliers | ✅ | ✅ DB |
| Categories | *.list, create, update, delete | GET/POST/PUT/DELETE | /api/categories | ✅ | ✅ DB |
| Products | *.list, create, update, delete | GET/POST/PUT/DELETE | /api/products | ✅ | ✅ DB |
| Stores | *.list, create, update, delete | GET/POST/PUT/DELETE | /api/stores | ✅ | ✅ DB |
| Users | *.list, create, update, delete, resetPassword | GET/POST/PUT/DELETE/POST | /api/users | ✅ | ⚠️ Stub |
| Orders | orders.list, create | GET, POST | /api/orders | ✅ | ✅ |
| Orders | orders.accept, reject, confirmTotal | PATCH | /api/orders/:id/accept, reject, confirm-total | ✅ | ✅ |
| OrderSuppliers | confirmReceive, stockIn, updateStatus | PATCH/POST/PATCH | /api/order-suppliers/:id/... | ✅ | ✅ |
| SupplierOrders | list, getById, updateStatus | GET, PATCH | /api/supplier-orders | updateStatus ✅; list/getById không dùng (FE dùng orders) | ✅ |
| Warehouse | stock, transactions | GET | /api/warehouse/stock, transactions | ✅ | ✅ stub |
| Reports | summary | GET | /api/reports/summary | ❌ | ✅ stub |
| Dashboard | stats | GET | /api/dashboard/stats | ❌ | ✅ stub |

---

## 13. Luồng chạy end-to-end (tóm tắt)

1. **Đăng nhập** → auth.login → refetchInitialData() → orders.list, suppliers.list, categories.list, products.list, stores.list, users.list.
2. **Admin CRUD** NCC/Danh mục/SP/Cửa hàng/User → đủ API, BE DB (trừ User stub).
3. **Tạo đơn** → orders.create.
4. **Admin duyệt** → orders.accept hoặc orders.reject.
5. **NCC xử lý** → supplierOrders.updateStatus (Confirm/Reject/Delivering/Delivered/Partial).
6. **Store xác nhận nhận hàng** → orderSuppliers.confirmReceive (FormData ảnh).
7. **Store nhập kho** → orderSuppliers.stockIn.
8. **Admin cập nhật trạng thái đơn NCC** → orderSuppliers.updateStatus.
9. **Admin đóng đơn tổng** → orders.confirmTotal.
10. **Kho** → warehouse.stock, warehouse.transactions (stub).
11. **Cài đặt** → auth.updateProfile, auth.changePassword.

**Kết luận:** Các API cần trong từng luồng đã có trong api-mapping; FE gọi đúng các API cho luồng chính (đơn, NCC, Store, Auth); BE có đủ endpoint (một số stub/DB tùy module). Luồng xử lý chạy được từ đăng nhập → tạo đơn → duyệt → NCC xử lý → xác nhận nhận hàng / nhập kho → đóng đơn.
