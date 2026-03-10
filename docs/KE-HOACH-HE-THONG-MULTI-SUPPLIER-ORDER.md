# KẾ HOẠCH HỆ THỐNG – MULTI-SUPPLIER ORDER MANAGEMENT SYSTEM

> Tài liệu tổng quan & kế hoạch triển khai – phiên bản đầy đủ (đã bổ sung luồng NCC, trạng thái, phân quyền, log, KPI).

**→ Tổng hợp chi tiết chức năng & luồng đã triển khai:** [TONG-HOP-HE-THONG-MULTI-SUPPLIER-ORDER.md](./TONG-HOP-HE-THONG-MULTI-SUPPLIER-ORDER.md)

---

## 1. MỤC TIÊU HỆ THỐNG

| Mục tiêu | Mô tả |
|----------|--------|
| **Đặt hàng đa NCC** | Store đặt hàng từ nhiều Nhà cung cấp (NCC) trong **1 lần tạo đơn**. |
| **Tách đơn tự động** | Hệ thống **tự động tách đơn** theo từng NCC (Order → OrderSupplier). |
| **Gửi yêu cầu NCC** | Gửi thông tin đơn hàng tới từng NCC để xử lý. |
| **Theo dõi giao hàng** | Store & Admin theo dõi trạng thái từng đơn con (NCC). |
| **Báo cáo thống kê** | Report theo Supplier, Store, sản phẩm; KPI NCC; Export Excel. |

---

## 2. CÁC USER & PHÂN QUYỀN (ROLE)

### 2.1 Roles trong hệ thống

| Role | Mã | Mô tả |
|------|-----|--------|
| **Admin** | `Admin` | Quyền cao nhất; quản lý toàn bộ danh mục & xem toàn bộ dữ liệu. |
| **Store User** | `StoreUser` | Nhân viên cửa hàng; chỉ thấy & thao tác đơn của **Store mình**. |
| **Supplier User** | `SupplierUser` | Nhân viên NCC; chỉ thấy & xử lý **OrderSupplier của NCC mình**. |

### 2.2 Chức năng theo Role

#### Admin
- Quản lý **Supplier**
- Quản lý **Category**
- Quản lý **Product**
- Quản lý **Store**
- Quản lý **User**
- Xem **Dashboard** (toàn hệ thống)
- Xem **Report** (Supplier, Store, Product, KPI)
- **Không** tạo đơn / xử lý đơn thay Store hoặc NCC

#### Store User
- **Tạo đơn** (thêm nhiều sản phẩm khác NCC)
- **Sửa đơn** khi trạng thái = **Draft**
- **Hủy đơn** khi chưa xử lý (theo quy tắc hủy/sửa bên dưới)
- **Submit** đơn → hệ thống tách OrderSupplier
- **Theo dõi** trạng thái đơn (tổng + từng NCC)
- **Xác nhận nhận hàng** (khi NCC báo Delivered)
- Xem **lịch sử đơn** của Store mình
- Dashboard Store: đơn gần nhất, đơn đang giao, nút Tạo đơn

#### Supplier User
- Xem **danh sách OrderSupplier** của NCC mình
- Xem **chi tiết** sản phẩm trong từng OrderSupplier
- **Confirm** đơn
- Báo **Partial** (giao thiếu)
- **Reject** (không cung cấp được)
- Cập nhật trạng thái: **Delivering** → **Delivered**
- Dashboard NCC: đơn mới, đơn cần giao hôm nay

---

## 3. KIẾN TRÚC DỮ LIỆU

### 3.1 Sơ đồ quan hệ

```
Supplier (NCC)
    ↑
Product ← Category
    ↑
OrderItem ← OrderSupplier (đơn con theo NCC)
    ↑           ↑
    └── Order (đơn tổng - Master)
              ↑
           Store
              ↑
           User (StoreUser / Admin / SupplierUser)
```

### 3.2 Bảng dữ liệu chính (tóm tắt)

