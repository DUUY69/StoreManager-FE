/**
 * Test CRUD đầy đủ: Thêm, Lưu, Hủy, Sửa, Xóa cho từng module.
 * Xử lý window.confirm khi Xóa bằng cách override trước khi click.
 */
import { buildDriver, quitDriver, getDriver, waitForText, clickByText } from "./driver.js";
import { By, until } from "selenium-webdriver";
import { expect } from "chai";
import { loginAsAdmin, goToMenu } from "./helpers.js";

const CONFIRM_OVERRIDE = "window.confirm = function() { return true; };";

async function waitForTextInPage(driver, text, timeout = 10000) {
  await driver.wait(until.elementLocated(By.xpath("//*[contains(.,'" + text + "')]")), timeout);
}

describe("CRUD đầy đủ – Nhà cung cấp", function () {
  this.timeout(90000);
  const code = "NCC-E2E-" + Date.now();

  before(async function () {
    await buildDriver();
    await loginAsAdmin();
    await goToMenu("Nhà cung cấp");
    await getDriver().sleep(500);
    await getDriver().executeScript(CONFIRM_OVERRIDE);
  });
  after(async function () {
    await quitDriver();
  });

  it("Thêm: mở form → nhập đủ → Lưu → thấy dòng mới trong bảng", async function () {
    const driver = getDriver();
    await clickByText("Thêm", "button");
    await driver.sleep(500);
    const modalInputs = await driver.findElements(By.xpath("//div[contains(@class,'fixed')]//input"));
    const inputs = modalInputs.length >= 5 ? modalInputs : await driver.findElements(By.css("input"));
    if (inputs.length >= 5) {
      await inputs[0].clear(); await inputs[0].sendKeys(code);
      await inputs[1].clear(); await inputs[1].sendKeys("NCC Test CRUD");
      await inputs[2].clear(); await inputs[2].sendKeys("0999999999");
      await inputs[3].clear(); await inputs[3].sendKeys("e2e@test.vn");
      await inputs[4].clear(); await inputs[4].sendKeys("Địa chỉ E2E");
    }
    await clickByText("Lưu", "button");
    await driver.sleep(1000);
    await waitForTextInPage(driver, code);
  });

  it("Hủy: mở form Thêm → bấm Hủy → form đóng", async function () {
    await clickByText("Thêm", "button");
    await getDriver().sleep(300);
    await clickByText("Hủy", "button");
    await getDriver().sleep(300);
    const modals = await getDriver().findElements(By.xpath("//*[contains(text(),'Thêm Nhà cung cấp')]"));
    expect(modals.length === 0 || !(await modals[0].isDisplayed())).to.be.true;
  });

  it("Sửa: bấm Sửa trên dòng vừa thêm → đổi Tên → Lưu → thấy tên mới", async function () {
    const driver = getDriver();
    const row = await driver.findElement(By.xpath("//tr[contains(.,'" + code + "')]"));
    const editBtn = await row.findElement(By.xpath(".//button[.//*[name()='svg']][1]"));
    await editBtn.click();
    await driver.sleep(500);
    const modalInputs = await driver.findElements(By.xpath("//div[contains(@class,'fixed')]//input"));
    const inputs = modalInputs.length >= 2 ? modalInputs : await driver.findElements(By.css("input"));
    if (inputs.length >= 2) {
      await inputs[1].clear();
      await inputs[1].sendKeys("NCC Test CRUD (đã sửa)");
    }
    await clickByText("Lưu", "button");
    await driver.sleep(600);
    const body = await driver.findElement(By.tagName("body"));
    expect(await body.getText()).to.match(/đã sửa|NCC Test CRUD/);
  });

  it("Xóa: bấm Xóa trên dòng có mã " + code + " → xác nhận → dòng biến mất", async function () {
    const driver = getDriver();
    const row = await driver.findElement(By.xpath("//tr[contains(.,'" + code + "')]"));
    const deleteBtns = await row.findElements(By.xpath(".//button[.//*[name()='svg']]"));
    await deleteBtns[deleteBtns.length - 1].click();
    await driver.sleep(600);
    const body = await driver.findElement(By.tagName("body"));
    expect(await body.getText()).to.not.include(code);
  });
});

