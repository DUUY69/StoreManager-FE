/**
 * Test theo đúng luồng nghiệp vụ – chạy tuần tự và báo kết quả.
 * Ánh xạ: A1, A2, D1–D3, S1, C1, P1, ST1, U1, O1, O6, O7, W1, R1, N1, G3.
 */
import { buildDriver, quitDriver, getDriver, open, waitForText, clickByText } from "./driver.js";
import { By, until } from "selenium-webdriver";
import { expect } from "chai";
import { loginAsAdmin, loginAs, goToMenu } from "./helpers.js";

describe("LUỒNG NGHIỆP VỤ ĐẦY ĐỦ", function () {
  this.timeout(90000);

  before(async function () {
    await buildDriver();
  });

  after(async function () {
    await quitDriver();
  });

  it("[A1] Mở trang đăng nhập – thấy form Đăng nhập", async function () {
    await open("/auth/sign-in");
    await waitForText("Đăng nhập");
    const driver = getDriver();
    expect(await driver.findElement(By.xpath("//*[contains(text(),'Đăng nhập')]")).isDisplayed()).to.be.true;
  });

  it("[A2] Đăng nhập Admin – chuyển Dashboard, thấy menu", async function () {
    const driver = getDriver();
    const btn = await driver.findElement(By.css('[data-testid="login-submit"]'));
    await btn.click();
    await waitForText("Dashboard");
    const url = await driver.getCurrentUrl();
    expect(url).to.include("/dashboard");
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    expect(text).to.match(/Dashboard|Cafe|Nhà cung cấp|Danh mục/);
  });

  it("[D1][D2] Dashboard – brand Cafe, menu đủ (Admin)", async function () {
    const driver = getDriver();
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    expect(text).to.include("Cafe");
    expect(text).to.match(/Dashboard|Nhà C|Danh mục|Sản phẩm|Danh sách|Tạo đơn/);
  });

  it("[D3] Click Dashboard → trang home", async function () {
    await clickByText("Dashboard", "a");
    await waitForText("Dashboard");
    const driver = getDriver();
    expect(await driver.getCurrentUrl()).to.include("/dashboard/home");
  });

  it("[S1] Nhà cung cấp – tiêu đề, bảng, nút Thêm", async function () {
    await goToMenu("Nhà cung cấp");
    await getDriver().sleep(500);
    await waitForText("Quản lý Nhà cung cấp");
    const driver = getDriver();
    const body = await driver.findElement(By.tagName("body"));
    const t = await body.getText();
    expect(t).to.match(/Quản lý Nhà cung cấp|Mã|Tên/);
    expect(await driver.findElement(By.xpath("//button[contains(.,'Thêm')]")).isDisplayed()).to.be.true;
  });

  it("[C1] Danh mục – tiêu đề, nút Thêm", async function () {
    await goToMenu("Danh mục");
    await waitForText("Quản lý Danh mục");
    const driver = getDriver();
    expect(await driver.findElement(By.xpath("//button[contains(.,'Thêm')]")).isDisplayed()).to.be.true;
  });

  it("[P1] Sản phẩm – tiêu đề, Bộ lọc, Thêm", async function () {
    await goToMenu("Sản phẩm");
    await waitForText("Quản lý Sản phẩm");
    const driver = getDriver();
    const body = await driver.findElement(By.tagName("body"));
    expect(await body.getText()).to.include("Bộ lọc");
    expect(await driver.findElement(By.xpath("//button[contains(.,'Thêm')]")).isDisplayed()).to.be.true;
  });

  it("[ST1] Cửa hàng – tiêu đề, Thêm", async function () {
    await goToMenu("Cửa hàng");
    await waitForText("Quản lý Cửa hàng");
    const driver = getDriver();
    expect(await driver.findElement(By.xpath("//button[contains(.,'Thêm')]")).isDisplayed()).to.be.true;
  });

  it("[U1] User – tiêu đề, Thêm", async function () {
    await goToMenu("User");
    await waitForText("Quản lý User");
    const driver = getDriver();
    expect(await driver.findElement(By.xpath("//button[contains(.,'Thêm')]")).isDisplayed()).to.be.true;
  });

  it("[O1] Tạo đơn – form, tiêu đề", async function () {
    await goToMenu("Tạo đơn");
    await waitForText("Tạo đơn hàng");
    const driver = getDriver();
    const body = await driver.findElement(By.tagName("body"));
    expect(await body.getText()).to.match(/Submit|Giỏ|sản phẩm/);
  });

  it("[O6][O7] Danh sách đơn – mở danh sách, click đơn (nếu có)", async function () {
    await goToMenu("Danh sách đơn");
    await getDriver().sleep(800);
    const driver = getDriver();
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    expect(text).to.match(/Đơn|Danh sách|Trạng thái|Mã/);
    const links = await driver.findElements(By.css('a[href*="/dashboard/orders/"]'));
    if (links.length > 0) {
      await links[0].click();
      await driver.sleep(500);
      expect(await driver.getCurrentUrl()).to.include("/dashboard/orders/");
    }
  });

  it("[W0] Admin không vào được Quản lý kho – chuyển về home", async function () {
    const driver = getDriver();
    await driver.get(new URL("/dashboard/warehouse", await driver.getCurrentUrl()).href);
    await driver.sleep(800);
    expect(await driver.getCurrentUrl()).to.match(/\/dashboard\/home$/);
  });

  it("[R1] Báo cáo – có nội dung", async function () {
    await goToMenu("Báo cáo");
    await getDriver().sleep(500);
    const driver = getDriver();
    const body = await driver.findElement(By.tagName("body"));
    expect(await body.getText()).to.match(/Báo cáo|Thống kê|đơn|NCC/);
  });

  it("[N1] Đăng nhập NCC – thấy Đơn cần xử lý", async function () {
    await open("/auth/sign-in");
    await waitForText("Chọn tài khoản demo");
    const driver = getDriver();
    const buttons = await driver.findElements(By.css("form button"));
    if (buttons.length >= 1) await buttons[0].click();
    await driver.sleep(400);
    const option = await driver.findElement(By.xpath("//li[contains(.,'SupplierUser')]"));
    await option.click();
    await driver.sleep(200);
    const btn = await driver.findElement(By.css('[data-testid="login-submit"]'));
    await btn.click();
    await waitForText("Dashboard");
    const body = await driver.findElement(By.tagName("body"));
    expect(await body.getText()).to.include("Đơn cần xử lý");
  });

  it("[G3] Menu user mở được, có mục Đăng xuất", async function () {
    const driver = getDriver();
    const profileBtn = await driver.findElement(By.xpath("//button[contains(.,'Admin') or contains(.,'User') or contains(.,'Cafe') or contains(.,'Lê') or contains(.,'Văn') or contains(.,'Cường') or contains(.,'Dung')]"));
    await profileBtn.click();
    await driver.sleep(1000);
    const logoutItem = await driver.wait(until.elementLocated(By.xpath("//*[contains(.,'Đăng xuất')]")), 12000);
    expect(await logoutItem.isDisplayed()).to.be.true;
  });
});
