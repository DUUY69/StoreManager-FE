import { Builder, until, By } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { BASE_URL, IMPLICIT_WAIT_MS, PAGE_LOAD_TIMEOUT_MS } from "./config.js";

let driver = null;

export async function buildDriver() {
  const options = new chrome.Options();
  if (process.env.CI || process.env.HEADLESS) {
    options.addArguments("--headless=new", "--no-sandbox", "--disable-dev-shm-usage");
  }
  driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();
  await driver.manage().setTimeouts({ implicit: IMPLICIT_WAIT_MS, pageLoad: PAGE_LOAD_TIMEOUT_MS });
  await driver.manage().window().setRect({ width: 1280, height: 800 });
  return driver;
}

export function getDriver() {
  return driver;
}

export async function quitDriver() {
  if (driver) {
    await driver.quit();
    driver = null;
  }
}

/** Mở URL (tương đối với BASE_URL) */
export async function open(path = "/") {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  await driver.get(url);
}

/** Tìm 1 element (By) */
export function el(by) {
  return driver.findElement(by);
}

/** Tìm nhiều elements */
export function els(by) {
  return driver.findElements(by);
}

/** Click element tìm bởi text (link hoặc button) */
export async function clickByText(text, tag = "*") {
  const xpath = `//${tag}[contains(text(),'${text}') or contains(.,'${text}')]`;
  const e = await driver.wait(until.elementLocated(By.xpath(xpath)), IMPLICIT_WAIT_MS);
  await e.click();
}

/** Đợi đến khi có text trên page */
export async function waitForText(text) {
  await driver.wait(until.elementLocated(By.xpath(`//*[contains(text(),'${text}')]`)), IMPLICIT_WAIT_MS);
}

/** Đợi và nhập vào input (placeholder hoặc label) */
export async function typeInLabel(labelOrPlaceholder, value) {
  const xpath = `//input[@placeholder='${labelOrPlaceholder}' or preceding::label[contains(.,'${labelOrPlaceholder}')]] | //input[following-sibling::*[contains(text(),'${labelOrPlaceholder}')]]`;
  try {
    const input = await driver.wait(until.elementLocated(By.xpath(xpath)), 5000);
    await input.clear();
    await input.sendKeys(value);
  } catch {
    const byPlaceholder = By.css(`input[placeholder*="${labelOrPlaceholder}"]`);
    const input = await driver.wait(until.elementLocated(byPlaceholder), 5000);
    await input.clear();
    await input.sendKeys(value);
  }
}

/** Chọn option trong select theo text (Material Tailwind thường dùng div/li) */
export async function selectOptionByText(optionText) {
  await clickByText(optionText, "li");
}

export { By, until };
