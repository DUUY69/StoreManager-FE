# Kiểm tra chức năng – BE API & FE

## Tổng quan

| Trang / API | BE: Dữ liệu từ DB? | FE: Nút "Tải lại" khi rỗng? | FE: Cập nhật local sau CRUD? | FE: Chuẩn hóa Id/Name (PascalCase)? |
|-------------|--------------------|----------------------------|------------------------------|-------------------------------------|
| **Nhà cung cấp** (Suppliers) | ✅ Có | ✅ Có | ✅ Có | ✅ Có (Suppliers.jsx) |
| **Danh mục** (Categories) | ✅ Có | ✅ Có | ✅ Có | ✅ Có (Categories.jsx) |
| **Cửa hàng** (Stores) | ✅ Có | ✅ Có | ✅ Có | ✅ Có (Stores.jsx) |
| **Sản phẩm** (Products) | ✅ Có | ✅ Có | ✅ Có | ✅ Có (Products.jsx) |
| **User** (Users) | ⚠️ Stub (1 user cứng) | ✅ Có | ✅ Có | ✅ Có (Users.jsx) |
| **Danh sách đơn** (Orders) | ⚠️ Stub / cache | ✅ Có | ✅ Có (optimistic) | ✅ Có (DataContext normalizeOrders) |
| **Chi tiết đơn / OrderSupplier status** | ⚠️ Một phần (API có, DB tùy BE) | - | ✅ Có (optimistic) | ✅ Orders đã normalize trong context |
| **Đơn NCC** (SupplierOrderList/Detail) | Dùng chung orders | - | ✅ Có | ✅ Dùng orders đã normalize |
| **Tạo đơn** (CreateOrder) | Gửi API (nếu có) | - | - | Dùng stores/suppliers/products từ context |
| **Dashboard Home** | Stub | - | - | - |
| **Kho** (Warehouse) | Stub | - | - | - |
| **Báo cáo** (Reports) | Stub | - | - | - |
| **Cài đặt** (Settings) | Profile/đổi mật khẩu qua Auth API | - | - | - |

## Lỗi đã xử lý (giống nhau)

1. **BE trả stub thay vì DB**  
   Đã chuyển Suppliers, Categories, Stores, Products sang đọc/ghi DB (EF Core). Users và Orders vẫn stub (Users do bảng có PasswordHash; Orders phức tạp bảng con).

2. **FE không cập nhật state sau CRUD**  
   Các trang CRUD (Suppliers, Categories, Stores, Products, Users) sau khi gọi API thành công đều cập nhật local state (optimistic), rồi mới `refetch`. Xóa cũng cập nhật local ngay.

3. **FE không có nút "Tải lại" khi danh sách rỗng**  
   Đã thêm nút "Tải lại" khi `useApi`, danh sách rỗng và không đang loading cho: Suppliers, Categories, Stores, Products, Users, OrderList.

4. **API trả PascalCase (Id, Name) → FE lỗi hiển thị**  
   - DataContext: `normalizeOrders()` chuẩn hóa toàn bộ orders (và OrderSuppliers, OrderItems) khi nhận từ API hoặc cache.  
   - Các trang CRUD dùng `row.id ?? row.Id`, `s.name ?? s.Name` (và tương tự) cho bảng và dropdown.

## Cách kiểm tra nhanh

1. Bật `VITE_USE_API=true` trong `.env`, đăng nhập bằng tài khoản BE.
2. Vào từng trang: Nhà cung cấp, Danh mục, Cửa hàng, Sản phẩm, User, Danh sách đơn.
3. Kiểm tra: danh sách lấy từ BE (đúng dữ liệu DB), Thêm/Sửa/Xóa cập nhật ngay trên màn hình, khi danh sách trống có nút "Tải lại".
4. Xem toast góc trên phải: mỗi thao tác CRUD/API có log thành công/lỗi.

## Việc có thể làm tiếp

- **Users API**: Tạo bảng/entity User trong BE, đọc/ghi DB (lưu hash mật khẩu khi tạo/reset).
- **Orders API**: Orders + OrderSuppliers + OrderItems đọc/ghi DB để trạng thái và đơn hàng lưu vĩnh viễn.
