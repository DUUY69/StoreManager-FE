/**
 * Cấu hình E2E Selenium
 * Chạy app: npm run dev (port 5173) hoặc npm run preview (port 4173)
 */
export const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5173";
export const IMPLICIT_WAIT_MS = 8000;
export const PAGE_LOAD_TIMEOUT_MS = 15000;
