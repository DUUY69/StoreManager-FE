import { buildDriver, quitDriver, open, waitForText, getDriver } from "./driver.js";
import { By } from "selenium-webdriver";
import { expect } from "chai";

describe("Login", function () {
  before(async function () {
    await buildDriver();
  });

  after(async function () {
    await quitDriver();
  });

  it("mở trang đăng nhập và thấy tiêu đề Đăng nhập", async function () {
    await open("/auth/sign-in");
    await waitForText("Đăng nhập");
    const driver = getDriver();
    const heading = await driver.findElement(By.xpath("//*[contains(text(),'Đăng nhập')]"));
    expect(await heading.isDisplayed()).to.be.true;
  });

  it("đăng nhập với user mặc định (Admin) và chuyển đến Dashboard", async function () {
    await open("/auth/sign-in");
    await waitForText("Đăng nhập");
    const driver = getDriver();
    const btn = await driver.findElement(By.css('[data-testid="login-submit"]'));
    await btn.click();
    await waitForText("Dashboard");
    const url = await driver.getCurrentUrl();
    expect(url).to.include("/dashboard");
  });
});
