# TỔNG HỢP HỆ THỐNG – MULTI-SUPPLIER ORDER MANAGEMENT

> Tài liệu tổng hợp **đầy đủ** chức năng, luồng nghiệp vụ và chi tiết kỹ thuật đã triển khai (demo frontend).

---

## 1. MỤC TIÊU & TỔNG QUAN

| Mục tiêu | Mô tả |
|----------|--------|
| **Đặt hàng đa NCC** | Cửa hàng (Store) đặt hàng từ **nhiều Nhà cung cấp (NCC)** trong **một lần tạo đơn**. |
| **Tách đơn tự động** | Hệ thống **tự động tách** đơn tổng thành nhiều **đơn con theo từng NCC** (Order → OrderSupplier). |
| **Gửi đơn cho NCC** | Admin/Store có thể **xuất từng đơn theo NCC** để gửi riêng cho từng nhà cung cấp. |
| **Theo dõi đơn** | Store & Admin theo dõi trạng thái **đơn tổng** và **từng đơn NCC** (timeline, trạng thái). |
| **Xác nhận nhận hàng** | Store xác nhận nhận hàng kèm **tải ảnh** (ảnh hàng nhận được, hóa đơn đã ký); Admin xem được. |
| **Báo cáo** | Report theo NCC, theo Cửa hàng; lọc theo ngày; Export Excel (mock). |

---

## 2. PHÂN QUYỀN THEO ROLE

### 2.1 Ba role chính

| Role | Mã | Đối tượng | Dữ liệu thấy |
|------|-----|-----------|---------------|
| **Admin** | `Admin` | Quản trị hệ thống | Toàn bộ đơn, toàn bộ Store/NCC/User/Sản phẩm. |
| **Store User** | `StoreUser` | Nhân viên cửa hàng | Chỉ đơn của **Store mình**; tạo đơn cho Store mình. |
| **Supplier User** | `SupplierUser` | Nhân viên NCC | Chỉ **OrderSupplier** (đơn con) của **NCC mình**. |

### 2.2 Menu & route theo role

| Trang | Route | Admin | StoreUser | SupplierUser |
|-------|--------|-------|-----------|--------------|
| Dashboard | `/dashboard/home` | ✅ | ✅ | ✅ |
| Nhà cung cấp | `/dashboard/suppliers` | ✅ | ❌ | ❌ |
| Danh mục | `/dashboard/categories` | ✅ | ❌ | ❌ |
| Sản phẩm | `/dashboard/products` | ✅ | ❌ | ❌ |
| Cửa hàng | `/dashboard/stores` | ✅ | ❌ | ❌ |
| User | `/dashboard/users` | ✅ | ❌ | ❌ |
| Tạo đơn | `/dashboard/create-order` | ❌ | ✅ | ❌ |
| Danh sách đơn | `/dashboard/orders` | ✅ (toàn bộ) | ✅ (Store mình) | ❌ |
| Chi tiết đơn | `/dashboard/orders/:id` | ✅ | ✅ (nếu thuộc Store) | ❌ |
| Đơn cần xử lý (NCC) | `/dashboard/supplier-orders` | ❌ | ❌ | ✅ |
| Chi tiết đơn NCC | `/dashboard/supplier-orders/:id` | ❌ | ❌ | ✅ |
| Báo cáo | `/dashboard/reports` | ✅ | ❌ | ❌ |

---

## 3. KIẾN TRÚC DỮ LIỆU

### 3.1 Sơ đồ quan hệ

```
Store (Cửa hàng)
  └── Order (Đơn tổng) ──┬── OrderSupplier (đơn con NCC 1) ── OrderItem[]
                        ├── OrderSupplier (đơn con NCC 2) ── OrderItem[]
                        └── ...

OrderItem → Product → Supplier, Category
User → Store (StoreUser) hoặc Supplier (SupplierUser)
```

### 3.2 Order (Đơn tổng)

