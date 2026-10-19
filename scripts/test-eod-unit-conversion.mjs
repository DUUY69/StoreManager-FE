#!/usr/bin/env node
/**
 * Test quy đổi đơn vị kiểm kho (EOD) — logic giống EodCheckin.jsx
 * Usage:
 *   node scripts/test-eod-unit-conversion.mjs
 *   node scripts/test-eod-unit-conversion.mjs --api http://localhost:5001
 *   node scripts/test-eod-unit-conversion.mjs --api http://hanghoa.unigroups.vn
 */

const args = process.argv.slice(2);
const apiIdx = args.indexOf("--api");
const BASE_URL = apiIdx >= 0 ? args[apiIdx + 1] : null;

// ── Logic copy từ EodCheckin.jsx ─────────────────────────────────────────────
const toBaseQtyDual = (packQty, looseQty, rate) => {
  const p = parseFloat(packQty) || 0;
  const l = parseFloat(looseQty) || 0;
  if (rate > 0) return p * rate + l;
  return p + l;
};

const fromBaseQtyDual = (baseQty, rate) => {
  if (!rate || rate <= 0) return { pack: 0, loose: baseQty };
  const pack = Math.floor(baseQty / rate);
  const loose = baseQty - pack * rate;
  return { pack, loose };
};

const formatDualDisplay = (baseQty, packUnit, looseUnit, rate) => {
  if (!rate || rate <= 0) return `${baseQty} ${packUnit}`;
  const { pack, loose } = fromBaseQtyDual(baseQty, rate);
  const parts = [];
  if (pack > 0) parts.push(`${pack} ${packUnit}`);
  if (loose > 0) parts.push(`${loose} ${looseUnit}`);
  return parts.join(" ") || `0 ${packUnit}`;
};

const formatDiffDisplay = (diff, packUnit, looseUnit, rate) => {
  if (diff === 0) return "0";
  if (!rate || rate <= 0) return `${diff > 0 ? "+" : ""}${diff} ${packUnit}`;
  const { pack, loose } = fromBaseQtyDual(Math.abs(diff), rate);
  const sign = diff > 0 ? "+" : "-";
  const parts = [];
  if (pack > 0) parts.push(`${pack} ${packUnit}`);
  if (loose > 0) parts.push(`${loose} ${looseUnit}`);
  return sign + (parts.join(" ") || String(Math.abs(diff)));
};

// ── Test cases mẫu (nghiệp vụ thực tế) ─────────────────────────────────────
const CASES = [
  {
    name: "Bột Choco Mint — Túi/Gr (800)",
    unit: "Túi", conversionUnit: "Gr", rate: 800,
    currentQty: 1888, packQty: 1, looseQty: 288,
    expectedBase: 1088, expectedDiff: -800, expectedDiffLabel: "-1 Túi",
  },
  {
    name: "Đào lon — Hộp/Lát (8)",
    unit: "Hộp", conversionUnit: "Lát", rate: 8,
    currentQty: 240, packQty: 9, looseQty: 0,
    expectedBase: 72, expectedDiff: -168, expectedDiffLabel: "-21 Hộp",
  },
  {
    name: "Nước suối — Chai/Ml (350)",
    unit: "Chai", conversionUnit: "Ml", rate: 350,
    currentQty: 1050, packQty: 2, looseQty: 100,
    expectedBase: 800, expectedDiff: -250, expectedDiffLabel: "-250 Ml",
  },
  {
    name: "Sauce — Chai/Ml (2000), còn nguyên thùng",
    unit: "Chai", conversionUnit: "Ml", rate: 2000,
    currentQty: 4000, packQty: 1, looseQty: 0,
    expectedBase: 2000, expectedDiff: -2000, expectedDiffLabel: "-1 Chai",
  },
  {
    name: "Bột Kg/Gr (1000) — không quy đổi cột lớn",
    unit: "Kg", conversionUnit: "Gr", rate: 1000,
    currentQty: 2500, packQty: 2, looseQty: 500,
    expectedBase: 2500, expectedDiff: 0, expectedDiffLabel: "0",
  },
  {
    name: "SP không quy đổi — Cái",
    unit: "Cái", conversionUnit: "", rate: 0,
    currentQty: 50, packQty: "", looseQty: 45,
    expectedBase: 45, expectedDiff: -5, expectedDiffLabel: "-5 Cái",
  },
  {
    name: "Gói/Gr (500) — dùng 1 gói",
    unit: "Gói", conversionUnit: "Gr", rate: 500,
    currentQty: 1500, packQty: 2, looseQty: 0,
    expectedBase: 1000, expectedDiff: -500, expectedDiffLabel: "-1 Gói",
  },
];

