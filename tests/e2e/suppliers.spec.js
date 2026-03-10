import { buildDriver, quitDriver, getDriver, clickByText, waitForText } from "./driver.js";
import { By } from "selenium-webdriver";
import { expect } from "chai";
import { loginAsAdmin, goToMenu } from "./helpers.js";

describe("Quản lý Nhà cung cấp", function () {
  before(async function () {
    await buildDriver();
    await loginAsAdmin();
    await goToMenu("Nhà cung cấp");
  });

  after(async function () {
    await quitDriver();
  });

  it("mở trang và thấy tiêu đề Quản lý Nhà cung cấp", async function () {
    await waitForText("Quản lý Nhà cung cấp");
    const driver = getDriver();
    expect(await driver.findElement(By.xpath("//*[contains(text(),'Quản lý Nhà cung cấp')]")).isDisplayed()).to.be.true;
  });

  it("có nút Thêm", async function () {
    const driver = getDriver();
    const btn = await driver.findElement(By.xpath("//button[contains(.,'Thêm')]"));
    expect(await btn.isDisplayed()).to.be.true;
  });

  it("click Thêm mở form Thêm Nhà cung cấp", async function () {
    await clickByText("Thêm", "button");
    await waitForText("Thêm Nhà cung cấp");
    const driver = getDriver();
    expect(await driver.findElement(By.xpath("//*[contains(text(),'Thêm Nhà cung cấp')]")).isDisplayed()).to.be.true;
  });

  it("có bảng với cột Mã, Tên, Liên hệ", async function () {
    const driver = getDriver();
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    expect(text).to.include("Mã");
    expect(text).to.include("Tên");
    expect(text).to.include("Liên hệ");
  });
});
