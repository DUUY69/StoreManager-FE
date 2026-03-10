import { buildDriver, quitDriver, getDriver, clickByText, waitForText } from "./driver.js";
import { By } from "selenium-webdriver";
import { expect } from "chai";
import { loginAsAdmin, goToMenu } from "./helpers.js";

describe("Quản lý User", function () {
  before(async function () {
    await buildDriver();
    await loginAsAdmin();
    await goToMenu("User");
  });

  after(async function () {
    await quitDriver();
  });

  it("mở trang và thấy tiêu đề Quản lý User", async function () {
    await waitForText("Quản lý User");
    const driver = getDriver();
    expect(await driver.findElement(By.xpath("//*[contains(text(),'Quản lý User')]")).isDisplayed()).to.be.true;
  });

  it("có nút Thêm", async function () {
    const driver = getDriver();
    const btn = await driver.findElement(By.xpath("//button[contains(.,'Thêm')]"));
    expect(await btn.isDisplayed()).to.be.true;
  });
});