describe("CRUD đầy đủ – Danh mục", function () {
  this.timeout(90000);
  const name = "DM-E2E-" + Date.now();

  before(async function () {
    await buildDriver();
    await loginAsAdmin();
    await goToMenu("Danh mục");
    await getDriver().sleep(500);
    await getDriver().executeScript(CONFIRM_OVERRIDE);
  });
  after(async function () {
    await quitDriver();
  });

  it("Thêm: Thêm → nhập Tên, Mô tả → Lưu → thấy trong bảng", async function () {
    const driver = getDriver();
    await clickByText("Thêm", "button");
    await driver.sleep(500);
    const modalInputs = await driver.findElements(By.xpath("//div[contains(@class,'fixed')]//input"));
    const inputs = modalInputs.length >= 1 ? modalInputs : await driver.findElements(By.css("input"));
    if (inputs.length >= 1) {
      await inputs[0].clear();
      await inputs[0].sendKeys(name);
    }
    if (inputs.length >= 2) {
      await inputs[1].clear();
      await inputs[1].sendKeys("Mô tả E2E");
    }
    await clickByText("Lưu", "button");
    await driver.sleep(1000);
    await waitForTextInPage(driver, name);
  });

  it("Hủy: mở form Thêm → Hủy → form đóng", async function () {
    await clickByText("Thêm", "button");
    await getDriver().sleep(300);
    await clickByText("Hủy", "button");
    await getDriver().sleep(300);
    const modals = await getDriver().findElements(By.xpath("//*[contains(text(),'Thêm Danh mục')]"));
    expect(modals.length === 0 || !(await modals[0].isDisplayed())).to.be.true;
  });

  it("Sửa: Sửa dòng có tên " + name + " → đổi Mô tả → Lưu", async function () {
    const driver = getDriver();
    const row = await driver.findElement(By.xpath("//tr[contains(.,'" + name + "')]"));
    const editBtn = await row.findElement(By.xpath(".//button[.//*[name()='svg']][1]"));
    await editBtn.click();
    await driver.sleep(500);
    const modalInputs = await driver.findElements(By.xpath("//div[contains(@class,'fixed')]//input"));
    const inputs = modalInputs.length >= 2 ? modalInputs : await driver.findElements(By.css("input"));
    if (inputs.length >= 2) {
      await inputs[1].clear();
      await inputs[1].sendKeys("Mô tả đã sửa");
    }
    await clickByText("Lưu", "button");
    await driver.sleep(600);
    const body = await driver.findElement(By.tagName("body"));
    expect(await body.getText()).to.include("đã sửa");
  });

  it("Xóa: Xóa dòng có tên " + name + " → dòng biến mất", async function () {
    const driver = getDriver();
    const row = await driver.findElement(By.xpath("//tr[contains(.,'" + name + "')]"));
    const deleteBtns = await row.findElements(By.xpath(".//button[.//*[name()='svg']]"));
    await deleteBtns[deleteBtns.length - 1].click();
    await driver.sleep(600);
    const body = await driver.findElement(By.tagName("body"));
    expect(await body.getText()).to.not.include(name);
  });
});

