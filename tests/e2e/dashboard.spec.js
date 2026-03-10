import { buildDriver, quitDriver, open, waitForText, getDriver, clickByText } from "./driver.js";
import { By } from "selenium-webdriver";
import { expect } from "chai";
import { loginAsAdmin } from "./helpers.js";

describe("Dashboard", function () {
  before(async function () {
    await buildDriver();
    await loginAsAdmin();
  });

  after(async function () {
    await quitDriver();
  });

  it("sau khi đăng nhập thấy Dashboard và menu", async function () {
    await waitForText("Dashboard");
    const driver = getDriver();
    const body = await driver.findElement(By.tagName("body"));
    expect(await body.getText()).to.include("Dashboard");
  });

  it("sidebar có link Nhà cung cấp (Admin)", async function () {
    const driver = getDriver();
    const link = await driver.findElement(By.xpath("//a[contains(.,'Nhà cung cấp')]"));
    expect(await link.isDisplayed()).to.be.true;
  });

  it("click Dashboard về trang home", async function () {
    await clickByText("Dashboard", "a");
    await waitForText("Dashboard");
    const driver = getDriver();
    const url = await driver.getCurrentUrl();
    expect(url).to.include("/dashboard/home");
  });
});
