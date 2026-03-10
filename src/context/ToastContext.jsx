import React, { useState, useCallback, useRef, useEffect } from "react";

const ToastContext = React.createContext(null);

const TOAST_DURATION_MS = 4000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message, type = "info") => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, type }]);
      const timer = setTimeout(() => {
        removeToast(id);
      }, TOAST_DURATION_MS);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const value = { showToast, toasts, removeToast };
  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const { toasts, removeToast } = React.useContext(ToastContext);
  if (!toasts.length) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-[360px] pointer-events-none"
      aria-live="polite"
    >
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`pointer-events-auto rounded-lg shadow-lg border-l-4 p-3 bg-white border border-blue-gray-200 ${
            t.type === "success"
              ? "border-l-green-500"
              : t.type === "error"
              ? "border-l-red-500"
              : "border-l-blue-500"
          }`}
          style={{ animation: "toastSlideIn 0.3s ease-out" }}
        >
          <div className="flex items-start gap-2">
            <span
              className={`flex-1 text-sm ${
                t.type === "success"
                  ? "text-green-800"
                  : t.type === "error"
                  ? "text-red-800"
                  : "text-blue-gray-800"
              }`}
            >
              {t.message}
            </span>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="shrink-0 text-blue-gray-400 hover:text-blue-gray-600 text-lg leading-none"
              aria-label="Đóng"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

export default ToastContext;
