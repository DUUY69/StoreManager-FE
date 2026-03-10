/**
 * Log mỗi lần gọi API — dùng cho cửa sổ "Hành động CRUD" để dễ nhận biết có gọi API hay lỗi.
 */
const MAX_ENTRIES = 50;
let entries = [];
let nextId = 1;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

export function addLog(entry) {
  const id = nextId++;
  const record = {
    id,
    time: new Date().toLocaleTimeString("vi-VN"),
    key: entry.key ?? "",
    method: entry.method ?? "",
    path: entry.path ?? "",
    status: entry.status ?? "sending",
    statusCode: entry.statusCode,
    message: entry.message,
    ...entry,
  };
  entries.unshift(record);
  if (entries.length > MAX_ENTRIES) entries.pop();
  notify();
  return id;
}

export function updateLog(id, updates) {
  const i = entries.findIndex((e) => e.id === id);
  if (i === -1) return;
  entries[i] = { ...entries[i], ...updates };
  notify();
}

export function getEntries() {
  return [...entries];
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clearLog() {
  entries = [];
  notify();
}
