import { buildDriver, quitDriver, getDriver, waitForText } from "./driver.js";
import { By } from "selenium-webdriver";
import { expect } from "chai";
import { loginAs } from "./helpers.js";

describe("Đơn cần xử lý (NCC)", function () {
  before(async function () {
    await buildDriver();
    await loginAs("SupplierUser");
  });

  after(async function () {
    await quitDriver();
  });

  it("sau khi đăng nhập NCC thấy menu Đơn cần xử lý", async function () {
    await waitForText("Dashboard");
    const driver = getDriver();
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    expect(text).to.include("Đơn cần xử lý");
  });

  it("mở Đơn cần xử lý và thấy danh sách hoặc thông báo", async function () {
    const driver = getDriver();
    const link = await driver.findElement(By.xpath("//a[contains(.,'Đơn cần xử lý')]"));
    await link.click();
    await driver.sleep(600);
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    expect(text).to.match(/Đơn|NCC|Trạng thái|Pending|Chưa có/);
  });
});