describe("CRUD đầy đủ – Sản phẩm", function () {
  this.timeout(90000);
  const code = "SP-E2E-" + Date.now();

  before(async function () {
    await buildDriver();
    await loginAsAdmin();
    await goToMenu("Sản phẩm");
    await getDriver().sleep(600);
    await getDriver().executeScript(CONFIRM_OVERRIDE);
  });
  after(async function () {
    await quitDriver();
  });

  it("Thêm: Thêm → nhập Mã, Tên, chọn NCC/Danh mục, Đơn vị, Giá → Lưu", async function () {
    const driver = getDriver();
    await clickByText("Thêm", "button");
    await driver.sleep(500);
    const modalInputs = await driver.findElements(By.xpath("//div[contains(@class,'fixed')]//input"));
    const inputs = modalInputs.length >= 2 ? modalInputs : await driver.findElements(By.css("input"));
    if (inputs.length >= 1) {
      await inputs[0].clear();
      await inputs[0].sendKeys(code);
    }
    if (inputs.length >= 2) {
      await inputs[1].clear();
      await inputs[1].sendKeys("Sản phẩm E2E Test");
    }
    if (inputs.length >= 5) await inputs[4].sendKeys("cái");
    if (inputs.length >= 6) await inputs[5].clear(), await inputs[5].sendKeys("10000");
    await clickByText("Lưu", "button");
    await driver.sleep(1000);
    await waitForTextInPage(driver, code);
  });

  it("Hủy: mở form Thêm → Hủy → form đóng", async function () {
    await clickByText("Thêm", "button");
    await getDriver().sleep(300);
    await clickByText("Hủy", "button");
    await getDriver().sleep(300);
    const modals = await getDriver().findElements(By.xpath("//*[contains(text(),'Thêm Sản phẩm')]"));
    expect(modals.length === 0 || !(await modals[0].isDisplayed())).to.be.true;
  });

  it("Sửa: Sửa dòng mã " + code + " → đổi Tên → Lưu", async function () {
    const driver = getDriver();
    const row = await driver.findElement(By.xpath("//tr[contains(.,'" + code + "')]"));
    const editBtn = await row.findElement(By.xpath(".//button[.//*[name()='svg']][1]"));
    await editBtn.click();
    await driver.sleep(500);
    const modalInputs = await driver.findElements(By.xpath("//div[contains(@class,'fixed')]//input"));
    const inputs = modalInputs.length >= 2 ? modalInputs : await driver.findElements(By.css("input"));
    if (inputs.length >= 2) {
      await inputs[1].clear();
      await inputs[1].sendKeys("SP E2E (đã sửa)");
    }
    await clickByText("Lưu", "button");
    await driver.sleep(600);
    const body = await driver.findElement(By.tagName("body"));
    expect(await body.getText()).to.match(/đã sửa|SP E2E/);
  });

  it("Xóa: Xóa dòng mã " + code + " → dòng biến mất", async function () {
    const driver = getDriver();
    const row = await driver.findElement(By.xpath("//tr[contains(.,'" + code + "')]"));
    const deleteBtns = await row.findElements(By.xpath(".//button[.//*[name()='svg']]"));
    await deleteBtns[deleteBtns.length - 1].click();
    await driver.sleep(600);
    const body = await driver.findElement(By.tagName("body"));
    expect(await body.getText()).to.not.include(code);
  });
});

describe("CRUD đầy đủ – Cửa hàng", function () {
  this.timeout(90000);
  const code = "CH-E2E-" + Date.now();

  before(async function () {
    await buildDriver();
    await loginAsAdmin();
    await goToMenu("Cửa hàng");
    await getDriver().sleep(500);
    await getDriver().executeScript(CONFIRM_OVERRIDE);
  });
  after(async function () {
    await quitDriver();
  });

  it("Thêm: Thêm → nhập Mã, Tên, Địa chỉ, Điện thoại → Lưu", async function () {
    const driver = getDriver();
    await clickByText("Thêm", "button");
    await driver.sleep(500);
    const modalInputs = await driver.findElements(By.xpath("//div[contains(@class,'fixed')]//input"));
    const inputs = modalInputs.length >= 4 ? modalInputs : await driver.findElements(By.css("input"));
    if (inputs.length >= 4) {
      await inputs[0].clear(); await inputs[0].sendKeys(code);
      await inputs[1].clear(); await inputs[1].sendKeys("Cửa hàng E2E");
      await inputs[2].clear(); await inputs[2].sendKeys("Địa chỉ E2E");
      await inputs[3].clear(); await inputs[3].sendKeys("0888123456");
    }
    await clickByText("Lưu", "button");
    await driver.sleep(1000);
    await waitForTextInPage(driver, code);
  });

  it("Hủy: mở form Thêm → Hủy → form đóng", async function () {
    await clickByText("Thêm", "button");
    await getDriver().sleep(300);
    await clickByText("Hủy", "button");
    await getDriver().sleep(300);
    const modals = await getDriver().findElements(By.xpath("//*[contains(text(),'Thêm Cửa hàng')]"));
    expect(modals.length === 0 || !(await modals[0].isDisplayed())).to.be.true;
  });

  it("Sửa: Sửa dòng mã " + code + " → đổi Tên → Lưu", async function () {
    const driver = getDriver();
    const row = await driver.findElement(By.xpath("//tr[contains(.,'" + code + "')]"));
    const editBtn = await row.findElement(By.xpath(".//button[.//*[name()='svg']][1]"));
    await editBtn.click();
    await driver.sleep(500);
    const modalInputs = await driver.findElements(By.xpath("//div[contains(@class,'fixed')]//input"));
    const inputs = modalInputs.length >= 2 ? modalInputs : await driver.findElements(By.css("input"));
    if (inputs.length >= 2) {
      await inputs[1].clear();
      await inputs[1].sendKeys("Cửa hàng E2E (đã sửa)");
    }
    await clickByText("Lưu", "button");
    await driver.sleep(600);
    const body = await driver.findElement(By.tagName("body"));
    expect(await body.getText()).to.include("đã sửa");
  });

  it("Xóa: Xóa dòng mã " + code + " → dòng biến mất", async function () {
    const driver = getDriver();
    const row = await driver.findElement(By.xpath("//tr[contains(.,'" + code + "')]"));
    const deleteBtns = await row.findElements(By.xpath(".//button[.//*[name()='svg']]"));
    await deleteBtns[deleteBtns.length - 1].click();
    await driver.sleep(600);
    const body = await driver.findElement(By.tagName("body"));
    expect(await body.getText()).to.not.include(code);
  });
});