| Entity | Mô tả |
|--------|--------|
| **Supplier** | Nhà cung cấp (tên, mã, liên hệ, trạng thái). |
| **Category** | Danh mục sản phẩm. |
| **Product** | Sản phẩm; thuộc Supplier + Category. |
| **Store** | Cửa hàng (tên, địa chỉ, liên hệ). |
| **User** | Tài khoản; gắn Role + (Store hoặc Supplier tùy role). |
| **Order** | Đơn tổng do Store tạo. |
| **OrderSupplier** | Đơn con theo từng NCC; tự tạo khi Submit. |
| **OrderItem** | Dòng sản phẩm thuộc OrderSupplier (Product, số lượng, trạng thái). |

---

## 4. TRẠNG THÁI CHUẨN (BẮT BUỘC THEO ĐÚNG)

### 4.1 Order (Master – Đơn tổng)

| Status | Mã | Mô tả |
|--------|-----|--------|
| **Draft** | `Draft` | Nháp; Store có thể sửa, xóa, thêm/xóa sản phẩm. |
| **Submitted** | `Submitted` | Đã submit; đã tách OrderSupplier; **không sửa** nội dung đơn. |
| **Processing** | `Processing` | Ít nhất 1 OrderSupplier đang xử lý (chưa Completed/Cancelled toàn bộ). |
| **Partially Completed** | `PartiallyCompleted` | Một số NCC đã giao xong, còn NCC khác chưa. |
| **Completed** | `Completed` | Tất cả OrderSupplier đều Completed. |
| **Cancelled** | `Cancelled` | Đơn bị hủy (bởi Store khi chưa xử lý, hoặc Admin). |

### 4.2 OrderSupplier (Đơn con theo NCC)

| Status | Mã | Mô tả |
|--------|-----|--------|
| **Pending** | `Pending` | Mới tạo; chờ NCC xác nhận. |
| **Confirmed** | `Confirmed` | NCC đã confirm, chuẩn bị giao. |
| **Partial** | `Partial` | NCC báo giao thiếu (một phần). |
| **Rejected** | `Rejected` | NCC từ chối (không cung cấp được). |
| **Delivering** | `Delivering` | Đang giao. |
| **Delivered** | `Delivered` | Đã giao; chờ Store xác nhận nhận hàng (nếu cần). |
| **Completed** | `Completed` | Hoàn tất (đã xác nhận nhận / đã đủ điều kiện). |

### 4.3 OrderItem (trạng thái xử lý – tùy nghiệp vụ)

- Có thể dùng: `Pending` | `Confirmed` | `Partial` | `Shipped` | `Delivered` | `Cancelled`  
- Hoặc đơn giản: chỉ cập nhật theo OrderSupplier, không cần trạng thái riêng từng dòng.

---

## 5. CẤU TRÚC CHI TIẾT CÁC BẢNG

### 5.1 Order (Đơn tổng)

| Field | Kiểu | Ghi chú |
|-------|------|--------|
| Id | PK | |
| StoreId | FK | Store đặt hàng |
| Status | Enum | Draft, Submitted, Processing, PartiallyCompleted, Completed, Cancelled |
| OrderDate | DateTime | Ngày đặt |
| ExpectedDeliveryDate | DateTime? | Ngày giao dự kiến (tổng) |
| Note | string? | Ghi chú |
| **CreatedBy** | FK User? | User tạo đơn |
| **CreatedDate** | DateTime | |
| UpdatedDate | DateTime? | |
| TotalItemCount | int? | (Optional) Tổng số dòng đơn |

### 5.2 OrderSupplier (Đơn con theo NCC)