| Field | Kiểu | Ghi chú |
|-------|------|--------|
| id | number | PK |
| storeId | number | FK Store |
| storeName | string | Tên cửa hàng (denormalize) |
| status | string | Draft \| Submitted \| Processing \| PartiallyCompleted \| Completed \| Cancelled |
| orderDate | string | Ngày đặt (YYYY-MM-DD) |
| expectedDeliveryDate | string? | Giao dự kiến |
| createdBy | number | FK User |
| createdDate | string | ISO datetime |
| totalItemCount | number | Tổng số dòng |
| orderSuppliers | OrderSupplier[] | Danh sách đơn con theo NCC |

### 3.3 OrderSupplier (Đơn con theo NCC)

| Field | Kiểu | Ghi chú |
|-------|------|--------|
| id | number | PK |
| orderId | number | FK Order |
| supplierId | number | FK Supplier |
| supplierName | string | Tên NCC |
| status | string | Pending \| Confirmed \| Partial \| Rejected \| Delivering \| Delivered \| Completed |
| expectedDeliveryDate | string? | Giao dự kiến (NCC) |
| actualDeliveryDate | string? | Giao thực tế |
| confirmDate | string? | Ngày NCC confirm |
| note | string? | Ghi chú |
| receiveImages | ReceiveImage[]? | Ảnh Store gửi khi xác nhận nhận hàng |
| orderItems | OrderItem[] | Danh sách sản phẩm |

### 3.4 ReceiveImage (Ảnh xác nhận nhận hàng)

| Field | Kiểu | Ghi chú |
|-------|------|--------|
| id | string | Unique |
| type | string | `received` (ảnh hàng nhận được) \| `invoice` (hóa đơn đã ký) |
| dataUrl | string? | Base64 (khi tải lên) |
| imageUrl | string? | URL ảnh mẫu (demo) |
| fileName | string | Tên file |

### 3.5 OrderItem

| Field | Kiểu | Ghi chú |
|-------|------|--------|
| id | number | PK |
| productId | number | FK Product |
| productName | string | Tên SP |
| quantity | number | Số lượng |
| unit | string | Đơn vị (túi, thùng, chai...) |
| price | number | Đơn giá |

### 3.6 Các entity khác

- **Supplier**: id, code, name, contact, email, address, status
- **Category**: id, name, description
- **Product**: id, code, name, supplierId, categoryId, unit, price, status
- **Store**: id, code, name, address, phone, status
- **User**: id, email, name, role, storeId?, supplierId?, status

---

## 4. TRẠNG THÁI CHUẨN

### 4.1 Order (Đơn tổng)

| Status | Ý nghĩa |
|--------|---------|
| **Draft** | Nháp; chưa submit; có thể sửa/xóa. |
| **Submitted** | Đã submit; đã tách OrderSupplier; NCC chưa xử lý hết. |
| **Processing** | Ít nhất một OrderSupplier đang xử lý (chưa Completed/Rejected hết). |
| **PartiallyCompleted** | Một số NCC Completed, còn NCC khác chưa. |
| **Completed** | Tất cả OrderSupplier đều Completed (hoặc Rejected, tùy logic). |
| **Cancelled** | Đơn bị hủy. |

### 4.2 OrderSupplier (Đơn con NCC)

| Status | Ý nghĩa |
|--------|---------|
| **Pending** | Mới tạo; chờ NCC xác nhận. |
| **Confirmed** | NCC đã confirm. |
| **Partial** | NCC báo giao thiếu. |
| **Rejected** | NCC từ chối. |
| **Delivering** | Đang giao. |
| **Delivered** | Đã giao; chờ Store xác nhận nhận hàng. |
| **Completed** | Đã xác nhận nhận hàng (và có thể đã gửi ảnh). |

---

## 5. CÁC LUỒNG NGHIỆP VỤ CHI TIẾT

### LUỒNG 1 – Admin quản lý danh mục

