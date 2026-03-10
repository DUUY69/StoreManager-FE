import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardBody, Typography, Button, Input, IconButton, Chip } from "@material-tailwind/react";
import { FilterSelect } from "@/components/FilterSelect";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import { useData } from "@/context/DataContext";
import { useAuth, useToast } from "@/context";
import api from "@/api";

export function CreateOrder() {
  const { products, suppliers, categories, orders, setOrders, stores, useApi, refetchOrders } = useData();
  const { currentUser, isAdmin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAdmin) navigate("/dashboard/home", { replace: true });
  }, [isAdmin, navigate]);
  if (isAdmin) return null;

  const [search, setSearch] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState(""); // Admin chọn cửa hàng; StoreUser dùng currentUser.storeId
  const [cart, setCart] = useState([]); // [{ productId, productName, supplierId, supplierName, quantity, unit, price }]

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.code && p.code.toLowerCase().includes(search.toLowerCase()));
      const matchSup = !filterSupplier || p.supplierId === Number(filterSupplier);
      const matchCat = !filterCategory || p.categoryId === Number(filterCategory);
      return p.status === "Active" && matchSearch && matchSup && matchCat;
    });
  }, [products, search, filterSupplier, filterCategory]);

  const addToCart = (p) => {
    const sup = suppliers.find((s) => s.id === p.supplierId);
    const existing = cart.find((c) => c.productId === p.id);
    if (existing) {
      setCart(cart.map((c) => (c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([...cart, { productId: p.id, productName: p.name, supplierId: p.supplierId, supplierName: sup?.name || "", quantity: 1, unit: p.unit, price: p.price }]);
    }
  };

  const updateQty = (productId, delta) => {
    setCart(cart.map((c) => (c.productId === productId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c)).filter((c) => c.quantity > 0));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((c) => c.productId !== productId));
  };

  const effectiveStoreId = isAdmin ? Number(selectedStoreId) || null : currentUser?.storeId;
  const submitOrder = async () => {
    if (cart.length === 0) {
      showToast("Chưa có sản phẩm trong đơn.", "error");
      return;
    }
    if (isAdmin && !selectedStoreId) {
      showToast("Vui lòng chọn cửa hàng gửi đơn.", "error");
      return;
    }
    const storeIdToUse = effectiveStoreId ?? currentUser?.storeId ?? currentUser?.StoreId;
    if (storeIdToUse == null || storeIdToUse === 0) {
      showToast("Không xác định được cửa hàng. Vui lòng đăng xuất và đăng nhập lại.", "error");
      return;
    }
    const supplierIds = [...new Set(cart.map((c) => c.supplierId))];
    const orderSuppliersPayload = supplierIds.map((supId) => {
      const items = cart.filter((c) => c.supplierId === supId);
      return {
        supplierId: supId,
        orderItems: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unit: it.unit,
          price: it.price,
        })),
      };
    });
    if (useApi) {
      setSubmitting(true);
      try {
        await api.post("orders.create", {
          storeId: Number(storeIdToUse),
          orderSuppliers: orderSuppliersPayload,
        });
        await refetchOrders();
        setCart([]);
        showToast("Tạo đơn thành công.", "success");
        navigate("/dashboard/orders");
      } catch (e) {
        const msg = e?.data?.message || e?.message || "Lỗi tạo đơn";
        showToast(typeof msg === "string" ? msg : "Lỗi tạo đơn", "error");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    const newOrderId = Math.max(0, ...orders.map((o) => o.id)) + 1;
    const orderSuppliers = supplierIds.map((supId) => {
      const items = cart.filter((c) => c.supplierId === supId);
      const sup = suppliers.find((s) => s.id === supId);
      return {
        id: newOrderId * 100 + supId,
        orderId: newOrderId,
        supplierId: supId,
        supplierName: sup?.name || "",
        status: "Pending",
        expectedDeliveryDate: null,
        actualDeliveryDate: null,
        confirmDate: null,
        note: "",
        orderItems: items.map((it, idx) => ({
          id: newOrderId * 1000 + supId * 10 + idx,
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unit: it.unit,
          price: it.price,
        })),
      };
    });
    const newOrder = {
      id: newOrderId,
      storeId: storeIdToUse,
      storeName: storeIdToUse ? stores.find((s) => s.id === storeIdToUse)?.name : "Store",
      status: "Pending",
      orderDate: new Date().toISOString().slice(0, 10),
      expectedDeliveryDate: null,
      createdBy: currentUser.id,
      createdDate: new Date().toISOString(),
      totalItemCount: cart.reduce((s, c) => s + c.quantity, 0),
      orderSuppliers,
    };
    setOrders([...orders, newOrder]);
    setCart([]);
    showToast("Tạo đơn thành công. Đơn đã được tách theo từng NCC.", "success");
    navigate("/dashboard/orders");
  };

  const store = stores.find((s) => s.id === effectiveStoreId);

  return (
    <div className="mt-12">
      <Typography variant="h5" color="blue-gray" className="mb-4">Tạo đơn hàng {store ? `- ${store.name}` : isAdmin ? " (chọn cửa hàng bên dưới)" : ""}</Typography>

      {isAdmin && (
        <Card className="border border-blue-gray-100 mb-4">
          <CardBody className="p-4">
            <Typography variant="small" color="blue-gray" className="mb-2 block">Admin: chọn cửa hàng để gửi đơn cho NCC</Typography>
            <div className="w-full max-w-xs">
              <FilterSelect label="Cửa hàng" value={selectedStoreId} onChange={setSelectedStoreId} options={stores.map((s) => ({ value: String(s.id), label: s.name }))} placeholder="-- Chọn cửa hàng --" />
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-blue-gray-100">
          <CardHeader className="p-4 border-b">
            <Typography variant="h6" className="mb-3">Chọn sản phẩm</Typography>
            <div className="flex flex-row flex-wrap items-end gap-4 w-full">
              <div className="w-[200px] shrink-0">
                <Input placeholder="Tìm tên, mã..." value={search} onChange={(e) => setSearch(e.target.value)} className="!min-w-0" />
              </div>
              <div className="w-[180px] shrink-0">
                <FilterSelect label="NCC" value={filterSupplier} onChange={setFilterSupplier} options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))} placeholder="Tất cả" />
              </div>
              <div className="w-[180px] shrink-0">
                <FilterSelect label="Danh mục" value={filterCategory} onChange={setFilterCategory} options={categories.map((c) => ({ value: String(c.id), label: c.name }))} placeholder="Tất cả" />
              </div>
            </div>
          </CardHeader>
          <CardBody className="max-h-[400px] overflow-y-auto">
            {filteredProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-blue-gray-50">
                <div>
                  <Typography variant="small" className="font-medium">{p.name}</Typography>
                  <Typography variant="small" color="gray">{suppliers.find((s) => s.id === p.supplierId)?.name} · {p.unit} · {Number(p.price).toLocaleString("vi-VN")} đ</Typography>
                </div>
                <Button size="sm" onClick={() => addToCart(p)}><PlusIcon className="w-4 h-4" /></Button>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card className="border border-blue-gray-100">
          <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
            <Typography variant="h6">Giỏ đơn ({cart.length} dòng)</Typography>
            {cart.length > 0 && (
              <Button size="sm" color="blue" onClick={submitOrder} disabled={cart.length === 0 || submitting} title={cart.length === 0 ? "Thêm sản phẩm vào giỏ trước khi gửi" : ""}>{submitting ? "Đang gửi..." : "Submit đơn"}</Button>
            )}
          </CardHeader>
          <CardBody className="max-h-[400px] overflow-y-auto">
            {cart.length === 0 ? (
              <Typography color="gray">Chưa có sản phẩm. Chọn từ danh sách bên trái.</Typography>
            ) : (
              cart.map((c) => (
                <div key={c.productId} className="flex items-center justify-between py-2 border-b border-blue-gray-50">
                  <div>
                    <Typography variant="small" className="font-medium">{c.productName}</Typography>
                    <Chip size="sm" value={c.supplierName} className="w-fit mt-1" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outlined" onClick={() => updateQty(c.productId, -1)}>-</Button>
                    <Typography variant="small">{c.quantity} {c.unit}</Typography>
                    <Button size="sm" variant="outlined" onClick={() => updateQty(c.productId, 1)}>+</Button>
                    <IconButton variant="text" size="sm" color="red" onClick={() => removeFromCart(c.productId)}><TrashIcon className="w-4 h-4" /></IconButton>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default CreateOrder;