| Field | Kiểu | Ghi chú |
|-------|------|--------|
| Id | PK | |
| OrderId | FK | Thuộc Order nào |
| SupplierId | FK | NCC nào |
| Status | Enum | Pending → … → Completed |
| **ExpectedDeliveryDate** | DateTime? | Ngày giao dự kiến (riêng NCC) |
| **ActualDeliveryDate** | DateTime? | Ngày giao thực tế |
| **ConfirmDate** | DateTime? | Ngày NCC confirm |
| **Note** | string? | Ghi chú (NCC/Store) |
| CreatedDate | DateTime | |
| UpdatedDate | DateTime? | |

### 5.3 OrderItem

| Field | Kiểu | Ghi chú |
|-------|------|--------|
| Id | PK | |
| OrderSupplierId | FK | Thuộc OrderSupplier |
| ProductId | FK | Sản phẩm |
| Quantity | int | Số lượng |
| Status | Enum? | (Optional) Pending, Delivered, Partial, Cancelled |
| Note | string? | |

### 5.4 OrderStatusHistory (Log / Lịch sử trạng thái)

| Field | Kiểu | Ghi chú |
|-------|------|--------|
| Id | PK | |
| OrderId | FK? | Null nếu là log của OrderSupplier |
| OrderSupplierId | FK? | Null nếu là log của Order |
| FromStatus | string? | Trạng thái cũ |
| ToStatus | string | Trạng thái mới |
| **ChangedBy** | FK User | User thay đổi |
| **ChangedDate** | DateTime | |
| Note | string? | Ghi chú khi đổi trạng thái |

**Ví dụ log:**
- Order: `Submitted` – 01/03 – Store A  
- OrderSupplier (NCC A): `Confirmed` – 02/03 – Supplier A  
- OrderSupplier (NCC A): `Delivered` – 03/03 – Supplier A  

---

## 6. CƠ CHẾ SỬA / HỦY ĐƠN

| Trạng thái Order | Store sửa nội dung | Store hủy đơn |
|------------------|---------------------|----------------|
| **Draft** | ✅ Có | ✅ Có |
| **Submitted** trở đi | ❌ Không | ⚠️ Chỉ hủy được nếu **tất cả** OrderSupplier vẫn Pending (chưa Confirm). Nếu đã có NCC Confirm → cần quy trình riêng (ví dụ: liên hệ NCC hủy, hoặc Admin hủy). |

- **Admin**: Có thể hủy đơn trong trường hợp đặc biệt (và nên ghi log).
- Mọi thay đổi trạng thái đều ghi vào **OrderStatusHistory**.

---

## 7. CÁC LUỒNG NGHIỆP VỤ CHÍNH

### LUỒNG 1 – QUẢN LÝ DANH MỤC (Admin)

1. Tạo **Supplier**
2. Tạo **Category**
3. Tạo **Product** (gán Supplier, Category)
4. Tạo **Store**
5. Tạo **User** (gán Role: Admin / StoreUser / SupplierUser; gắn Store hoặc Supplier nếu cần)

---

### LUỒNG 2 – STORE TẠO ĐƠN

1. Store User đăng nhập → **Create Order**.
2. Hệ thống hiển thị **toàn bộ sản phẩm Active**.
3. Có thể:
   - **Lọc theo Supplier**
   - **Lọc theo Category**
   - **Tìm kiếm** tên sản phẩm
4. Chọn **nhiều sản phẩm** (khác NCC vẫn được) → thêm vào giỏ / draft.
5. Lưu **Draft** (có thể sửa sau).
6. **Submit**:
   - Order chuyển sang **Submitted**.
   - Hệ thống **tự động tách** thành nhiều **OrderSupplier** (mỗi NCC một đơn con).
   - Mỗi OrderSupplier = **Pending**.
   - Ghi **OrderStatusHistory**.
   - (Tùy triển khai: gửi thông báo/email cho NCC.)

---

### LUỒNG 3 – STORE THEO DÕI & NHẬN HÀNG