1. Đăng nhập **Admin** → menu: Nhà cung cấp, Danh mục, Sản phẩm, Cửa hàng, User.
2. **Nhà cung cấp**: CRUD; bộ lọc ngang: Tìm mã/tên/email, Trạng thái (Active/Inactive).
3. **Danh mục**: CRUD.
4. **Sản phẩm**: CRUD; chọn NCC, Danh mục; bộ lọc ngang: Tìm mã/tên, NCC, Danh mục, Trạng thái.
5. **Cửa hàng**: CRUD.
6. **User**: CRUD; gán Role (Admin/StoreUser/SupplierUser); gán Store hoặc Supplier theo role.

---

### LUỒNG 2 – Store tạo đơn

1. **Store User** đăng nhập → **Tạo đơn**.
2. Màn hình: danh sách sản phẩm (Active) + giỏ đơn.
3. **Bộ lọc (ngang)**: Tìm tên/mã, NCC, Danh mục.
4. Chọn sản phẩm (nhiều NCC được) → thêm vào giỏ; sửa số lượng, xóa dòng trong giỏ.
5. **Submit đơn**:
   - Tạo **Order** (status = Submitted).
   - Hệ thống **tự tách** theo `supplierId` của từng dòng → tạo **OrderSupplier** (mỗi NCC một đơn con, status = Pending).
   - Mỗi OrderSupplier chứa các **OrderItem** thuộc NCC đó.
6. Sau khi submit → chuyển đến danh sách đơn (hoặc chi tiết đơn vừa tạo).

---

### LUỒNG 3 – Store/Admin theo dõi đơn & xác nhận nhận hàng

1. **Danh sách đơn** (`/dashboard/orders`):
   - **Bộ lọc (ngang, cách đều)**: Trạng thái, Cửa hàng (Admin), NCC (Admin), Từ ngày, Đến ngày.
   - Cột: ID, Cửa hàng, Ngày đặt, Trạng thái, **Thao tác** (Xem/Theo dõi, Xuất đơn/In).
   - Store User chỉ thấy đơn của Store mình.

2. **Chi tiết đơn** (`/dashboard/orders/:id`):
   - **Đơn tổng**: số đơn, cửa hàng, ngày đặt, **timeline trạng thái** (Draft → Submitted → ... → Completed).
   - **Từng NCC** (card riêng):
     - Tên NCC, **timeline đơn con** (Pending → Confirmed → ... → Completed).
     - Bảng sản phẩm (tên, số lượng, đơn giá).
     - Giao dự kiến / giao thực tế.
     - **Ảnh Store đã gửi** (nếu có): nhóm "Ảnh đơn hàng nhận được", "Hóa đơn đã ký"; click xem lightbox. Admin & Store đều xem được.
   - **Nút**:
     - **Xuất đơn / In** (đầu trang): in **toàn bộ** đơn (tất cả NCC).
     - **Xuất đơn NCC / Gửi** (trên từng card NCC): in **riêng** đơn của NCC đó (để gửi cho NCC).
     - **Xác nhận nhận hàng** (khi OrderSupplier = Delivered): mở modal tải ảnh.

3. **Xác nhận nhận hàng (kèm ảnh)**:
   - Khi NCC đã chuyển trạng thái **Delivered**, Store (hoặc Admin) bấm **Xác nhận nhận hàng**.
   - Modal: **Ảnh đơn hàng nhận được** (nhiều ảnh), **Hóa đơn đã ký** (nhiều ảnh).
   - Bấm **Xác nhận & gửi ảnh** → OrderSupplier chuyển **Completed**; ảnh lưu vào `receiveImages` (dataUrl). Nếu tất cả OrderSupplier Completed → Order tổng chuyển **Completed**.

---

### LUỒNG 4 – NCC xử lý đơn

1. **Supplier User** đăng nhập → **Đơn cần xử lý** (chỉ OrderSupplier của NCC mình).
2. **Bộ lọc (ngang)**: Trạng thái, Từ ngày đặt, Đến ngày đặt.
3. Bảng: ID đơn con, Đơn tổng #, Cửa hàng, Trạng thái, **Thao tác** (Xem/Xử lý).
4. **Chi tiết OrderSupplier** (`/dashboard/supplier-orders/:id`):
   - Thông tin đơn tổng (Store, ngày đặt).
   - Danh sách sản phẩm (OrderItem).
   - **Thao tác**: Confirm, Reject, Partial, Delivering, Delivered (cập nhật status + actualDeliveryDate khi Delivered).
   - Hệ thống cập nhật trạng thái **Order** tổng theo trạng thái các OrderSupplier.

