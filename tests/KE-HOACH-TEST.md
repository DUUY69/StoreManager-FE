# Kế hoạch test – Hệ thống Admin Dashboard (Đặt hàng NCC)

Tài liệu liệt kê **tất cả chức năng cần test**, **test gì**, **kết quả dự kiến**, theo **từng luồng nghiệp vụ**. Test được thực hiện theo đúng thứ tự luồng dưới đây.

---

## 1. Luồng nghiệp vụ tổng quan

```
[1] Đăng nhập / Đăng xuất
       ↓
[2] Admin: Thiết lập dữ liệu nền (NCC, Danh mục, Sản phẩm, Cửa hàng, User)
       ↓
[3] Store/Admin: Tạo đơn hàng (chọn cửa hàng, sản phẩm, gửi đơn)
       ↓
[4] Admin: Duyệt đơn (Chấp nhận / Từ chối đơn Submitted)
       ↓
[5] NCC: Xem đơn → Xác nhận / Từ chối / Báo giao thiếu / Đang giao / Đã giao
       ↓
[6] Store/Admin: Xem chi tiết đơn → Xác nhận nhận hàng, Nhập kho
       ↓
[7] Admin: Đóng đơn tổng (khi tất cả NCC Delivered/Completed)
       ↓
[8] Kho: Xem tồn kho, lịch sử nhập/xuất
       ↓
[9] Báo cáo: Thống kê theo thời gian, NCC, cửa hàng
```

---

## 2. Chi tiết test theo từng chức năng

### 2.1 Đăng nhập / Đăng xuất (Auth)

| STT | Test case | Các bước / Điều kiện | Kết quả dự kiến |
|-----|-----------|----------------------|------------------|
| A1  | Mở trang đăng nhập | Vào `/auth/sign-in` | Hiển thị tiêu đề "Đăng nhập", form chọn user (demo) hoặc email/password (khi bật API) |
| A2  | Đăng nhập với user mặc định (Admin) | Chọn user (hoặc không đổi), bấm "Đăng nhập" | Chuyển đến `/dashboard/home`, thấy menu Dashboard, Nhà cung cấp, ... |
| A3  | Đăng nhập với StoreUser | Chọn user "Nguyễn Văn An" (StoreUser) → Đăng nhập | Vào dashboard, thấy menu Tạo đơn, Danh sách đơn, Quản lý kho; không thấy Nhà cung cấp, User |
| A4  | Đăng nhập với SupplierUser | Chọn user "Lê Văn Cường" (SupplierUser) → Đăng nhập | Vào dashboard, thấy menu "Đơn cần xử lý"; không thấy Tạo đơn, Nhà cung cấp |
| A5  | Đăng xuất | Đăng nhập → Mở menu user → Bấm "Đăng xuất" | Chuyển về `/auth/sign-in`, thấy form đăng nhập |

---

### 2.2 Dashboard (Trang chủ)

| STT | Test case | Các bước / Điều kiện | Kết quả dự kiến |
|-----|-----------|----------------------|------------------|
| D1  | Hiển thị Dashboard sau khi đăng nhập | Đăng nhập Admin | Có tiêu đề/ nội dung "Dashboard", sidebar có brand "Cafe - Đặt hàng NCC" |
| D2  | Menu sidebar đúng theo role Admin | Đăng nhập Admin | Có: Dashboard, Nhà cung cấp, Danh mục, Sản phẩm, Cửa hàng, User, Tạo đơn, Danh sách đơn, Báo cáo; **không có** Quản lý kho (Admin chỉ gửi đơn và quản lý tình trạng đơn) |
| D3  | Click "Dashboard" | Click link Dashboard trên sidebar | URL chứa `/dashboard/home`, nội dung trang home hiển thị |
| D4  | Tổng quan đơn (số đơn, trạng thái) | Vào Dashboard Home | Có thống kê hoặc danh sách liên quan đơn (ví dụ: đơn đang giao, đơn gần đây) |

---

### 2.3 Quản lý Nhà cung cấp (Admin)