1. Store xem **Order List** (chỉ đơn của Store mình).
2. Filter: Ngày, Trạng thái, Supplier.
3. Vào **Order Detail**:
   - Hiển thị theo **từng NCC** (nhóm OrderSupplier):
     - NCC A – Delivered
     - NCC B – Delivering
     - NCC C – Partial
   - Khi **tất cả** OrderSupplier của đơn đó = Completed → Order tổng chuyển **Completed**.
4. Store **xác nhận nhận hàng** khi NCC báo Delivered (có thể dùng nút “Xác nhận đã nhận” → OrderSupplier sang Completed).

---

### LUỒNG 4 – NCC XỬ LÝ ĐƠN (BỔ SUNG – QUAN TRỌNG)

1. Supplier User đăng nhập → vào **Danh sách OrderSupplier** (chỉ của NCC mình).
2. Filter: Trạng thái, ngày, Store.
3. Vào **Chi tiết OrderSupplier**:
   - Xem danh sách sản phẩm (OrderItem), số lượng.
4. Thao tác:
   - **Confirm** → trạng thái **Confirmed**; ghi **ConfirmDate**; ghi log.
   - **Reject** → trạng thái **Rejected**; ghi log + Note.
   - **Partial** → trạng thái **Partial** (đã giao một phần); ghi Note.
5. Cập nhật trạng thái giao hàng:
   - **Delivering** (đang giao).
   - **Delivered** (đã giao xong) → nhập **ActualDeliveryDate**; ghi log.
6. Hệ thống cập nhật trạng thái **Order** tổng (Processing / Partially Completed / Completed) dựa trên các OrderSupplier.

---

## 8. GIAO DIỆN HỆ THỐNG (UI)

### 8.1 Login Page

- Form đăng nhập (email/username + password).
- Sau khi đăng nhập: redirect theo Role (Admin → Dashboard Admin; Store → Dashboard Store; Supplier → Dashboard NCC).

### 8.2 Dashboard

| Role | Nội dung chính |
|------|-----------------|
| **Admin** | Tổng số đơn; Đơn đang giao; NCC giao trễ; Biểu đồ theo tháng. |
| **Store** | Đơn gần nhất; Đơn đang giao; **Nút Tạo đơn**. |
| **Supplier** | Đơn mới (Pending); Đơn cần giao hôm nay. |

### 8.3 Quản lý danh mục (Admin)

- Supplier List (CRUD)
- Category List (CRUD)
- Product List (CRUD, gán Supplier + Category)
- Store List (CRUD)
- User List (CRUD, gán Role + Store/Supplier)

### 8.4 Create Order (Store User)

- Search sản phẩm
- Filter: Supplier, Category
- Chọn nhiều sản phẩm (khác NCC được)
- Giỏ / Draft: sửa số lượng, xóa dòng
- Nút **Lưu nháp** / **Submit**

### 8.5 Order List

- Filter: Ngày, Trạng thái, Supplier (Admin/Store); Store (Admin).
- Store User: chỉ thấy đơn của Store mình.
- Supplier User: view riêng “OrderSupplier list” (chỉ NCC mình).

### 8.6 Order Detail

- Hiển thị theo **nhóm NCC** (từng OrderSupplier).
- Mỗi nhóm: trạng thái, danh sách OrderItem, ExpectedDeliveryDate, ActualDeliveryDate, Note.
- Store: nút “Xác nhận nhận hàng” (khi NCC đã Delivered).
- Supplier: nút Confirm / Reject / Partial / Delivering / Delivered.

### 8.7 Report Screen (Admin)

- **Report theo Supplier**: tổng đơn, tổng giá trị, đơn giao trễ.
- **Report theo Store**: tổng đơn, tổng giá trị.
- **Report theo sản phẩm**: lượng bán, Store, NCC.
- **KPI NCC**:
  - Tổng số đơn theo NCC
  - Tỷ lệ giao đủ
  - Tỷ lệ giao thiếu (Partial)
  - Thời gian xử lý trung bình (từ Pending → Delivered)
  - Số lần giao trễ (so ExpectedDeliveryDate)
