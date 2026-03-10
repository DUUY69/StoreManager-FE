import { buildDriver, quitDriver, getDriver, waitForText } from "./driver.js";
import { By, until } from "selenium-webdriver";
import { expect } from "chai";
import { loginAsAdmin } from "./helpers.js";

describe("Navbar & Layout", function () {
  before(async function () {
    await buildDriver();
    await loginAsAdmin();
  });

  after(async function () {
    await quitDriver();
  });

  it("navbar hiển thị tên user hoặc Dashboard", async function () {
    await waitForText("Dashboard");
    const driver = getDriver();
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    expect(text).to.match(/Admin|User|Dashboard/);
  });

  it("sidebar có brand Cafe - Đặt hàng NCC", async function () {
    const driver = getDriver();
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    expect(text).to.include("Cafe");
  });

  it("mở menu user và thấy mục Đăng xuất", async function () {
    const driver = getDriver();
    const buttons = await driver.findElements(By.xpath("//button[contains(.,'Admin') or contains(.,'Cafe')]"));
    const profileBtn = buttons.length > 0 ? buttons[buttons.length - 1] : await driver.findElement(By.xpath("//button[contains(.,'Admin')]"));
    await profileBtn.click();
    await driver.sleep(1200);
    const logoutItem = await driver.wait(until.elementLocated(By.xpath("//*[contains(.,'Đăng xuất')]")), 15000);
    expect(await logoutItem.isDisplayed()).to.be.true;
  });
});