| STT | Test case | Các bước / Điều kiện | Kết quả dự kiến |
|-----|-----------|----------------------|------------------|
| S1  | Mở trang Nhà cung cấp | Menu → Nhà cung cấp | Tiêu đề "Quản lý Nhà cung cấp", bảng có cột: Mã, Tên, Liên hệ, Email, Địa chỉ, Trạng thái, Thao tác |
| S2  | Bộ lọc | Nhập tìm kiếm, chọn Trạng thái | Danh sách lọc đúng theo từ khóa và trạng thái |
| S3  | Mở form Thêm NCC | Bấm "Thêm" | Modal/form "Thêm Nhà cung cấp", có ô Mã, Tên, Liên hệ, Email, Địa chỉ, Trạng thái |
| S4  | Thêm NCC mới | Nhập đủ thông tin → Lưu | Đóng form, danh sách có thêm 1 dòng mới (hoặc thông báo thành công) |
| S5  | Sửa NCC | Bấm Sửa trên 1 dòng → Sửa thông tin → Lưu | Dữ liệu dòng đó cập nhật đúng |
| S6  | Xóa NCC | Bấm Xóa → Xác nhận | Dòng biến mất khỏi bảng (hoặc thông báo thành công) |

---

### 2.4 Quản lý Danh mục (Admin)

| STT | Test case | Các bước / Điều kiện | Kết quả dự kiến |
|-----|-----------|----------------------|------------------|
| C1  | Mở trang Danh mục | Menu → Danh mục | Tiêu đề "Quản lý Danh mục", bảng có cột ID, Tên, Mô tả, Thao tác |
| C2  | Thêm danh mục | Bấm Thêm → Nhập Tên, Mô tả → Lưu | Form đóng, danh sách có danh mục mới |
| C3  | Sửa danh mục | Bấm Sửa → Sửa → Lưu | Dữ liệu cập nhật đúng |
| C4  | Xóa danh mục | Bấm Xóa → Xác nhận | Dòng biến mất khỏi bảng |

---

### 2.5 Quản lý Sản phẩm (Admin)

| STT | Test case | Các bước / Điều kiện | Kết quả dự kiến |
|-----|-----------|----------------------|------------------|
| P1  | Mở trang Sản phẩm | Menu → Sản phẩm | Tiêu đề "Quản lý Sản phẩm", có Bộ lọc (tìm kiếm, NCC, Danh mục, Trạng thái), bảng có Mã, Tên, NCC, Danh mục, Đơn vị, Giá, Trạng thái |
| P2  | Lọc sản phẩm | Chọn NCC / Danh mục / Trạng thái | Danh sách lọc đúng |
| P3  | Thêm sản phẩm | Thêm → Nhập Mã, Tên, NCC, Danh mục, Đơn vị, Giá, Trạng thái → Lưu | Sản phẩm mới xuất hiện trong bảng |
| P4  | Sửa / Xóa sản phẩm | Sửa hoặc Xóa → thao tác | Dữ liệu cập nhật hoặc dòng bị xóa đúng |

---

### 2.6 Quản lý Cửa hàng (Admin)

| STT | Test case | Các bước / Điều kiện | Kết quả dự kiến |
|-----|-----------|----------------------|------------------|
| ST1 | Mở trang Cửa hàng | Menu → Cửa hàng | Tiêu đề "Quản lý Cửa hàng", bảng có Mã, Tên, Địa chỉ, Điện thoại, Trạng thái |
| ST2 | Thêm / Sửa / Xóa cửa hàng | Thực hiện từng thao tác | Danh sách thay đổi đúng theo thao tác |

---

### 2.7 Quản lý User (Admin)

| STT | Test case | Các bước / Điều kiện | Kết quả dự kiến |
|-----|-----------|----------------------|------------------|
| U1  | Mở trang User | Menu → User | Tiêu đề "Quản lý User", bảng có Email, Tên, Role, Store/NCC, Trạng thái |
| U2  | Thêm / Sửa / Xóa user | Thực hiện từng thao tác | Danh sách thay đổi đúng, role và store/NCC hiển thị đúng |

---

### 2.8 Tạo đơn hàng (Admin / StoreUser)