function runMathTests() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 1: Quy đổi số (logic EodCheckin)");
  console.log("=".repeat(60));

  let pass = 0, fail = 0;
  for (const c of CASES) {
    const hasPack = c.conversionUnit && c.rate > 0;
    const base = toBaseQtyDual(c.packQty, c.looseQty, c.rate);
    const diff = base - c.currentQty;
    const diffLabel = formatDiffDisplay(diff, c.unit, c.conversionUnit, c.rate);
    const okBase = Math.abs(base - c.expectedBase) < 0.001;
    const okDiff = Math.abs(diff - c.expectedDiff) < 0.001;
    const okLabel = diffLabel === c.expectedDiffLabel;

    if (okBase && okDiff && okLabel) {
      console.log(`✅ ${c.name}`);
      console.log(`   Tồn: ${hasPack ? formatDualDisplay(c.currentQty, c.unit, c.conversionUnit, c.rate) : c.currentQty + " " + c.unit}`);
      console.log(`   Nhập: ${c.packQty || 0} ${c.unit} + ${c.looseQty || 0} ${c.conversionUnit || c.unit} → chênh ${diffLabel}`);
      pass++;
    } else {
      console.log(`❌ ${c.name}`);
      console.log(`   base=${base} (expected ${c.expectedBase}) diff=${diff} (expected ${c.expectedDiff})`);
      console.log(`   label="${diffLabel}" (expected "${c.expectedDiffLabel}")`);
      fail++;
    }
  }
  console.log(`\nKết quả: ${pass}/${CASES.length} pass, ${fail} fail`);
  return fail === 0;
}

// ── Kiểm tra DB qua API ───────────────────────────────────────────────────
const SMALL_UNITS = new Set(["gr", "g", "ml", "lát", "lat", "lon", "cái", "cai", "viên", "vien"]);
const BIG_UNITS = new Set(["túi", "tui", "gói", "goi", "hộp", "hop", "thùng", "thung", "chai", "bịch", "bich", "kg"]);

function isReversedUnit(product) {
  const u = (product.unit ?? product.Unit ?? "").toLowerCase().trim();
  const cu = (product.conversionUnit ?? product.ConversionUnit ?? "").toLowerCase().trim();
  const rate = parseFloat(product.conversionRate ?? product.ConversionRate ?? 0);
  if (!cu || rate <= 1) return false;
  return SMALL_UNITS.has(u) && BIG_UNITS.has(cu);
}

