import React from "react";
import api from "@/api";

const DataContext = React.createContext(null);
const ORDERS_CACHE_KEY = "admin_dashboard_orders_cache";
const ORDERS_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 giờ - dùng cache đơn khi reload nếu BE chưa lưu DB

function normOrderItem(it) {
  if (!it) return it;
  return {
    id: it.id ?? it.Id,
    productId: it.productId ?? it.ProductId,
    productName: it.productName ?? it.ProductName,
    quantity: it.quantity ?? it.Quantity,
    receivedQuantity: it.receivedQuantity ?? it.ReceivedQuantity ?? null,
    unit: it.unit ?? it.Unit,
    price: it.price ?? it.Price,
    note: it.note ?? it.Note ?? null,
  };
}
function normReceiveImage(img) {
  if (!img) return img;
  return {
    id: img.id ?? img.Id,
    type: img.type ?? img.Type,
    imageUrl: img.imageUrl ?? img.ImageUrl,
    dataUrl: img.dataUrl ?? img.DataUrl,
    fileName: img.fileName ?? img.FileName,
  };
}
function normOrderSupplier(os) {
  if (!os) return os;
  return {
    id: os.id ?? os.Id,
    orderId: os.orderId ?? os.OrderId,
    supplierId: os.supplierId ?? os.SupplierId,
    supplierName: os.supplierName ?? os.SupplierName,
    status: os.status ?? os.Status,
    orderItems: (os.orderItems ?? os.OrderItems ?? []).map(normOrderItem),
    expectedDeliveryDate: os.expectedDeliveryDate ?? os.ExpectedDeliveryDate,
    actualDeliveryDate: os.actualDeliveryDate ?? os.ActualDeliveryDate,
    confirmDate: os.confirmDate ?? os.ConfirmDate,
    note: os.note ?? os.Note,
    receiveNote: os.receiveNote ?? os.ReceiveNote ?? null,
    receiveQtyAdjusted: !!(os.receiveQtyAdjusted ?? os.ReceiveQtyAdjusted),
    receiveImages: (os.receiveImages ?? os.ReceiveImages ?? []).map(normReceiveImage),
  };
}
function normalizeOrders(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((o) => ({
    id: o.id ?? o.Id,
    storeId: o.storeId ?? o.StoreId,
    storeName: o.storeName ?? o.StoreName,
    orderDate: o.orderDate ?? o.OrderDate,
    status: o.status ?? o.Status,
    orderSuppliers: (o.orderSuppliers ?? o.OrderSuppliers ?? []).map(normOrderSupplier),
  }));
}

function useInitialState() {
  const [suppliers, setSuppliers] = React.useState(() => []);
  const [products, setProducts] = React.useState(() => []);
  const [stores, setStores] = React.useState(() => []);
  const [users, setUsers] = React.useState(() => []);
  const [orders, setOrders] = React.useState(() => []);
  return {
    suppliers,
    setSuppliers,
    products,
    setProducts,
    stores,
    setStores,
    users,
    setUsers,
    orders,
    setOrders,
  };
}