| STT | Test case | Các bước / Điều kiện | Kết quả dự kiến |
|-----|-----------|----------------------|------------------|
| O1  | Mở trang Tạo đơn | Menu → Tạo đơn | Có tiêu đề "Tạo đơn hàng", danh sách sản phẩm (có lọc), giỏ hàng |
| O2  | Admin chọn cửa hàng | Role Admin, chọn Store trong dropdown | Cửa hàng được chọn đúng cho đơn |
| O3  | Thêm sản phẩm vào giỏ | Chọn sản phẩm (có thể nhiều NCC) | Giỏ hiển thị sản phẩm, số lượng, đơn giá |
| O4  | Submit đơn | Có ít nhất 1 sản phẩm trong giỏ → Bấm "Submit đơn" | Thông báo thành công, chuyển đến Danh sách đơn, đơn mới có trạng thái Submitted (hoặc tương đương) |
| O5  | Submit khi giỏ trống | Giỏ trống → Bấm Submit | Không gửi được (nút disabled hoặc cảnh báo) |

---

### 2.9 Danh sách đơn & Chi tiết đơn (Admin / StoreUser)

| STT | Test case | Các bước / Điều kiện | Kết quả dự kiến |
|-----|-----------|----------------------|------------------|
| O6  | Mở Danh sách đơn | Menu → Danh sách đơn | Có bảng/danh sách đơn (mã đơn, cửa hàng, trạng thái, ...), có thể lọc |
| O7  | Mở chi tiết đơn | Click vào 1 đơn | Chuyển đến `/dashboard/orders/:id`, hiển thị thông tin đơn, từng NCC (OrderSupplier), sản phẩm, trạng thái từng phần |
| O8  | Admin: Chấp nhận đơn Submitted | Đơn trạng thái Submitted → Bấm "Chấp nhận" | Tất cả OrderSupplier Pending chuyển Confirmed, đơn chuyển Processing |
| O9  | Admin: Từ chối đơn Submitted | Đơn Submitted → Bấm "Từ chối" | OrderSupplier chuyển Rejected, đơn Cancelled (hoặc tương đương) |
| O10 | Store: Xác nhận nhận hàng | OrderSupplier trạng thái Delivered/Partial → Bấm "Xác nhận nhận hàng" (có thể upload ảnh) | Trạng thái phần đó chuyển Completed (hoặc đã nhận) |
| O11 | Nhập kho | OrderSupplier Delivered/Completed/Partial → Bấm "Nhập kho" | Thông báo/trạng thái đã nhập kho, (khi có API) tồn kho cập nhật |
| O12 | Admin: Đóng đơn tổng | Đơn Processing, tất cả NCC Delivered/Completed → Bấm "Đóng đơn" / "Chấp nhận đơn tổng" | Đơn chuyển Completed |

---

### 2.10 Đơn cần xử lý – NCC (SupplierUser)

| STT | Test case | Các bước / Điều kiện | Kết quả dự kiến |
|-----|-----------|----------------------|------------------|
| N1  | Mở danh sách đơn NCC | Đăng nhập NCC → Menu "Đơn cần xử lý" | Danh sách chỉ gồm đơn của NCC đang đăng nhập |
| N2  | Mở chi tiết đơn NCC | Click 1 đơn | Trang chi tiết đơn NCC: sản phẩm, số lượng, đơn giá, trạng thái |
| N3  | Xác nhận đơn (Confirm) | Trạng thái Pending → Bấm "Confirm" | Trạng thái chuyển Confirmed, có ngày xác nhận |
| N4  | Từ chối đơn (Reject) | Pending → Bấm "Reject" | Trạng thái chuyển Rejected |
| N5  | Báo giao thiếu (Partial) | Confirmed/Delivering → Bấm "Báo giao thiếu" → Nhập ghi chú | Trạng thái Partial, ghi chú hiển thị |
| N6  | Đang giao (Delivering) | Confirmed → Bấm "Đang giao" | Trạng thái Delivering |
| N7  | Đã giao (Delivered) | Delivering → Bấm "Đã giao" | Trạng thái Delivered |

---

### 2.11 Quản lý kho (chỉ StoreUser)

Admin không tham gia quản lý kho; chỉ Store (StoreUser) quản lý tồn kho của cửa hàng mình.

| STT | Test case | Các bước / Điều kiện | Kết quả dự kiến |
|-----|-----------|----------------------|------------------|
| W0  | Admin không thấy menu Quản lý kho | Đăng nhập Admin | Sidebar không có mục "Quản lý kho" |
| W1  | Mở trang Quản lý kho (StoreUser) | Đăng nhập StoreUser → Menu → Quản lý kho | Tiêu đề "Quản lý kho", có Bộ lọc (Từ ngày, Đến ngày); cửa hàng mặc định là store của user |
| W2  | Xem tồn kho theo cửa hàng | StoreUser (một store) | Bảng tồn kho: sản phẩm, số lượng, cửa hàng |
| W3  | Xem lịch sử giao dịch | Chọn khoảng ngày | Bảng lịch sử nhập/xuất: loại (In/Out/Adjust), số lượng, tham chiếu đơn |

