import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Navigate, Link } from "react-router-dom";
import {
  Typography,
  Button,
  Card,
  CardBody,
  CardHeader,
  Select,
  Option,
} from "@material-tailwind/react";
import { CalendarDaysIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { useAuth, useToast, useData } from "@/context";
import api from "@/api";
import { normalizeEodUnits, formatDualDisplay } from "@/utils/eodUnits";
import { useUrlFilters } from "@/utils/urlFilters";

const fmtNum = (n) => {
  const v = Number(n);
  if (Number.isNaN(v)) return "—";
  return v % 1 === 0 ? String(v) : v.toFixed(2);
};

import { fromBaseQtyDual } from "@/utils/eodUnits";

const formatStockDisplay = (qty, unit, conversionUnit, conversionRate, productName) => {
  if (qty == null || qty === "") return "—";
  const norm = normalizeEodUnits({ unit, conversionUnit, conversionRate, productName });
  if (norm.conversionUnit && norm.conversionRate > 0) {
    return formatDualDisplay(Number(qty), norm.unit, norm.conversionUnit, norm.conversionRate);
  }
  return `${fmtNum(qty)} ${norm.unit || ""}`.trim();
};

/** Ô bảng hẹp: xuống dòng "2 Gói" / "190 Gr" */
const formatStockCellDisplay = (qty, unit, conversionUnit, conversionRate, productName) => {
  if (qty == null || qty === "") return "—";
  const norm = normalizeEodUnits({ unit, conversionUnit, conversionRate, productName });
  const rate = norm.conversionRate;
  if (!norm.conversionUnit || !(rate > 0)) return fmtNum(qty);
  const { pack, loose } = fromBaseQtyDual(Number(qty), rate);
  const lines = [];
  if (pack > 0) lines.push(`${pack} ${norm.unit}`);
  if (loose > 0) lines.push(`${fmtNum(loose)} ${norm.conversionUnit}`);
  return lines.join("\n") || `0 ${norm.unit}`;
};

function normMatrixPayload(raw) {
  if (!raw) return null;
  const storeId = raw.storeId ?? raw.StoreId;
  const storeName = raw.storeName ?? raw.StoreName ?? "";
  const year = raw.year ?? raw.Year;
  const month = raw.month ?? raw.Month;
  const daysInMonth = raw.daysInMonth ?? raw.DaysInMonth ?? 31;
  const products = (raw.products ?? raw.Products ?? []).map((row) => ({
    productId: row.productId ?? row.ProductId,
    productCode: row.productCode ?? row.ProductCode ?? "",
    productName: row.productName ?? row.ProductName ?? "",
    unit: row.unit ?? row.Unit ?? "",
    conversionUnit: row.conversionUnit ?? row.ConversionUnit ?? null,
    conversionRate: row.conversionRate ?? row.ConversionRate ?? null,
    sortOrder: row.sortOrder ?? row.SortOrder ?? null,
    totalReceivedInMonth: row.totalReceivedInMonth ?? row.TotalReceivedInMonth ?? 0,
    totalUsedInMonth: row.totalUsedInMonth ?? row.TotalUsedInMonth ?? null,
    days: (row.days ?? row.Days ?? []).map((c) => ({
      day: c.day ?? c.Day,
      closingQuantity: c.closingQuantity ?? c.ClosingQuantity,
      hasEod: !!(c.hasEod ?? c.HasEod),
      isCurrentStock: !!(c.isCurrentStock ?? c.IsCurrentStock),
    })),
  }));
  return { storeId, storeName, year, month, daysInMonth, products };
}

const EOD_MATRIX_FILTER_DEFAULTS = {
  storeId: "",
  year: "",
  month: "",
};

export function EodMonthlyMatrix() {
  const { currentUser, isAdmin, isStoreUser } = useAuth();
  const { stores = [] } = useData();
  const { showToast } = useToast();
  const now = new Date();
  const { values, setFilter } = useUrlFilters(EOD_MATRIX_FILTER_DEFAULTS);
  const selectedStoreId = values.storeId;
  const year = Number(values.year) || now.getFullYear();
  const month = Number(values.month) || now.getMonth() + 1;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(null);
  const [inboundLoading, setInboundLoading] = useState(false);
  const [inbound, setInbound] = useState(null);
  const [showInboundLines, setShowInboundLines] = useState(false);
  const todayColRef = useRef(null);

  const userStoreId = Number(currentUser?.storeId ?? currentUser?.StoreId) || null;
  const effectiveStoreId = isStoreUser ? userStoreId : Number(selectedStoreId) || null;

  const storeOptions = stores.filter((s) => (s.status ?? s.Status) === "Active");

  useEffect(() => {
    if (isAdmin && !selectedStoreId && storeOptions.length > 0) {
      setFilter("storeId", String(storeOptions[0].id ?? storeOptions[0].Id));
    }
  }, [isAdmin, selectedStoreId, storeOptions, setFilter]);

  const load = useCallback(async () => {
    if (!api.USE_API) {
      showToast("Bật API để xem bảng tồn theo tháng.", "error");
      return;
    }
    if (!effectiveStoreId) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const query = { year, month };
      if (isAdmin) query.storeId = effectiveStoreId;
      const raw = await api.get("warehouse.eodMonthlyMatrix", { query });
      setData(normMatrixPayload(raw));
    } catch (e) {
      showToast(e?.data?.message || e.message || "Lỗi tải dữ liệu", "error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, month, effectiveStoreId, isAdmin, showToast]);

  useEffect(() => {
    if ((isStoreUser && userStoreId) || (isAdmin && effectiveStoreId)) load();
  }, [load, isStoreUser, isAdmin, userStoreId, effectiveStoreId]);

  const getLastEodBefore = (row, day) => {
    let last = null;
    for (const c of row.days) {
      if (c.day < day && c.hasEod && (!last || c.day > last.day)) last = c;
    }
    return last;
  };

  const buildDayDetail = (row, day, cell, apiRaw = null) => {
    const lastEodCell = getLastEodBefore(row, day);
    const openingFromMatrix = lastEodCell?.hasEod ? lastEodCell.closingQuantity : null;
    const lastEodDayFromMatrix = lastEodCell?.day ?? null;

    const hasEodClosing =
      !!(apiRaw?.hasEodClosing ?? apiRaw?.HasEodClosing) || !!cell?.hasEod;
    const closingQuantity =
      apiRaw?.closingQuantity ?? apiRaw?.ClosingQuantity ?? (cell?.hasEod ? cell.closingQuantity : null);

    const hasOpening = !!(apiRaw?.hasOpening ?? apiRaw?.HasOpening) || !!lastEodCell?.hasEod;
    const openingQuantity =
      apiRaw?.openingQuantity ?? apiRaw?.OpeningQuantity ?? openingFromMatrix;

    const lastEodDateRaw = apiRaw?.lastEodDate ?? apiRaw?.LastEodDate;
    const lastEodDate = lastEodDateRaw
      ? new Date(lastEodDateRaw)
      : lastEodDayFromMatrix && data
        ? new Date(data.year, data.month - 1, lastEodDayFromMatrix)
        : null;

    const totalReceived = apiRaw?.totalReceived ?? apiRaw?.TotalReceived ?? 0;
    const totalReceivedBeforeEod =
      apiRaw?.totalReceivedBeforeEodClosing ?? apiRaw?.TotalReceivedBeforeEodClosing ?? null;
    const totalReceivedAfterEod =
      apiRaw?.totalReceivedAfterEodClosing ?? apiRaw?.TotalReceivedAfterEodClosing ?? 0;
    const totalReceivedSinceLastEod =
      apiRaw?.totalReceivedSinceLastEod ?? apiRaw?.TotalReceivedSinceLastEod ?? 0;
    const currentStockQuantity =
      apiRaw?.currentStockQuantity ?? apiRaw?.CurrentStockQuantity ?? null;

    let totalUsed = apiRaw?.totalUsed ?? apiRaw?.TotalUsed;
    if (totalUsed == null && hasOpening && hasEodClosing && closingQuantity != null) {
      const inboundForUsed =
        totalReceivedBeforeEod != null ? Number(totalReceivedBeforeEod) : Number(totalReceived);
      totalUsed = Number(openingQuantity) + inboundForUsed - Number(closingQuantity);
    }

    let estimatedUsedSinceLastEod =
      apiRaw?.estimatedUsedSinceLastEod ?? apiRaw?.EstimatedUsedSinceLastEod ?? null;
    if (
      estimatedUsedSinceLastEod == null &&
      hasOpening &&
      !hasEodClosing &&
      currentStockQuantity != null
    ) {
      estimatedUsedSinceLastEod =
        Number(openingQuantity) + Number(totalReceivedSinceLastEod) - Number(currentStockQuantity);
    }

    const lines = (apiRaw?.lines ?? apiRaw?.Lines ?? []).map((l) => ({
      id: l.id ?? l.Id,
      quantityDelta: l.quantityDelta ?? l.QuantityDelta,
      referenceOrderId: l.referenceOrderId ?? l.ReferenceOrderId,
      referenceOrderSupplierId: l.referenceOrderSupplierId ?? l.ReferenceOrderSupplierId,
      note: l.note ?? l.Note,
      createdAt: l.createdAt ?? l.CreatedAt,
    }));

    return {
      openingQuantity,
      hasOpening,
      lastEodDate,
      closingQuantity,
      hasEodClosing,
      totalReceived,
      totalReceivedBeforeEod,
      totalReceivedAfterEod,
      totalReceivedSinceLastEod,
      currentStockQuantity,
      totalUsed,
      estimatedUsedSinceLastEod,
      lines,
    };
  };

  const openInbound = async (day, row, cell) => {
    if (!data?.storeId || !day || !row) return;
    const dateStr = `${data.year}-${String(data.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setShowInboundLines(false);
    setModal({
      day,
      dateStr,
      productId: row.productId,
      productName: row.productName,
      unit: row.unit,
      conversionUnit: row.conversionUnit,
      conversionRate: row.conversionRate,
      cellHasEod: !!cell?.hasEod,
    });
    setInbound(buildDayDetail(row, day, cell));
    setInboundLoading(true);
    try {
      const raw = await api.get("warehouse.storeDayInbound", {
        query: { storeId: data.storeId, date: dateStr, productId: row.productId },
      });
      setInbound(buildDayDetail(row, day, cell, raw));
    } catch (e) {
      showToast(e?.data?.message || e.message || "Lỗi tải chi tiết ngày", "error");
    } finally {
      setInboundLoading(false);
    }
  };

  const yearOptions = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i);

  const isCurrentMonthView =
    year === now.getFullYear() && month === now.getMonth() + 1;
  const todayDay = now.getDate();

  const eodDaysInMonth = useMemo(() => {
    if (!data?.products?.length) return [];
    const set = new Set();
    data.products.forEach((p) => {
      p.days.forEach((c) => {
        if (c.hasEod) set.add(c.day);
      });
    });
    return [...set].sort((a, b) => a - b);
  }, [data]);

  const todayHasEod = useMemo(() => {
    if (!data?.products?.length || !isCurrentMonthView) return false;
    return data.products.some((p) => p.days.find((c) => c.day === todayDay)?.hasEod);
  }, [data, isCurrentMonthView, todayDay]);

  useEffect(() => {
    if (!data || loading || !isCurrentMonthView) return;
    const t = setTimeout(() => {
      todayColRef.current?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
    }, 300);
    return () => clearTimeout(t);
  }, [data, loading, isCurrentMonthView, year, month]);

  if (!isAdmin && !isStoreUser) {
    return <Navigate to="/dashboard/home" replace />;
  }

  if (isStoreUser && !userStoreId) {
    return (
      <div className="mt-8 px-4">
        <Typography color="gray">Tài khoản chưa gắn cửa hàng. Liên hệ quản trị.</Typography>
      </div>
    );
  }

  const daysHeader = data ? Array.from({ length: data.daysInMonth }, (_, i) => i + 1) : [];

  return (
    <div className="mt-4 md:mt-8 px-2 md:px-0 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
        <div>
          <Typography variant="h4" color="blue-gray" className="flex items-center gap-2">
            <CalendarDaysIcon className="w-8 h-8 shrink-0 text-teal-600" />
            Tồn kiểm kê tháng
          </Typography>
          <Typography variant="small" color="gray" className="mt-1 max-w-3xl">
            {isAdmin
              ? "Admin xem tồn kiểm kho từng cửa hàng — chọn cửa hàng bên dưới."
              : "Số trong ô là tồn cuối ngày sau kiểm kho (ô nghiêng ở cột hôm nay = tồn hiện tại, chưa kiểm kho)."}
            {" "}Hai cột cuối: <strong>tổng nhập</strong> và <strong>tổng đã dùng</strong> trong tháng.
          </Typography>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {isAdmin && (
            <div className="w-full sm:w-56">
              <Typography variant="small" color="blue-gray" className="mb-1 font-medium">Cửa hàng</Typography>
              <select
                className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={selectedStoreId}
                onChange={(e) => setFilter("storeId", e.target.value)}
              >
                <option value="">-- Chọn cửa hàng --</option>
                {storeOptions.map((s) => (
                  <option key={s.id ?? s.Id} value={s.id ?? s.Id}>
                    {s.name ?? s.Name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="w-32">
            <Select label="Năm" value={String(year)} onChange={(v) => setFilter("year", v)}>
              {yearOptions.map((y) => (
                <Option key={y} value={String(y)}>{y}</Option>
              ))}
            </Select>
          </div>
          <div className="w-28">
            <Select label="Tháng" value={String(month)} onChange={(v) => setFilter("month", v)}>
              {Array.from({ length: 12 }, (_, i) => (
                <Option key={i + 1} value={String(i + 1)}>{i + 1}</Option>
              ))}
            </Select>
          </div>
          <Button variant="outlined" size="sm" className="h-10" onClick={() => load()} disabled={loading || !effectiveStoreId}>
            Tải lại
          </Button>
        </div>
      </div>

      {isAdmin && !effectiveStoreId && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Vui lòng chọn cửa hàng để xem bảng kiểm kê tháng.
        </div>
      )}

      {data && (
        <Typography variant="small" className="mb-2 text-blue-gray-700">
          {data.storeName} · Tháng {data.month}/{data.year}
        </Typography>
      )}

      {data && isCurrentMonthView && (
        <div
          className={`mb-3 rounded-lg border px-3 py-2.5 text-sm ${
            todayHasEod
              ? "border-teal-200 bg-teal-50 text-teal-900"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          <strong>Hôm nay {todayDay}/{month}/{year}:</strong>{" "}
          {todayHasEod
            ? "Đã có kiểm kho cuối ngày (cột hôm nay là tồn sau kiểm kho)."
            : "Chưa kiểm kho cuối ngày — cột hôm nay hiện tồn kho hiện tại (in nghiêng); sau khi kiểm kho số sẽ là tồn chốt ngày."}
          {!todayHasEod && !isAdmin && (
            <Link
              to="/dashboard/eod-checkin"
              className="ml-1 font-semibold text-teal-700 underline hover:text-teal-900"
            >
              Kiểm kho cuối ngày ngay
            </Link>
          )}
          {eodDaysInMonth.length > 0 && (
            <span className="block mt-1 text-xs opacity-90">
              Trong tháng này chỉ có dữ liệu kiểm kê các ngày:{" "}
              <strong>{eodDaysInMonth.join(", ")}</strong>
              {eodDaysInMonth.length === 1 && eodDaysInMonth[0] !== todayDay && todayDay > eodDaysInMonth[0]
                ? ` — từ ngày ${eodDaysInMonth[0] + 1} đến ngày ${todayDay} chưa kiểm kho nên chưa có số trên bảng.`
                : ""}
            </span>
          )}
        </div>
      )}

      <Card className="border border-blue-gray-100 overflow-hidden">
        <CardHeader className="p-3 border-b bg-blue-gray-50">
          <Typography variant="small" color="gray">
            Cuộn ngang xem từng ngày; hai cột <strong>tổng nhập / tổng dùng</strong> dính bên phải.
            {" "}Sản phẩm có <strong>🚩</strong> = thứ tự ưu tiên (Sản phẩm → Cờ). <strong>Tổng dùng</strong> chỉ cộng giữa các ngày KK trong tháng (không gồm mức dùng từ KK tháng trước).
          </Typography>
        </CardHeader>
        <CardBody className="p-0">
          {loading && (
            <div className="p-8 text-center text-gray-500">Đang tải…</div>
          )}
          {!loading && data && (
            <div className="overflow-x-auto isolate">
              <table className="min-w-max w-full text-xs border-separate border-spacing-0">
                <thead>
                  <tr className="bg-teal-700 text-white">
                    <th className="sticky left-0 z-40 bg-teal-700 text-left px-2 py-2 font-semibold border border-teal-600 min-w-[110px] max-w-[140px] shadow-[2px_0_4px_rgba(0,0,0,0.08)]">
                      Sản phẩm / Đơn vị
                    </th>
                    {daysHeader.map((d) => {
                      const isToday = isCurrentMonthView && d === todayDay;
                      return (
                        <th
                          key={d}
                          ref={isToday ? todayColRef : undefined}
                          className={`text-center px-1 py-2 font-semibold border border-teal-600 w-10 whitespace-nowrap ${
                            isToday ? "bg-amber-500 text-white ring-2 ring-amber-200" : ""
                          }`}
                        >
                          <span>{d}</span>
                          {isToday && (
                            <span className="block text-[9px] font-normal leading-tight opacity-95">Hôm nay</span>
                          )}
                        </th>
                      );
                    })}
                    <th className="sticky right-[64px] z-40 bg-indigo-800 text-center px-1.5 py-2 font-semibold border border-indigo-700 w-16 min-w-[64px] shadow-[-6px_0_10px_rgba(0,0,0,0.15)]">
                      Tổng nhập
                    </th>
                    <th className="sticky right-0 z-40 bg-indigo-900 text-center px-1.5 py-2 font-semibold border border-indigo-800 w-16 min-w-[64px] shadow-[-6px_0_10px_rgba(0,0,0,0.15)]">
                      Tổng dùng
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.length === 0 && (
                    <tr>
                      <td colSpan={1 + data.daysInMonth + 2} className="p-6 text-center text-gray-500">
                        Chưa có dữ liệu kiểm kho hoặc nhập kho trong tháng này.
                      </td>
                    </tr>
                  )}
                  {data.products.map((row, ri) => (
                    <tr key={row.productId} className={ri % 2 === 0 ? "bg-white" : "bg-blue-gray-50"}>
                      <td
                        className={`sticky left-0 z-40 border border-blue-gray-100 px-2 py-1.5 font-medium text-blue-gray-900 max-w-[140px] shadow-[2px_0_4px_rgba(0,0,0,0.08)] ${ri % 2 === 0 ? "bg-white" : "bg-blue-gray-100"}`}
                      >
                        <span className="line-clamp-2" title={row.productName}>
                          {row.sortOrder != null && (
                            <span className="text-orange-600 font-bold mr-0.5" title={`Ưu tiên ${row.sortOrder}`}>🚩</span>
                          )}
                          {row.productName}
                        </span>
                        <span className="block text-[10px] text-gray-500">{row.unit}</span>
                        {row.conversionUnit && Number(row.conversionRate) > 0 && (
                          <span className="block text-[9px] text-blue-600">
                            1 {row.unit} = {fmtNum(row.conversionRate)} {row.conversionUnit}
                          </span>
                        )}
                      </td>
                      {row.days.map((cell) => {
                        const isToday = isCurrentMonthView && cell.day === todayDay;
                        return (
                        <td
                          key={cell.day}
                          className={`text-center border border-blue-gray-100 p-0 min-w-[52px] ${
                            isToday ? "bg-amber-100 ring-1 ring-inset ring-amber-300" : "bg-white"
                          }`}
                        >
                          <button
                            type="button"
                            title={
                              cell.hasEod || cell.isCurrentStock
                                ? `${formatStockDisplay(cell.closingQuantity, row.unit, row.conversionUnit, row.conversionRate, row.productName)} — bấm để xem chi tiết`
                                : isToday
                                  ? "Hôm nay chưa kiểm kho — bấm để xem nhập kho trong ngày"
                                  : "Ngày chưa kiểm kho — bấm để xem nhập kho trong ngày"
                            }
                            className={`w-full h-full min-h-[36px] px-0.5 py-1 text-xs font-medium whitespace-pre-line leading-tight
                              ${cell.hasEod ? "text-teal-900 hover:bg-teal-100" : cell.isCurrentStock ? "text-amber-900 hover:bg-amber-100 italic" : isToday ? "text-amber-800 hover:bg-amber-100" : "text-gray-400 hover:bg-blue-gray-100"}`}
                            onClick={() => openInbound(cell.day, row, cell)}
                          >
                            {cell.hasEod || cell.isCurrentStock
                              ? formatStockCellDisplay(cell.closingQuantity, row.unit, row.conversionUnit, row.conversionRate, row.productName)
                              : "—"}
                          </button>
                        </td>
                        );
                      })}
                      <td
                        className={`sticky right-[56px] z-40 text-center border border-blue-gray-200 px-1 py-1.5 font-semibold text-teal-900 w-16 min-w-[64px] whitespace-pre-line leading-tight text-[10px] shadow-[-6px_0_10px_rgba(0,0,0,0.12)] ${ri % 2 === 0 ? "bg-teal-100" : "bg-teal-200"}`}
                        title={formatStockDisplay(row.totalReceivedInMonth, row.unit, row.conversionUnit, row.conversionRate, row.productName)}
                      >
                        {formatStockCellDisplay(row.totalReceivedInMonth, row.unit, row.conversionUnit, row.conversionRate, row.productName)}
                      </td>
                      <td
                        className={`sticky right-0 z-40 text-center border border-blue-gray-200 px-1 py-1.5 font-semibold text-amber-950 w-16 min-w-[64px] whitespace-pre-line leading-tight text-[10px] shadow-[-6px_0_10px_rgba(0,0,0,0.12)] ${ri % 2 === 0 ? "bg-amber-100" : "bg-amber-200"}`}
                        title={row.totalUsedInMonth != null
                          ? `${formatStockDisplay(row.totalUsedInMonth, row.unit, row.conversionUnit, row.conversionRate, row.productName)} — chỉ giữa các ngày KK trong tháng`
                          : "Tổng dùng trong tháng (giữa các ngày KK)"}
                      >
                        {row.totalUsedInMonth != null
                          ? formatStockCellDisplay(row.totalUsedInMonth, row.unit, row.conversionUnit, row.conversionRate, row.productName)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {modal && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          onClick={() => { setModal(null); setInbound(null); }}
          role="presentation"
        >
          <div
            className="w-full max-w-md flex flex-col max-h-[min(90vh,100dvh-2rem)] rounded-xl bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex flex-row items-start justify-between gap-2 border-b border-blue-gray-100 px-4 pt-5 pb-4 overflow-visible">
              <div className="flex-1 min-w-0 pr-1">
                <h2 className="text-base font-semibold text-blue-gray-900 leading-relaxed break-words m-0 py-0.5">
                  {modal.productName}
                </h2>
                <p className="text-sm text-gray-600 mt-1 mb-0">
                  Ngày {modal.day}/{data?.month ?? month}/{data?.year ?? year}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 p-2 rounded-lg text-blue-gray-600 hover:bg-blue-gray-50"
                aria-label="Đóng"
                onClick={() => { setModal(null); setInbound(null); }}
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4">
              {inboundLoading && (
                <Typography color="gray" className="mb-2 text-sm">Đang tải chi tiết từ server…</Typography>
              )}
              {inbound && (() => {
                const used =
                  inbound.hasEodClosing && inbound.totalUsed != null
                    ? inbound.totalUsed
                    : inbound.estimatedUsedSinceLastEod;
                const isTodayCell =
                  year === now.getFullYear() &&
                  month === now.getMonth() + 1 &&
                  modal.day === now.getDate();
                const stockDisplay =
                  isTodayCell && inbound.currentStockQuantity != null
                    ? inbound.currentStockQuantity
                    : inbound.hasEodClosing
                      ? inbound.closingQuantity
                      : inbound.currentStockQuantity;
                const showClosingNote =
                  isTodayCell &&
                  inbound.hasEodClosing &&
                  inbound.closingQuantity != null &&
                  inbound.currentStockQuantity != null &&
                  Number(inbound.currentStockQuantity) !== Number(inbound.closingQuantity);
                const lastEodDate = inbound.lastEodDate ? new Date(inbound.lastEodDate) : null;
                const monthStart = data ? new Date(data.year, data.month - 1, 1) : null;
                const usedSpansPrevMonth =
                  lastEodDate && monthStart && lastEodDate < monthStart && used != null;

                return (
                  <>
                    {!inbound.hasEodClosing && (
                      <Typography variant="small" color="gray" className="mb-3">
                        Chưa kiểm kho cuối ngày — số dưới đây là ước tính.
                      </Typography>
                    )}
                    {usedSpansPrevMonth && (
                      <Typography variant="small" className="mb-3 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                        Dùng tính từ tồn sau KK ngày{" "}
                        {lastEodDate.toLocaleDateString("vi-VN")} → chốt ngày {modal.day}/{data?.month ?? month}.
                        Cột <strong>Tổng dùng</strong> tháng <em>không</em> cộng khoảng này.
                      </Typography>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-teal-200 bg-teal-50 px-2 py-3 text-center">
                        <p className="text-[11px] font-medium text-teal-800 mb-1">Nhận</p>
                        <p className="text-2xl font-bold text-teal-900 leading-none">
                          {formatStockDisplay(inbound.totalReceived, modal.unit, modal.conversionUnit, modal.conversionRate, modal.productName)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-3 text-center">
                        <p className="text-[11px] font-medium text-amber-800 mb-1">Dùng</p>
                        <p className="text-2xl font-bold text-amber-900 leading-none">
                          {used != null
                            ? formatStockDisplay(used, modal.unit, modal.conversionUnit, modal.conversionRate, modal.productName)
                            : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-blue-gray-200 bg-blue-gray-50 px-2 py-3 text-center">
                        <p className="text-[11px] font-medium text-blue-gray-700 mb-1">Tồn</p>
                        <p className="text-xl font-bold text-blue-gray-900 leading-tight">
                          {stockDisplay != null
                            ? formatStockDisplay(stockDisplay, modal.unit, modal.conversionUnit, modal.conversionRate, modal.productName)
                            : "—"}
                        </p>
                        {showClosingNote && (
                          <p className="text-[10px] text-gray-500 mt-1.5 leading-tight">
                            KK: {formatStockDisplay(inbound.closingQuantity, modal.unit, modal.conversionUnit, modal.conversionRate, modal.productName)}
                          </p>
                        )}
                      </div>
                    </div>
                    {inbound.lines.length > 0 && (
                      <>
                        <Button
                          variant="text"
                          size="sm"
                          className="w-full mt-3 normal-case"
                          onClick={() => setShowInboundLines((v) => !v)}
                        >
                          {showInboundLines ? "Ẩn" : "Xem"} phiếu nhập ({inbound.lines.length})
                        </Button>
                        {showInboundLines && (
                          <ul className="text-sm border border-blue-gray-100 rounded-lg divide-y divide-blue-gray-50">
                            {inbound.lines.map((l) => (
                              <li key={l.id} className="px-3 py-2 flex justify-between gap-2">
                                <span>
                                  <strong>+{formatStockDisplay(l.quantityDelta, modal.unit, modal.conversionUnit, modal.conversionRate, modal.productName)}</strong>
                                  {l.referenceOrderId != null && (
                                    <span className="text-gray-600"> · Đơn #{l.referenceOrderId}</span>
                                  )}
                                </span>
                                <span className="text-xs text-gray-500 shrink-0">
                                  {l.createdAt
                                    ? new Date(l.createdAt).toLocaleTimeString("vi-VN")
                                    : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
