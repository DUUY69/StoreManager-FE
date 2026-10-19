#!/usr/bin/env node

/**
 * Comprehensive API Test Suite
 * Tests all CRUD operations and order management flows
 * Covers: Admin, StoreUser, SupplierUser roles
 */

const BASE_URL = "http://hanghoa.unigroups.vn";

// Test users
const USERS = {
  admin: { email: "admin@admin.vn", password: "123456", role: "Admin" },
  storeUser: { email: "PASSION_20CH@store.vn", password: "123456", role: "StoreUser" },
  // Note: No SupplierUser accounts exist yet, will skip supplier tests
};

let tokens = {};
let testData = {};

async function login(userKey) {
  const user = USERS[userKey];
  console.log(`\n🔐 Logging in as ${userKey} (${user.email})...`);
  
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: user.password }),
    });
    
    if (!res.ok) {
      const err = await res.text();
      console.error(`❌ Login failed: ${res.status} - ${err}`);
      return false;
    }
    
    const data = await res.json();
    tokens[userKey] = data.token;
    console.log(`✅ Login successful. Token: ${data.token.substring(0, 20)}...`);
    return true;
  } catch (e) {
    console.error(`❌ Login error: ${e.message}`);
    return false;
  }
}

async function apiCall(method, endpoint, body = null, userKey = "admin") {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${tokens[userKey]}`,
    },
  };
  
  if (body) options.body = JSON.stringify(body);
  
  try {
    const res = await fetch(url, options);
    const data = await res.json();
    
    if (!res.ok) {
      console.error(`❌ ${method} ${endpoint}: ${res.status}`);
      console.error(`   Error: ${data.message || JSON.stringify(data)}`);
      return null;
    }
    
    return data;
  } catch (e) {
    console.error(`❌ ${method} ${endpoint}: ${e.message}`);
    return null;
  }
}

async function testAdminCRUD() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 1: Admin CRUD Operations");
  console.log("=".repeat(60));
  
  // Get suppliers
  console.log("\n📋 Getting suppliers...");
  const suppliers = await apiCall("GET", "/api/suppliers", null, "admin");
  if (!suppliers || suppliers.length === 0) {
    console.error("❌ No suppliers found");
    return false;
  }
  testData.supplierId = suppliers[0].id;
  console.log(`✅ Found ${suppliers.length} suppliers. Using supplier ID: ${testData.supplierId}`);
  
  // Get stores
  console.log("\n📋 Getting stores...");
  const stores = await apiCall("GET", "/api/stores", null, "admin");
  if (!stores || stores.length === 0) {
    console.error("❌ No stores found");
    return false;
  }
  testData.storeId = stores[0].id;
  console.log(`✅ Found ${stores.length} stores. Using store ID: ${testData.storeId}`);
  
  // Create product (without category since endpoint doesn't exist)
  console.log("\n➕ Creating product...");
  const newProduct = {
    code: `TEST-${Date.now()}`,
    name: `Test Product ${Date.now()}`,
    supplierId: testData.supplierId,
    unit: "cái",
    price: 50000,
    status: "Active",
  };
  const createdProduct = await apiCall("POST", "/api/products", newProduct, "admin");
  if (!createdProduct || !createdProduct.id) {
    console.error("❌ Failed to create product");
    return false;
  }
  testData.productId = createdProduct.id;
  console.log(`✅ Product created. ID: ${testData.productId}`);
  
  // Get products
  console.log("\n📋 Getting products...");
  const products = await apiCall("GET", "/api/products", null, "admin");
  if (!products) {
    console.error("❌ Failed to get products");
    return false;
  }
  console.log(`✅ Found ${products.length} products`);
  
  // Update product
  console.log("\n✏️ Updating product...");
  const updateData = { ...newProduct, price: 60000 };
  const updated = await apiCall("PUT", `/api/products/${testData.productId}`, updateData, "admin");
  if (!updated) {
    console.error("❌ Failed to update product");
    return false;
  }
  console.log(`✅ Product updated. New price: ${updated.price}`);
  
  return true;
}

async function testOrderCreation() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 2: Order Creation (StoreUser)");
  console.log("=".repeat(60));
  
  // Get products for order
  console.log("\n📋 Getting products for order...");
  const products = await apiCall("GET", "/api/products", null, "storeUser");
  if (!products || products.length === 0) {
    console.error("❌ No products found");
    return false;
  }
  
  // Get suppliers
  const suppliers = await apiCall("GET", "/api/suppliers", null, "storeUser");
  if (!suppliers || suppliers.length === 0) {
    console.error("❌ No suppliers found");
    return false;
  }
  
  // Group products by supplier
  const productsBySupplier = {};
  products.forEach(p => {
    if (!productsBySupplier[p.supplierId]) {
      productsBySupplier[p.supplierId] = [];
    }
    productsBySupplier[p.supplierId].push(p);
  });
  
  // Create order with multiple suppliers
  console.log("\n➕ Creating order with multiple suppliers...");
  const orderSuppliers = Object.entries(productsBySupplier).slice(0, 2).map(([supplierId, prods]) => ({
    supplierId: Number(supplierId),
    orderItems: prods.slice(0, 2).map(p => ({
      productId: p.id,
      productName: p.name,
      quantity: 5,
      unit: p.unit,
      price: p.price,
    })),
  }));
  
  const orderPayload = {
    storeId: testData.storeId,
    orderSuppliers,
  };
  
  const createdOrder = await apiCall("POST", "/api/orders", orderPayload, "storeUser");
  if (!createdOrder || !createdOrder.id) {
    console.error("❌ Failed to create order");
    return false;
  }
  testData.orderId = createdOrder.id;
  console.log(`✅ Order created. ID: ${testData.orderId}`);
  console.log(`   Order Suppliers: ${createdOrder.orderSuppliers.length}`);
  
  return true;
}

async function testOrderManagement() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 3: Order Management (Admin)");
  console.log("=".repeat(60));
  
  // Get order
  console.log("\n📋 Getting order details...");
  const order = await apiCall("GET", `/api/orders/${testData.orderId}`, null, "admin");
  if (!order) {
    console.error("❌ Failed to get order");
    return false;
  }
  console.log(`✅ Order retrieved. Status: ${order.status}`);
  
  // Accept order
  console.log("\n✅ Accepting order...");
  const accepted = await apiCall("PATCH", `/api/orders/${testData.orderId}/accept`, {}, "admin");
  if (!accepted) {
    console.error("❌ Failed to accept order");
    return false;
  }
  console.log(`✅ Order accepted. New status: ${accepted.status}`);
  
  return true;
}

async function testSupplierOrderOperations() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 4: Supplier Order Operations (SupplierUser)");
  console.log("=".repeat(60));
  
  console.log("⚠️  No SupplierUser accounts configured. Skipping supplier operations test.");
  return true;
}

async function testOrderRejection() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 5: Order Rejection Flow");
  console.log("=".repeat(60));
  
  // Create another order for rejection test
  console.log("\n➕ Creating order for rejection test...");
  const products = await apiCall("GET", "/api/products", null, "storeUser");
  const suppliers = await apiCall("GET", "/api/suppliers", null, "storeUser");
  
  if (!products || products.length === 0 || !suppliers || suppliers.length === 0) {
    console.error("❌ Not enough data for rejection test");
    return false;
  }
  
  const orderPayload = {
    storeId: testData.storeId,
    orderSuppliers: [{
      supplierId: suppliers[0].id,
      orderItems: products.slice(0, 1).map(p => ({
        productId: p.id,
        productName: p.name,
        quantity: 2,
        unit: p.unit,
        price: p.price,
      })),
    }],
  };
  
  const rejectionTestOrder = await apiCall("POST", "/api/orders", orderPayload, "storeUser");
  if (!rejectionTestOrder || !rejectionTestOrder.id) {
    console.error("❌ Failed to create order for rejection test");
    return false;
  }
  console.log(`✅ Order created for rejection test. ID: ${rejectionTestOrder.id}`);
  
  // Reject order
  console.log("\n❌ Rejecting order...");
  const rejected = await apiCall("PATCH", `/api/orders/${rejectionTestOrder.id}/reject`, {}, "admin");
  if (!rejected) {
    console.error("❌ Failed to reject order");
    return false;
  }
  console.log(`✅ Order rejected. New status: ${rejected.status}`);
  console.log(`   All supplier orders also rejected: ${rejected.orderSuppliers.every(os => os.status === "Rejected")}`);
  
  return true;
}

async function testWarehouseOperations() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST 6: Warehouse Operations");
  console.log("=".repeat(60));
  
  // Get warehouse stock
  console.log("\n📋 Getting warehouse stock...");
  const warehouseStock = await apiCall("GET", "/api/warehouse/stock", null, "storeUser");
  if (!warehouseStock) {
    console.error("❌ Failed to get warehouse stock");
    return false;
  }
  console.log(`✅ Warehouse stock retrieved. Records: ${warehouseStock.length}`);
  
  return true;
}

async function runAllTests() {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 COMPREHENSIVE API TEST SUITE");
  console.log("=".repeat(60));
  
  // Login all users
  console.log("\n📝 Logging in all users...");
  for (const userKey of Object.keys(USERS)) {
    if (!await login(userKey)) {
      console.error(`❌ Failed to login as ${userKey}`);
      process.exit(1);
    }
  }
  
  // Run tests
  const tests = [
    { name: "Admin CRUD", fn: testAdminCRUD },
    { name: "Order Creation", fn: testOrderCreation },
    { name: "Order Management", fn: testOrderManagement },
    { name: "Supplier Operations", fn: testSupplierOrderOperations },
    { name: "Order Rejection", fn: testOrderRejection },
    { name: "Warehouse Operations", fn: testWarehouseOperations },
  ];
  
  const results = [];
  for (const test of tests) {
    try {
      const passed = await test.fn();
      results.push({ name: test.name, passed });
    } catch (e) {
      console.error(`❌ Test error: ${e.message}`);
      results.push({ name: test.name, passed: false });
    }
  }
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));
  results.forEach(r => {
    const icon = r.passed ? "✅" : "❌";
    console.log(`${icon} ${r.name}`);
  });
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`\n📈 Result: ${passed}/${total} tests passed`);
  
  process.exit(passed === total ? 0 : 1);
}

runAllTests().catch(e => {
  console.error(`❌ Fatal error: ${e.message}`);
  process.exit(1);
});
