import { By } from "selenium-webdriver";
import { getDriver, open, clickByText, waitForText } from "./driver.js";

const LOGIN_URL = "/auth/sign-in";

/** Đăng nhập với user mặc định (Admin) - mode demo: chỉ cần click Đăng nhập */
export async function loginAsAdmin() {
  const driver = getDriver();
  await open(LOGIN_URL);
  await waitForText("Đăng nhập");
  const btn = await driver.findElement(By.css('[data-testid="login-submit"]'));
  await btn.click();
  await waitForText("Dashboard");
}

/** Đăng nhập với role khác: mở dropdown User, chọn option có text chứa roleName rồi click Đăng nhập */
export async function loginAs(roleName) {
  const driver = getDriver();
  await open(LOGIN_URL);
  await waitForText("Chọn tài khoản demo");
  const buttons = await driver.findElements(By.css("form button"));
  if (buttons.length >= 1) await buttons[0].click();
  await driver.sleep(400);
  const option = await driver.findElement(By.xpath(`//li[contains(.,'${roleName}')]`));
  await option.click();
  await driver.sleep(200);
  const btn = await driver.findElement(By.css('[data-testid="login-submit"]'));
  await btn.click();
  await waitForText("Dashboard");
}

/** Click link trong menu sidebar theo text (tên trang) */
export async function goToMenu(menuText) {
  await clickByText(menuText, "a");
}
