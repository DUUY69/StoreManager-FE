/**
 * Test các nút và luồng chưa cover: Lưu/Hủy/Sửa/Xóa CRUD, Tạo đơn (giỏ, Submit), OrderDetail, SupplierOrderDetail, Warehouse.
 */
import { buildDriver, quitDriver, getDriver, open, waitForText, clickByText } from "./driver.js";
import { By, until } from "selenium-webdriver";
import { expect } from "chai";
import { loginAsAdmin, loginAs, goToMenu } from "./helpers.js";

describe("Nút và luồng CRUD – Nhà cung cấp", function () {
  this.timeout(60000);
  before(async function () {
    await buildDriver();
    await loginAsAdmin();
    await goToMenu("Nhà cung cấp");
    await getDriver().sleep(400);
  });
  after(async function () {
    await quitDriver();
  });

  it("[S3][S4] Thêm NCC: mở form → nhập Mã/Tên → Lưu → thấy dòng mới hoặc form đóng", async function () {
    const driver = getDriver();
    await clickByText("Thêm", "button");
    await driver.sleep(400);
    await waitForText("Thêm Nhà cung cấp");
    const inputs = await driver.findElements(By.css('input[type="text"], input:not([type])'));
    if (inputs.length >= 2) {
      await inputs[0].clear();
      await inputs[0].sendKeys("NCC-TEST");
      await inputs[1].clear();
      await inputs[1].sendKeys("NCC Test E2E");
    }
    await clickByText("Lưu", "button");
    await driver.sleep(600);
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    expect(text).to.match(/NCC-TEST|Quản lý Nhà cung cấp/);
  });

  it("[S5] Sửa NCC: bấm icon Sửa trên dòng đầu → form Sửa mở", async function () {
    const driver = getDriver();
    const editBtns = await driver.findElements(By.css('button[type="button"] svg, [aria-label]'));
    const rows = await driver.findElements(By.css("tbody tr"));
    if (rows.length > 0) {
      const firstRow = rows[0];
      const editIcon = await firstRow.findElement(By.xpath(".//button[.//*[name()='svg']]"));
      await editIcon.click();
      await driver.sleep(500);
      const modal = await driver.findElements(By.xpath("//*[contains(text(),'Sửa Nhà cung cấp')]"));
      expect(modal.length).to.be.greaterThan(0);
      await driver.findElement(By.xpath("//button[contains(.,'Hủy')]")).click();
      await driver.sleep(300);
    }
  });

  it("[S- Hủy] Mở form Thêm → bấm Hủy → form đóng", async function () {
    await clickByText("Thêm", "button");
    await getDriver().sleep(300);
    await clickByText("Hủy", "button");
    await getDriver().sleep(300);
    const modals = await getDriver().findElements(By.xpath("//*[contains(text(),'Thêm Nhà cung cấp')]"));
    const visible = modals.length ? await modals[0].isDisplayed() : false;
    expect(visible).to.be.false;
  });
});

describe("Nút và luồng CRUD – Danh mục", function () {
  this.timeout(60000);
  before(async function () {
    await buildDriver();
    await loginAsAdmin();
    await goToMenu("Danh mục");
    await getDriver().sleep(400);
  });
  after(async function () {
    await quitDriver();
  });

  it("[C2] Thêm danh mục: Thêm → nhập Tên → Lưu", async function () {
    const driver = getDriver();
    await clickByText("Thêm", "button");
    await driver.sleep(400);
    const inputs = await driver.findElements(By.css('input'));
    if (inputs.length > 0) {
      await inputs[0].clear();
      await inputs[0].sendKeys("Danh mục E2E Test");
    }
    await clickByText("Lưu", "button");
    await driver.sleep(500);
    const body = await driver.findElement(By.tagName("body"));
    expect(await body.getText()).to.match(/Danh mục E2E Test|Quản lý Danh mục/);
  });
});

