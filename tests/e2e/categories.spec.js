import { buildDriver, quitDriver, getDriver, clickByText, waitForText } from "./driver.js";
import { By } from "selenium-webdriver";
import { expect } from "chai";
import { loginAsAdmin, goToMenu } from "./helpers.js";

describe("Quản lý Danh mục", function () {
  before(async function () {
    await buildDriver();
    await loginAsAdmin();
    await goToMenu("Danh mục");
  });

  after(async function () {
    await quitDriver();
  });

  it("mở trang và thấy tiêu đề Quản lý Danh mục", async function () {
    await waitForText("Quản lý Danh mục");
    const driver = getDriver();
    expect(await driver.findElement(By.xpath("//*[contains(text(),'Quản lý Danh mục')]")).isDisplayed()).to.be.true;
  });

  it("có nút Thêm và bảng danh mục", async function () {
    const driver = getDriver();
    const btn = await driver.findElement(By.xpath("//button[contains(.,'Thêm')]"));
    expect(await btn.isDisplayed()).to.be.true;
    await clickByText("Thêm", "button");
    await waitForText("Thêm Danh mục");
  });
});