---

### 2.12 Báo cáo (Admin)

| STT | Test case | Các bước / Điều kiện | Kết quả dự kiến |
|-----|-----------|----------------------|------------------|
| R1  | Mở trang Báo cáo | Menu → Báo cáo | Có nội dung báo cáo / thống kê (theo thời gian, NCC, cửa hàng, đơn) |
| R2  | Lọc theo khoảng ngày | Chọn Từ ngày, Đến ngày (nếu có) | Số liệu cập nhật theo khoảng ngày |

---

### 2.13 Navbar & Giao diện chung

| STT | Test case | Các bước / Điều kiện | Kết quả dự kiến |
|-----|-----------|----------------------|------------------|
| G1  | Hiển thị tên user trên navbar | Đã đăng nhập | Có tên user (hoặc role) trên góc phải |
| G2  | Thông báo đơn (nếu có) | Có đơn Pending/Delivered/Partial liên quan | Icon chuông có badge số, click mở danh sách thông báo |
| G3  | Đăng xuất từ menu user | Click tên user → Đăng xuất | Về trang đăng nhập |

---

## 3. Thứ tự thực hiện test theo luồng

1. **Auth**: A1 → A2 → (A3, A4 tùy role) → D1, D2, D3, D4 → G1 → A5 (đăng xuất).
2. **Thiết lập (Admin)**: A2 → S1–S6, C1–C4, P1–P4, ST1–ST2, U1–U2.
3. **Luồng đơn**: A2 (Admin) → O1–O5 (tạo đơn) → O6–O7 (xem danh sách & chi tiết) → A4 (đăng nhập NCC) → N1–N7 → A2 (StoreUser) → O6–O7, O10–O11 → A2 (Admin) → O8/O9, O12.
4. **Kho & Báo cáo**: W1–W3, R1–R2.
5. **Kiểm tra lại Navbar**: G2, G3.

---

## 4. Checklist: Nút và luồng cần test (đã / chưa cover E2E)

### 4.1 CRUD (Nhà cung cấp, Danh mục, Sản phẩm, Cửa hàng, User)

| Trang | Nút / Hành động | Test case | Đã có E2E? |
|-------|------------------|-----------|------------|
| NCC | Thêm | S3 | ✓ |
| NCC | Lưu (trong form) | S4 | ✓ buttons-and-flows |
| NCC | Hủy (trong form) | - | ✓ |
| NCC | Sửa (icon bút) | S5 | ✓ mở form Sửa |
| NCC | Xóa (icon thùng) + xác nhận | S6 | ❌ chưa (cần xử lý confirm) |
| Danh mục | Thêm, Lưu, Hủy | C2 | ✓ |
| Danh mục | Sửa, Xóa | C3–C4 | ❌ chưa |
| Sản phẩm | Thêm, Lưu, Hủy, Sửa, Xóa | P3, P4 | ❌ chưa |
| Cửa hàng | Thêm, Lưu, Hủy, Sửa, Xóa | ST2 | ❌ chưa |
| User | Thêm, Lưu, Hủy, Sửa, Xóa | U2 | ❌ chưa |

### 4.2 Tạo đơn hàng

| Nút / Hành động | Test case | Đã có E2E? |
|------------------|-----------|------------|
| Chọn cửa hàng (Admin) | O2 | ❌ chưa |
| Thêm sản phẩm vào giỏ (+) | O3 | ✓ buttons-and-flows |
| Tăng / Giảm số lượng (+/-) | O3 | ❌ chưa |
| Xóa khỏi giỏ (icon thùng) | - | ❌ chưa |
| Submit đơn | O4 | ❌ chưa |
| Nút Submit (enabled khi có giỏ) | O5 | ✓ (kiểm tra không disabled) |

### 4.3 Danh sách đơn

| Nút / Hành động | Đã có E2E? |
|------------------|------------|
| Bộ lọc (trạng thái, NCC, cửa hàng, ngày) | ❌ chưa |
| Xóa bộ lọc | ❌ chưa |
| Click vào đơn → chi tiết | ✓ O7 |
| In đơn (nếu có) | ❌ chưa |

