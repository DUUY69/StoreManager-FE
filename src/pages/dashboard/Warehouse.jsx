import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardBody, Typography, Button } from "@material-tailwind/react";
import { ArchiveBoxIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/solid";
import { useAuth, useToast } from "@/context";
import { useData } from "@/context/DataContext";
import api from "@/api";

const mockSupplierStock = [
  { supplierId: 1, productId: 1, productCode: "CF001", productName: "Cà phê Arabica 1kg", quantity: 200, updatedAt: new Date().toISOString() },
  { supplierId: 1, productId: 2, productCode: "CF002", productName: "Cà phê Robusta 500g", quantity: 150, updatedAt: new Date().toISOString() },
];

const ELIGIBLE_STATUSES = ["Delivered", "Completed", "Partial"];

export function Warehouse() {
  const { isSupplierUser, isAdmin, isStoreUser, currentUser } = useAuth();
  const { useApi } = useData();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [stock, setStock] = useState(mockSupplierStock);
  const [loading, setLoading] = useState(false);
  const [pendingStockIn, setPendingStockIn] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [stockInLoadingId, setStockInLoadingId] = useState(null);

  // Tồn kho tại NCC (chỉ SupplierUser)
  useEffect(() => {
    if (!useApi || !isSupplierUser) {
      setStock(mockSupplierStock);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const list = await api.get("warehouse.supplierStock");
        if (!cancelled) setStock(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setStock([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [useApi, isSupplierUser]);

  // Đơn đã giao chờ nhập kho (Admin / StoreUser)
  useEffect(() => {
    if (!useApi || !(isAdmin || isStoreUser)) {
      setPendingStockIn([]);
      return;
    }
    let cancelled = false;
    setLoadingPending(true);
    (async () => {
      try {
        const query = isStoreUser && currentUser?.storeId != null ? { storeId: currentUser.storeId } : {};
        const orders = await api.get("orders.list", { query });
        if (cancelled) return;
        const list = (Array.isArray(orders) ? orders : []).flatMap((o) =>
          (o.orderSuppliers || o.OrderSuppliers || []).filter(
            (os) => ELIGIBLE_STATUSES.includes(os.status ?? os.Status)
          ).map((os) => ({
            orderId: o.id ?? o.Id,
            storeName: o.storeName ?? o.StoreName ?? "",
            os,
          }))
        );
        setPendingStockIn(list);
      } catch (e) {
        if (!cancelled) setPendingStockIn([]);
      } finally {
        if (!cancelled) setLoadingPending(false);
      }
    })();
    return () => { cancelled = true; };
  }, [useApi, isAdmin, isStoreUser, currentUser?.storeId]);

  const handleStockIn = async (osId) => {
    setStockInLoadingId(osId);
    try {
      const res = await api.post("orderSuppliers.stockIn", {}, { params: { id: osId } });
      setPendingStockIn((prev) => prev.filter((x) => (x.os.id ?? x.os.Id) !== osId));
      const msg = res?.message ?? res?.Message ?? "Đã nhập kho theo đơn NCC.";
      const count = res?.transactionsCreated ?? res?.TransactionsCreated;
      showToast(count != null ? `${msg} (${count} phiếu)` : msg, "success");
    } catch (e) {
      const msg = e?.data?.message ?? e?.message ?? "Lỗi nhập kho";
      if (e?.status === 400 && typeof msg === "string" && msg.includes("đã được nhập kho")) {
        setPendingStockIn((prev) => prev.filter((x) => (x.os.id ?? x.os.Id) !== osId));
      }
      showToast(typeof msg === "string" ? msg : "Lỗi nhập kho", "error");
    } finally {
      setStockInLoadingId(null);
    }
  };

  const showSupplierStock = isSupplierUser;
  const showStockInSection = (isAdmin || isStoreUser) && useApi;

  return (
    <div className="mt-12 w-full max-w-full min-w-0">
      <Typography variant="h5" color="blue-gray" className="mb-4 flex items-center gap-2">
        <ArchiveBoxIcon className="w-6 h-6" /> Kho
      </Typography>

      {showStockInSection && (
        <>
          <p className="text-sm text-blue-gray-500 mb-4">
            Đơn NCC đã giao — bấm <strong>Nhập kho</strong> để cộng tồn cửa hàng. Sau khi nhập, phiếu nhập được tạo và tồn kho cập nhật.
          </p>
          <Card className="border border-blue-gray-100 mb-6">
            <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
              <Typography variant="h6">Đơn đã giao — Nhập kho</Typography>
              {loadingPending && <Typography variant="small" color="gray">Đang tải...</Typography>}
            </CardHeader>
            <CardBody className="overflow-x-auto p-0">
              <table className="w-full min-w-[500px] table-auto">
                <thead>
                  <tr>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Đơn #</Typography></th>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Cửa hàng</Typography></th>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">NCC</Typography></th>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Trạng thái</Typography></th>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-right"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Thao tác</Typography></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingStockIn.length === 0 && !loadingPending ? (
                    <tr><td colSpan={5} className="py-8 text-center"><Typography color="gray">Không có đơn NCC nào đang chờ nhập kho (Delivered / Completed / Partial).</Typography></td></tr>
                  ) : pendingStockIn.map(({ orderId, storeName, os }) => {
                    const osId = os.id ?? os.Id;
                    const supplierName = os.supplierName ?? os.SupplierName ?? "";
                    const status = os.status ?? os.Status ?? "";
                    return (
                      <tr key={osId} className="hover:bg-blue-gray-50/50 border-b border-blue-gray-50">
                        <td className="py-3 px-4"><Typography variant="small" className="font-medium">{orderId}</Typography></td>
                        <td className="py-3 px-4"><Typography variant="small">{storeName}</Typography></td>
                        <td className="py-3 px-4"><Typography variant="small">{supplierName}</Typography></td>
                        <td className="py-3 px-4"><Typography variant="small">{status}</Typography></td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            color="green"
                            className="flex items-center gap-1 inline-flex"
                            onClick={() => handleStockIn(osId)}
                            disabled={stockInLoadingId === osId}
                          >
                            <ArchiveBoxIcon className="w-4 h-4" />
                            {stockInLoadingId === osId ? "Đang nhập..." : "Nhập kho"}
                          </Button>
                          <Button
                            size="sm"
                            variant="text"
                            className="ml-2"
                            onClick={() => navigate(`/dashboard/orders/${orderId}`)}
                          >
                            <ArrowRightOnRectangleIcon className="w-4 h-4" /> Chi tiết
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </>
      )}

      {showSupplierStock && (
        <>
          <p className="text-sm text-blue-gray-500 mb-4">
            Tồn kho sản phẩm tại NCC của bạn. Cập nhật số lượng tồn để cửa hàng đặt hàng chính xác.
          </p>
          <Card className="border border-blue-gray-100">
            <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
              <Typography variant="h6">Tồn kho theo sản phẩm</Typography>
              {loading && <Typography variant="small" color="gray">Đang tải...</Typography>}
            </CardHeader>
            <CardBody className="overflow-x-auto p-0">
              <table className="w-full min-w-[500px] table-auto">
                <thead>
                  <tr>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Mã SP</Typography></th>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Tên sản phẩm</Typography></th>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-right"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Số lượng</Typography></th>
                    <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold uppercase text-blue-gray-400">Cập nhật</Typography></th>
                  </tr>
                </thead>
                <tbody>
                  {stock.length === 0 ? (
                    <tr><td colSpan={4} className="py-8 text-center"><Typography color="gray">Chưa có dữ liệu tồn kho.</Typography></td></tr>
                  ) : stock.map((row) => (
                    <tr key={`${row.supplierId ?? row.SupplierId}-${row.productId ?? row.ProductId}`} className="hover:bg-blue-gray-50/50">
                      <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.productCode ?? row.ProductCode}</Typography></td>
                      <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{row.productName ?? row.ProductName}</Typography></td>
                      <td className="py-3 px-4 border-b border-blue-gray-50 text-right"><Typography variant="small" className="font-medium">{Number(row.quantity ?? row.Quantity ?? 0)}</Typography></td>
                      <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small" color="gray">{row.updatedAt ? new Date(row.updatedAt).toLocaleString("vi-VN") : (row.UpdatedAt ? new Date(row.UpdatedAt).toLocaleString("vi-VN") : "")}</Typography></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </>
      )}

      {!showSupplierStock && !showStockInSection && (
        <p className="text-sm text-blue-gray-500">Bạn không có quyền xem mục này.</p>
      )}
    </div>
  );
}

export default Warehouse;