---

### LUỒNG 5 – Admin báo cáo & xuất

1. **Báo cáo** (`/dashboard/reports`):
   - **Bộ lọc (ngang)**: Từ ngày, Đến ngày (lọc theo ngày đặt đơn).
   - Biểu đồ: đơn theo NCC, đơn theo Cửa hàng.
   - Bảng: Report theo NCC (số đơn, đã hoàn thành, tổng SL SP); Report theo Cửa hàng (tổng số đơn).
   - Nút **Export Excel** (mock).

2. **Xuất đơn**:
   - **Trong danh sách đơn**: mỗi dòng có nút **Xuất đơn / In** → in toàn bộ đơn đó (tất cả NCC).
   - **Trong chi tiết đơn**: **Xuất đơn / In** (cả đơn) hoặc **Xuất đơn NCC / Gửi** (từng NCC) → mở cửa sổ in, nội dung tương ứng (bảng SP, tổng tiền, ngày giao).

---

## 6. GIAO DIỆN CHI TIẾT TỪNG MÀN HÌNH

### 6.1 Login

- **Route**: `/sign-in` (auth layout).
- Chọn **tài khoản demo** (dropdown: Admin, StoreUser từng Store, SupplierUser từng NCC).
- Đăng nhập → redirect `/dashboard/home`. Menu sidebar thay đổi theo role.

### 6.2 Dashboard (Home) – Chi tiết

**Route:** `/dashboard/home`. Nội dung thay đổi theo role.

#### 6.2.1 Dashboard Admin

