import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Typography, IconButton, Input, Spinner } from "@material-tailwind/react";
import {
  PaperAirplaneIcon,
  SparklesIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/solid";
import api from "@/api";
import { useAssistantPanel } from "@/widgets/layout/assistant-panel-state";
import {
  getAssistantSystem,
  assistantStoragePrefix,
  STARTER_HINTS_BY_SYSTEM,
  FEEDBACK_CORRECTIONS_BY_SYSTEM,
} from "@/utils/assistantSystem";

const ASSISTANT_SYSTEM = getAssistantSystem();
const STORAGE_KEY = `${assistantStoragePrefix(ASSISTANT_SYSTEM)}_chat_v1`;
const SESSION_KEY = `${assistantStoragePrefix(ASSISTANT_SYSTEM)}_session_v1`;
const PANEL_WIDTH = "w-72 sm:w-80";
const STARTER_HINTS = STARTER_HINTS_BY_SYSTEM[ASSISTANT_SYSTEM] ?? STARTER_HINTS_BY_SYSTEM.oa;
const FEEDBACK_CORRECTIONS = FEEDBACK_CORRECTIONS_BY_SYSTEM[ASSISTANT_SYSTEM] ?? FEEDBACK_CORRECTIONS_BY_SYSTEM.oa;
const ASSISTANT_TITLE = ASSISTANT_SYSTEM === "chamcong" ? "Trợ lý CH" : "Trợ lý kho";

function readStorage(key) {
  try {
    const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (localStorage.getItem(key) == null && sessionStorage.getItem(key) != null) {
      try {
        localStorage.setItem(key, raw);
        sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

function loadMessages() {
  const parsed = readStorage(STORAGE_KEY);
  return Array.isArray(parsed) ? parsed : [];
}

function loadSession() {
  const parsed = readStorage(SESSION_KEY);
  if (!parsed || typeof parsed !== "object") return { sessionId: makeId(), lastStoreMentioned: null };
  return {
    sessionId: parsed.sessionId || makeId(),
    lastStoreMentioned: parsed.lastStoreMentioned || null,
  };
}

function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

function saveMessages(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-80)));
  } catch {
    /* ignore */
  }
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeAssistantActionUrl(actionUrl) {
  if (!actionUrl || typeof actionUrl !== "string") return null;
  const raw = actionUrl.trim();
  if (!raw) return null;
  if (raw.startsWith("/dashboard/")) return raw;
  if (raw.startsWith("/dashboard")) return "/dashboard/home";
  if (raw.startsWith("/")) return `/dashboard${raw}`;
  return `/dashboard/${raw}`;
}

const INTENT_LABELS = {
  Greeting: "Chào hỏi",
  Help: "Hướng dẫn",
  Thanks: "Cảm ơn",
  Goodbye: "Tạm biệt",
  WhoAmI: "Giới thiệu",
  Unknown: "Gợi ý",
  General: "Trò chuyện",
  Workflow: "Quy trình",
  Skill: "Tra cứu",
  Clarification: "Làm rõ",
  IntentConfirm: "Xác nhận",
  Action: "Thao tác",
};

const DEFAULT_ACTION_BY_SKILL = {
  orders_pending_list: "/dashboard/orders?status=Pending",
  orders_pending_count: "/dashboard/orders?status=Pending",
  orders_need_admin_accept: "/dashboard/orders?status=Pending",
  store_health_overview: "/dashboard/home",
  orders_accepted_delivering: "/dashboard/orders?osStatus=Delivering",
  orders_late_delivery: "/dashboard/orders?osStatus=Delivering",
  eod_stores_not_checked: "/dashboard/eod-checkin",
  inventory_low_stock: "/dashboard/products",
  orders_create_draft: "/dashboard/orders/create",
  reports_monthly: "/dashboard/reports",
  action_product_demand: "/dashboard/product-demand",
};

const ALERT_POLL_MS = 120_000;

function suggestionClickText(s) {
  if (typeof s === "string") return s;
  if (s.text) return s.text;
  const ex = s.examples ?? s.Examples;
  if (Array.isArray(ex) && ex[0]) return ex[0];
  return s.name ?? s.Name ?? "";
}

function resolveActionUrl(msg) {
  const fromApi = normalizeAssistantActionUrl(msg.actionUrl);
  if (fromApi) return fromApi;
  const skillId = msg.skillId ?? msg.SkillId;
  if (skillId && DEFAULT_ACTION_BY_SKILL[skillId]) return DEFAULT_ACTION_BY_SKILL[skillId];
  return null;
}

function messageLabel(m) {
  if (m.workflowName) return m.workflowName;
  if (m.skillName) return m.skillName;
  if (m.intent && INTENT_LABELS[m.intent]) return INTENT_LABELS[m.intent];
  return null;
}

export function AssistantPanel() {
  const { open, toggle, setOpen } = useAssistantPanel();
  const navigate = useNavigate();
  const [messages, setMessages] = useState(loadMessages);
  const [session, setSession] = useState(loadSession);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [alertCount, setAlertCount] = useState(0);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const historyLoadedRef = useRef(false);

  const fetchServerHistory = useCallback(async (sessionId) => {
    if (!sessionId || historyLoadedRef.current) return;
    try {
      const res = await api.get("assistant.conversations", {
        query: { sessionId, take: 80, thread: true },
      });
      const items = res?.items ?? res?.Items ?? [];
      if (!Array.isArray(items) || items.length === 0) return;

      const fromServer = [];
      for (const row of items) {
        const ts = row.createdAt ?? row.CreatedAt;
        const baseTs = ts ? new Date(ts).getTime() : Date.now();
        const question = row.question ?? row.Question ?? "";
        const answer = row.answer ?? row.Answer ?? "";
        if (question) {
          fromServer.push({ id: `srv-u-${row.id ?? row.Id}`, role: "user", text: question, ts: baseTs });
        }
        if (answer) {
          fromServer.push({
            id: `srv-a-${row.id ?? row.Id}`,
            role: "assistant",
            text: answer,
            skillId: row.skillId ?? row.SkillId,
            intent: row.intent ?? row.Intent,
            ts: baseTs + 1,
          });
        }
      }
      if (fromServer.length === 0) return;

      setMessages((prev) => {
        if (prev.length >= fromServer.length) return prev;
        return fromServer;
      });
      historyLoadedRef.current = true;
    } catch {
      /* API chưa có hoặc lỗi mạng */
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    if (ASSISTANT_SYSTEM !== "oa") {
      setAlerts([]);
      setAlertCount(0);
      return;
    }
    try {
      const res = await api.get("assistant.alerts", { query: { system: ASSISTANT_SYSTEM } });
      const list = res?.alerts ?? res?.Alerts ?? [];
      const count = res?.count ?? res?.Count ?? list.length;
      setAlerts(Array.isArray(list) ? list : []);
      setAlertCount(typeof count === "number" ? count : list.length);
    } catch {
      /* ignore — trợ lý vẫn dùng được */
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const id = setInterval(fetchAlerts, ALERT_POLL_MS);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  const dismissAlert = useCallback(async (key) => {
    try {
      await api.post("assistant.alertsDismiss", { key });
      setAlerts((prev) => prev.filter((a) => (a.key ?? a.Key) !== key));
      setAlertCount((c) => Math.max(0, c - 1));
    } catch {
      /* ignore */
    }
  }, []);

  const patchMessage = useCallback((msgId, patch) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...patch } : m)));
  }, []);

  const submitFeedback = useCallback(async (msgId, executionLogId, payload) => {
    if (!executionLogId) return;
    try {
      await api.post("assistant.feedback", {
        executionLogId,
        success: payload.success,
        correctSkillId: payload.correctSkillId ?? undefined,
        correctWorkflowId: payload.correctWorkflowId ?? undefined,
        note: payload.note ?? undefined,
      });
      patchMessage(msgId, {
        feedbackStatus: payload.success ? "good" : payload.correctSkillId ? "corrected" : "bad",
        showCorrection: false,
      });
    } catch {
      patchMessage(msgId, { feedbackError: true });
    }
  }, [patchMessage]);

  useEffect(() => {
    if (open) fetchServerHistory(session.sessionId);
  }, [open, session.sessionId, fetchServerHistory]);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, statusText]);

  const sendMessage = useCallback(async (text, options = {}) => {
    const trimmed = (text ?? "").trim();
    const { confirmExecute } = options;
    if ((!trimmed && confirmExecute == null) || sending) return;

    if (confirmExecute == null) {
      const userMsg = { id: makeId(), role: "user", text: trimmed, ts: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
    }
    setInput("");
    setSending(true);
    setStatusText(
      confirmExecute === true
        ? "Đang tra cứu…"
        : confirmExecute === false
          ? "Đang hủy…"
          : "Đang đọc phiên chat & phân tích…",
    );

    try {
      const res = await api.post("assistant.chat", {
        message: trimmed || (confirmExecute === true ? "Đúng, tra cứu" : "Không phải"),
        confirmExecute,
        system: ASSISTANT_SYSTEM,
        sessionId: session.sessionId,
        sessionStoreMentioned: session.lastStoreMentioned,
        recentHistory: messages.slice(-10).map((m) => ({
          role: m.role,
          text: m.text,
          skillId: m.skillId ?? undefined,
        })),
      });

      const storeFromReply = res?.resolvedStoreName ?? res?.ResolvedStoreName;
      if (storeFromReply) {
        setSession((s) => ({ ...s, lastStoreMentioned: storeFromReply }));
      }

      const assistantMsg = {
        id: makeId(),
        role: "assistant",
        text: res?.reply || res?.Reply || "Không có phản hồi.",
        intent: res?.intent ?? res?.Intent,
        workflowId: res?.workflowId ?? res?.WorkflowId,
        workflowName: res?.workflowName ?? res?.WorkflowName,
        skillId: res?.skillId ?? res?.SkillId,
        skillName: res?.skillName ?? res?.SkillName,
        actionUrl: res?.actionUrl ?? res?.ActionUrl,
        matched: res?.matched ?? res?.Matched,
        suggestions: res?.suggestions ?? res?.Suggestions,
        rows: res?.rows ?? res?.Rows,
        stepsExecuted: res?.stepsExecuted ?? res?.StepsExecuted ?? 0,
        requiresConfirm: res?.requiresConfirm ?? res?.RequiresConfirm,
        usedOpenAi: res?.usedOpenAi ?? res?.UsedOpenAi,
        confidence: res?.confidence ?? res?.Confidence,
        needClarification: res?.needClarification ?? res?.NeedClarification,
        actionId: res?.actionId ?? res?.ActionId,
        clarificationOptions: res?.clarificationOptions ?? res?.ClarificationOptions,
        pendingConfirm: res?.pendingConfirm ?? res?.PendingConfirm,
        executionLogId: res?.executionLogId ?? res?.ExecutionLogId,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          text: e?.data?.message || e?.message || "Lỗi kết nối trợ lý.",
          ts: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
      setStatusText("");
      inputRef.current?.focus();
    }
  }, [sending, session]);

  const handleIntentConfirm = useCallback(
    (msgId, confirmed) => {
      patchMessage(msgId, { pendingConfirm: false, confirmHandled: true });
      sendMessage(confirmed ? "Đúng, tra cứu" : "Không phải", { confirmExecute: confirmed });
    },
    [patchMessage, sendMessage],
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    historyLoadedRef.current = false;
    const newSession = { sessionId: makeId(), lastStoreMentioned: null };
    setSession(newSession);
    saveSession(newSession);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-[45] flex items-center justify-center bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors
          bottom-[4.75rem] right-4 h-14 w-14 rounded-full xl:bottom-auto xl:right-0 xl:top-1/2 xl:-translate-y-1/2 xl:h-auto xl:w-auto xl:flex-col xl:gap-1 xl:rounded-l-xl xl:rounded-r-none xl:border xl:border-r-0 xl:border-blue-gray-200 xl:py-3 xl:px-1.5"
        title={alertCount > 0 ? `${alertCount} cảnh báo` : `Mở ${ASSISTANT_TITLE}`}
        aria-label={`Mở ${ASSISTANT_TITLE}`}
      >
        {alertCount > 0 && (
          <span className="absolute -top-1 -right-1 xl:-left-1 xl:right-auto min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none">
            {alertCount > 9 ? "9+" : alertCount}
          </span>
        )}
        <SparklesIcon className="h-6 w-6 xl:h-5 xl:w-5" />
        <span className="hidden xl:inline text-[10px] font-semibold" style={{ writingMode: "vertical-rl" }}>
          {ASSISTANT_TITLE}
        </span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/30 xl:hidden"
        aria-label="Đóng trợ lý"
        onClick={() => setOpen(false)}
      />
      <aside
        className={`fixed z-50 flex flex-col bg-white shadow-xl
          inset-x-0 bottom-0 top-14 max-h-[calc(100dvh-3.5rem)] rounded-t-2xl border-t border-blue-gray-100
          xl:inset-x-auto xl:right-0 xl:top-0 xl:bottom-0 xl:max-h-none xl:rounded-none xl:border-l xl:border-t-0 ${PANEL_WIDTH}`}
        aria-label={ASSISTANT_TITLE}
      >
      <header className="shrink-0 flex items-center justify-between gap-2 px-3 py-3 border-b border-blue-gray-50 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shrink-0">
            <SparklesIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <Typography variant="small" className="font-semibold text-blue-gray-800 truncate">
              {ASSISTANT_TITLE}
            </Typography>
            {session.lastStoreMentioned && (
              <Typography className="text-[10px] text-blue-gray-500 truncate">
                Nhớ CH: {session.lastStoreMentioned}
              </Typography>
            )}
          </div>
        </div>
        <div className="flex items-center shrink-0">
          <IconButton variant="text" size="sm" onClick={clearChat} title="Xóa lịch sử chat">
            <TrashIcon className="h-4 w-4 text-blue-gray-400" />
          </IconButton>
          <IconButton variant="text" size="sm" onClick={toggle} title="Thu gọn trợ lý">
            <ChevronRightIcon className="h-5 w-5 text-blue-gray-600" />
          </IconButton>
        </div>
      </header>

      {alerts.length > 0 && (
        <div className="shrink-0 border-b border-amber-100 bg-amber-50/80 px-3 py-2 space-y-1.5 max-h-36 overflow-y-auto">
          <Typography className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide">
            Cảnh báo ({alerts.length})
          </Typography>
          {alerts.map((a) => {
            const key = a.key ?? a.Key;
            const title = a.title ?? a.Title ?? "";
            const message = a.message ?? a.Message;
            const severity = a.severity ?? a.Severity ?? "info";
            const actionUrl = normalizeAssistantActionUrl(a.actionUrl ?? a.ActionUrl);
            const suggested = a.suggestedChat ?? a.SuggestedChat;
            const border =
              severity === "error"
                ? "border-red-200"
                : severity === "warn"
                  ? "border-amber-200"
                  : "border-blue-gray-100";
            return (
              <div
                key={key}
                className={`rounded-lg border bg-white px-2 py-1.5 text-[11px] ${border}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <p className="font-semibold text-blue-gray-800 leading-snug">{title}</p>
                  <button
                    type="button"
                    onClick={() => dismissAlert(key)}
                    className="shrink-0 text-[10px] text-blue-gray-400 hover:text-blue-gray-600"
                    title="Ẩn cảnh báo"
                  >
                    ✕
                  </button>
                </div>
                {message && (
                  <p className="text-[10px] text-blue-gray-500 mt-0.5 leading-snug">{message}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-1">
                  {actionUrl && (
                    <button
                      type="button"
                      onClick={() => navigate(actionUrl)}
                      className="text-[10px] font-semibold text-blue-600 hover:underline"
                    >
                      Mở trang
                    </button>
                  )}
                  {suggested && (
                    <button
                      type="button"
                      onClick={() => sendMessage(suggested)}
                      className="text-[10px] font-semibold text-blue-600 hover:underline"
                    >
                      Hỏi trợ lý
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-6 px-2">
            <Typography className="text-xs text-blue-gray-500 mb-3">
              Hỏi tự nhiên — em tra dữ liệu và trả lời luôn.
            </Typography>
            <div className="flex flex-col gap-2">
              {STARTER_HINTS.map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => sendMessage(hint)}
                  className="text-left text-xs px-3 py-2 rounded-lg border border-blue-gray-100 bg-blue-gray-50/50 text-blue-gray-700 hover:bg-blue-50 transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const actionTo = m.role === "assistant" ? resolveActionUrl(m) : null;
          return (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-blue-gray-50 text-blue-gray-800 rounded-bl-sm border border-blue-gray-100"
                }`}
              >
                <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>
                {Array.isArray(m.rows) && m.rows.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {m.rows.map((row, idx) => {
                      const title = row.title ?? row.Title ?? "";
                      const subtitle = row.subtitle ?? row.Subtitle;
                      const link = normalizeAssistantActionUrl(row.link ?? row.Link);
                      if (link) {
                        return (
                          <button
                            key={`${title}-${idx}`}
                            type="button"
                            onClick={() => navigate(link)}
                            className="block w-full text-left text-[11px] px-2 py-1.5 rounded bg-white border border-blue-gray-100 hover:bg-blue-50"
                          >
                            <span className="font-medium text-blue-gray-800">{title}</span>
                            {subtitle && (
                              <span className="block text-[10px] text-blue-600 font-medium">{subtitle}</span>
                            )}
                          </button>
                        );
                      }
                      return (
                        <div
                          key={`${title}-${idx}`}
                          className="text-[11px] px-2 py-1 rounded bg-white border border-blue-gray-100"
                        >
                          <span className="font-medium text-blue-gray-800">{title}</span>
                          {subtitle && (
                            <span className="block text-[10px] text-blue-600 font-medium">{subtitle}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {actionTo && (
                  <button
                    type="button"
                    onClick={() => navigate(actionTo)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
                  >
                    Mở trang liên quan
                    <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                  </button>
                )}
                {Array.isArray(m.clarificationOptions) && m.clarificationOptions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] text-blue-gray-500">Chọn để làm rõ:</p>
                    {m.clarificationOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => sendMessage(opt)}
                        className="block w-full text-left text-[11px] px-2 py-1.5 rounded bg-white border border-amber-200 hover:bg-amber-50"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {m.pendingConfirm && !m.confirmHandled && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => handleIntentConfirm(m.id, true)}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Đúng, tra cứu
                    </button>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => handleIntentConfirm(m.id, false)}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-blue-gray-200 bg-white text-blue-gray-700 hover:bg-blue-gray-50 disabled:opacity-50"
                    >
                      Không phải
                    </button>
                  </div>
                )}
                {Array.isArray(m.suggestions) && m.suggestions.length > 0 && messages.indexOf(m) === messages.length - 1 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.suggestions.map((s) => {
                      const lbl = suggestionClickText(s);
                      if (!lbl) return null;
                      return (
                        <button
                          key={s.id ?? s.Id ?? lbl}
                          type="button"
                          onClick={() => sendMessage(lbl)}
                          className="text-[11px] px-2 py-1 rounded-full border border-blue-gray-200 bg-white text-blue-gray-700 hover:bg-blue-50"
                        >
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                )}
                {m.executionLogId && !m.feedbackStatus && (
                  <div className="mt-2 pt-2 border-t border-blue-gray-100 flex items-center gap-2">
                    <span className="text-[10px] text-blue-gray-400 mr-1">Hữu ích?</span>
                    <button
                      type="button"
                      title="Đúng"
                      onClick={() => submitFeedback(m.id, m.executionLogId, { success: true })}
                      className="text-base leading-none px-1.5 py-0.5 rounded hover:bg-green-50"
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      title="Sai — chọn loại câu trả lời đúng"
                      onClick={() => patchMessage(m.id, { showCorrection: true })}
                      className="text-base leading-none px-1.5 py-0.5 rounded hover:bg-red-50"
                    >
                      👎
                    </button>
                  </div>
                )}
                {m.showCorrection && !m.feedbackStatus && (
                  <div className="mt-2 space-y-1 rounded-lg border border-amber-200 bg-amber-50/80 p-2">
                    <p className="text-[10px] font-medium text-amber-900">Anh/chị muốn em trả lời kiểu nào?</p>
                    {FEEDBACK_CORRECTIONS.map((c) => (
                      <button
                        key={c.skillId}
                        type="button"
                        onClick={() =>
                          submitFeedback(m.id, m.executionLogId, {
                            success: false,
                            correctSkillId: c.skillId,
                          })
                        }
                        className="block w-full text-left text-[11px] px-2 py-1 rounded bg-white border border-amber-100 hover:bg-amber-50"
                      >
                        {c.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        submitFeedback(m.id, m.executionLogId, {
                          success: false,
                          note: "user_disliked",
                        })
                      }
                      className="text-[10px] text-blue-gray-500 hover:underline"
                    >
                      Chỉ báo sai (chưa rõ skill)
                    </button>
                  </div>
                )}
                {m.feedbackStatus === "good" && (
                  <p className="mt-2 text-[10px] text-green-600">✓ Cảm ơn anh/chị — em ghi nhận câu trả lời đúng.</p>
                )}
                {m.feedbackStatus === "corrected" && (
                  <p className="mt-2 text-[10px] text-amber-700">✓ Đã ghi — lần sau cùng câu hỏi em sẽ ưu tiên skill đó.</p>
                )}
                {m.feedbackStatus === "bad" && (
                  <p className="mt-2 text-[10px] text-blue-gray-500">✓ Đã ghi phản hồi.</p>
                )}
                {m.feedbackError && (
                  <p className="mt-2 text-[10px] text-red-500">Không gửi được feedback — thử lại sau.</p>
                )}
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-xl px-3 py-2 bg-blue-gray-50 border border-blue-gray-100 flex items-center gap-2">
              <Spinner className="h-4 w-4" color="blue" />
              <span className="text-xs text-blue-gray-500">{statusText || "Đang xử lý…"}</span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-blue-gray-100 p-3 bg-white safe-area-bottom"
      >
        <div className="flex gap-2 items-end">
          <Input
            inputRef={inputRef}
            label="Nhập câu hỏi…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            className="!text-sm"
            containerProps={{ className: "min-w-0 flex-1" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <IconButton
            type="submit"
            color="blue"
            size="sm"
            disabled={!input.trim() || sending}
            className="shrink-0"
          >
            <PaperAirplaneIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </form>
    </aside>
    </>
  );
}

AssistantPanel.displayName = "/src/widgets/layout/assistant-panel.jsx";

export default AssistantPanel;
