/** Chuẩn hóa đơn vị EOD: tồn lưu theo đơn vị nhỏ (Gr, Ml…), hiển thị đơn vị lớn + lẻ. */

const fmtNum = (n) => {
  const v = parseFloat(n);
  return Number.isNaN(v) ? "0" : v % 1 === 0 ? v.toString() : v.toFixed(2);
};

export const fromBaseQtyDual = (baseQty, rate) => {
  if (!rate || rate <= 0) return { pack: 0, loose: baseQty };
  const pack = Math.floor(baseQty / rate);
  const loose = baseQty - pack * rate;
  return { pack, loose };
};

export const formatDualDisplay = (baseQty, packUnit, looseUnit, rate) => {
  if (!rate || rate <= 0) return `${fmtNum(baseQty)} ${packUnit || ""}`.trim();
  const { pack, loose } = fromBaseQtyDual(baseQty, rate);
  const parts = [];
  if (pack > 0) parts.push(`${pack} ${packUnit}`);
  if (loose > 0) parts.push(`${fmtNum(loose)} ${looseUnit}`);
  return parts.join(" ") || `0 ${packUnit}`;
};

/** Suy đơn vị lớn từ tên SP: "Blend Coffee - Gói/1kg" → Gói */
export function inferPackUnitFromName(name) {
  if (!name) return null;
  const n = String(name).toLowerCase();
  if (/gói|goi|gói|g\u00f3i/.test(n)) return "Gói";
  if (/túi|tui|t\u00fai/.test(n)) return "Túi";
  if (/thùng|thung/.test(n)) return "Thùng";
  if (/hộp|hop|h\u1ed9p/.test(n)) return "Hộp";
  if (/chai/.test(n)) return "Chai";
  if (/cây/.test(n)) return "Cây";
  return null;
}

/** Suy tỷ lệ Gr từ tên: "Gói/1kg" → 1000, "0.8kg" → 800, "500gr" → 500 */
export function inferGrRateFromName(name, fallback = 1000) {
  if (!name) return fallback;
  const s = String(name);
  const kg = s.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (kg) return Math.round(parseFloat(kg[1].replace(",", ".")) * 1000);
  const gr = s.match(/(\d+(?:[.,]\d+)?)\s*gr\b/i);
  if (gr) return Math.round(parseFloat(gr[1].replace(",", ".")));
  return fallback;
}

const sameUnit = (a, b) =>
  String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/**
 * Chuẩn hóa Unit / ConversionUnit / ConversionRate từ DB + tên SP.
 * Xử lý: Unit=Kg không có quy đổi, Unit=Gr trùng ConversionUnit, tên có Gói/1kg.
 */
export function normalizeEodUnits({ unit, conversionUnit, conversionRate, productName }) {
  let packUnit = String(unit || "").trim();
  let looseUnit = String(conversionUnit || "").trim();
  let rate = Number(conversionRate) || 0;
  const name = productName || "";

  if (looseUnit && rate > 1 && sameUnit(packUnit, looseUnit)) {
    const inferred = inferPackUnitFromName(name);
    if (inferred) packUnit = inferred;
  }

  if (looseUnit && rate > 0 && !sameUnit(packUnit, looseUnit)) {
    if (/^kg$/i.test(packUnit) && inferPackUnitFromName(name)) {
      packUnit = inferPackUnitFromName(name);
    }
    return { unit: packUnit, conversionUnit: looseUnit, conversionRate: rate };
  }

  const inferredPack = inferPackUnitFromName(name);
  if (inferredPack) {
    packUnit = inferredPack;
    looseUnit = looseUnit || "Gr";
    if (rate <= 0) rate = inferGrRateFromName(name, rate || 1000);
  } else if (/^kg$/i.test(packUnit) && rate <= 0) {
    looseUnit = "Gr";
    rate = 1000;
  }

  const hasPack =
    looseUnit && rate > 0 && !sameUnit(packUnit, looseUnit);
  return {
    unit: packUnit,
    conversionUnit: hasPack ? looseUnit : "",
    conversionRate: hasPack ? rate : 0,
  };
}

/** Chênh lệch (base) → "-1 Túi" hoặc "-800 Gr" */
export function formatDiffDisplay(diff, packUnit, looseUnit, rate) {
  if (diff === 0) return "0";
  if (!rate || rate <= 0) return `${diff > 0 ? "+" : ""}${fmtNum(diff)} ${packUnit || ""}`;
  const { pack, loose } = fromBaseQtyDual(Math.abs(diff), rate);
  const sign = diff > 0 ? "+" : "-";
  const parts = [];
  if (pack > 0) parts.push(`${pack} ${packUnit}`);
  if (loose > 0) parts.push(`${fmtNum(loose)} ${looseUnit}`);
  return sign + (parts.join(" ") || fmtNum(Math.abs(diff)));
}

export function formatEodQtyDisplay(qty, unit, conversionUnit, conversionRate, productName) {
  const norm = normalizeEodUnits({
    unit,
    conversionUnit,
    conversionRate,
    productName,
  });
  return formatDualDisplay(
    Number(qty),
    norm.unit,
    norm.conversionUnit,
    norm.conversionRate
  );
}
