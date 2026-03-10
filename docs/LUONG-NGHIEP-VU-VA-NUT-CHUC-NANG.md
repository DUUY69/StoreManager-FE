# Liệt kê chi tiết: Luồng nghiệp vụ, Nút, Chức năng & Ảnh hưởng lẫn nhau

Tài liệu mô tả **tất cả luồng nghiệp vụ**, **từng nút / hành động**, **chức năng** và **cách mỗi luồng ảnh hưởng đến luồng khác** trong hệ thống Admin Dashboard (Đặt hàng NCC).

---

## 1. Bản đồ vai trò (Role) & Trang được truy cập

| Role        | Trang có thể vào |
|------------|-------------------|
| **Admin**  | Dashboard, Nhà cung cấp, Danh mục, Sản phẩm, Cửa hàng, User, Tạo đơn, Danh sách đơn, Chi tiết đơn, Báo cáo. **Không** tham gia Quản lý kho — Admin chỉ gửi đơn và quản lý tình trạng đơn (duyệt, từ chối, đóng đơn). |
| **StoreUser** | Dashboard, Tạo đơn, Danh sách đơn (chỉ đơn của store mình), Chi tiết đơn, **Quản lý kho** (store mình) |
| **SupplierUser** | Dashboard, Đơn cần xử lý (danh sách + chi tiết đơn NCC) |

---

## 2. Trạng thái đơn & Điều kiện chuyển trạng thái

### 2.1 Trạng thái đơn tổng (Order)

| Trạng thái | Mô tả | Ai / Hành động tạo ra |
|------------|--------|------------------------|
| **Draft** | Nháp (nếu có) | Tạo đơn chưa gửi |
| **Submitted** | Đã gửi, chờ Admin duyệt | Store/Admin bấm **Submit đơn** tại Tạo đơn |
| **Processing** | Đang xử lý (NCC xác nhận, giao hàng) | Admin bấm **Chấp nhận đơn** tại Chi tiết đơn |
| **PartiallyCompleted** | Một phần NCC đã xong (nếu dùng) | Logic khi có NCC Completed/Delivered, có NCC chưa |
| **Completed** | Đã đóng đơn | Admin bấm **Chấp nhận đơn tổng** hoặc Store xác nhận nhận hàng hết → đơn tự chuyển Completed |
| **Cancelled** | Đã hủy | Admin bấm **Từ chối đơn** tại Chi tiết đơn |

### 2.2 Trạng thái đơn theo NCC (OrderSupplier)

| Trạng thái | Mô tả | Ai / Hành động |
|------------|--------|-----------------|
| **Pending** | Chờ NCC xác nhận | Mặc định khi đơn Submitted → Admin Chấp nhận → tất cả OS vẫn Pending (hoặc BE set Confirmed); trong mock có thể Admin Accept = Pending→Confirmed |
| **Confirmed** | NCC đã xác nhận | NCC bấm **Confirm** tại Chi tiết đơn NCC |
| **Rejected** | NCC từ chối | NCC bấm **Reject** hoặc Admin bấm **Từ chối đơn** (cả đơn → tất cả OS Rejected) |
| **Delivering** | Đang giao | NCC bấm **Đang giao** |
| **Delivered** | Đã giao tới cửa hàng | NCC bấm **Đã giao (Delivered)** |
| **Partial** | Giao thiếu | NCC bấm **Báo giao thiếu** + nhập ghi chú |
| **Completed** | Store đã xác nhận nhận hàng / đã nhập kho | Store bấm **Xác nhận đã nhận hàng** (có thể gửi ảnh) tại Chi tiết đơn |

---

## 3. Luồng nghiệp vụ theo thứ tự & Ảnh hưởng

### Luồng 1: Đăng nhập / Đăng xuất

- **Trang:** `/auth/sign-in`
- **Nút / Hành động:**
  - Chọn user (demo) hoặc nhập Email/Password (khi bật API)
  - **Đăng nhập** → vào `/dashboard/home`
  - Trên Navbar: menu user → **Đăng xuất** → về `/auth/sign-in`
- **Ảnh hưởng:** Quyết định **role** (Admin / StoreUser / SupplierUser) → quyết định **menu sidebar** và **quyền** trên mọi trang (CRUD, Tạo đơn, Duyệt đơn, Đơn NCC, Kho, Báo cáo).

---

### Luồng 2: Thiết lập dữ liệu nền (Admin)

