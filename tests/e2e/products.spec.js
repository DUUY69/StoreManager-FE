import { buildDriver, quitDriver, getDriver, clickByText, waitForText } from "./driver.js";
import { By } from "selenium-webdriver";
import { expect } from "chai";
import { loginAsAdmin, goToMenu } from "./helpers.js";

describe("Quản lý Sản phẩm", function () {
  before(async function () {
    await buildDriver();
    await loginAsAdmin();
    await goToMenu("Sản phẩm");
  });

  after(async function () {
    await quitDriver();
  });

  it("mở trang và thấy tiêu đề Quản lý Sản phẩm", async function () {
    await waitForText("Quản lý Sản phẩm");
    const driver = getDriver();
    expect(await driver.findElement(By.xpath("//*[contains(text(),'Quản lý Sản phẩm')]")).isDisplayed()).to.be.true;
  });

  it("có bộ lọc và nút Thêm", async function () {
    const driver = getDriver();
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    expect(text).to.include("Bộ lọc");
    const btn = await driver.findElement(By.xpath("//button[contains(.,'Thêm')]"));
    expect(await btn.isDisplayed()).to.be.true;
  });
});
