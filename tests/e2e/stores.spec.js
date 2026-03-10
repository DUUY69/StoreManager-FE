import { buildDriver, quitDriver, getDriver, clickByText, waitForText } from "./driver.js";
import { By } from "selenium-webdriver";
import { expect } from "chai";
import { loginAsAdmin, goToMenu } from "./helpers.js";

describe("Quản lý Cửa hàng", function () {
  before(async function () {
    await buildDriver();
    await loginAsAdmin();
    await goToMenu("Cửa hàng");
  });

  after(async function () {
    await quitDriver();
  });

  it("mở trang và thấy tiêu đề Quản lý Cửa hàng", async function () {
    await waitForText("Quản lý Cửa hàng");
    const driver = getDriver();
    expect(await driver.findElement(By.xpath("//*[contains(text(),'Quản lý Cửa hàng')]")).isDisplayed()).to.be.true;
  });

  it("có nút Thêm", async function () {
    const driver = getDriver();
    const btn = await driver.findElement(By.xpath("//button[contains(.,'Thêm')]"));
    expect(await btn.isDisplayed()).to.be.true;
  });
});