- **Export Excel** (đơn, OrderSupplier, report).

---

## 9. CHECKLIST TRIỂN KHAI (GỢI Ý THỨ TỰ)

- [ ] **Phase 1 – Nền tảng**
  - [ ] Thiết kế DB (Supplier, Category, Product, Store, User, Order, OrderSupplier, OrderItem, OrderStatusHistory).
  - [ ] API Auth + JWT; phân quyền theo Role (Admin, StoreUser, SupplierUser).
  - [ ] Login page & redirect theo Role.

- [ ] **Phase 2 – Admin**
  - [ ] CRUD Supplier, Category, Product, Store, User.
  - [ ] Dashboard Admin (số liệu cơ bản).

- [ ] **Phase 3 – Store tạo đơn**
  - [ ] Màn Create Order: danh sách Product, filter, search, chọn sản phẩm.
  - [ ] Lưu Draft; Submit → tách OrderSupplier; ghi OrderStatusHistory.
  - [ ] Order List + Order Detail (xem theo NCC).

- [ ] **Phase 4 – NCC xử lý đơn**
  - [ ] OrderSupplier list (Supplier User).
  - [ ] Chi tiết OrderSupplier: Confirm, Reject, Partial, Delivering, Delivered.
  - [ ] Cập nhật ExpectedDeliveryDate, ActualDeliveryDate, Note; ghi log.

- [ ] **Phase 5 – Store nhận hàng & trạng thái**
  - [ ] Store xác nhận nhận hàng → OrderSupplier Completed.
  - [ ] Cập nhật trạng thái Order tổng (Processing, Partially Completed, Completed).
  - [ ] Dashboard Store & Supplier.

- [ ] **Phase 6 – Sửa/hủy đơn & quy tắc**
  - [ ] Sửa/xóa khi Draft.
  - [ ] Hủy đơn (chỉ khi tất cả OrderSupplier Pending); ghi log.

- [ ] **Phase 7 – Report & KPI**
  - [ ] Report theo Supplier, Store, Product.
  - [ ] KPI NCC (giao đủ, giao thiếu, trễ, thời gian xử lý).
  - [ ] Export Excel.

- [ ] **Phase 8 – Tối ưu & vận hành**
  - [ ] Thông báo (in-app/email) cho NCC khi có đơn mới; cho Store khi NCC Confirm/Delivered.
  - [ ] Test phân quyền (Store chỉ thấy Store, NCC chỉ thấy NCC).

---

## 10. TÓM TẮT BỔ SUNG SO VỚI BẢN GỐC

| Hạng mục | Đã bổ sung |
|----------|------------|
| **Luồng NCC** | LUỒNG 4 – NCC xem đơn, Confirm/Reject/Partial, Delivering/Delivered. |
| **Trạng thái** | Chuẩn hóa Order (Draft → … → Completed/Cancelled) và OrderSupplier (Pending → … → Completed). |
| **Phân quyền** | Role: Admin, StoreUser, **SupplierUser**; Store chỉ thấy Store, NCC chỉ thấy NCC. |
| **Sửa/hủy đơn** | Sửa chỉ khi Draft; hủy khi chưa xử lý (hoặc theo quy định). |
| **Log** | Bảng OrderStatusHistory (OrderId/OrderSupplierId, FromStatus, ToStatus, ChangedBy, ChangedDate). |
| **Trường bổ sung** | Order: CreatedBy, CreatedDate; OrderSupplier: ExpectedDeliveryDate, ActualDeliveryDate, ConfirmDate, Note. |
| **KPI/Report** | Tỷ lệ giao đủ/thiếu, thời gian xử lý, giao trễ; Export Excel. |

---

*Tài liệu này dùng làm kế hoạch tổng thể để triển khai từng phase. Khi bắt tay vào code, nên tách tiếp: API spec, DB schema SQL, và danh sách màn hình frontend chi tiết.*
