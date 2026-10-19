import React, { useState } from "react";
import { Card, CardHeader, CardBody, Typography, Button, Input } from "@material-tailwind/react";
import { ArrowDownTrayIcon, FunnelIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { StatisticsChart } from "@/widgets/charts";
import { chartsConfig } from "@/configs";
import { useData } from "@/context/DataContext";
import { useUrlFilters } from "@/utils/urlFilters";

const REPORT_FILTER_DEFAULTS = { dateFrom: "", dateTo: "", productId: "" };

/** API (.NET) thường trả OrderDate dạng ISO có giờ; input date chỉ có yyyy-mm-dd — phải so sánh theo ngày calendar. */
function orderPlacedDateKey(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${day}`;
  }
  return "";
}

export function Reports() {
  const { orders, suppliers, stores, products } = useData();
  const { values, setFilter, clearFilters: clearUrlFilters } = useUrlFilters(REPORT_FILTER_DEFAULTS);
  const filterDateFrom = values.dateFrom;
  const filterDateTo = values.dateTo;
  const filterProductId = values.productId;

  const filteredOrders = React.useMemo(() => {
    let list = orders;
    if (filterDateFrom) {
      list = list.filter((o) => {
        const key = orderPlacedDateKey(o.orderDate ?? o.OrderDate);
        return key && key >= filterDateFrom;
      });
    }
    if (filterDateTo) {
      list = list.filter((o) => {
        const key = orderPlacedDateKey(o.orderDate ?? o.OrderDate);
        return key && key <= filterDateTo;
      });
    }
    return list;
  }, [orders, filterDateFrom, filterDateTo]);

  const sortedProducts = React.useMemo(
    () =>
      [...(products || [])].sort((a, b) =>
        String(a.name ?? a.Name ?? "").localeCompare(String(b.name ?? b.Name ?? ""), "vi", { sensitivity: "base" })
      ),
    [products]
  );

  const selectedProductName = React.useMemo(() => {
    if (!filterProductId) return "";
    const pid = Number(filterProductId);
    const p = (products || []).find((x) => Number(x.id ?? x.Id) === pid);
    return p ? String(p.name ?? p.Name ?? `SP #${filterProductId}`) : `SP #${filterProductId}`;
  }, [products, filterProductId]);

  const bySupplier = React.useMemo(() => {
    const map = {};
    suppliers.forEach((s) => {
      const sid = s.id ?? s.Id;
      map[sid] = { name: s.name ?? s.Name, totalOrders: 0, completed: 0, totalItems: 0 };
    });
    filteredOrders.forEach((o) => {
      (o.orderSuppliers || o.OrderSuppliers || []).forEach((os) => {
        const sid = os.supplierId ?? os.SupplierId;
        if (!map[sid]) return;
        map[sid].totalOrders += 1;
        if ((os.status ?? os.Status) === "Delivered") map[sid].completed += 1;
        (os.orderItems || os.OrderItems || []).forEach((it) => {
          map[sid].totalItems += Number(it.quantity ?? it.Quantity ?? 0);
        });
      });
    });
    return Object.entries(map).map(([id, v]) => ({ id, ...v }));
  }, [filteredOrders, suppliers]);

  const byStore = React.useMemo(() => {
    const map = {};
    stores.forEach((s) => {
      const sid = String(s.id ?? s.Id);
      map[sid] = { name: s.name ?? s.Name, totalOrders: 0 };
    });
    filteredOrders.forEach((o) => {
      const storeId = String(o.storeId ?? o.StoreId ?? "");
      if (map[storeId]) map[storeId].totalOrders += 1;
    });
    return Object.entries(map).map(([id, v]) => ({ id, ...v }));
  }, [filteredOrders, stores]);

  const productQtyByStore = React.useMemo(() => {
    const pid = Number(filterProductId);
    if (!filterProductId || !Number.isFinite(pid)) return [];
    const storeNameById = {};
    stores.forEach((s) => {
      storeNameById[String(s.id ?? s.Id)] = s.name ?? s.Name;
    });
    const perStore = new Map();
    filteredOrders.forEach((o) => {
      if ((o.status ?? o.Status) === "Rejected") return;
      const sid = String(o.storeId ?? o.StoreId ?? "");
      (o.orderSuppliers || o.OrderSuppliers || []).forEach((os) => {
        if ((os.status ?? os.Status) === "Rejected") return;
        (os.orderItems || os.OrderItems || []).forEach((it) => {
          const itPid = Number(it.productId ?? it.ProductId);
          if (!Number.isFinite(itPid) || itPid !== pid) return;
          const q = Number(it.quantity ?? it.Quantity ?? 0);
          const oid = o.id ?? o.Id;
          const prev =
            perStore.get(sid) ||
            {
              storeId: sid,
              storeName: storeNameById[sid] || o.storeName || o.StoreName || `CH #${sid}`,
              totalQty: 0,
              orderCount: 0,
              _orderIds: new Set(),
            };
          prev.totalQty += q;
          if (oid != null && !prev._orderIds.has(oid)) {
            prev._orderIds.add(oid);
            prev.orderCount += 1;
          }
          perStore.set(sid, prev);
        });
      });
    });
    return Array.from(perStore.values())
      .map(({ _orderIds, ...rest }) => rest)
      .sort((a, b) => b.totalQty - a.totalQty);
  }, [filteredOrders, filterProductId, stores]);

  /** Sản phẩm xuất hiện ở nhiều cửa hàng đặt nhất (đếm cửa hàng khác nhau có dòng đặt, trong kỳ đã lọc). */
  const productsRankByStoreCount = React.useMemo(() => {
    const storeSets = new Map();
    const totalQty = new Map();
    const names = new Map();
    filteredOrders.forEach((o) => {
      if ((o.status ?? o.Status) === "Rejected") return;
      const storeId = String(o.storeId ?? o.StoreId ?? "");
      if (!storeId) return;
      (o.orderSuppliers || o.OrderSuppliers || []).forEach((os) => {
        if ((os.status ?? os.Status) === "Rejected") return;
        (os.orderItems || os.OrderItems || []).forEach((it) => {
          const pid = Number(it.productId ?? it.ProductId);
          if (!Number.isFinite(pid)) return;
          if (!storeSets.has(pid)) storeSets.set(pid, new Set());
          storeSets.get(pid).add(storeId);
          totalQty.set(pid, (totalQty.get(pid) || 0) + Number(it.quantity ?? it.Quantity ?? 0));
          const lineName = (it.productName ?? it.ProductName ?? "").trim();
          if (lineName && (!names.has(pid) || lineName.length > (names.get(pid) || "").length)) names.set(pid, lineName);
        });
      });
    });
    return Array.from(storeSets.entries())
      .map(([productId, set]) => {
        const catalog = (products || []).find((p) => Number(p.id ?? p.Id) === productId);
        const catalogName = (catalog?.name ?? catalog?.Name ?? "").trim();
        const productName = catalogName || names.get(productId) || `SP #${productId}`;
        return {
          productId,
          productName,
          storeCount: set.size,
          totalQty: totalQty.get(productId) || 0,
        };
      })
      .sort((a, b) => b.storeCount - a.storeCount || b.totalQty - a.totalQty)
      .slice(0, 40);
  }, [filteredOrders, products]);

  const chartBySupplier = React.useMemo(() => ({
    type: "bar",
    height: 280,
    series: [{ name: "Số đơn", data: bySupplier.map((r) => r.totalOrders) }],
    options: {
      ...chartsConfig,
      colors: "#0288d1",
      plotOptions: { bar: { columnWidth: "50%", borderRadius: 5 } },
      xaxis: { ...chartsConfig.xaxis, categories: bySupplier.map((r) => r.name.length > 15 ? r.name.slice(0, 14) + "…" : r.name) },
    },
  }), [bySupplier]);

  const chartByStore = React.useMemo(() => ({
    type: "bar",
    height: 280,
    series: [{ name: "Số đơn", data: byStore.map((r) => r.totalOrders) }],
    options: {
      ...chartsConfig,
      colors: "#388e3c",
      plotOptions: { bar: { columnWidth: "50%", borderRadius: 5 } },
      xaxis: { ...chartsConfig.xaxis, categories: byStore.map((r) => r.name) },
    },
  }), [byStore]);

  const chartProductByStore = React.useMemo(
    () => ({
      type: "bar",
      height: 280,
      series: [{ name: "Số lượng đặt", data: productQtyByStore.map((r) => r.totalQty) }],
      options: {
        ...chartsConfig,
        colors: "#7b1fa2",
        plotOptions: { bar: { columnWidth: "50%", borderRadius: 5 } },
        xaxis: {
          ...chartsConfig.xaxis,
          categories: productQtyByStore.map((r) => {
            const n = r.storeName || "";
            return n.length > 15 ? `${n.slice(0, 14)}…` : n;
          }),
        },
      },
    }),
    [productQtyByStore]
  );

  const totalOrderSuppliers = filteredOrders.reduce((s, o) => s + (o.orderSuppliers || o.OrderSuppliers || []).length, 0);
  const completedOrderSuppliers = filteredOrders.reduce((s, o) => {
    return s + (o.orderSuppliers || o.OrderSuppliers || []).filter((os) => (os.status ?? os.Status) === "Delivered").length;
  }, 0);

  const exportExcel = () => {
    const BOM = "\uFEFF";
    let csv = "Báo cáo;Giá trị\n";
    csv += `Tổng đơn (Order) trong kỳ;${filteredOrders.length}\n`;
    csv += `Tổng đơn con (OrderSupplier);${totalOrderSuppliers}\n`;
    csv += `Đơn con đã hoàn thành;${completedOrderSuppliers}\n\n`;
    csv += "Report theo NCC\n";
    csv += "NCC;Số đơn;Đã hoàn thành;Tổng SL SP\n";
    bySupplier.forEach((r) => { csv += `"${r.name}";${r.totalOrders};${r.completed};${r.totalItems}\n`; });
    csv += "\nReport theo Cửa hàng\n";
    csv += "Cửa hàng;Tổng số đơn\n";
    byStore.forEach((r) => { csv += `"${r.name}";${r.totalOrders}\n`; });
    if (filterProductId && productQtyByStore.length) {
      csv += `\nTheo sản phẩm (${selectedProductName})\n`;
      csv += "Cửa hàng;Tổng SL đặt;Số đơn có sản phẩm\n";
      productQtyByStore.forEach((r) => {
        csv += `"${r.storeName}";${r.totalQty};${r.orderCount}\n`;
      });
    }
    if (productsRankByStoreCount.length) {
      csv += "\nXếp hạng SP theo số cửa hàng đặt (trong kỳ)\n";
      csv += "Hạng;ProductId;Tên SP;Số CH có đặt;Tổng SL đặt\n";
      productsRankByStoreCount.forEach((r, i) => {
        csv += `${i + 1};${r.productId};"${String(r.productName).replace(/"/g, '""')}";${r.storeCount};${r.totalQty}\n`;
      });
    }
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bao-cao-${filterDateFrom || "tu-dau"}-${filterDateTo || "den-cuoi"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasFilters = filterDateFrom || filterDateTo || filterProductId;
  const hasDateFilters = Boolean(filterDateFrom || filterDateTo);
  const clearDateFilters = () => {
    setFilter("dateFrom", "");
    setFilter("dateTo", "");
  };
  const clearProductFilter = () => setFilter("productId", "");
  const clearFilters = () => clearUrlFilters();

  return (
    <div className="mt-12">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <Typography variant="h4" color="blue-gray">Báo cáo thống kê</Typography>
        <Button className="flex items-center gap-2" onClick={exportExcel}><ArrowDownTrayIcon className="w-5 h-5" /> Export CSV</Button>
      </div>

      {(hasFilters || filteredOrders.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border border-blue-gray-100 p-4">
            <Typography variant="small" color="gray">Tổng đơn trong kỳ</Typography>
            <Typography variant="h4" className="mt-1">{filteredOrders.length}</Typography>
            <Typography variant="small" color="gray">Order</Typography>
          </Card>
          <Card className="border border-blue-gray-100 p-4">
            <Typography variant="small" color="gray">Tổng đơn con (NCC)</Typography>
            <Typography variant="h4" className="mt-1">{totalOrderSuppliers}</Typography>
            <Typography variant="small" color="gray">OrderSupplier</Typography>
          </Card>
          <Card className="border border-blue-gray-100 p-4">
            <Typography variant="small" color="gray">Đơn con đã hoàn thành</Typography>
            <Typography variant="h4" className="mt-1 text-green-600">{completedOrderSuppliers}</Typography>
            <Typography variant="small" color="gray">Giao hoàn thành (Delivered)</Typography>
          </Card>
          <Card className="border border-blue-gray-100 p-4">
            <Typography variant="small" color="gray">Tỷ lệ hoàn thành</Typography>
            <Typography variant="h4" className="mt-1">{totalOrderSuppliers ? Math.round((completedOrderSuppliers / totalOrderSuppliers) * 100) : 0}%</Typography>
            <Typography variant="small" color="gray">theo đơn con</Typography>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
        {hasFilters && (
          <Button variant="text" size="sm" className="flex items-center gap-1 text-red-600" onClick={clearFilters}>
            <XMarkIcon className="w-4 h-4" /> Xóa tất cả bộ lọc
          </Button>
        )}
      </div>

      <Card className="border border-blue-gray-100 mb-6">
        <CardHeader className="p-4 border-b flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <FunnelIcon className="w-5 h-5 text-blue-gray-500 shrink-0 mt-0.5" />
            <div>
              <Typography variant="h6" color="blue-gray">Kỳ báo cáo</Typography>
              <Typography variant="small" color="gray" className="font-normal block mt-0.5">
                Lọc đơn theo <strong>ngày đặt</strong> (áp dụng cho mọi biểu đồ / bảng phía dưới).
              </Typography>
            </div>
          </div>
          {hasDateFilters && (
            <Button variant="text" size="sm" className="text-red-600 shrink-0 self-start sm:self-center" onClick={clearDateFilters}>
              Xóa kỳ ngày
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-4 pt-2">
          <div className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-10 sm:gap-y-4">
            <div className="w-full min-w-0 sm:w-[13.5rem] sm:max-w-[14rem]">
              <Input
                type="date"
                label="Từ ngày"
                value={filterDateFrom}
                onChange={(e) => setFilter("dateFrom", e.target.value)}
                className="!min-w-0"
                containerProps={{ className: "min-w-0" }}
              />
            </div>
            <div className="w-full min-w-0 sm:w-[13.5rem] sm:max-w-[14rem]">
              <Input
                type="date"
                label="Đến ngày"
                value={filterDateTo}
                onChange={(e) => setFilter("dateTo", e.target.value)}
                className="!min-w-0"
                containerProps={{ className: "min-w-0" }}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="mb-6 border border-purple-100 shadow-sm">
        <CardHeader className="p-4 border-b border-purple-50 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between bg-purple-50/30">
          <div>
            <Typography variant="h6" color="blue-gray">Sản phẩm theo cửa hàng</Typography>
            <Typography variant="small" color="gray" className="font-normal block mt-0.5">
              Báo riêng: chọn một sản phẩm để xem tổng SL đặt từng cửa hàng trong <strong>kỳ đã chọn ở trên</strong> (không gộp chung ô lọc ngày).
            </Typography>
          </div>
          {filterProductId && (
            <Button variant="text" size="sm" className="text-red-600 shrink-0 self-start sm:self-center" onClick={clearProductFilter}>
              Bỏ chọn sản phẩm
            </Button>
          )}
        </CardHeader>
        <CardBody className="p-4 pt-3">
          <div className="w-full max-w-xl">
            <Typography variant="small" className="mb-2 font-medium text-blue-gray-700 block">
              Chọn sản phẩm
            </Typography>
            <select
              className="w-full rounded-lg border border-blue-gray-200 bg-white py-2.5 px-3 text-sm text-blue-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              value={filterProductId}
              onChange={(e) => setFilter("productId", e.target.value)}
            >
              <option value="">— Chọn sản phẩm —</option>
              {sortedProducts.map((p) => {
                const id = p.id ?? p.Id;
                return (
                  <option key={String(id)} value={String(id)}>
                    {p.name ?? p.Name ?? `SP #${id}`}
                  </option>
                );
              })}
            </select>
            <Typography variant="small" color="gray" className="mt-2 block text-xs leading-relaxed">
              Cộng <strong>quantity</strong> trên dòng đơn NCC (bỏ đơn cha / đơn con <strong>Rejected</strong>). Nếu chưa chọn kỳ ngày, hệ thống dùng toàn bộ đơn đang có.
            </Typography>
          </div>
        </CardBody>
      </Card>

      <Card className="mb-6 border border-teal-100 shadow-sm">
        <CardHeader className="p-4 border-b border-teal-50 bg-teal-50/40">
          <Typography variant="h6" color="blue-gray">Sản phẩm — nhiều cửa hàng đặt nhất</Typography>
          <Typography variant="small" color="gray" className="font-normal block mt-1">
            Trong <strong>kỳ đã lọc</strong>: đếm số <strong>cửa hàng khác nhau</strong> có ít nhất một dòng đặt (đơn NCC không Rejected). Xếp theo số cửa hàng, rồi tổng SL.
          </Typography>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          {productsRankByStoreCount.length === 0 ? (
            <div className="p-6">
              <Typography variant="small" color="gray">Không có dòng sản phẩm trong kỳ đã lọc.</Typography>
            </div>
          ) : (
            <table className="w-full table-auto min-w-[520px]">
              <thead>
                <tr>
                  <th className="border-b border-blue-gray-50 py-3 px-4 text-left w-14">
                    <Typography variant="small" className="font-bold text-blue-gray-500">#</Typography>
                  </th>
                  <th className="border-b border-blue-gray-50 py-3 px-4 text-left">
                    <Typography variant="small" className="font-bold text-blue-gray-500">Sản phẩm</Typography>
                  </th>
                  <th className="border-b border-blue-gray-50 py-3 px-4 text-right w-32">
                    <Typography variant="small" className="font-bold text-blue-gray-500">Số CH có đặt</Typography>
                  </th>
                  <th className="border-b border-blue-gray-50 py-3 px-4 text-right w-28">
                    <Typography variant="small" className="font-bold text-blue-gray-500">Tổng SL</Typography>
                  </th>
                  <th className="border-b border-blue-gray-50 py-3 px-4 text-right w-36">
                    <Typography variant="small" className="font-bold text-blue-gray-500">&nbsp;</Typography>
                  </th>
                </tr>
              </thead>
              <tbody>
                {productsRankByStoreCount.map((r, idx) => (
                  <tr key={r.productId} className="hover:bg-teal-50/30">
                    <td className="border-b border-blue-gray-50 py-3 px-4">
                      <Typography variant="small" className="font-semibold text-teal-800">{idx + 1}</Typography>
                    </td>
                    <td className="border-b border-blue-gray-50 py-3 px-4">
                      <Typography variant="small" className="font-medium text-blue-gray-800">{r.productName}</Typography>
                      <Typography variant="small" color="gray" className="text-xs block">ID {r.productId}</Typography>
                    </td>
                    <td className="border-b border-blue-gray-50 py-3 px-4 text-right">
                      <Typography variant="small" className="font-semibold">{r.storeCount}</Typography>
                    </td>
                    <td className="border-b border-blue-gray-50 py-3 px-4 text-right">
                      <Typography variant="small">{r.totalQty}</Typography>
                    </td>
                    <td className="border-b border-blue-gray-50 py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="text"
                        className="text-purple-700 font-semibold normal-case text-xs py-1"
                        onClick={() => setFilter("productId", String(r.productId))}
                      >
                        SL theo CH →
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {filterProductId && (
        <Card className="border border-blue-gray-100 mb-6">
          <CardHeader className="p-4 border-b">
            <div>
              <Typography variant="h6" color="blue-gray">{selectedProductName}</Typography>
              <Typography variant="small" color="gray" className="mt-1 block">
                Tổng số lượng đặt theo từng cửa hàng
              </Typography>
            </div>
          </CardHeader>
          <CardBody className="p-4">
            {!productQtyByStore.length ? (
              <Typography variant="small" color="gray">
                Không có dòng đặt hàng cho sản phẩm này trong kỳ đã lọc.
              </Typography>
            ) : (
              <>
                <div className="mb-6">
                  <StatisticsChart
                    color="white"
                    title="Biểu đồ SL đặt theo cửa hàng"
                    description={`Sản phẩm: ${selectedProductName}`}
                    chart={chartProductByStore}
                  />
                </div>
                <div className="overflow-x-auto rounded-lg border border-blue-gray-50">
                  <table className="w-full table-auto">
                    <thead>
                      <tr>
                        <th className="border-b border-blue-gray-50 py-3 px-4 text-left">
                          <Typography variant="small" className="font-bold text-blue-gray-500">Cửa hàng</Typography>
                        </th>
                        <th className="border-b border-blue-gray-50 py-3 px-4 text-left">
                          <Typography variant="small" className="font-bold text-blue-gray-500">Tổng SL đặt</Typography>
                        </th>
                        <th className="border-b border-blue-gray-50 py-3 px-4 text-left">
                          <Typography variant="small" className="font-bold text-blue-gray-500">Số đơn có SP</Typography>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {productQtyByStore.map((r) => (
                        <tr key={r.storeId}>
                          <td className="py-3 px-4 border-b border-blue-gray-50">
                            <Typography variant="small">{r.storeName}</Typography>
                          </td>
                          <td className="py-3 px-4 border-b border-blue-gray-50">
                            <Typography variant="small" className="font-semibold">{r.totalQty}</Typography>
                          </td>
                          <td className="py-3 px-4 border-b border-blue-gray-50">
                            <Typography variant="small">{r.orderCount}</Typography>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 mb-6 lg:grid-cols-2">
        <StatisticsChart
          color="white"
          title="Biểu đồ đơn theo NCC"
          description="Tổng số đơn (OrderSupplier) theo từng nhà cung cấp"
          chart={chartBySupplier}
        />
        <StatisticsChart
          color="white"
          title="Biểu đồ đơn theo Cửa hàng"
          description="Tổng số đơn (Order) theo từng cửa hàng"
          chart={chartByStore}
        />
      </div>

      <Card className="border border-blue-gray-100 mb-6">
        <CardHeader className="p-4 border-b"><Typography variant="h6">Report theo NCC</Typography></CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full table-auto">
            <thead>
              <tr>
                <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold text-blue-gray-500">NCC</Typography></th>
                <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold text-blue-gray-500">Số đơn</Typography></th>
                <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold text-blue-gray-500">Đã hoàn thành</Typography></th>
                <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold text-blue-gray-500">Tổng SL sản phẩm</Typography></th>
              </tr>
            </thead>
            <tbody>
              {bySupplier.map((r) => (
                <tr key={r.id}>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.name}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.totalOrders}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.completed}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.totalItems}</Typography></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card className="border border-blue-gray-100">
        <CardHeader className="p-4 border-b"><Typography variant="h6">Report theo Cửa hàng</Typography></CardHeader>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full table-auto">
            <thead>
              <tr>
                <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold text-blue-gray-500">Cửa hàng</Typography></th>
                <th className="border-b border-blue-gray-50 py-3 px-4 text-left"><Typography variant="small" className="font-bold text-blue-gray-500">Tổng số đơn</Typography></th>
              </tr>
            </thead>
            <tbody>
              {byStore.map((r) => (
                <tr key={r.id}>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.name}</Typography></td>
                  <td className="py-3 px-4 border-b border-blue-gray-50"><Typography variant="small">{r.totalOrders}</Typography></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

export default Reports;