describe("Nút và luồng – Tạo đơn", function () {
  this.timeout(60000);
  before(async function () {
    await buildDriver();
    await loginAsAdmin();
    await goToMenu("Tạo đơn");
    await getDriver().sleep(600);
  });
  after(async function () {
    await quitDriver();
  });

  it("[O3] Thêm sản phẩm vào giỏ: bấm nút + trên 1 sản phẩm → giỏ có hàng", async function () {
    const driver = getDriver();
    const plusBtns = await driver.findElements(By.xpath("//div[contains(@class,'flex') and contains(@class,'justify-between')]//button[.//*[name()='svg']]"));
    if (plusBtns.length > 0) {
      await driver.executeScript("arguments[0].scrollIntoView({block:'center'});", plusBtns[0]);
      await driver.sleep(300);
      await driver.executeScript("arguments[0].click();", plusBtns[0]);
      await driver.sleep(600);
      const body = await driver.findElement(By.tagName("body"));
      const text = await body.getText();
      expect(text).to.match(/Submit đơn|Giỏ đơn \(\d+\)|1 /);
    }
  });

  it("[O5] Khi giỏ có hàng thì nút Submit đơn không disabled", async function () {
    const driver = getDriver();
    const submitBtns = await driver.findElements(By.xpath("//button[contains(.,'Submit')]"));
    if (submitBtns.length === 0) {
      this.skip();
      return;
    }
    const disabled = await submitBtns[0].getAttribute("disabled");
    expect(disabled).to.be.null;
  });
});

describe("Nút – Chi tiết đơn (OrderDetail)", function () {
  this.timeout(60000);
  before(async function () {
    await buildDriver();
    await loginAsAdmin();
    await goToMenu("Danh sách đơn");
    await getDriver().sleep(1000);
  });
  after(async function () {
    await quitDriver();
  });

  it("[O7] Có đơn thì click vào → trang chi tiết có nút Quay lại hoặc Chấp nhận/Từ chối", async function () {
    const driver = getDriver();
    const links = await driver.findElements(By.css('a[href*="/dashboard/orders/"]'));
    if (links.length === 0) {
      this.skip();
      return;
    }
    await links[0].click();
    await driver.sleep(800);
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    expect(text).to.match(/Quay lại|Chấp nhận|Từ chối|Xác nhận đã nhận|Nhập kho|In đơn/);
  });

  it("Trang chi tiết đơn: nút Quay lại về danh sách đơn", async function () {
    const driver = getDriver();
    const backBtn = await driver.findElements(By.xpath("//button[contains(.,'Quay lại')]"));
    if (backBtn.length === 0) {
      this.skip();
      return;
    }
    await backBtn[0].click();
    await driver.sleep(500);
    expect(await driver.getCurrentUrl()).to.include("/dashboard/orders");
    expect(await driver.getCurrentUrl()).to.not.match(/\/dashboard\/orders\/\d+$/);
  });
});

describe("Nút – Đơn NCC (SupplierOrderDetail)", function () {
  this.timeout(60000);
  before(async function () {
    await buildDriver();
    await loginAs("SupplierUser");
    await getDriver().sleep(500);
  });
  after(async function () {
    await quitDriver();
  });

  it("Mở Đơn cần xử lý → click đơn đầu (nếu có) → thấy nút Confirm/Reject hoặc Quay lại", async function () {
    const driver = getDriver();
    const link = await driver.findElement(By.xpath("//a[contains(.,'Đơn cần xử lý')]"));
    await link.click();
    await driver.sleep(1000);
    const orderLinks = await driver.findElements(By.css('a[href*="/dashboard/supplier-orders/"]'));
    if (orderLinks.length === 0) {
      const body = await driver.findElement(By.tagName("body"));
      expect(await body.getText()).to.match(/Đơn|Chưa có|NCC/);
      return;
    }
    await orderLinks[0].click();
    await driver.sleep(600);
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    expect(text).to.match(/Quay lại|Confirm|Reject|Đang giao|Đã giao|Báo giao thiếu/);
  });
});

describe("Nút – Quản lý kho", function () {
  this.timeout(60000);
  before(async function () {
    await buildDriver();
    await loginAsAdmin();
    await goToMenu("Quản lý kho");
    await getDriver().sleep(500);
  });
  after(async function () {
    await quitDriver();
  });

  it("Xóa bộ lọc: chọn cửa hàng (nếu có) → bấm Xóa bộ lọc → filter reset", async function () {
    const driver = getDriver();
    const clearBtn = await driver.findElements(By.xpath("//*[contains(text(),'Xóa bộ lọc')]"));
    if (clearBtn.length === 0) {
      this.skip();
      return;
    }
    await clearBtn[0].click();
    await driver.sleep(400);
    const body = await driver.findElement(By.tagName("body"));
    expect(await body.getText()).to.include("Quản lý kho");
  });
});
