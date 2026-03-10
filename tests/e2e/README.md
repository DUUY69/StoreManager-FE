# E2E Tests (Selenium + Mocha)

Kiểm thử giao diện toàn bộ chức năng UI bằng Selenium WebDriver (Chrome).

## Yêu cầu

- Node.js 18+
- Chrome browser
- Ứng dụng chạy tại `http://localhost:5173` (mặc định, Vite dev) hoặc set `TEST_BASE_URL` (vd: `http://localhost:4173` khi dùng `npm run preview`)

## Chạy test

### 1. Bật ứng dụng (terminal 1)

```bash
cd FE
npm run dev
```

(Hoặc `npm run build && npm run preview` rồi set `TEST_BASE_URL=http://localhost:4173`.)

### 2. Chạy E2E (terminal 2)

```bash
cd FE
npm run test:e2e
```

Chạy headless (không mở cửa sổ Chrome):

```bash
HEADLESS=1 npm run test:e2e
```

Chỉ chạy một file:

```bash
npx mocha --timeout 60000 tests/e2e/login.spec.js --exit
```

## Cấu trúc

| File | Mô tả |
|------|--------|
| `config.js` | BASE_URL, timeouts |
| `driver.js` | Khởi tạo Chrome driver, helpers (open, clickByText, waitForText) |
| `helpers.js` | loginAsAdmin(), loginAs(role), goToMenu(text) |
| `login.spec.js` | Đăng nhập |
| `dashboard.spec.js` | Dashboard, menu |
| `navbar.spec.js` | Navbar, đăng xuất |
| `suppliers.spec.js` | CRUD Nhà cung cấp |
| `categories.spec.js` | CRUD Danh mục |
| `products.spec.js` | CRUD Sản phẩm |
| `stores.spec.js` | CRUD Cửa hàng |
| `users.spec.js` | CRUD User |
| `orders.spec.js` | Tạo đơn, Danh sách đơn, chi tiết đơn |
| `warehouse.spec.js` | Quản lý kho |
| `reports.spec.js` | Báo cáo |
| `supplier-orders.spec.js` | Đơn cần xử lý (role NCC) |

## Lưu ý

- Test dùng **chế độ mock** (không cần BE). Giữ `VITE_USE_API=false` trong `.env` khi chạy E2E.
- Đăng nhập demo: chọn user trong dropdown rồi bấm Đăng nhập (Admin mặc định).
- Một số test phụ thuộc vào data mẫu (ví dụ: có ít nhất 1 đơn trong Danh sách đơn).
