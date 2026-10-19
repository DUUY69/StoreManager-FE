import React from "react";

const OPEN_KEY = "oa_assistant_panel_open_v1";

function loadOpen() {
  try {
    const v = sessionStorage.getItem(OPEN_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

const AssistantPanelContext = React.createContext(null);

export function AssistantPanelProvider({ children }) {
  const [open, setOpenState] = React.useState(loadOpen);

  const setOpen = React.useCallback((value) => {
    setOpenState(value);
    try {
      sessionStorage.setItem(OPEN_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = React.useCallback(() => {
    setOpenState((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(OPEN_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = React.useMemo(
    () => ({ open, setOpen, toggle }),
    [open, setOpen, toggle]
  );

  return (
    <AssistantPanelContext.Provider value={value}>
      {children}
    </AssistantPanelContext.Provider>
  );
}

export function useAssistantPanel() {
  const ctx = React.useContext(AssistantPanelContext);
  if (!ctx) {
    throw new Error("useAssistantPanel must be used within AssistantPanelProvider");
  }
  return ctx;
}

/** Margin main content khi panel mo (desktop only — mobile dung overlay) */
export function assistantPanelMarginClass(open) {
  return open ? "xl:mr-72 2xl:mr-80" : "";
}
