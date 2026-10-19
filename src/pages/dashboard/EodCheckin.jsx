import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card, CardHeader, CardBody, Typography, Button, Chip,
} from "@material-tailwind/react";
import {
  ClipboardDocumentCheckIcon, ChevronDownIcon, ChevronUpIcon,
  ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon,
} from "@heroicons/react/24/solid";
import { useAuth, useToast } from "@/context";
import { useData } from "@/context/DataContext";
import api from "@/api";
import { useUrlFilters } from "@/utils/urlFilters";
import {
  formatDualDisplay,
  formatDiffDisplay as formatDiffDisplayUtil,
  normalizeEodUnits,
  formatEodQtyDisplay as formatEodQtyDisplayUtil,
} from "@/utils/eodUnits";

// ─── Helpers ────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("vi-VN");
};
const fmtNum = (n) => {
  const v = parseFloat(n);
  return isNaN(v) ? "0" : v % 1 === 0 ? v.toString() : v.toFixed(2);
};

/**
 * Tính tổng base từ 2 cột nhập: đơn vị lớn + đơn vị nhỏ lẻ.
 * VD: 12 thùng × 24 chai/thùng + 2 chai lẻ = 290 chai
 */
const toBaseQtyDual = (packQty, looseQty, rate) => {
  const p = parseFloat(packQty) || 0;
  const l = parseFloat(looseQty) || 0;
  if (rate > 0) return p * rate + l;
  return p + l;
};

/**
 * Quy đổi ngược base → (pack, loose) để hiển thị.
 * VD: 290 chai, rate=24 → { pack: 12, loose: 2 }
 */
const fromBaseQtyDual = (baseQty, rate) => {
  if (!rate || rate <= 0) return { pack: 0, loose: baseQty };
  const pack = Math.floor(baseQty / rate);
  const loose = baseQty - pack * rate;
  return { pack, loose };
};

const formatConvHint = (unit, conversionUnit, rate) =>
  `1 ${unit} = ${fmtNum(rate)} ${conversionUnit}`;

const formatDiffDisplay = (diff, packUnit, looseUnit, rate) =>
  formatDiffDisplayUtil(diff, packUnit, looseUnit, rate);

/** Modal: SP có chênh lệch lên trước, rồi theo tên */
const sortConfirmItems = (items) =>
  [...items].sort((a, b) => {
    const aCh = a.diff !== 0 ? 0 : 1;
    const bCh = b.diff !== 0 ? 0 : 1;
    if (aCh !== bCh) return aCh - bCh;
    if (a.diff !== 0 && b.diff !== 0) return Math.abs(b.diff) - Math.abs(a.diff);
    return (a.productName || "").localeCompare(b.productName || "", "vi");
  });

const EOD_CHECKIN_FILTER_DEFAULTS = {
  storeId: "",
  date: "",
  tab: "",
  historyFrom: "",
  historyTo: "",
};

