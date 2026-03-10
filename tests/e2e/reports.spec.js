import { buildDriver, quitDriver, getDriver, waitForText } from "./driver.js";
import { By } from "selenium-webdriver";
import { expect } from "chai";
import { loginAsAdmin, goToMenu } from "./helpers.js";

describe("Báo cáo", function () {
  before(async function () {
    await buildDriver();
    await loginAsAdmin();
    await goToMenu("Báo cáo");
  });

  after(async function () {
    await quitDriver();
  });

  it("mở trang báo cáo và thấy nội dung", async function () {
    await getDriver().sleep(500);
    const driver = getDriver();
    const body = await driver.findElement(By.tagName("body"));
    const text = await body.getText();
    expect(text).to.match(/Báo cáo|Thống kê|đơn|NCC/);
  });
});