async function runApiTests(baseUrl) {
  console.log("\n" + "=".repeat(60));
  console.log(`TEST 2: API Products + quy đổi (${baseUrl})`);
  console.log("=".repeat(60));

  let token;
  try {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@admin.vn", password: "123456" }),
    });
    if (!loginRes.ok) {
      console.log(`❌ Login failed: ${loginRes.status}`);
      return false;
    }
    const loginData = await loginRes.json();
    token = loginData.token;
    console.log("✅ Login admin OK");
  } catch (e) {
    console.log(`❌ Login error: ${e.message}`);
    return false;
  }

  const headers = { Authorization: `Bearer ${token}` };

  let products;
  try {
    const res = await fetch(`${baseUrl}/api/products`, { headers });
    if (!res.ok) {
      console.log(`❌ GET products: ${res.status}`);
      return false;
    }
    products = await res.json();
  } catch (e) {
    console.log(`❌ Products error: ${e.message}`);
    return false;
  }

  const active = products.filter((p) => (p.status ?? p.Status) === "Active");
  const withConv = active.filter((p) => {
    const cu = p.conversionUnit ?? p.ConversionUnit;
    const rate = parseFloat(p.conversionRate ?? p.ConversionRate ?? 0);
    return cu && rate > 1;
  });

  console.log(`📦 Active products: ${active.length}, có quy đổi: ${withConv.length}`);

  const reversed = withConv.filter(isReversedUnit);
  if (reversed.length === 0) {
    console.log("✅ Không phát hiện SP đảo Unit/ConversionUnit");
  } else {
    console.log(`❌ ${reversed.length} SP nghi đảo đơn vị:`);
    reversed.slice(0, 15).forEach((p) => {
      console.log(`   ${p.code ?? p.Code}: Unit=${p.unit ?? p.Unit}, Conv=${p.conversionUnit ?? p.ConversionUnit}, rate=${p.conversionRate ?? p.ConversionRate}`);
    });
  }

  // Round-trip test: base → pack/loose → base
  let roundTripFail = 0;
  const samples = withConv.slice(0, 30);
  for (const p of samples) {
    const unit = p.unit ?? p.Unit;
    const cu = p.conversionUnit ?? p.ConversionUnit;
    const rate = parseFloat(p.conversionRate ?? p.ConversionRate);
    const bases = [0, rate, rate * 2 + 100, rate * 5 + 50];
    for (const base of bases) {
      const { pack, loose } = fromBaseQtyDual(base, rate);
      const back = toBaseQtyDual(pack, loose, rate);
      if (Math.abs(back - base) > 0.001) {
        console.log(`❌ Round-trip fail ${p.code ?? p.Code}: ${base} → ${pack}+${loose} → ${back}`);
        roundTripFail++;
      }
    }
  }
  if (roundTripFail === 0) console.log(`✅ Round-trip OK (${samples.length} SP × 4 giá trị)`);

  // Stock store 1
  try {
    const stockRes = await fetch(`${baseUrl}/api/warehouse/stock?storeId=1`, { headers });
    if (stockRes.ok) {
      const stock = await stockRes.json();
      console.log(`✅ GET warehouse/stock storeId=1: ${stock.length} dòng`);
      // 3 SP có quy đổi + tồn > 0
      const withStock = stock.filter((s) => (s.quantity ?? s.Quantity) > 0).slice(0, 5);
      for (const s of withStock) {
        const pid = s.productId ?? s.ProductId;
        const prod = active.find((p) => (p.id ?? p.Id) === pid);
        if (!prod) continue;
        const cu = prod.conversionUnit ?? prod.ConversionUnit;
        const rate = parseFloat(prod.conversionRate ?? prod.ConversionRate ?? 0);
        if (!cu || rate <= 1) continue;
        const qty = parseFloat(s.quantity ?? s.Quantity);
        const unit = prod.unit ?? prod.Unit;
        console.log(`   ${prod.code ?? prod.Code}: tồn ${formatDualDisplay(qty, unit, cu, rate)} (base=${qty} ${cu})`);
      }
    }
  } catch (_) {}

  return reversed.length === 0 && roundTripFail === 0;
}

// ── Main ───────────────────────────────────────────────────────────────────
const mathOk = runMathTests();

if (BASE_URL) {
  runApiTests(BASE_URL.replace(/\/$/, "")).then((apiOk) => {
    process.exit(mathOk && apiOk ? 0 : 1);
  });
} else {
  console.log("\n💡 Chạy thêm với API: node scripts/test-eod-unit-conversion.mjs --api http://localhost:5001");
  process.exit(mathOk ? 0 : 1);
}
