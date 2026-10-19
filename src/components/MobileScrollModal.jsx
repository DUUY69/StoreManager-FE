import React, { useEffect } from "react";

/**
 * Modal cuộn được trên iOS/Android: backdrop scroll + panel max dvh + vùng body scroll.
 */
export function MobileScrollModal({
  open,
  onClose,
  children,
  zIndex = "z-[55]",
  maxWidth = "max-w-lg",
  panelClassName = "",
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 ${zIndex} overflow-y-auto overscroll-contain bg-black/50`}
      style={{ WebkitOverflowScrolling: "touch" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex min-h-[100dvh] min-h-[100vh] items-end justify-center sm:items-center sm:p-4"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div
          className={`flex w-full ${maxWidth} max-h-[min(92dvh,100%)] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[min(90dvh,100%)] sm:rounded-xl ${panelClassName}`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function MobileScrollModalBody({ children, className = "" }) {
  return (
    <div
      className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${className}`}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {children}
    </div>
  );
}
