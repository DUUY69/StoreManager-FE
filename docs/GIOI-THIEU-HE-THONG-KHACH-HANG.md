# GIỚI THIỆU HỆ THỐNG – MULTI-SUPPLIER ORDER MANAGEMENT

> Tài liệu dành cho **khách hàng / đối tác** – giới thiệu hệ thống, cách sử dụng demo và mọi thông tin cần thiết.

---

## 1. HỆ THỐNG LÀ GÌ?

**Hệ thống Quản lý đơn hàng đa Nhà cung cấp (Multi-Supplier Order Management)** là ứng dụng web dùng để:

- **Cửa hàng** đặt hàng từ **nhiều Nhà cung cấp (NCC)** trong **một đơn**.
- Hệ thống **tự tách** đơn tổng thành **đơn con theo từng NCC** để gửi và theo dõi riêng.
- **Admin** duyệt/từ chối đơn, xem báo cáo; **Cửa hàng** tạo đơn, xác nhận nhận hàng kèm ảnh; **NCC** xem và xử lý đơn của mình.

Dữ liệu demo hiện tại theo chủ đề **quán cafe** (cà phê, sữa, syrup, bánh, vật tư F&B).

---

## 2. CÁCH CHẠY ỨNG DỤNG (DEMO)

### Yêu cầu

- **Node.js** (phiên bản 18 trở lên khuyến nghị).
- Trình duyệt: Chrome, Edge, Firefox, Safari (phiên bản mới).

### Các bước

1. Mở terminal tại thư mục dự án.
2. Cài đặt thư viện (chỉ lần đầu):
   ```bash
   npm install
   ```
3. Chạy ứng dụng:
   ```bash
   npm run dev
   ```
4. Mở trình duyệt và truy cập địa chỉ hiển thị (thường là `http://localhost:5173`).
5. Trên màn hình **Đăng nhập**: chọn một **tài khoản demo** trong dropdown và bấm **Đăng nhập** (demo không dùng mật khẩu).

---

## 3. TÀI KHOẢN DEMO

| Vai trò | Tên hiển thị | Email (tham chiếu) | Ghi chú |
|--------|---------------|---------------------|--------|
| **Admin** | Admin Cafe | admin@cafe.vn | Xem toàn bộ đơn, duyệt/từ chối đơn, quản lý NCC/Cửa hàng/Sản phẩm/User, báo cáo. |
| **Cửa hàng – Q1** | Nguyễn Văn An | q1@cafe.vn | Cafe Sài Gòn Quận 1. Tạo đơn, xem đơn của Q1, xác nhận nhận hàng + gửi ảnh. |
| **Cửa hàng – Q7** | Trần Thị Bình | q7@cafe.vn | Cafe Sài Gòn Quận 7. |
| **Cửa hàng – Bình Thạnh** | Lê Thị Hương | bt@cafe.vn | Cafe Sài Gòn Bình Thạnh. |
| **NCC – Cà phê** | Lê Văn Cường | ncc_caphe@supplier.vn | Công ty Cà phê Trung Nguyên. Xem và xử lý đơn con của NCC mình. |
| **NCC – Sữa** | Phạm Thị Dung | ncc_sua@supplier.vn | Công ty Sữa & Đồ uống Vinamilk. |
| **NCC – Syrup** | Hoàng Văn Em | ncc_syrup@supplier.vn | NCC Syrup & Topping Monin. |
| **NCC – Bánh** | Võ Minh Tuấn | ncc_banh@supplier.vn | Công ty Bánh & Snack Kinh Đô. |
| **NCC – Vật tư** | Đặng Thị Lan | ncc_vattu@supplier.vn | Công ty Vật tư F&B Toàn Thắng. |

**Cách đăng nhập:** Trên màn Đăng nhập, chọn **user** (theo tên hoặc email) trong danh sách rồi bấm **Đăng nhập**. Menu và dữ liệu hiển thị sẽ thay đổi theo vai trò.

