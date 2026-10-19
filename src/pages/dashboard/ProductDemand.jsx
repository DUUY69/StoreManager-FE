import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardBody,
  Typography,
  Button,
  Input,
} from "@material-tailwind/react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import { useData } from "@/context/DataContext";
import {
  computeProductDemandOpen,
  filterProductDemandRows,
  filterProductDemandRowsBySupplier,
  formatDemandDateRangeLabel,
  getWeekRange,
  PRODUCT_DEMAND_RULES_NOTE,
} from "@/utils/productDemand";
import { useUrlFilters } from "@/utils/urlFilters";

const DEMAND_FILTER_DEFAULTS = { dateFrom: "", dateTo: "", supplier: "", q: "" };

export function ProductDemand() {
  const navigate = useNavigate();
  const { orders, suppliers } = useData();
  const { values, setFilter } = useUrlFilters(DEMAND_FILTER_DEFAULTS);

  const thisWeek = useMemo(() => getWeekRange(0), []);
  const demandDateFrom = values.dateFrom || thisWeek.from;
  const demandDateTo = values.dateTo || thisWeek.to;
  const search = values.q;
  const filterSupplier = values.supplier;

  const allRows = useMemo(
    () => computeProductDemandOpen(orders, demandDateFrom, demandDateTo),
    [orders, demandDateFrom, demandDateTo]
  );

  const rows = useMemo(() => {
    let r = filterProductDemandRows(allRows, search);
    r = filterProductDemandRowsBySupplier(r, filterSupplier);
    return r;
  }, [allRows, search, filterSupplier]);

  const totalQty = useMemo(
    () => rows.reduce((s, r) => s + Number(r.totalQty || 0), 0),
    [rows]
  );

  const openOrdersForRow = (row) => {
    const params = new URLSearchParams({ product: row.productName });
    if (demandDateFrom) params.set("dateFrom", demandDateFrom);
    if (demandDateTo) params.set("dateTo", demandDateTo);
    if (row.supplierId != null) params.set("supplier", String(row.supplierId));
    navigate(`/dashboard/orders?${params.toString()}`);
  };

  return (
    <div className="mt-4 mb-8">
      <Typography variant="h5" color="blue-gray" className="mb-1">
        Nhu cầu theo sản phẩm (đơn còn xử lý)
      </Typography>
      <Typography variant="small" color="gray" className="mb-3 font-normal max-w-3xl">
        Tổng SL đặt còn mở theo <strong>ngày đặt đơn</strong>. Gõ tên SP hoặc NCC để lọc nhanh — không phân biệt dấu.
      </Typography>
      <div className="mb-4 rounded-lg border border-teal-100 bg-teal-50/40 px-4 py-3 max-w-3xl">
        <Typography variant="small" className="font-semibold text-teal-900 text-xs mb-1.5">
          Khi nào dòng xuất hiện / biến mất?
        </Typography>
        <ul className="list-disc list-inside space-y-0.5">
          {PRODUCT_DEMAND_RULES_NOTE.map((line) => (
            <li key={line}>
              <Typography variant="small" color="blue-gray" className="text-xs font-normal inline">
                {line}
              </Typography>
            </li>
          ))}
        </ul>
      </div>

      <Card className="border border-teal-100 shadow-sm">
        <CardHeader floated={false} shadow={false} className="m-0 p-4 border-b border-teal-100 rounded-none">
          <div className="flex flex-col gap-3 w-full">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 text-blue-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                label="Tìm sản phẩm, NCC..."
                value={search}
                onChange={(e) => setFilter("q", e.target.value)}
                className="!pl-10"
                crossOrigin={undefined}
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <select
                value={filterSupplier}
                onChange={(e) => setFilter("supplier", e.target.value)}
                className="flex-1 min-w-0 sm:max-w-[220px] rounded-lg border border-teal-200 bg-white px-2 py-2 text-sm text-blue-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                aria-label="Lọc theo nhà cung cấp"
              >
                <option value="">Tất cả NCC</option>
                {suppliers.map((s) => (
                  <option key={s.id ?? s.Id} value={String(s.id ?? s.Id)}>
                    {s.name ?? s.Name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={demandDateFrom}
                onChange={(e) => setFilter("dateFrom", e.target.value)}
                className="flex-1 min-w-0 sm:max-w-[160px] rounded-lg border border-teal-200 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                aria-label="Từ ngày"
              />
              <span className="text-blue-gray-400 text-sm shrink-0 hidden sm:inline">→</span>
              <input
                type="date"
                value={demandDateTo}
                onChange={(e) => setFilter("dateTo", e.target.value)}
                className="flex-1 min-w-0 sm:max-w-[160px] rounded-lg border border-teal-200 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                aria-label="Đến ngày"
              />
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant={demandDateFrom === thisWeek.from && demandDateTo === thisWeek.to ? "filled" : "outlined"}
                  color="teal"
                  className="normal-case text-xs py-1.5 px-2.5"
                  onClick={() => {
                    const w = getWeekRange(0);
                    setFilter("dateFrom", w.from);
                    setFilter("dateTo", w.to);
                  }}
                >
                  Tuần này
                </Button>
                <Button
                  size="sm"
                  variant="outlined"
                  color="blue-gray"
                  className="normal-case text-xs py-1.5 px-2.5"
                  onClick={() => {
                    const w = getWeekRange(-1);
                    setFilter("dateFrom", w.from);
                    setFilter("dateTo", w.to);
                  }}
                >
                  Tuần trước
                </Button>
                <Button
                  size="sm"
                  variant={!demandDateFrom && !demandDateTo ? "filled" : "outlined"}
                  color="blue-gray"
                  className="normal-case text-xs py-1.5 px-2.5"
                  onClick={() => {
                    setFilter("dateFrom", "");
                    setFilter("dateTo", "");
                  }}
                >
                  Tất cả
                </Button>
              </div>
            </div>
            <Typography variant="small" color="blue-gray" className="text-xs font-normal">
              Đang lọc ngày đặt: <strong>{formatDemandDateRangeLabel(demandDateFrom, demandDateTo)}</strong>
              {" · "}
              Hiển thị <strong>{rows.length}</strong>
              {(search.trim() || filterSupplier) ? ` / ${allRows.length}` : ""} dòng (SP + NCC)
              {" · "}Tổng SL: <strong>{totalQty.toLocaleString("vi-VN")}</strong>
            </Typography>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <div className="p-8 text-center">
              <Typography variant="small" color="gray">
                {search.trim() || filterSupplier
                  ? "Không có dòng nào khớp bộ lọc — thử NCC khác hoặc đổi khoảng ngày."
                  : "Không có nhu cầu mở trong khoảng thời gian này."}
              </Typography>
            </div>
          ) : (
            <>
              <div className="hidden md:block max-h-[calc(100vh-320px)] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white sticky top-0 z-[1] shadow-sm">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-blue-gray-600">Sản phẩm</th>
                      <th className="text-left py-3 px-4 font-medium text-blue-gray-600 min-w-[120px]">NCC</th>
                      <th className="text-right py-3 px-4 font-medium text-blue-gray-600 w-24">Tổng SL</th>
                      <th className="text-right py-3 px-4 font-medium text-blue-gray-600 w-16">Dòng</th>
                      <th className="text-right py-3 px-4 w-36" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={`${row.productId}-${row.supplierId ?? "x"}`}
                        className="border-t border-teal-100/80 hover:bg-teal-50/40"
                      >
                        <td className="py-2.5 px-4">
                          <Typography variant="small" className="font-medium text-blue-gray-800">
                            {row.productName}
                          </Typography>
                          {row.unit ? (
                            <Typography variant="small" color="gray" className="text-xs block">
                              {row.unit}
                            </Typography>
                          ) : null}
                        </td>
                        <td className="py-2.5 px-4">
                          <Typography variant="small" className="text-blue-gray-700">
                            {row.supplierName}
                          </Typography>
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-teal-900">{row.totalQty}</td>
                        <td className="py-2.5 px-4 text-right text-blue-gray-500">{row.lines}</td>
                        <td className="py-2.5 px-4 text-right">
                          <Button
                            size="sm"
                            variant="text"
                            className="px-2 py-1 text-xs font-semibold text-blue-700 normal-case"
                            onClick={() => openOrdersForRow(row)}
                          >
                            Đơn có SP →
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="md:hidden divide-y divide-teal-100 max-h-[calc(100vh-320px)] overflow-y-auto">
                {rows.map((row) => (
                  <li key={`m-${row.productId}-${row.supplierId ?? "x"}`} className="p-4 space-y-2">
                    <Typography variant="small" className="font-semibold text-blue-gray-900">
                      {row.productName}
                      {row.unit ? (
                        <span className="text-blue-gray-500 font-normal"> · {row.unit}</span>
                      ) : null}
                    </Typography>
                    <Typography variant="small" color="gray">
                      NCC: {row.supplierName}
                    </Typography>
                    <div className="flex items-center justify-between gap-2">
                      <Typography variant="small">
                        SL: <strong className="text-teal-900">{row.totalQty}</strong>
                        <span className="text-blue-gray-400"> · {row.lines} dòng</span>
                      </Typography>
                      <Button
                        size="sm"
                        variant="text"
                        className="px-2 py-1 text-xs font-semibold text-blue-700 normal-case shrink-0"
                        onClick={() => openOrdersForRow(row)}
                      >
                        Đơn có SP →
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default ProductDemand;