Thứ tự khuyến nghị: **Nhà cung cấp → Danh mục → Sản phẩm → Cửa hàng → User**, vì:

- **Sản phẩm** phụ thuộc **NCC** và **Danh mục** (chọn supplierId, categoryId).
- **User** (StoreUser/SupplierUser) phụ thuộc **Cửa hàng** (storeId) và **NCC** (supplierId).
- **Tạo đơn** dùng: **Cửa hàng**, **Sản phẩm** (→ NCC, Danh mục), **User** (createdBy).

#### 2.1 Nhà cung cấp (Suppliers)

- **Trang:** `/dashboard/suppliers`
- **Nút / Chức năng:**

| Nút / Hành động | Điều kiện | Kết quả | Ảnh hưởng luồng khác |
|------------------|-----------|---------|------------------------|
| **Thêm** | - | Mở modal "Thêm Nhà cung cấp" | - |
| Trong modal: **Lưu** | Đã nhập Mã, Tên, Liên hệ, Email, Địa chỉ (Trạng thái) | Thêm 1 NCC mới, đóng modal, danh sách cập nhật | **Sản phẩm**: có thêm lựa chọn NCC khi Thêm/Sửa. **Tạo đơn**: sản phẩm gắn NCC. **Báo cáo**: thống kê theo NCC. **Đơn NCC**: NCC mới có thể xuất hiện trong đơn. |
| Trong modal: **Hủy** | - | Đóng modal, không lưu | - |
| **Sửa** (icon bút) trên 1 dòng | - | Mở modal "Sửa Nhà cung cấp", pre-fill dữ liệu | Nếu đổi tên/mã: hiển thị ở Sản phẩm, Chi tiết đơn, Báo cáo cập nhật theo. |
| **Xóa** (icon thùng) | Confirm "Xóa nhà cung cấp này?" | Xóa NCC khỏi danh sách | **Ràng buộc**: Nếu Sản phẩm hoặc Đơn đang tham chiếu NCC này → cần xử lý (khóa xóa hoặc cascade). **Sản phẩm**: mất lựa chọn NCC. **Đơn cũ**: vẫn giữ supplierName/supplierId. |
| Bộ lọc: ô tìm (mã/tên/email), chọn Trạng thái | - | Lọc danh sách hiển thị | Chỉ ảnh hưởng hiển thị, không đổi dữ liệu. |

#### 2.2 Danh mục (Categories)

- **Trang:** `/dashboard/categories`
- **Nút / Chức năng:**

| Nút / Hành động | Điều kiện | Kết quả | Ảnh hưởng luồng khác |
|------------------|-----------|---------|------------------------|
| **Thêm** | - | Mở modal "Thêm Danh mục" | - |
| **Lưu** | Nhập Tên, Mô tả | Thêm danh mục, đóng modal | **Sản phẩm**: có thêm lựa chọn Danh mục khi Thêm/Sửa. **Tạo đơn**: sản phẩm lọc theo danh mục. |
| **Hủy** | - | Đóng modal | - |
| **Sửa** | - | Mở modal Sửa, cập nhật Tên/Mô tả | Sản phẩm thuộc danh mục hiển thị đúng tên mới. |
| **Xóa** | Confirm | Xóa danh mục | Nếu Sản phẩm đang gắn danh mục → cần ràng buộc (khóa xóa hoặc clear categoryId). |

#### 2.3 Sản phẩm (Products)

- **Trang:** `/dashboard/products`
- **Nút / Chức năng:**

| Nút / Hành động | Điều kiện | Kết quả | Ảnh hưởng luồng khác |
|------------------|-----------|---------|------------------------|
| Bộ lọc: tìm kiếm, NCC, Danh mục, Trạng thái | - | Lọc danh sách | Chỉ hiển thị. |
| **Thêm** | - | Mở modal "Thêm Sản phẩm" | - |
| **Lưu** | Nhập Mã, Tên, chọn NCC, Danh mục, Đơn vị, Giá (Trạng thái) | Thêm sản phẩm | **Tạo đơn**: sản phẩm mới xuất hiện trong danh sách chọn, giỏ hàng. **Kho**: khi nhập kho theo đơn sẽ có productId. **Báo cáo**: thống kê theo sản phẩm (nếu có). |
| **Hủy** | - | Đóng modal | - |
| **Sửa** | - | Mở modal Sửa | Đổi tên/giá/đơn vị: Tạo đơn và Chi tiết đơn (đơn cũ giữ snapshot). Đơn mới dùng giá/tên mới. |
| **Xóa** | Confirm | Xóa sản phẩm | Đơn cũ vẫn giữ productName, price (snapshot). Tạo đơn không còn chọn SP này. Kho: productId có thể còn trong tồn/lịch sử. |

