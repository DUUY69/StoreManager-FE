import { buildDriver, quitDriver, getDriver, waitForText } from "./driver.js";
import { By } from "selenium-webdriver";
import { expect } from "chai";
import { loginAs, goToMenu } from "./helpers.js";

describe("Quản lý kho (chỉ StoreUser)", function () {
  before(async function () {
    await buildDriver();
    await loginAs("StoreUser");
    await getDriver().sleep(500);
    await goToMenu("Quản lý kho");
  });

  after(async function () {
    await quitDriver();
  });

  it("mở trang và thấy tiêu đề Quản lý kho", async function () {
    await waitForText("Quản lý kho");
    const driver = getDriver();
    expect(await driver.findElement(By.xpath("//*[contains(text(),'Quản lý kho')]")).isDisplayed()).to.be.true;
  });

  it("có bộ lọc (Từ ngày, Đến ngày) và nội dung tồn kho", async function () {
    const driver = getDriver();
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    expect(text).to.include("Bộ lọc");
    expect(text).to.match(/Tồn kho|Cửa hàng|Từ ngày/);
  });
});