---

## 4. CHỨC NĂNG THEO TỪNG VAI TRÒ

### 4.1 Admin

- **Dashboard:** Thống kê tổng đơn, đơn đang giao, NCC giao trễ, biểu đồ đơn theo tháng, bảng đơn gần đây.
- **Quản lý:** Nhà cung cấp, Danh mục, Sản phẩm, Cửa hàng, User.
- **Danh sách đơn:** Xem toàn bộ đơn; lọc theo trạng thái, cửa hàng, NCC, ngày. Với đơn **Submitted**: nút **Chấp nhận đơn** và **Từ chối đơn** ngay trên danh sách.
- **Chi tiết đơn:** Xem chi tiết đơn tổng và từng đơn NCC; với đơn Submitted: **Chấp nhận đơn** / **Từ chối đơn**; khi tất cả NCC đã giao xong: **Chấp nhận đơn tổng** (đóng đơn). Xuất đơn in, xuất từng đơn NCC. Xem ảnh Store gửi khi xác nhận nhận hàng.
- **Báo cáo:** Báo cáo theo NCC, theo Cửa hàng; lọc theo ngày; Export CSV.

### 4.2 Cửa hàng (Store)

- **Dashboard:** Đơn gần đây, đơn đang giao, nút Tạo đơn.
- **Tạo đơn:** Chọn sản phẩm (lọc theo NCC, danh mục), thêm vào giỏ, Submit đơn. Hệ thống tự tách đơn theo NCC.
- **Danh sách đơn:** Chỉ đơn của cửa hàng mình; Xem/Theo dõi, In.
- **Chi tiết đơn:** Xem theo từng NCC; **Xác nhận đã nhận hàng** (khi NCC đã Delivered): tải ảnh hàng nhận được và hóa đơn đã ký; Xuất đơn từng NCC để gửi.

### 4.3 Nhà cung cấp (Supplier)

- **Dashboard:** Đơn mới, đơn cần giao hôm nay, đơn gần đây (chỉ đơn con của NCC mình).
- **Đơn cần xử lý:** Danh sách đơn con (OrderSupplier) thuộc NCC; lọc theo trạng thái, ngày.
- **Chi tiết đơn NCC:** Xem chi tiết đơn con, cập nhật trạng thái (Confirm, Delivering, Delivered…).

---

## 5. LUỒNG NGHIỆP VỤ CHÍNH

1. **Admin** thiết lập: NCC, Danh mục, Sản phẩm, Cửa hàng, User.
2. **Cửa hàng** tạo đơn: chọn sản phẩm từ nhiều NCC → Submit → hệ thống tách thành nhiều đơn con (mỗi NCC một đơn).
3. **Admin** với đơn **Submitted**: **Chấp nhận đơn** (chuyển sang xử lý) hoặc **Từ chối đơn** (hủy). Có thể thao tác ngay trên danh sách đơn hoặc trong chi tiết đơn.
4. **NCC** xem đơn con của mình, xác nhận, cập nhật giao hàng (Delivering → Delivered).
5. **Cửa hàng** khi đã nhận hàng: bấm **Xác nhận đã nhận hàng** cho từng NCC, tải ảnh hàng + hóa đơn (Admin cũng xem được).
6. **Admin** khi tất cả NCC đã giao xong: bấm **Chấp nhận đơn tổng** để đóng đơn.
7. **Admin** xem báo cáo theo NCC/Cửa hàng, lọc ngày, Export CSV.

---

## 6. TRẠNG THÁI ĐƠN (GỢI Ý KHI DEMO)

- **Đơn tổng:** Draft → Submitted → Processing → Completed (hoặc Cancelled).
- **Đơn con (NCC):** Pending → Confirmed → Delivering → Delivered → Completed (hoặc Rejected/Partial).

Đơn **Submitted** dùng để demo **Chấp nhận / Từ chối** (Admin). Đơn có đơn con **Delivered** dùng để demo **Xác nhận đã nhận hàng** (Store) và **Chấp nhận đơn tổng** (Admin).

