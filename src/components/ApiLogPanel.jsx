import React, { useState, useEffect, useRef } from "react";
import { Typography, Button } from "@material-tailwind/react";
import { ChevronDownIcon, ChevronUpIcon, TrashIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { getEntries, subscribe, clearLog } from "@/api/api-log";

const statusColors = {
  sending: "bg-blue-gray-100 text-blue-gray-700",
  success: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
};

const TOAST_DURATION_MS = 3500;

export function ApiLogPanel() {
  const [entries, setEntries] = useState(getEntries());
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    const unsub = subscribe(() => {
      const list = getEntries();
      setEntries(list);
      const latest = list[0];
      if (latest && (latest.status === "success" || latest.status === "error")) {
        setToast({ ...latest });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
          setToast(null);
          toastTimerRef.current = null;
        }, TOAST_DURATION_MS);
      }
    });
    return () => {
      unsub();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const hasEntries = entries.length > 0;

  return (
    <>
      {/* Cửa sổ thông báo nổi — hiện 3–4s rồi tự ẩn */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-[95] w-[320px] rounded-lg shadow-xl border border-blue-gray-200 bg-white p-3 animate-toast-in"
          style={{ animation: "toastIn 0.3s ease-out" }}
          role="alert"
        >
          <style>{`
            @keyframes toastIn {
              from { opacity: 0; transform: translateX(100%); }
              to { opacity: 1; transform: translateX(0); }
            }
            @keyframes toastOut {
              from { opacity: 1; transform: translateX(0); }
              to { opacity: 0; transform: translateX(100%); }
            }
          `}</style>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-mono text-blue-gray-600">
              {toast.method} {toast.path}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                toast.status === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
            >
              {toast.status === "success" ? "OK" : "Lỗi"}
            </span>
          </div>
          {toast.key && (
            <Typography variant="small" className="text-blue-gray-500 truncate mt-1">
              {toast.key}
            </Typography>
          )}
          {toast.statusCode != null && (
            <Typography variant="small" className="text-blue-gray-500">HTTP {toast.statusCode}</Typography>
          )}
          {toast.message && toast.status === "error" && (
            <Typography variant="small" className="text-red-600 mt-1 break-words">{toast.message}</Typography>
          )}
          <Typography variant="small" className="text-blue-gray-400 mt-1">{toast.time}</Typography>
        </div>
      )}

      {/* Nút mở log — góc trên phải */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`fixed right-4 z-[90] flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-lg border border-blue-gray-200 hover:bg-blue-gray-50 ${toast ? "top-24" : "top-4"}`}
        title="Xem log gọi API / CRUD"
      >
        <DocumentTextIcon className="w-5 h-5 text-blue-gray-600" />
        <span className="text-sm font-medium text-blue-gray-700">API Log</span>
      </button>

      {/* Cửa sổ thông báo trượt ra từ góc trên phải */}
      {open && (
        <div
          className="fixed top-14 right-4 z-[91] flex flex-col w-[360px] max-h-[340px] bg-white rounded-lg shadow-xl border border-blue-gray-200 overflow-hidden"
          style={{ animation: "slideInRight 0.25s ease-out" }}
        >
          <style>{`
            @keyframes slideInRight {
              from { opacity: 0; transform: translateX(100%); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}</style>
          <div
            className="flex items-center justify-between px-3 py-2 bg-blue-gray-50 border-b border-blue-gray-200 cursor-pointer"
            onClick={() => setCollapsed(!collapsed)}
          >
            <Typography variant="small" className="font-semibold text-blue-gray-800">
              Hành động CRUD / API {hasEntries ? `(${entries.length})` : ""}
            </Typography>
            <div className="flex items-center gap-1">
              {hasEntries && (
                <Button
                  size="sm"
                  variant="text"
                  className="p-1 min-w-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearLog();
                    setEntries([]);
                  }}
                  title="Xóa log"
                >
                  <TrashIcon className="w-4 h-4" />
                </Button>
              )}
              {collapsed ? (
                <ChevronUpIcon className="w-5 h-5 text-blue-gray-600" />
              ) : (
                <ChevronDownIcon className="w-5 h-5 text-blue-gray-600" />
              )}
            </div>
          </div>
          {!collapsed && (
            <div className="overflow-y-auto flex-1 p-2 space-y-1.5 max-h-[280px]">
              {!hasEntries ? (
                <Typography variant="small" color="gray" className="p-2 block">
                  Chưa có gọi API.
                </Typography>
              ) : (
                entries.map((e) => (
                  <div
                    key={e.id}
                    className="rounded p-2 border border-blue-gray-100 bg-white text-left"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-mono text-blue-gray-600">
                        {e.method} {e.path}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          statusColors[e.status] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {e.status === "sending" ? "Đang gọi..." : e.status === "success" ? "OK" : "Lỗi"}
                      </span>
                    </div>
                    {e.key && (
                      <Typography variant="small" className="text-blue-gray-500 truncate mt-0.5">
                        {e.key}
                      </Typography>
                    )}
                    {e.statusCode != null && (
                      <Typography variant="small" className="text-blue-gray-500">
                        HTTP {e.statusCode}
                      </Typography>
                    )}
                    {e.message && e.status === "error" && (
                      <Typography variant="small" className="text-red-600 mt-0.5 break-words">
                        {e.message}
                      </Typography>
                    )}
                    <Typography variant="small" className="text-blue-gray-400 mt-0.5">
                      {e.time}
                    </Typography>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default ApiLogPanel;