// ─── Component ──────────────────────────────────────────────────────────────
export function EodCheckin() {
  const { currentUser, isAdmin, isStoreUser } = useAuth();
  const { stores = [], products = [], refetchProducts } = useData();
  const { showToast } = useToast();
  const { values, setFilter, setFilters } = useUrlFilters(EOD_CHECKIN_FILTER_DEFAULTS);

  const selectedStoreId = values.storeId || (isStoreUser && currentUser?.storeId ? String(currentUser.storeId) : "");
  const checkinDate = values.date || today();
  const historyTab = values.tab === "history" || (values.tab !== "form" && isAdmin);
  const historyDateFrom = values.historyFrom;
  const historyDateTo = values.historyTo;

  // ── State: form nhập kiểm kho ──
  const [currentStock, setCurrentStock] = useState([]); // tồn kho hiện tại
  const [stockLoading, setStockLoading] = useState(false);
  const [rows, setRows] = useState([]); // [{productId, productCode, productName, unit, currentQty, actualQty, note}]
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // kết quả sau submit
  const [confirmModal, setConfirmModal] = useState(null); // { rows: [...] } khi cần xác nhận

  // ── State: lịch sử ──
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [expandedSession, setExpandedSession] = useState(null); // "storeId_date"
  const [sessionDetails, setSessionDetails] = useState({}); // key: "storeId_date"
  const [nameSort, setNameSort] = useState(null); // null | 'asc' | 'desc'
  const [missingToday, setMissingToday] = useState([]);
  const [missingTodayLoading, setMissingTodayLoading] = useState(false);

  // ── Load tồn kho hiện tại khi chọn cửa hàng ──
  const loadCurrentStock = useCallback(async (storeId) => {
    if (!storeId || !api.USE_API) return;
    setStockLoading(true);
    setResult(null);
    try {
      const data = await api.get("warehouse.stock", { query: { storeId } });
      const list = Array.isArray(data) ? data : [];
      setCurrentStock(list);

      // Merge thông tin quy đổi từ products context
      setRows(
        list.map((s) => {
          const pid = s.productId ?? s.ProductId;
          const prod = products.find((p) => (p.id ?? p.Id) === pid);
          // DB convention: unit = đơn vị lớn (Chai, Hộp, Kg...)
          //                conversionUnit = đơn vị nhỏ (Ml, Gr, Cái...)
          //                conversionRate = số đơn vị nhỏ trong 1 đơn vị lớn
          const productName = s.productName ?? s.ProductName ?? prod?.name ?? prod?.Name ?? "";
          const norm = normalizeEodUnits({
            unit: s.unit ?? s.Unit ?? prod?.unit ?? prod?.Unit ?? "",
            conversionUnit: prod?.conversionUnit ?? prod?.ConversionUnit ?? "",
            conversionRate: prod?.conversionRate ?? prod?.ConversionRate ?? 0,
            productName,
          });
          return {
            productId: pid,
            productCode: s.productCode ?? s.ProductCode ?? "",
            productName,
            unit: norm.unit,
            conversionUnit: norm.conversionUnit,
            conversionRate: norm.conversionRate,
            currentQty: parseFloat(s.quantity ?? s.Quantity ?? 0), // tồn kho (đơn vị nhỏ)
            packQty: "",              // số đơn vị lớn nhân viên nhập
            looseQty: "",             // số đơn vị nhỏ lẻ
            note: "",
          };
        })
      );
    } catch (e) {
      showToast(e.message || "Lỗi tải tồn kho", "error");
      setCurrentStock([]);
      setRows([]);
    } finally {
      setStockLoading(false);
    }
  }, [showToast, products]);

  useEffect(() => {
    if (selectedStoreId) loadCurrentStock(selectedStoreId);
  }, [selectedStoreId, loadCurrentStock]);

  // ── Cập nhật row (theo productId — an toàn khi sort) ──
  const updateRow = (productId, field, value) => {
    setRows((prev) => prev.map((r) => (r.productId === productId ? { ...r, [field]: value } : r)));
  };

  const displayRows = useMemo(() => {
    if (!nameSort) return rows;
    return [...rows].sort((a, b) => {
      const cmp = (a.productName || "").localeCompare(b.productName || "", "vi");
      return nameSort === "asc" ? cmp : -cmp;
    });
  }, [rows, nameSort]);

  const toggleNameSort = () => {
    setNameSort((s) => (s === null ? "asc" : s === "asc" ? "desc" : null));
  };

  // ── Điền tất cả = tồn hiện tại (quy đổi về pack + loose) ──
  const fillAllCurrent = () => {
    setRows((prev) => prev.map((r) => {
      if (r.conversionRate > 0) {
        // currentQty là đơn vị nhỏ (Ml), quy đổi về pack (Chai) + loose (Ml)
        const { pack, loose } = fromBaseQtyDual(r.currentQty, r.conversionRate);
        return { ...r, packQty: String(pack), looseQty: String(loose) };
      }
      // Không có quy đổi: nhập thẳng vào looseQty (đơn vị = unit)
      return { ...r, packQty: "", looseQty: String(r.currentQty) };
    }));
  };

  // ── Bước 1: Mở modal xác nhận ──
  const openConfirm = () => {
    const filledRows = rows.filter((r) => r.packQty !== "" || r.looseQty !== "");
    if (filledRows.length === 0) {
      showToast("Vui lòng nhập số lượng thực tế cho ít nhất 1 sản phẩm", "error");
      return;
    }
    // Chuẩn bị dữ liệu preview cho modal
    const previewItems = filledRows.map((r) => {
      const baseActual = toBaseQtyDual(r.packQty, r.looseQty, r.conversionRate);
      const diff = baseActual - r.currentQty;
      const hasPack = r.conversionUnit && r.conversionRate > 0;
      // Hiển thị số nhập dạng "12 thùng 2 chai"
      const inputDisplay = hasPack
        ? `${r.packQty || 0} ${r.unit}${(parseFloat(r.looseQty) || 0) > 0 ? ` ${r.looseQty} ${r.conversionUnit}` : ""}`
        : `${r.looseQty || 0} ${r.unit}`;
      const prevDisplay = hasPack
        ? formatDualDisplay(r.currentQty, r.unit, r.conversionUnit, r.conversionRate)
        : `${fmtNum(r.currentQty)} ${r.unit}`;
      return {
        productId: r.productId,
        productName: r.productName,
        productCode: r.productCode,
        unit: r.unit,
        conversionUnit: r.conversionUnit,
        conversionRate: r.conversionRate,
        prevDisplay,
        inputDisplay,
        baseActual,
        diff,
        note: r.note,
      };
    });
    setConfirmModal({ items: sortConfirmItems(previewItems) });
  };

  // ── Bước 2: Thực sự lưu sau khi xác nhận ──
  const doSubmit = async (override = false) => {
    if (!confirmModal) return;
    setSubmitting(true);
    try {
      const payload = {
        storeId: parseInt(selectedStoreId, 10),
        date: checkinDate,
        override,
        items: confirmModal.items.map((r) => ({
          productId: r.productId,
          actualQuantity: r.baseActual,
          note: r.note || "",
        })),
      };
      const res = await api.post("warehouse.eodCheckin", payload);
      setConfirmModal(null);
      setResult(res);
      showToast(`✅ Kiểm kho thành công! ${res.itemCount} sản phẩm đã cập nhật.`, "success");
      await loadCurrentStock(selectedStoreId);
    } catch (e) {
      if (e.status === 400 && e.data?.message?.includes("Đã có phiên")) {
        if (window.confirm(`${e.data.message}\n\nBạn có muốn ghi đè phiên cũ không?`)) {
          setSubmitting(false);
          await doSubmit(true);
          return;
        }
      } else {
        showToast(e.data?.message || e.message || "Lỗi kiểm kho", "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Load lịch sử phiên kiểm kho ──
  const loadSessions = useCallback(async () => {
    if (!api.USE_API) return;
    setSessionsLoading(true);
    try {
      const query = {};
      if (isStoreUser && currentUser?.storeId) query.storeId = currentUser.storeId;
      else if (selectedStoreId) query.storeId = selectedStoreId;
      if (historyDateFrom) query.dateFrom = historyDateFrom;
      if (historyDateTo) query.dateTo = historyDateTo;
      const data = await api.get("warehouse.eodSessions", { query });
      setSessions(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast(e.message || "Lỗi tải lịch sử", "error");
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [isStoreUser, currentUser, selectedStoreId, historyDateFrom, historyDateTo, showToast]);

  const loadMissingToday = useCallback(async () => {
    if (!api.USE_API || !isAdmin) return;
    setMissingTodayLoading(true);
    try {
      const data = await api.get("warehouse.eodMissingToday");
      const stores = data?.stores ?? data?.Stores ?? [];
      setMissingToday(Array.isArray(stores) ? stores : []);
    } catch {
      setMissingToday([]);
    } finally {
      setMissingTodayLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (historyTab) loadSessions();
  }, [historyTab, loadSessions]);

  useEffect(() => {
    if (historyTab && isAdmin) loadMissingToday();
  }, [historyTab, isAdmin, loadMissingToday]);

  useEffect(() => {
    if (historyTab && api.USE_API && refetchProducts) refetchProducts();
  }, [historyTab, refetchProducts]);

  // ── Load chi tiết phiên ──
  const toggleSessionDetail = async (storeId, date) => {
    const key = `${storeId}_${date}`;
    if (expandedSession === key) {
      setExpandedSession(null);
      return;
    }
    setExpandedSession(key);
    if (sessionDetails[key]) return; // đã load rồi
    try {
      const dateStr = typeof date === "string" ? date.slice(0, 10) : new Date(date).toISOString().slice(0, 10);
      const data = await api.get("warehouse.eodSessionDetail", { params: { storeId, date: dateStr } });
      setSessionDetails((prev) => ({ ...prev, [key]: data }));
    } catch (e) {
      showToast(e.message || "Lỗi tải chi tiết", "error");
    }
  };

  // ── Tính tóm tắt ──
  const filledCount = rows.filter((r) => r.packQty !== "" || r.looseQty !== "").length;
  const diffRows = rows.filter((r) => {
    if (r.packQty === "" && r.looseQty === "") return false;
    const baseActual = toBaseQtyDual(r.packQty, r.looseQty, r.conversionRate);
    return baseActual !== r.currentQty;
  });

  const storeOptions = isAdmin
    ? stores.filter((s) => (s.status ?? s.Status) === "Active")
    : stores.filter((s) => String(s.id ?? s.Id) === String(currentUser?.storeId));

  const resolveItemUnits = (item) => {
    const pid = item.productId ?? item.ProductId;
    const prod = products.find((p) => (p.id ?? p.Id) === pid);
    const productName = item.productName ?? item.ProductName ?? prod?.name ?? prod?.Name ?? "";
    return normalizeEodUnits({
      unit: item.unit ?? item.Unit ?? prod?.unit ?? prod?.Unit ?? "",
      conversionUnit:
        item.conversionUnit ?? item.ConversionUnit ?? prod?.conversionUnit ?? prod?.ConversionUnit ?? "",
      conversionRate:
        item.conversionRate ?? item.ConversionRate ?? prod?.conversionRate ?? prod?.ConversionRate ?? 0,
      productName,
    });
  };

  const displayEodQty = (item, qty) => {
    const { unit, conversionUnit, conversionRate } = resolveItemUnits(item);
    return formatEodQtyDisplayUtil(qty, unit, conversionUnit, conversionRate, item.productName);
  };

  return (
    <>
    <div className="mt-4 md:mt-12 mb-8 flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Typography variant="h4" color="blue-gray">Kiểm kho cuối ngày</Typography>
          <Typography variant="small" color="gray" className="mt-1">
            {isAdmin
              ? "Xem lịch sử kiểm kho các cửa hàng — chọn cửa hàng hoặc để trống để xem tất cả."
              : "Nhập số lượng thực tế từng sản phẩm — hệ thống tự cập nhật tồn kho"}
          </Typography>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={!historyTab ? "filled" : "outlined"}
            color="blue"
            className="flex-1 md:flex-none"
            onClick={() => setFilter("tab", "form")}
          >
            Nhập kiểm kho
          </Button>
          <Button
            size="sm"
            variant={historyTab ? "filled" : "outlined"}
            color="blue-gray"
            className="flex-1 md:flex-none"
            onClick={() => setFilter("tab", "history")}
          >
            Lịch sử
          </Button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: NHẬP KIỂM KHO
      ══════════════════════════════════════════════════════════════════════ */}
      {!historyTab && (
        <>
          {/* ── Bộ lọc ── */}
          <Card>
            <CardBody className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end py-4 px-3 md:px-6">
              {isAdmin && (
                <div className="w-full md:w-64">
                  <Typography variant="small" color="blue-gray" className="mb-1 font-medium">Cửa hàng</Typography>
                  <select
                    className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              {isStoreUser && (
                <div className="w-full md:w-64">
                  <Typography variant="small" color="blue-gray" className="mb-1 font-medium">Cửa hàng</Typography>
                  <input
                    readOnly
                    className="w-full rounded border border-blue-gray-100 bg-gray-50 px-3 py-2 text-sm"
                    value={storeOptions[0]?.name ?? storeOptions[0]?.Name ?? ""}
                  />
                </div>
              )}
              <div className="w-full md:w-auto">
                <Typography variant="small" color="blue-gray" className="mb-1 font-medium">Ngày kiểm kho</Typography>
                <input
                  type="date"
                  className="w-full md:w-auto rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={checkinDate}
                  onChange={(e) => setFilter("date", e.target.value)}
                />
              </div>
              <Button
                size="sm"
                variant="outlined"
                color="blue-gray"
                className="flex items-center justify-center gap-1 w-full md:w-auto"
                onClick={() => loadCurrentStock(selectedStoreId)}
                disabled={!selectedStoreId || stockLoading}
              >
                <ArrowPathIcon className={`h-4 w-4 ${stockLoading ? "animate-spin" : ""}`} />
                Tải lại tồn kho
              </Button>
            </CardBody>
          </Card>

          {/* ── Kết quả submit ── */}
          {result && (
            <Card className="border border-green-200 bg-green-50">
              <CardBody className="py-4 px-3 md:px-6">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircleIcon className="h-5 w-5 text-green-600" />
                  <Typography variant="h6" color="green">
                    Kiểm kho thành công — {fmtDate(result.date)} — {result.storeName}
                  </Typography>
                </div>
                {/* Mobile: card list */}
                <div className="flex flex-col gap-2 md:hidden">
                  {(result.items ?? []).map((item) => (
                    <div key={item.productId} className="bg-white rounded-lg px-3 py-2 border border-green-100">
                      <div className="font-medium text-blue-gray-800 text-sm">{item.productName}</div>
                      <div className="flex justify-between mt-1 text-xs text-gray-500">
                        <span>Tồn trước: {displayEodQty(item, item.previousQuantity)}</span>
                        <span>Thực tế: <span className="font-semibold text-blue-gray-700">{displayEodQty(item, item.actualQuantity)}</span></span>
                        <span className={`font-semibold ${item.difference > 0 ? "text-green-600" : item.difference < 0 ? "text-red-600" : "text-gray-400"}`}>
                          {(() => {
                            const { unit, conversionUnit, conversionRate } = resolveItemUnits(item);
                            return formatDiffDisplay(item.difference, unit, conversionUnit, conversionRate);
                          })()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-green-100">
                        <th className="px-3 py-2 text-left">Sản phẩm</th>
                        <th className="px-3 py-2 text-right">Tồn trước</th>
                        <th className="px-3 py-2 text-right">Thực tế</th>
                        <th className="px-3 py-2 text-right">Chênh lệch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(result.items ?? []).map((item) => (
                        <tr key={item.productId} className="border-t border-green-100">
                          <td className="px-3 py-1.5">
                            <span className="font-medium">{item.productName}</span>
                          </td>
                          <td className="px-3 py-1.5 text-right text-gray-600">{displayEodQty(item, item.previousQuantity)}</td>
                          <td className="px-3 py-1.5 text-right font-medium">{displayEodQty(item, item.actualQuantity)}</td>
                          <td className={`px-3 py-1.5 text-right font-semibold ${item.difference > 0 ? "text-green-600" : item.difference < 0 ? "text-red-600" : "text-gray-500"}`}>
                            {(() => {
                              const { unit, conversionUnit, conversionRate } = resolveItemUnits(item);
                              return formatDiffDisplay(item.difference, unit, conversionUnit, conversionRate);
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          )}

          {/* ── Bảng nhập ── */}
          {selectedStoreId && (
            <Card>
              <CardHeader floated={false} shadow={false} className="rounded-none px-3 md:px-6 pt-4 pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <Typography variant="h6" color="blue-gray">
                      Danh sách sản phẩm — {rows.length} mặt hàng
                    </Typography>
                    <Typography variant="small" color="gray">
                      Đã nhập: {filledCount}/{rows.length}
                      {diffRows.length > 0 && (
                        <span className="ml-2 text-orange-600 font-medium">
                          · {diffRows.length} sản phẩm có chênh lệch
                        </span>
                      )}
                    </Typography>
                  </div>
                  <Button size="sm" variant="outlined" color="blue-gray" onClick={fillAllCurrent}>
                    Điền tất cả = tồn hiện tại
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="px-0 pt-0 pb-2">
                {stockLoading ? (
                  <div className="text-center py-10 text-gray-500">Đang tải tồn kho...</div>
                ) : rows.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    Chưa có sản phẩm nào trong kho cửa hàng này
                  </div>
                ) : (
                  <>
                    {/* ── Compact list — dùng chung mobile + desktop ── */}
                    <table className="w-full table-auto text-sm">
                      <thead>
                        <tr className="bg-blue-gray-100 text-blue-gray-600 text-xs uppercase">
                          <th className="px-3 py-2 text-left w-6">#</th>
                          <th
                            className="px-3 py-2 text-left cursor-pointer select-none hover:bg-blue-gray-200/80 active:bg-blue-gray-200"
                            onClick={toggleNameSort}
                            title="Bấm để xếp theo tên"
                          >
                            Sản phẩm
                            {nameSort === "asc" && <span className="ml-1 text-blue-600">↑ A-Z</span>}
                            {nameSort === "desc" && <span className="ml-1 text-blue-600">↓ Z-A</span>}
                          </th>
                          <th className="px-3 py-2 text-right w-20 hidden sm:table-cell">Tồn kho</th>
                          <th className="px-3 py-2 text-center w-24">
                            <span className="hidden sm:inline">ĐV lớn</span>
                            <span className="sm:hidden">Lớn</span>
                          </th>
                          <th className="px-3 py-2 text-center w-24">
                            <span className="hidden sm:inline">ĐV nhỏ</span>
                            <span className="sm:hidden">Nhỏ</span>
                          </th>
                          <th className="px-3 py-2 text-right w-20">Chênh</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayRows.map((row, idx) => {
                          const hasPack = row.conversionUnit && row.conversionRate > 0;
                          const baseActual = (row.packQty !== "" || row.looseQty !== "")
                            ? toBaseQtyDual(row.packQty, row.looseQty, row.conversionRate)
                            : null;
                          const diff = baseActual !== null ? baseActual - row.currentQty : null;
                          const hasDiff = diff !== null && diff !== 0;

                          const displayCurrent = hasPack
                            ? formatDualDisplay(row.currentQty, row.unit, row.conversionUnit, row.conversionRate)
                            : `${fmtNum(row.currentQty)} ${row.unit}`;

                          // Màu nền xen kẽ, ưu tiên màu chênh lệch nếu có
                          const rowBg = hasDiff
                            ? "bg-orange-50"
                            : idx % 2 === 0 ? "bg-white" : "bg-blue-gray-50/40";

                          return (
                            <tr key={row.productId} className={`${rowBg} border-b border-blue-gray-100`}>
                              {/* # */}
                              <td className="px-3 py-1.5 text-gray-400 text-xs">{idx + 1}</td>

                              {/* Tên SP */}
                              <td className="px-3 py-1.5">
                                <div className="font-medium text-blue-gray-800 text-xs leading-snug" title={row.productName}>
                                  {row.productName}
                                </div>
                                {hasPack && (
                                  <div className="text-[10px] text-blue-600 mt-0.5">
                                    {formatConvHint(row.unit, row.conversionUnit, row.conversionRate)}
                                  </div>
                                )}
                                <div className="text-[10px] text-gray-600 mt-0.5 sm:hidden">
                                  Tồn: {displayCurrent}
                                </div>
                              </td>

                              {/* Tồn hiện tại — ẩn trên mobile nhỏ */}
                              <td className="px-3 py-1.5 text-right text-xs text-gray-500 hidden sm:table-cell whitespace-nowrap">
                                {displayCurrent}
                              </td>

                              {/* ĐV lớn */}
                              <td className="px-1.5 py-1.5">
                                {hasPack ? (
                                  <div className="flex items-center gap-0.5">
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      placeholder="0"
                                      className={`w-full rounded border px-1.5 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-blue-400
                                        ${hasDiff ? "border-orange-300 bg-orange-50" : "border-blue-gray-200 bg-white"}`}
                                      value={row.packQty}
                                      onChange={(e) => updateRow(row.productId, "packQty", e.target.value)}
                                    />
                                    <span className="text-[10px] text-gray-400 shrink-0">{row.unit}</span>
                                  </div>
                                ) : (
                                  <span className="text-gray-300 text-xs block text-center">—</span>
                                )}
                              </td>

                              {/* ĐV nhỏ */}
                              <td className="px-1.5 py-1.5">
                                <div className="flex items-center gap-0.5">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0"
                                    className={`w-full rounded border px-1.5 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-blue-400
                                      ${hasDiff ? "border-orange-300 bg-orange-50" : "border-blue-gray-200 bg-white"}`}
                                    value={row.looseQty}
                                    onChange={(e) => updateRow(row.productId, "looseQty", e.target.value)}
                                  />
                                  <span className="text-[10px] text-gray-400 shrink-0">
                                    {hasPack ? row.conversionUnit : row.unit}
                                  </span>
                                </div>
                              </td>

                              {/* Chênh lệch */}
                              <td className="px-3 py-1.5 text-right text-xs font-semibold whitespace-nowrap">
                                {diff !== null ? (
                                  <span className={diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-400"}>
                                    {formatDiffDisplay(diff, row.unit, row.conversionUnit, row.conversionRate)}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}
              </CardBody>
              {rows.length > 0 && (
                <div className="px-3 md:px-6 py-4 border-t border-blue-gray-50 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-gray-600">
                    {diffRows.length > 0 && (
                      <span className="flex items-center gap-1 text-orange-600">
                        <ExclamationTriangleIcon className="h-4 w-4" />
                        {diffRows.length} sản phẩm có chênh lệch so với tồn kho
                      </span>
                    )}
                  </div>
                  <Button
                    color="blue"
                    className="flex items-center justify-center gap-2 w-full md:w-auto"
                    onClick={openConfirm}
                    disabled={submitting || filledCount === 0}
                  >
                    <ClipboardDocumentCheckIcon className="h-4 w-4" />
                    {submitting ? "Đang lưu..." : `Xác nhận kiểm kho (${filledCount} sản phẩm)`}
                  </Button>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: LỊCH SỬ
      ══════════════════════════════════════════════════════════════════════ */}
      {historyTab && (
        <Card>
          {isAdmin && (
            <div className="px-3 md:px-6 pt-4">
              {missingTodayLoading ? (
                <div className="rounded-lg border border-blue-gray-100 bg-blue-gray-50/50 px-4 py-3 text-sm text-gray-500">
                  Đang kiểm tra CH chưa EOD hôm nay…
                </div>
              ) : missingToday.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <Typography variant="small" className="font-semibold text-amber-900">
                    Hôm nay {missingToday.length} CH chưa kiểm kê EOD
                  </Typography>
                  <ul className="mt-2 list-disc list-inside text-sm text-amber-900/90 max-h-32 overflow-y-auto">
                    {missingToday.map((s) => (
                      <li key={s.id ?? s.Id}>{s.name ?? s.Name}</li>
                    ))}
                  </ul>
                  <Typography variant="small" className="mt-2 text-xs text-amber-800/80">
                    Bảng bên dưới chỉ hiện phiên đã kiểm kê (lịch sử). CH chưa làm hôm nay không có trong lịch sử — cùng logic với Trợ lý AI.
                  </Typography>
                </div>
              ) : (
                <div className="rounded-lg border border-green-100 bg-green-50/60 px-4 py-3 text-sm text-green-900">
                  Tất cả CH active đã kiểm kê EOD hôm nay (hoặc chưa có CH active).
                </div>
              )}
            </div>
          )}
          <CardHeader floated={false} shadow={false} className="rounded-none px-3 md:px-6 pt-4 pb-2">
            <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
              {isAdmin && (
                <div className="w-full md:w-56">
                  <Typography variant="small" color="blue-gray" className="mb-1 font-medium">Cửa hàng</Typography>
                  <select
                    className="w-full rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none"
                    value={selectedStoreId}
                    onChange={(e) => setFilter("storeId", e.target.value)}
                  >
                    <option value="">Tất cả</option>
                    {storeOptions.map((s) => (
                      <option key={s.id ?? s.Id} value={s.id ?? s.Id}>{s.name ?? s.Name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="w-full md:w-auto">
                <Typography variant="small" color="blue-gray" className="mb-1 font-medium">Từ ngày</Typography>
                <input type="date" className="w-full md:w-auto rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none"
                  value={historyDateFrom} onChange={(e) => setFilter("historyFrom", e.target.value)} />
              </div>
              <div className="w-full md:w-auto">
                <Typography variant="small" color="blue-gray" className="mb-1 font-medium">Đến ngày</Typography>
                <input type="date" className="w-full md:w-auto rounded border border-blue-gray-200 px-3 py-2 text-sm focus:outline-none"
                  value={historyDateTo} onChange={(e) => setFilter("historyTo", e.target.value)} />
              </div>
              <Button size="sm" color="blue" onClick={loadSessions} disabled={sessionsLoading}
                className="flex items-center justify-center gap-1 w-full md:w-auto">
                <ArrowPathIcon className={`h-4 w-4 ${sessionsLoading ? "animate-spin" : ""}`} />
                Tìm kiếm
              </Button>
            </div>
          </CardHeader>
          <CardBody className="px-0 pt-0 pb-2">
            {sessionsLoading ? (
              <div className="text-center py-10 text-gray-500">Đang tải...</div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                Chưa có phiên kiểm kho trong khoảng lọc
                {isAdmin && missingToday.length > 0 && (
                  <Typography variant="small" className="block mt-2 text-amber-700/90 max-w-md mx-auto">
                    (Có {missingToday.length} CH chưa kiểm kê hôm nay — xem khung vàng phía trên)
                  </Typography>
                )}
              </div>
            ) : (
              <div className="divide-y divide-blue-gray-50">
                {sessions.map((session) => {
                  const dateStr = typeof session.date === "string"
                    ? session.date.slice(0, 10)
                    : new Date(session.date).toISOString().slice(0, 10);
                  const key = `${session.storeId}_${dateStr}`;
                  const isExpanded = expandedSession === key;
                  const detail = sessionDetails[key];

                  return (
                    <div key={key}>
                      {/* ── Row tóm tắt ── */}
                      <div
                        className="flex items-center justify-between px-6 py-3 hover:bg-blue-gray-50 cursor-pointer"
                        onClick={() => toggleSessionDetail(session.storeId, dateStr)}
                      >
                        <div className="flex items-center gap-4">
                          <ClipboardDocumentCheckIcon className="h-5 w-5 text-blue-500 shrink-0" />
                          <div>
                            <Typography variant="small" className="font-semibold text-blue-gray-800">
                              {fmtDate(session.date)}
                            </Typography>
                            <Typography variant="small" color="gray">
                              {session.storeName} · {session.itemCount} sản phẩm
                            </Typography>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Chip
                            value={`${session.itemCount} sản phẩm`}
                            size="sm"
                            color="blue"
                            variant="ghost"
                          />
                          {isExpanded
                            ? <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                            : <ChevronDownIcon className="h-4 w-4 text-gray-500" />}
                        </div>
                      </div>

                      {/* ── Chi tiết phiên ── */}
                      {isExpanded && (
                        <div className="bg-blue-gray-50/50 px-3 md:px-6 py-3">
                          {!detail ? (
                            <div className="text-center py-4 text-gray-500 text-sm">Đang tải chi tiết...</div>
                          ) : (
                            <>
                              {/* Mobile: card list */}
                              <div className="flex flex-col gap-2 md:hidden">
                                {(detail.items ?? []).map((item) => (
                                  <div key={item.productId} className="bg-white rounded-lg px-3 py-2 border border-blue-gray-100">
                                    <div className="font-medium text-blue-gray-800 text-sm">
                                      {item.productName}
                                      <span className="text-xs text-gray-400 ml-1">({item.productCode})</span>
                                    </div>
                                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                                      <span>Số lượng thực tế: <span className="font-semibold text-blue-gray-700">{displayEodQty(item, item.actualQuantity)}</span></span>
                                      <span className="text-gray-400">{item.note || "—"}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {/* Desktop: table */}
                              <table className="hidden md:table w-full text-sm">
                                <thead>
                                  <tr className="text-blue-gray-600">
                                    <th className="text-left py-1.5 pr-4">Sản phẩm</th>
                                    <th className="text-right py-1.5 pr-4">Số lượng thực tế</th>
                                    <th className="text-left py-1.5">Ghi chú</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(detail.items ?? []).map((item) => (
                                    <tr key={item.productId} className="border-t border-blue-gray-100">
                                      <td className="py-1.5 pr-4">
                                        <span className="font-medium">{item.productName}</span>
                                        <span className="text-xs text-gray-400 ml-1">({item.productCode})</span>
                                      </td>
                                      <td className="py-1.5 pr-4 text-right font-semibold whitespace-nowrap">
                                        {displayEodQty(item, item.actualQuantity)}
                                      </td>
                                      <td className="py-1.5 text-gray-500 text-xs">{item.note || "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>

    {/* ══════════════════════════════════════════════════════════════════════
        MODAL XÁC NHẬN KIỂM KHO
    ══════════════════════════════════════════════════════════════════════ */}
    {confirmModal && (
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 md:p-4">
        <div className="bg-white w-full md:rounded-xl shadow-2xl md:max-w-3xl max-h-[95vh] md:max-h-[90vh] flex flex-col rounded-t-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-blue-gray-100">
            <div>
              <Typography variant="h5" color="blue-gray">Xác nhận kiểm kho cuối ngày</Typography>
              <Typography variant="small" color="gray">
                Ngày {fmtDate(checkinDate)} · {confirmModal.items.length} sản phẩm
              </Typography>
            </div>
            <button
              onClick={() => setConfirmModal(null)}
              className="p-1.5 rounded-full hover:bg-blue-gray-50 text-gray-500"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Body — tóm tắt */}
          <div className="overflow-y-auto flex-1 px-4 md:px-6 py-4">
            {/* Tóm tắt nhanh */}
            <div className="flex gap-3 mb-4 flex-wrap">
              {(() => {
                const changed = confirmModal.items.filter((i) => i.diff !== 0);
                const increased = changed.filter((i) => i.diff > 0);
                const decreased = changed.filter((i) => i.diff < 0);
                return (
                  <>
                    <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg px-3 py-2">
                      <ClipboardDocumentCheckIcon className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-blue-700">{confirmModal.items.length} sản phẩm</span>
                    </div>
                    {increased.length > 0 && (
                      <div className="flex items-center gap-1.5 bg-green-50 rounded-lg px-3 py-2">
                        <span className="text-sm font-medium text-green-700">▲ {increased.length} tăng</span>
                      </div>
                    )}
                    {decreased.length > 0 && (
                      <div className="flex items-center gap-1.5 bg-red-50 rounded-lg px-3 py-2">
                        <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-red-700">▼ {decreased.length} giảm</span>
                      </div>
                    )}
                    {changed.length === 0 && (
                      <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-500">Không có thay đổi</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Mobile: card list */}
            <div className="flex flex-col gap-2 md:hidden">
              {confirmModal.items.map((item) => {
                const hasDiff = item.diff !== 0;
                return (
                  <div
                    key={item.productId}
                    className={`rounded-lg border px-3 py-2.5 ${hasDiff ? (item.diff < 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50") : "border-blue-gray-100 bg-white"}`}
                  >
                    <div className="font-medium text-blue-gray-800 text-sm">{item.productName}</div>
                    <div className="text-xs text-gray-400 mb-1.5">{item.productCode}</div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Tồn cũ: <span className="font-medium text-blue-gray-800">{item.prevDisplay}</span></span>
                      <span className="text-gray-500">Nhập: <span className="font-semibold text-blue-gray-800">{item.inputDisplay}</span></span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-gray-400">{item.note || ""}</span>
                      <span>
                        {hasDiff ? (
                          <span className={`font-bold ${item.diff > 0 ? "text-green-600" : "text-red-600"}`}>
                            {formatDiffDisplay(item.diff, item.unit, item.conversionUnit, item.conversionRate)}
                          </span>
                        ) : (
                          <span className="text-gray-400">không đổi</span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="bg-blue-gray-50 text-blue-gray-600">
                  <th className="px-3 py-2.5 text-left font-semibold">Sản phẩm</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Tồn cũ</th>
                  <th className="px-3 py-2.5 text-center font-semibold">→</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Nhập thực tế</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Chênh lệch</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {confirmModal.items.map((item) => {
                  const hasDiff = item.diff !== 0;
                  const hasPack = item.conversionUnit && item.conversionRate > 0;

                  return (
                    <tr
                      key={item.productId}
                      className={`border-t border-blue-gray-50 ${hasDiff ? (item.diff < 0 ? "bg-red-50" : "bg-green-50") : ""}`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-blue-gray-800">{item.productName}</div>
                        <div className="text-xs text-gray-400">{item.productCode}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-blue-gray-800 font-medium whitespace-nowrap">{item.prevDisplay}</td>
                      <td className="px-3 py-2.5 text-center text-gray-400">→</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-blue-gray-800">
                        {item.inputDisplay}
                        {hasPack && (
                          <div className="text-xs text-gray-400 font-normal">= {fmtNum(item.baseActual)} {item.conversionUnit}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold">
                        {hasDiff ? (
                          <span className={item.diff > 0 ? "text-green-600" : "text-red-600"}>
                            {formatDiffDisplay(item.diff, item.unit, item.conversionUnit, item.conversionRate)}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-normal">không đổi</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{item.note || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 md:px-6 py-4 border-t border-blue-gray-100 flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-gray-50 rounded-b-2xl md:rounded-b-xl">
            <Typography variant="small" color="gray" className="hidden md:block">
              Sau khi xác nhận, tồn kho sẽ được cập nhật ngay lập tức.
            </Typography>
            <div className="flex flex-col gap-2 md:flex-row md:gap-3">
              <Button
                variant="outlined"
                color="blue-gray"
                className="w-full md:w-auto"
                onClick={() => setConfirmModal(null)}
                disabled={submitting}
              >
                Quay lại sửa
              </Button>
              <Button
                color="blue"
                className="flex items-center justify-center gap-2 w-full md:w-auto"
                onClick={() => doSubmit(false)}
                disabled={submitting}
              >
                <CheckCircleIcon className="h-4 w-4" />
                {submitting ? "Đang lưu..." : "Xác nhận & Lưu"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default EodCheckin;