#### 2.4 Cửa hàng (Stores)

- **Trang:** `/dashboard/stores`
- **Nút / Chức năng:**

| Nút / Hành động | Điều kiện | Kết quả | Ảnh hưởng luồng khác |
|------------------|-----------|---------|------------------------|
| **Thêm** | - | Mở modal "Thêm Cửa hàng" | - |
| **Lưu** | Mã, Tên, Địa chỉ, Điện thoại (Trạng thái) | Thêm cửa hàng | **User**: StoreUser gắn storeId. **Tạo đơn**: Admin chọn cửa hàng. **Danh sách đơn**: lọc theo cửa hàng. **Kho**: tồn theo storeId. **Báo cáo**: thống kê theo cửa hàng. |
| **Hủy** / **Sửa** / **Xóa** | Giống CRUD trên | Tương tự | Xóa cửa hàng ảnh hưởng User (storeId), Đơn (storeId), Kho (storeId). |

#### 2.5 User

- **Trang:** `/dashboard/users`
- **Nút / Chức năng:**

| Nút / Hành động | Điều kiện | Kết quả | Ảnh hưởng luồng khác |
|------------------|-----------|---------|------------------------|
| **Thêm** | - | Mở modal "Thêm User" | - |
| **Lưu** | Email, Tên, Role (Admin/StoreUser/SupplierUser), Store hoặc NCC, Trạng thái | Thêm user | **Đăng nhập**: user mới có thể đăng nhập. **StoreUser** → thấy Tạo đơn, Danh sách đơn (theo store). **SupplierUser** → thấy Đơn cần xử lý (theo supplierId). **Tạo đơn**: createdBy. |
| **Hủy** / **Sửa** / **Xóa** | - | Như CRUD | Sửa role/store/supplier: quyền và dữ liệu hiển thị thay đổi. Xóa user: đơn cũ vẫn giữ createdBy (id). |

---

### Luồng 3: Tạo đơn hàng (Admin / StoreUser)

- **Trang:** `/dashboard/create-order`
- **Điều kiện tiên quyết:** Đã có ít nhất **Cửa hàng**, **Sản phẩm** (và NCC, Danh mục đã thiết lập). StoreUser dùng luôn **storeId** của user; Admin **phải chọn** cửa hàng.

| Nút / Hành động | Điều kiện | Kết quả | Ảnh hưởng luồng khác |
|------------------|-----------|---------|------------------------|
| Chọn **Cửa hàng** (dropdown, chỉ Admin) | Admin | Gán storeId cho đơn sắp tạo | **Danh sách đơn**: đơn lọc theo store. **Chi tiết đơn**: storeName. **Kho**: nhập kho theo storeId. **Báo cáo**: theo cửa hàng. |
| Bộ lọc sản phẩm: tìm kiếm, NCC, Danh mục | - | Lọc danh sách SP hiển thị | Chỉ UI. |
| **+** (Thêm vào giỏ) trên 1 sản phẩm | SP Active | Thêm 1 dòng vào giỏ (hoặc tăng số lượng nếu đã có) | Giỏ hàng có nội dung → có thể Submit. |
| **-** / **+** trong giỏ | Đã có dòng trong giỏ | Giảm/tăng số lượng; nếu = 0 có thể xóa dòng | Ảnh hưởng số lượng trong đơn. |
| Xóa dòng khỏi giỏ (icon thùng) | - | Bỏ sản phẩm khỏi giỏ | Giỏ có thể rỗng → Submit disabled. |
| **Submit đơn** | Giỏ không rỗng; Admin thì đã chọn cửa hàng | Tạo **Order** status **Submitted**, với **OrderSupplier** (theo từng NCC trong giỏ) status **Pending**, **OrderItem** theo từng dòng giỏ | **Luồng 4**: Đơn xuất hiện ở Danh sách đơn, Chi tiết đơn. **Luồng 5**: Mỗi NCC thấy đơn con của mình ở "Đơn cần xử lý". **Dashboard Home**: thống kê đơn tăng. **Navbar**: có thể có thông báo "Đơn cần duyệt". |