### 4.4 Chi tiết đơn (OrderDetail)

| Nút / Hành động | Test case | Đã có E2E? |
|------------------|-----------|------------|
| Quay lại | - | ❌ chưa |
| In / Xuất đơn | - | ❌ chưa |
| Chấp nhận đơn (Admin, đơn Submitted) | O8 | ❌ chưa |
| Từ chối đơn (Admin, đơn Submitted) | O9 | ❌ chưa |
| Chấp nhận đơn tổng (Admin, khi tất cả NCC giao xong) | O12 | ❌ chưa |
| Xác nhận đã nhận hàng (Store) → mở modal | O10 | ❌ chưa |
| Trong modal: Hủy, Xác nhận đã nhận hàng & gửi ảnh | O10 | ❌ chưa |
| Nhập kho (từng OrderSupplier) | O11 | ❌ chưa |
| In theo từng NCC | - | ❌ chưa |

### 4.5 Đơn NCC (SupplierOrderDetail)

| Nút / Hành động | Test case | Đã có E2E? |
|------------------|-----------|------------|
| Quay lại | - | ❌ chưa |
| Confirm (Pending → Confirmed) | N3 | ❌ chưa |
| Reject (Pending → Rejected) | N4 | ❌ chưa |
| Báo giao thiếu (Partial) + nhập ghi chú | N5 | ❌ chưa |
| Đang giao (Delivering) | N6 | ❌ chưa |
| Đã giao (Delivered) | N7 | ❌ chưa |

### 4.6 Quản lý kho (chỉ StoreUser)

| Nút / Hành động | Đã có E2E? |
|------------------|------------|
| Admin không thấy menu Quản lý kho | ❌ chưa |
| Bộ lọc (từ ngày, đến ngày) | ✓ W1 (có bộ lọc) |
| Xóa bộ lọc | ❌ chưa |

### 4.7 Báo cáo

| Nút / Hành động | Đã có E2E? |
|------------------|------------|
| Lọc theo khoảng ngày (nếu có) | ❌ chưa |
| Nội dung thống kê hiển thị | ✓ R1 |

---

## 5. E2E Tests hiện có (Selenium) – Ánh xạ với kế hoạch

| File spec | Phủ các test case (số) |
|-----------|------------------------|
| `login.spec.js` | A1, A2 |
| `dashboard.spec.js` | D1, D2, D3 |
| `navbar.spec.js` | G1, G2 (một phần), A5 / G3 |
| `suppliers.spec.js` | S1, S3 (mở form) |
| `categories.spec.js` | C1, C2 (mở form) |
| `products.spec.js` | P1, P2 (một phần) |
| `stores.spec.js` | ST1 |
| `users.spec.js` | U1 |
| `orders.spec.js` | O1, O6, O7 (mở chi tiết) |
| `warehouse.spec.js` | W1, W2 (một phần) |
| `reports.spec.js` | R1 |
| `supplier-orders.spec.js` | N1, N2 (một phần) |
| `buttons-and-flows.spec.js` | S4–S6, C2–C4, P3–P4, ST2, U2, O2–O5, O8–O12, N3–N7, W2 (nút), lọc/xóa lọc |
| **`crud-full.spec.js`** | **CRUD đầy đủ (Thêm, Lưu, Hủy, Sửa, Xóa) cho NCC, Danh mục, Sản phẩm, Cửa hàng, User – không bỏ nút nào** |

Test được chạy bằng:
- **Theo luồng nghiệp vụ (một file, đúng thứ tự):** `npm run test:e2e:flow`
- **CRUD đầy đủ (5 module, Thêm/Lưu/Hủy/Sửa/Xóa):** `npm run test:e2e:crud`
- **Toàn bộ spec (từng nhóm chức năng):** `npm run test:e2e`

(Sau khi đã chạy `npm run dev`; set `TEST_BASE_URL` nếu app chạy port khác.)

Kết quả: Mocha in ra từng test **pass (√)** hoặc **fail** với thông báo lỗi. File `full-flow.spec.js` ánh xạ trực tiếp [A1], [A2], [D1]–[D3], [S1], [C1], [P1], [ST1], [U1], [O1], [O6]–[O7], [W1], [R1], [N1], [G3].
