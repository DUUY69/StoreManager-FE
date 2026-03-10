/**
 * API client: đọc base URL từ .env, path từ api-mapping.json.
 * Khi BE đổi API chỉ cần sửa 1 chỗ: src/config/api-mapping.json
 * Mỗi lần gọi API được ghi vào api-log để hiển thị ở cửa sổ "Hành động CRUD".
 */

import apiMapping from "@/config/api-mapping.json";
import { addLog, updateLog } from "./api-log";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const USE_API = String(import.meta.env.VITE_USE_API || "").toLowerCase() === "true";

const TOKEN_KEY = "admin_dashboard_token";

/** Lấy cấu hình endpoint theo key (dạng "auth.login", "suppliers.getById") */
function getEndpoint(key, params = {}) {
  const parts = key.split(".");
  let node = apiMapping;
  for (const p of parts) {
    node = node?.[p];
    if (node == null) return null;
  }
  if (!node.path) return null;
  let path = node.path;
  Object.entries(params).forEach(([k, v]) => {
    path = path.replace(`:${k}`, String(v));
  });
  return { method: node.method, path, desc: node.desc };
}

/** Build URL đầy đủ (base + path + query string) */
function buildUrl(path, query = {}) {
  const url = new URL(path, BASE_URL);
  Object.entries(query).forEach(([k, v]) => {
    if (v != null && v !== "") url.searchParams.set(k, v);
  });
  return url.toString();
}

/** Gọi API theo key. options: { params, query, body, token, headers, formData } */
export async function request(key, options = {}) {
  if (!USE_API || !BASE_URL) {
    const msg = "API chưa bật hoặc thiếu VITE_API_BASE_URL. Đặt VITE_USE_API=true và VITE_API_BASE_URL trong .env";
    addLog({ key, method: "—", path: "—", status: "error", message: msg });
    return Promise.reject(new Error(msg));
  }
  const { params = {}, query = {}, body, token, headers = {}, formData } = options;
  const endpoint = getEndpoint(key, params);
  if (!endpoint) {
    addLog({ key, method: "—", path: "—", status: "error", message: `API key không tồn tại: ${key}` });
    return Promise.reject(new Error(`API key không tồn tại: ${key}`));
  }

  const url = buildUrl(endpoint.path, query);
  const logId = addLog({
    key,
    method: endpoint.method,
    path: endpoint.path,
    url,
    status: "sending",
  });

  const reqHeaders = { ...headers };
  if (!formData) reqHeaders["Content-Type"] = "application/json";
  const t = token ?? localStorage.getItem(TOKEN_KEY);
  if (t) reqHeaders["Authorization"] = `Bearer ${t}`;

  const config = { method: endpoint.method, headers: reqHeaders };
  if (body != null && !formData) config.body = JSON.stringify(body);
  if (formData) {
    delete reqHeaders["Content-Type"];
    config.body = formData;
  }

  try {
    const res = await fetch(url, config);
    if (!res.ok) {
      if (res.status === 401) {
        try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
      }
      const err = new Error(res.statusText || `HTTP ${res.status}`);
      err.status = res.status;
      err.response = res;
      try { err.data = await res.json(); } catch {}
      updateLog(logId, { status: "error", statusCode: res.status, message: err.message });
      throw err;
    }
    updateLog(logId, { status: "success", statusCode: res.status });
    if (res.status === 204) return null;
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) return res.json();
    return res.text();
  } catch (e) {
    updateLog(logId, {
      status: "error",
      statusCode: e.status,
      message: e.message || "Lỗi mạng / CORS",
    });
    throw e;
  }
}

/** Helper: GET */
export function get(key, options = {}) {
  return request(key, { ...options, method: "GET" });
}

/** Helper: POST (body) */
export function post(key, body, options = {}) {
  return request(key, { ...options, body });
}

/** Helper: PUT */
export function put(key, body, options = {}) {
  return request(key, { ...options, body });
}

/** Helper: PATCH */
export function patch(key, body, options = {}) {
  return request(key, { ...options, body });
}

/** Helper: DELETE */
export function del(key, options = {}) {
  return request(key, options);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export { USE_API, BASE_URL, getEndpoint };
export default { request, get, post, put, patch, del, getToken, setToken, USE_API, BASE_URL, getEndpoint };