---

### Luồng 4: Admin duyệt đơn (Chấp nhận / Từ chối)

- **Trang:** `/dashboard/orders` (danh sách) → click vào đơn → `/dashboard/orders/:id` (Chi tiết đơn).
- **Điều kiện:** Đơn **Submitted**; user **Admin**.

| Nút / Hành động | Điều kiện | Kết quả | Ảnh hưởng luồng khác |
|------------------|-----------|---------|------------------------|
| **Chấp nhận đơn** | Order status = Submitted | Order → **Processing**; tất cả OrderSupplier **Pending** → **Confirmed** (hoặc giữ Pending tùy BE) | **Luồng 5**: NCC thấy đơn con ở trạng thái Confirmed (hoặc Pending tùy logic) và có thể **Confirm/Reject/Đang giao/Đã giao**. **Danh sách đơn**: trạng thái đơn = Processing. |
| **Từ chối đơn** | Order status = Submitted | Order → **Cancelled**; tất cả OrderSupplier → **Rejected** | **Luồng 5**: NCC không cần xử lý (đã Rejected). **Dashboard / Báo cáo**: đơn hủy. |

---

### Luồng 5: NCC xử lý đơn (SupplierUser)

- **Trang:** `/dashboard/supplier-orders` (Đơn cần xử lý) → click đơn → `/dashboard/supplier-orders/:id` (Chi tiết đơn NCC).
- **Điều kiện:** User **SupplierUser**, đơn con (OrderSupplier) thuộc **supplierId** của user.

| Nút / Hành động | Điều kiện (trạng thái OS) | Kết quả | Ảnh hưởng luồng khác |
|------------------|----------------------------|---------|------------------------|
| **Confirm** | Pending | OrderSupplier → **Confirmed** | **Luồng 6**: Store/Admin thấy NCC đã xác nhận. Có thể chuyển **Đang giao** / **Đã giao**. |
| **Reject** | Pending | OrderSupplier → **Rejected** | **Chi tiết đơn (Store)**: NCC đó Rejected. **Admin**: có thể cần đóng đơn khi mọi NCC đã xong (Delivered/Completed/Rejected). |
| **Đang giao** | Confirmed | OrderSupplier → **Delivering** | **Luồng 6**: Store/Admin thấy "Đang giao". **Navbar**: có thể thông báo. |
| **Đã giao (Delivered)** | Delivering | OrderSupplier → **Delivered** | **Luồng 6**: Store có thể **Xác nhận đã nhận hàng** và **Nhập kho**. **Admin**: khi tất cả NCC Delivered/Completed → có thể **Chấp nhận đơn tổng**. **Navbar**: thông báo "Xác nhận nhận hàng". |
| **Báo giao thiếu (Partial)** | Confirmed hoặc Delivering | OrderSupplier → **Partial** + ghi chú | **Luồng 6**: Store vẫn có thể **Xác nhận đã nhận hàng** (phần đã giao) và **Nhập kho**. Hiển thị ghi chú giao thiếu. |

---

### Luồng 6: Store/Admin – Chi tiết đơn: Xác nhận nhận hàng & Nhập kho

- **Trang:** `/dashboard/orders/:id` (Chi tiết đơn).
- **Điều kiện:** User **Admin** hoặc **StoreUser** (và storeId = order.storeId).

| Nút / Hành động | Điều kiện (trạng thái OS) | Kết quả | Ảnh hưởng luồng khác |
|------------------|----------------------------|---------|------------------------|
| **Quay lại danh sách** | - | Navigate về `/dashboard/orders` | - |
| **Xuất đơn / In** | - | Mở cửa sổ in toàn đơn (theo NCC) | Chỉ in/PDF, không đổi dữ liệu. |
| **Xuất đơn NCC / Gửi** (từng block NCC) | - | In/xuất riêng phần 1 NCC | Chỉ in. |
| **Chấp nhận đơn** / **Từ chối đơn** | Như Luồng 4 | Như Luồng 4 | - |
| **Chấp nhận đơn tổng** | Order Processing, **mọi** OrderSupplier đã **Delivered** hoặc **Completed** hoặc **Rejected** | Order → **Completed**; các OS Delivered → **Completed** (nếu BE hỗ trợ) | **Dashboard / Báo cáo**: đơn Completed. Không còn thông báo "sẵn sàng đóng". |
| **Xác nhận đã nhận hàng** | OrderSupplier **Delivered** hoặc **Partial** | Mở modal: tải ảnh hàng nhận được, ảnh hóa đơn → **Xác nhận đã nhận hàng & gửi ảnh** | OrderSupplier → **Completed** (hoặc trạng thái "đã nhận"). Lưu ảnh. **Nhập kho** có thể bật cho OS này. |
| Trong modal: **Hủy** | - | Đóng modal | - |
| **Nhập kho** | OS **Delivered** / **Completed** / **Partial** và chưa nhập kho | Gọi API/BE tạo phiếu nhập kho từ đơn NCC này | **Luồng 8 (Kho)**: Tồn kho (storeId, productId) tăng; lịch sử giao dịch có bản ghi In, referenceOrderId, referenceOrderSupplierId. |