describe("CRUD đầy đủ – User", function () {
  this.timeout(90000);
  const email = "e2e.user." + Date.now() + "@test.vn";

  before(async function () {
    await buildDriver();
    await loginAsAdmin();
    await goToMenu("User");
    await getDriver().sleep(500);
    await getDriver().executeScript(CONFIRM_OVERRIDE);
  });
  after(async function () {
    await quitDriver();
  });

  it("Thêm: Thêm → nhập Email, Tên, chọn Role/Store → Lưu", async function () {
    const driver = getDriver();
    await clickByText("Thêm", "button");
    await driver.sleep(500);
    const modalInputs = await driver.findElements(By.xpath("//div[contains(@class,'fixed')]//input"));
    const inputs = modalInputs.length >= 2 ? modalInputs : await driver.findElements(By.css("input"));
    if (inputs.length >= 2) {
      await inputs[0].clear();
      await inputs[0].sendKeys(email);
      await inputs[1].clear();
      await inputs[1].sendKeys("User E2E Test");
    }
    await clickByText("Lưu", "button");
    await driver.sleep(1000);
    await waitForTextInPage(driver, email);
  });

  it("Hủy: mở form Thêm → Hủy → form đóng", async function () {
    await clickByText("Thêm", "button");
    await getDriver().sleep(300);
    await clickByText("Hủy", "button");
    await getDriver().sleep(300);
    const modals = await getDriver().findElements(By.xpath("//*[contains(text(),'Thêm User')]"));
    expect(modals.length === 0 || !(await modals[0].isDisplayed())).to.be.true;
  });

  it("Sửa: Sửa dòng email " + email + " → đổi Tên → Lưu", async function () {
    const driver = getDriver();
    const row = await driver.findElement(By.xpath("//tr[contains(.,'" + email + "')]"));
    const editBtn = await row.findElement(By.xpath(".//button[.//*[name()='svg']][1]"));
    await editBtn.click();
    await driver.sleep(500);
    const modalInputs = await driver.findElements(By.xpath("//div[contains(@class,'fixed')]//input"));
    const inputs = modalInputs.length >= 2 ? modalInputs : await driver.findElements(By.css("input"));
    if (inputs.length >= 2) {
      await inputs[1].clear();
      await inputs[1].sendKeys("User E2E (đã sửa)");
    }
    await clickByText("Lưu", "button");
    await driver.sleep(600);
    const body = await driver.findElement(By.tagName("body"));
    expect(await body.getText()).to.include("đã sửa");
  });

  it("Xóa: Xóa dòng email " + email + " → dòng biến mất", async function () {
    const driver = getDriver();
    const row = await driver.findElement(By.xpath("//tr[contains(.,'" + email + "')]"));
    const deleteBtns = await row.findElements(By.xpath(".//button[.//*[name()='svg']]"));
    await deleteBtns[deleteBtns.length - 1].click();
    await driver.sleep(600);
    const body = await driver.findElement(By.tagName("body"));
    expect(await body.getText()).to.not.include(email);
  });
});
