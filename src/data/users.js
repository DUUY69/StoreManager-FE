// Dữ liệu mẫu - User quán cafe (role: Admin | StoreUser | SupplierUser). Có phone để hiển thị ở Cài đặt.
// SupplierUser: mỗi NCC có 2 tài khoản (user chính + user phụ) để test.
export const usersData = [
  { id: 1, email: "admin@cafe.vn", name: "Admin Cafe", phone: "0900000001", role: "Admin", storeId: null, supplierId: null, status: "Active" },
  { id: 2, email: "q1@cafe.vn", name: "Nguyễn Văn An", phone: "0900000002", role: "StoreUser", storeId: 1, supplierId: null, status: "Active" },
  { id: 3, email: "q7@cafe.vn", name: "Trần Thị Bình", phone: "0900000003", role: "StoreUser", storeId: 2, supplierId: null, status: "Active" },
  { id: 4, email: "bt@cafe.vn", name: "Lê Thị Hương", phone: "0900000004", role: "StoreUser", storeId: 3, supplierId: null, status: "Active" },
  { id: 5, email: "ncc_caphe@supplier.vn", name: "Lê Văn Cường", phone: "0911000001", role: "SupplierUser", storeId: null, supplierId: 1, status: "Active" },
  { id: 6, email: "ncc_sua@supplier.vn", name: "Phạm Thị Dung", phone: "0911000002", role: "SupplierUser", storeId: null, supplierId: 2, status: "Active" },
  { id: 7, email: "ncc_syrup@supplier.vn", name: "Hoàng Văn Em", phone: "0911000003", role: "SupplierUser", storeId: null, supplierId: 3, status: "Active" },
  { id: 8, email: "ncc_banh@supplier.vn", name: "Võ Minh Tuấn", phone: "0911000004", role: "SupplierUser", storeId: null, supplierId: 4, status: "Active" },
  { id: 9, email: "ncc_vattu@supplier.vn", name: "Đặng Thị Lan", phone: "0911000005", role: "SupplierUser", storeId: null, supplierId: 5, status: "Active" },
  // Thêm user phụ cho từng NCC (cùng supplierId, mật khẩu demo: 123456)
  { id: 10, email: "ncc_caphe2@supplier.vn", name: "Nguyễn Thị Hoa", phone: "0911000011", role: "SupplierUser", storeId: null, supplierId: 1, status: "Active" },
  { id: 11, email: "ncc_sua2@supplier.vn", name: "Trần Văn Đức", phone: "0911000012", role: "SupplierUser", storeId: null, supplierId: 2, status: "Active" },
  { id: 12, email: "ncc_syrup2@supplier.vn", name: "Lê Thị Mai", phone: "0911000013", role: "SupplierUser", storeId: null, supplierId: 3, status: "Active" },
  { id: 13, email: "ncc_banh2@supplier.vn", name: "Phạm Văn Hùng", phone: "0911000014", role: "SupplierUser", storeId: null, supplierId: 4, status: "Active" },
  { id: 14, email: "ncc_vattu2@supplier.vn", name: "Hoàng Thị Nga", phone: "0911000015", role: "SupplierUser", storeId: null, supplierId: 5, status: "Active" },
];