---

### Luồng 7: Admin đóng đơn tổng

- **Trang:** `/dashboard/orders/:id`.
- **Nút:** **Chấp nhận đơn tổng** (đã mô tả trong Luồng 6).
- **Ảnh hưởng:** Order → Completed; thống kê Dashboard/Báo cáo; không còn thông báo "sẵn sàng đóng".

---

### Luồng 8: Quản lý kho (chỉ StoreUser — Store)

- **Trang:** `/dashboard/warehouse`
- **Quyền:** Chỉ **StoreUser** (cửa hàng) vào được. **Admin không tham gia quản lý kho** — Admin chỉ gửi đơn và quản lý tình trạng đơn (duyệt/từ chối/đóng đơn).
- **Nguồn dữ liệu:** Tồn kho và lịch sử giao dịch (In/Out/Adjust) — **cập nhật khi Store bấm Nhập kho** tại Chi tiết đơn (Luồng 6).

| Nút / Hành động | Điều kiện | Kết quả | Ảnh hưởng luồng khác |
|------------------|-----------|---------|------------------------|
| Bộ lọc: **Cửa hàng** (store mình), **Từ ngày**, **Đến ngày** | - | Lọc bảng tồn & lịch sử | Chỉ hiển thị. |
| **Xóa bộ lọc** | Đã đặt ít nhất 1 bộ lọc | Reset bộ lọc | Chỉ hiển thị. |

- **Ảnh hưởng ngược:** Kho **chỉ đọc** từ dữ liệu đã có; dữ liệu thay đổi khi **Store** bấm **Nhập kho** tại Chi tiết đơn (Luồng 6).

---

### Luồng 9: Báo cáo (Admin)

- **Trang:** `/dashboard/reports`
- **Nguồn dữ liệu:** **orders**, **suppliers**, **stores** — tất cả luồng CRUD và Đơn đều ảnh hưởng số liệu.

| Nút / Hành động | Điều kiện | Kết quả | Ảnh hưởng luồng khác |
|------------------|-----------|---------|------------------------|
| **Từ ngày**, **Đến ngày** (nếu có) | - | Lọc đơn theo orderDate | Biểu đồ / bảng theo NCC, Cửa hàng cập nhật theo khoảng ngày. |
| **Xuất / Tải** (nếu có) | - | Xuất file báo cáo | Chỉ xuất, không đổi dữ liệu. |

- **Ảnh hưởng:** Báo cáo **phụ thuộc** Luồng 2 (NCC, Store, User), Luồng 3–7 (đơn, trạng thái, Completed).

---

### Luồng 10: Dashboard Home & Navbar

- **Dashboard Home** (`/dashboard/home`): Thống kê đơn (tổng, đang giao, trễ), biểu đồ theo tháng/trạng thái, đơn gần đây; với StoreUser chỉ đơn của store; với SupplierUser chỉ đơn NCC. Mỗi thẻ/link dẫn tới **Danh sách đơn** hoặc **Chi tiết đơn** / **Đơn cần xử lý**.
- **Navbar:**
  - **Menu user** → **Đăng xuất** (Luồng 1).
  - **Thông báo (chuông):** Hiển thị theo đơn: "Đơn cần duyệt" (Submitted), "Sẵn sàng đóng" (Processing + tất cả NCC Delivered/Completed/Rejected), "Xác nhận nhận hàng" (OS Delivered). Click → dẫn tới Chi tiết đơn tương ứng.
- **Ảnh hưởng:** Chỉ điều hướng & hiển thị; dữ liệu phụ thuộc toàn bộ luồng đơn và CRUD.

---

## 4. Sơ đồ ảnh hưởng giữa các luồng (tóm tắt)