| Thành phần | Chi tiết |
|------------|----------|
| **4 thẻ thống kê (StatisticsCard)** | **1. Tổng số đơn**: Tổng số Order toàn hệ thống; footer "Toàn hệ thống". **2. Đơn đang giao**: Số đơn có status = Processing hoặc có ít nhất 1 OrderSupplier Delivering; footer "Processing". **3. NCC giao trễ**: Số lượng (mock); footer "Cần theo dõi". **4. Báo cáo tháng**: Text "Xem"; footer link **Đến trang Report** (`/dashboard/reports`). |
| **3 biểu đồ (StatisticsChart)** | **1. Xem đơn theo tháng**: Bar chart – trục X: T1→T12, trục Y: số đơn tạo trong tháng (theo `orderDate`). **2. Doanh số đơn hàng**: Line chart – xu hướng đơn theo 4 tuần trong tháng. **3. Các đơn theo trạng thái**: Bar chart – trục X: Draft, Submitted, Processing, Completed, Cancelled; trục Y: số đơn. Footer mỗi chart: ghi chú nguồn dữ liệu. |
| **Bảng Đơn gần đây** | Cột: **Mã đơn** (#id), **Cửa hàng**, **Ngày đặt**, **Trạng thái** (Chip màu), **Thao tác** (nút "Xem / Theo dõi" → `/dashboard/orders/:id`). Hiển thị 5 đơn mới nhất (slice reverse). Header có nút **Xem tất cả** → Danh sách đơn. |
| **Card Tổng quan đơn hàng** | Danh sách dạng timeline (icon + title + description): 6 đơn gần nhất, mỗi dòng: "Đơn #id - StoreName", "orderDate · status". Không có nút thao tác, chỉ xem nhanh. |

#### 6.2.2 Dashboard Store User

| Thành phần | Chi tiết |
|------------|----------|
| **4 thẻ thống kê** | **1. Tổng số đơn**: Số Order của **Store mình** (`storeId` = currentUser.storeId); footer tên Store. **2. Đơn đang giao**: Số đơn Store có status = Processing. **3. Đơn chờ xử lý**: Số đơn Store có status = Submitted. **4. Tạo đơn / Theo dõi**: Text "→"; footer hai link **Tạo đơn** (`/dashboard/create-order`) và **Danh sách đơn** (`/dashboard/orders`). |
| **3 biểu đồ** | Cùng loại với Admin nhưng **chỉ tính trên đơn của Store**: (1) Đơn theo tháng của Store, (2) Xu hướng đơn theo tuần của Store, (3) Đơn theo trạng thái của Store. |
| **Bảng Đơn gần đây** | Cấu trúc giống Admin; chỉ hiển thị đơn của Store; cột Thao tác: **Xem / Theo dõi** → Chi tiết đơn. |
| **Tổng quan đơn hàng** | Timeline 6 đơn gần nhất **của Store**. |

#### 6.2.3 Dashboard Supplier User

| Thành phần | Chi tiết |
|------------|----------|
| **Thẻ 1 – Đơn mới (Pending)** | Số OrderSupplier của NCC mình có `status = Pending`; footer "Cần xác nhận". |
| **Thẻ 2 – Đơn giao hôm nay** | Số OrderSupplier của NCC mình có `expectedDeliveryDate = hôm nay` (ngày cố định demo). |
| **Thẻ 3 – Nút hành động** | Card lớn: nút **Xem danh sách đơn của tôi** → `/dashboard/supplier-orders`. |
| **Card hướng dẫn** | Text: "NCC: **tên NCC**. Vào 'Đơn cần xử lý' để Confirm / Reject / cập nhật Delivering / Delivered." |

### 6.3 Danh sách đơn (Order List)

- **Bộ lọc**: Một hàng ngang; khoảng cách đều (gap-6); tất cả ô cùng width (172px). FilterSelect (Trạng thái, Cửa hàng, NCC), Input date (Từ ngày, Đến ngày). Nút **Xóa bộ lọc** khi có lọc.
- **Bảng**: ID, Cửa hàng, Ngày đặt, Trạng thái (Chip màu), Thao tác (Xem/Theo dõi, Xuất đơn/In).

### 6.4 Chi tiết đơn (Order Detail)

- Nút **Quay lại danh sách**, **Xuất đơn / In** (cả đơn).
- Card đơn tổng: timeline trạng thái.
- Từng card NCC: tên NCC, timeline đơn con, Chip trạng thái, **Xuất đơn NCC / Gửi**, **Xác nhận nhận hàng** (khi Delivered). Body: ảnh đã gửi (nếu có), bảng OrderItem, ngày giao.

### 6.5 Tạo đơn (Create Order)

- Hai cột: Chọn sản phẩm (có bộ lọc ngang: Tìm, NCC, Danh mục) + Giỏ đơn (sửa SL, xóa, Submit).
- FilterSelect/Input dùng layout ngang, cách đều.

### 6.6 Các trang CRUD (Suppliers, Categories, Products, Stores, Users)

- Header: tiêu đề + nút Thêm.
- **Bộ lọc (ngang)** (nếu có): FilterSelect + Input, gap đều.
- Bảng dữ liệu; cột Thao tác (Sửa, Xóa). Modal Thêm/Sửa (form + Select/Option Material Tailwind cho form, FilterSelect chỉ dùng ở khu vực lọc danh sách).

### 6.7 Đơn NCC (Supplier Order List & Detail)

- List: bộ lọc Trạng thái, Từ ngày đặt, Đến ngày đặt (ngang, cách đều).
- Detail: thao tác Confirm, Reject, Partial, Delivering, Delivered.

### 6.8 Báo cáo (Reports) – Chi tiết

**Route:** `/dashboard/reports`. Chỉ **Admin** truy cập.

| Mục | Chi tiết |
|-----|----------|
| **Tiêu đề & Export** | Header: "Báo cáo thống kê"; nút **Export Excel** (hiện mock alert; khi có BE sẽ xuất dữ liệu đã lọc). |
| **Bộ lọc báo cáo** | Card riêng. **Lọc theo ngày đặt đơn**: **Từ ngày** (Input date), **Đến ngày** (Input date). Chỉ đơn có `orderDate` trong khoảng [Từ ngày, Đến ngày] mới được tính vào biểu đồ và bảng. Nút **Xóa bộ lọc** khi đã chọn ít nhất một ngày. Layout: hàng ngang, gap đều. |
| **Biểu đồ 1 – Đơn theo NCC** | **Title:** "Biểu đồ đơn theo NCC". **Mô tả:** Tổng số đơn (OrderSupplier) theo từng nhà cung cấp. **Loại:** Bar chart. **Trục X:** Tên NCC (rút gọn nếu > 15 ký tự). **Trục Y:** Số lượng OrderSupplier. **Màu:** #0288d1. |
| **Biểu đồ 2 – Đơn theo Cửa hàng** | **Title:** "Biểu đồ đơn theo Cửa hàng". **Mô tả:** Tổng số đơn (Order) theo từng cửa hàng. **Loại:** Bar chart. **Trục X:** Tên cửa hàng. **Trục Y:** Số Order. **Màu:** #388e3c. |
| **Bảng Report theo NCC** | Cột: **NCC** (tên), **Số đơn** (tổng OrderSupplier của NCC đó trong kỳ lọc), **Đã hoàn thành** (số OrderSupplier có status Completed hoặc Delivered), **Tổng SL sản phẩm** (tổng quantity của tất cả OrderItem thuộc NCC đó). Một dòng cho mỗi NCC trong danh sách Supplier. |
| **Bảng Report theo Cửa hàng** | Cột: **Cửa hàng** (tên), **Tổng số đơn** (số Order có `storeId` trùng, trong kỳ lọc). Một dòng cho mỗi Store. |
| **Chỉ số tổng hợp (gợi ý mở rộng)** | Có thể bổ sung: Tổng số đơn trong kỳ, Tổng số OrderSupplier đã hoàn thành, Tỷ lệ hoàn thành theo NCC/Cửa hàng. Hiện tại chưa có card tổng hợp phía trên. |
| **Mở rộng sau (chưa làm)** | Report theo **sản phẩm** (số lượng đặt theo SP, theo NCC/Store); **KPI NCC** (tỷ lệ giao đủ, giao trễ, thời gian xử lý TB); Báo cáo theo **trạng thái** (phân bổ Draft/Submitted/... trong kỳ); Export Excel thật (file .xlsx từ BE). |

---

## 7. CHỨC NĂNG ĐẶC BIỆT ĐÃ TRIỂN KHAI

| Chức năng | Mô tả ngắn |
|-----------|------------|
| **Xuất đơn tổng** | In/xuất toàn bộ đơn (tất cả NCC) từ Danh sách đơn hoặc Chi tiết đơn. |
| **Xuất đơn từng NCC** | Trong Chi tiết đơn, mỗi card NCC có nút **Xuất đơn NCC / Gửi** → in riêng đơn đó (tiêu đề, Store, NCC, bảng SP, tổng tiền, ngày giao) để gửi cho NCC. |
| **Xác nhận nhận hàng + ảnh** | Khi OrderSupplier = Delivered, Store/Admin bấm Xác nhận nhận hàng → modal tải **Ảnh đơn hàng nhận được** (nhiều ảnh) và **Hóa đơn đã ký** (nhiều ảnh) → lưu vào `receiveImages`; Admin & Store xem lại trong Chi tiết đơn (thumb + lightbox). |
| **Bộ lọc ngang, cách đều** | Tất cả màn có bộ lọc: layout flex ngang, gap cố định (gap-6), ô lọc dùng **FilterSelect** (native select, dropdown luôn mở xuống) hoặc Input; khoảng cách Từ ngày / Đến ngày đủ rộng. |
| **Theo dõi đơn** | Không tách trang riêng: tích hợp **timeline** trong Chi tiết đơn và cột **Thao tác (Xem/Theo dõi)** trong Danh sách đơn + bảng Đơn gần đây trên Dashboard. |

---

## 8. CẤU TRÚC FILE FRONTEND (CHÍNH)

```
src/
├── context/
│   ├── AuthContext.jsx    # currentUser, role, login/logout
│   ├── DataContext.jsx    # orders, suppliers, categories, products, stores, users (state)
│   └── index.jsx
├── data/
│   ├── orders.js          # ordersData (Order + OrderSupplier + OrderItem, receiveImages)
│   ├── suppliers.js
│   ├── categories.js
│   ├── products.js
│   ├── stores.js
│   ├── users.js
│   └── index.js
├── components/
│   └── FilterSelect.jsx   # Native select cho bộ lọc (dropdown mở xuống)
├── pages/
│   ├── auth/
│   │   ├── Login.jsx       # Chọn user demo
│   │   └── index.js
│   └── dashboard/
│       ├── DashboardHome.jsx
│       ├── Suppliers.jsx, Categories.jsx, Products.jsx, Stores.jsx, Users.jsx
│       ├── CreateOrder.jsx
│       ├── OrderList.jsx
│       ├── OrderDetail.jsx   # Timeline, ảnh, Xuất đơn NCC, Xác nhận nhận hàng + ảnh
│       ├── SupplierOrderList.jsx, SupplierOrderDetail.jsx
│       ├── Reports.jsx
│       └── index.js
├── routes.jsx             # dashboardRoutesConfig, getDashboardRoutesForRole
├── layouts/
│   └── dashboard.jsx     # Sidenav (menu theo role), Navbar, Configurator
└── widgets/
    └── layout/
        ├── sidenav.jsx    # menuItems từ route theo role
        └── dashboard-navbar.jsx
```

---

## 9. DỮ LIỆU MẪU (DEMO)

- **Sản phẩm**: 28 sản phẩm (cà phê, trà, sữa, syrup, bánh, vật tư).
- **NCC**: 5 (Trung Nguyên, Vinamilk, Monin, Kinh Đô, Vật tư Toàn Thắng).
- **Cửa hàng**: 3 (Q1, Q7, Bình Thạnh).
- **User**: Admin + StoreUser (3 Store) + SupplierUser (5 NCC).
- **Đơn**: 15 đơn mẫu; trạng thái đa dạng (Draft, Submitted, Processing, PartiallyCompleted, Completed, Cancelled); một số OrderSupplier có **receiveImages** (ảnh mẫu `/img/received-goods-sample.png`, `/img/invoice-sample.png`).

---

## 10. TÓM TẮT CHECKLIST ĐÃ LÀM (DEMO)

- [x] Auth & phân quyền (Admin, StoreUser, SupplierUser); menu theo role.
- [x] CRUD Supplier, Category, Product, Store, User (Admin).
- [x] Create Order (Store): lọc, tìm, giỏ, submit → tách OrderSupplier.
- [x] Order List: lọc (Trạng thái, Cửa hàng, NCC, Từ/Đến ngày); Xuất đơn/In từng dòng.
- [x] Order Detail: timeline đơn tổng + từng NCC; bảng OrderItem; ảnh Store gửi; **Xuất đơn / In** (cả đơn); **Xuất đơn NCC / Gửi** (từng NCC).
- [x] Xác nhận nhận hàng (Store/Admin): modal tải ảnh (hàng nhận + hóa đơn); lưu receiveImages; Admin & Store xem ảnh.
- [x] Supplier: OrderSupplier list + detail; Confirm, Reject, Partial, Delivering, Delivered.
- [x] Dashboard: Admin & Store (4 thẻ, 3 chart, bảng đơn gần đây + Thao tác Xem/Theo dõi); Supplier (đơn mới, đơn cần giao).
- [x] Reports: lọc theo ngày; chart + bảng theo NCC/Store; Export Excel (mock).
- [x] Bộ lọc ngang, cách đều; FilterSelect (dropdown mở xuống); khoảng cách Từ ngày / Đến ngày.

---

*Tài liệu này mô tả đầy đủ chức năng, luồng và chi tiết đã triển khai trong phiên bản demo. Khi kết nối backend, cần thay mock data (DataContext) bằng API và bổ sung OrderStatusHistory (log trạng thái) nếu cần.*
