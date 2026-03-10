import { buildDriver, quitDriver, getDriver, clickByText, waitForText, open } from "./driver.js";
import { By } from "selenium-webdriver";
import { expect } from "chai";
import { loginAsAdmin, goToMenu } from "./helpers.js";

describe("Đơn hàng", function () {
  before(async function () {
    await buildDriver();
    await loginAsAdmin();
  });

  after(async function () {
    await quitDriver();
  });

  it("mở Tạo đơn và thấy form tạo đơn", async function () {
    await goToMenu("Tạo đơn");
    await waitForText("Tạo đơn hàng");
    const driver = getDriver();
    expect(await driver.findElement(By.xpath("//*[contains(text(),'Tạo đơn hàng')]")).isDisplayed()).to.be.true;
  });

  it("mở Danh sách đơn và thấy danh sách hoặc bảng", async function () {
    await goToMenu("Danh sách đơn");
    await getDriver().sleep(500);
    const driver = getDriver();
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    expect(text).to.match(/Đơn hàng|Danh sách|Mã đơn|Trạng thái/);
  });

  it("click vào đơn đầu tiên mở chi tiết đơn (nếu có đơn)", async function () {
    await goToMenu("Danh sách đơn");
    await getDriver().sleep(800);
    const driver = getDriver();
    const links = await driver.findElements(By.css('a[href*="/dashboard/orders/"]'));
    if (links.length > 0) {
      await links[0].click();
      await driver.sleep(500);
      const url = await driver.getCurrentUrl();
      expect(url).to.include("/dashboard/orders/");
    }
  });
});