```
[Đăng nhập] ──────────────────────────────────────────────────────────► Quyền tất cả trang

[NCC] ──────► [Sản phẩm] ──────► [Tạo đơn] ──► [Danh sách đơn] ──► [Chi tiết đơn]
[Danh mục] ──┘                    │                    │                    │
[Cửa hàng] ───────────────────────┼────────────────────┼────────────────────┤
[User] ──────────────────────────┘                    │                    │
                                                       │                    ├──► [Kho] (chỉ Store — Nhập kho)
                                                       │                    ├──► [Báo cáo] (số liệu)
                                                       │                    └──► [Navbar] (thông báo)
                                                       │
[Tạo đơn - Submit] ────────────────────────────────────┘
         │
         └──► [Đơn NCC] (SupplierOrderList/Detail) ──► Confirm/Reject/Delivering/Delivered/Partial
                          │
                          └──► Ảnh hưởng lại [Chi tiết đơn]: Store xác nhận nhận hàng, Nhập kho
                                    │
                                    └──► [Kho]: tồn & lịch sử
```

- **Luồng 2 (CRUD)** cung cấp **NCC, Danh mục, Sản phẩm, Cửa hàng, User** → **Luồng 3 (Tạo đơn)** dùng để tạo đơn.
- **Luồng 3** tạo đơn **Submitted** → **Luồng 4** (Admin duyệt) chuyển **Processing** → **Luồng 5** (NCC) xử lý từng đơn con.
- **Luồng 5** (Delivered/Partial/Completed/Rejected) → **Luồng 6** (Store xác nhận nhận hàng, Nhập kho) và **Luồng 7** (Admin đóng đơn tổng).
- **Luồng 6** (Nhập kho) → **Luồng 8** (Kho) cập nhật tồn và lịch sử.
- **Luồng 2, 3, 4, 5, 6, 7** → **Luồng 9** (Báo cáo) và **Dashboard / Navbar** (thống kê, thông báo).

---

## 5. Danh sách nút / chức năng theo trang (checklist)

| Trang | Nút / Hành động | Ghi chú |
|-------|------------------|--------|
| **Login** | Đăng nhập (chọn user / email+password) | - |
| **Navbar** | Menu user, Đăng xuất, Chuông thông báo (link tới đơn) | - |
| **Nhà cung cấp** | Thêm, Lưu, Hủy, Sửa, Xóa, Bộ lọc (tìm, trạng thái) | - |
| **Danh mục** | Thêm, Lưu, Hủy, Sửa, Xóa | - |
| **Sản phẩm** | Thêm, Lưu, Hủy, Sửa, Xóa, Bộ lọc (tìm, NCC, Danh mục, Trạng thái) | - |
| **Cửa hàng** | Thêm, Lưu, Hủy, Sửa, Xóa | - |
| **User** | Thêm, Lưu, Hủy, Sửa, Xóa | - |
| **Tạo đơn** | Chọn cửa hàng (Admin), Bộ lọc SP, +/– giỏ, Xóa khỏi giỏ, Submit đơn | - |
| **Danh sách đơn** | Bộ lọc (trạng thái, NCC, cửa hàng, ngày), Xóa bộ lọc, Click đơn → Chi tiết, In đơn (nếu có) | - |
| **Chi tiết đơn** | Quay lại, Xuất đơn/In, Xuất đơn NCC, Chấp nhận đơn, Từ chối đơn, Chấp nhận đơn tổng, Xác nhận đã nhận hàng (modal: ảnh + Xác nhận & gửi ảnh, Hủy), Nhập kho | - |
| **Đơn cần xử lý (NCC)** | Danh sách, Click đơn → Chi tiết đơn NCC | - |
| **Chi tiết đơn NCC** | Quay lại, Confirm, Reject, Báo giao thiếu, Đang giao, Đã giao | - |
| **Quản lý kho** | Bộ lọc (cửa hàng, từ ngày, đến ngày), Xóa bộ lọc | Chỉ **StoreUser**; Admin không vào được |
| **Báo cáo** | Lọc từ ngày–đến ngày, Xuất (nếu có) | - |
| **Dashboard Home** | Các link tới Danh sách đơn, Chi tiết đơn, Đơn cần xử lý (theo role) | - |

Tài liệu này dùng để test theo luồng, kiểm tra ràng buộc dữ liệu và ảnh hưởng chéo giữa các chức năng.