### Khi NCC báo giao thiếu (Partial)

1. **NCC** tại màn **Đơn cần xử lý** → chi tiết đơn → bấm **Báo giao thiếu (Partial)** → có thể nhập ghi chú (ví dụ: thiếu 2 túi do hết hàng, giao bù tuần sau). Đơn con chuyển sang trạng thái **Partial**.
2. **Store/Admin** thấy thông báo **Giao thiếu: Đơn #X - NCC** (trong chuông thông báo hoặc khi vào chi tiết đơn).
3. Tại **Chi tiết đơn**, block đơn con đó hiển thị: chip **Partial**, dòng chữ **NCC đã báo giao thiếu** (kèm ghi chú nếu NCC nhập).
4. Store/Admin vẫn có thể:
   - **Xác nhận đã nhận hàng** (phần hàng đã giao) và gửi ảnh như bình thường.
   - **Nhập kho** (phần thực nhận theo đơn; sau có thể mở rộng cho phép nhập từng dòng theo số lượng thực tế).
5. Sau khi xác nhận nhận hàng, đơn con chuyển **Completed**; đơn tổng cập nhật theo (PartiallyCompleted/Completed tùy các NCC khác).

### API Backend xử lý giao thiếu (Partial)

| Thao tác | API | Ghi chú |
|----------|-----|--------|
| NCC báo giao thiếu + ghi chú | `PATCH /api/supplier-orders/:id/status` | Body: `{ "status": "Partial", "note": "Thiếu 2 túi, giao bù tuần sau" }`. Backend lưu Status và Note. |
| Store xác nhận nhận hàng (kể cả đơn Partial) | `PATCH /api/order-suppliers/:id/confirm-receive` | Giống đơn Delivered, có thể gửi ảnh. |
| Store nhập kho (phần đã nhận) | `POST /api/order-suppliers/:id/stock-in` | Tạo phiếu nhập từ đơn NCC (kể cả khi status = Partial). |

Chi tiết request/response xem **BE: API-FE-LIEN-KET.md** (mục 8.3 và 7.7, 7.8).

---

## 7. TÀI LIỆU KỸ THUẬT (NỘI BỘ / TRIỂN KHAI)

Nếu cần mô tả chi tiết luồng, dữ liệu, API, cấu trúc file:

- **[TONG-HOP-HE-THONG-MULTI-SUPPLIER-ORDER.md](./TONG-HOP-HE-THONG-MULTI-SUPPLIER-ORDER.md)** – Tổng hợp chức năng, phân quyền, cấu trúc dữ liệu, từng màn hình, báo cáo.
- **[KE-HOACH-HE-THONG-MULTI-SUPPLIER-ORDER.md](./KE-HOACH-HE-THONG-MULTI-SUPPLIER-ORDER.md)** – Kế hoạch hệ thống, mục tiêu, kiến trúc.

---

## 8. LƯU Ý CHO KHÁCH HÀNG

- **Demo hiện tại:** Dữ liệu lưu trong bộ nhớ (in-memory). Tải lại trang hoặc đăng xuất/đăng nhập lại có thể làm mất thay đổi. Mục đích là trình diễn luồng và giao diện.
- **Triển khai thật:** Cần kết nối backend (API), cơ sở dữ liệu, xác thực đăng nhập (mật khẩu, token). Cấu trúc và luồng nghiệp vụ trong tài liệu này có thể dùng làm căn bản cho phiên bản production.
- **Hỗ trợ:** Mọi câu hỏi về demo hoặc yêu cầu chỉnh sửa, bổ sung chức năng có thể trao đổi trực tiếp với bên phát triển.

---

*Tài liệu cập nhật theo phiên bản demo hiện tại. Có thể bổ sung screenshot hoặc link demo (nếu deploy) khi bàn giao cho khách.*