export function DataProvider({ children }) {
  const state = useInitialState();
  const {
    suppliers,
    setSuppliers,
    products,
    setProducts,
    stores,
    setStores,
    users,
    setUsers,
    orders,
    setOrders,
  } = state;

  const [apiLoading, setApiLoading] = React.useState(api.USE_API);
  const [apiError, setApiError] = React.useState(null);

  const refetchSuppliers = React.useCallback(async () => {
    if (!api.USE_API) return;
    try {
      const data = await api.get("suppliers.list");
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("refetchSuppliers", e);
    }
  }, [setSuppliers]);

  const refetchProducts = React.useCallback(async () => {
    if (!api.USE_API) return;
    try {
      const data = await api.get("products.list");
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("refetchProducts", e);
    }
  }, [setProducts]);

  const refetchStores = React.useCallback(async () => {
    if (!api.USE_API) return;
    try {
      const data = await api.get("stores.list");
      setStores(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("refetchStores", e);
    }
  }, [setStores]);

  const refetchUsers = React.useCallback(async () => {
    if (!api.USE_API) return;
    try {
      const data = await api.get("users.list");
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("refetchUsers", e);
    }
  }, [setUsers]);

  const refetchOrders = React.useCallback(async () => {
    if (!api.USE_API) return;
    try {
      const data = await api.get("orders.list", { query: { _: Date.now() } });
      setOrders(Array.isArray(data) ? normalizeOrders(data) : []);
    } catch (e) {
      console.error("refetchOrders", e);
    }
  }, [setOrders]);

  // Lưu đơn vào localStorage mỗi khi thay đổi → reload trang vẫn giữ trạng thái (khi BE chưa lưu DB)
  React.useEffect(() => {
    if (!api.USE_API || !orders?.length) return;
    try {
      localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify({ data: orders, savedAt: Date.now() }));
    } catch (e) {
      // localStorage đầy hoặc private mode
    }
  }, [orders, api.USE_API]);

  const loadInitialData = React.useCallback(async () => {
    if (!api.USE_API || !api.BASE_URL) return;
    setApiError(null);
    try {
      const [s, p, st, u, o] = await Promise.all([
        api.get("suppliers.list").then((d) => (Array.isArray(d) ? d : [])),
        api.get("products.list").then((d) => (Array.isArray(d) ? d : [])),
        api.get("stores.list").then((d) => (Array.isArray(d) ? d : [])),
        api.get("users.list").then((d) => (Array.isArray(d) ? d : [])),
        api.get("orders.list", { query: { _: Date.now() } }).then((d) => (Array.isArray(d) ? normalizeOrders(d) : [])),
      ]);
      setSuppliers(s);
      setProducts(p);
      setStores(st);
      setUsers(u);
      // Luôn dùng dữ liệu từ API khi load/refetch (không ghi đè bằng cache)
      setOrders(o);
    } catch (err) {
      const raw = String(err?.message || "").toLowerCase();
      if (err.status === 401) {
        setApiError("Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng xuất và đăng nhập lại (email + mật khẩu).");
      } else if (raw.includes("failed to fetch") || raw.includes("network") || raw.includes("cors")) {
        setApiError("Không kết nối được máy chủ. Kiểm tra API đang chạy hoặc thử tải lại trang.");
      } else {
        setApiError(err.message || "Lỗi tải dữ liệu");
      }
      console.error("DataContext load", err);
    } finally {
      setApiLoading(false);
    }
  }, [setSuppliers, setProducts, setStores, setUsers, setOrders]);

  React.useEffect(() => {
    if (!api.USE_API || !api.BASE_URL) {
      setApiLoading(false);
      return;
    }
    if (!api.getToken()) {
      setApiLoading(false);
      setApiError("Chưa đăng nhập. Vui lòng đăng nhập để tải dữ liệu.");
      return;
    }
    let cancelled = false;
    setApiError(null);
    loadInitialData();
    return () => { cancelled = true; };
  }, [loadInitialData]);

  const refetchInitialData = React.useCallback(async () => {
    if (!api.USE_API || !api.getToken()) return;
    setApiLoading(true);
    setApiError(null);
    await loadInitialData();
    setApiLoading(false);
  }, [loadInitialData]);

  const clearApiError = React.useCallback(() => setApiError(null), []);

  const value = React.useMemo(
    () => ({
      suppliers,
      setSuppliers,
      products,
      setProducts,
      stores,
      setStores,
      users,
      setUsers,
      orders,
      setOrders,
      apiLoading,
      apiError,
      clearApiError,
      useApi: api.USE_API,
      refetchInitialData,
      refetchSuppliers,
      refetchProducts,
      refetchStores,
      refetchUsers,
      refetchOrders,
    }),
    [
      suppliers,
      products,
      stores,
      users,
      orders,
      apiLoading,
      apiError,
      clearApiError,
      refetchInitialData,
      refetchSuppliers,
      refetchProducts,
      refetchStores,
      refetchUsers,
      refetchOrders,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = React.useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
