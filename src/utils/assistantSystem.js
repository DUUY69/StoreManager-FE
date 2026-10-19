/** Phạm vi trợ lý: oa (kho/đơn hàng) | chamcong — mỗi app build .env riêng */
export function getAssistantSystem() {
  const raw = (import.meta.env.VITE_ASSISTANT_SYSTEM || "oa").trim().toLowerCase();
  if (raw === "chamcong" || raw === "cc" || raw === "attendance" || raw === "workforce") {
    return "chamcong";
  }
  return "oa";
}

export function assistantStoragePrefix(system) {
  return system === "chamcong" ? "cc_assistant" : "oa_assistant";
}

export const STARTER_HINTS_BY_SYSTEM = {
  oa: [
    "Sáng nay làm gì",
    "Đơn chờ duyệt",
    "CH nào chưa kiểm kê?",
    "Đơn đang giao",
    "Đơn giao trễ",
  ],
  chamcong: [
    "Hôm nay em chấm chưa?",
    "Ai trễ hôm nay?",
    "Ca hôm nay của em",
    "CH nào chưa check-in",
  ],
};

export const FEEDBACK_CORRECTIONS_BY_SYSTEM = {
  oa: [
    { skillId: "orders_pending_list", label: "Đơn chờ duyệt" },
    { skillId: "orders_list", label: "Danh sách đơn" },
    { skillId: "daily_morning_brief", label: "Tóm tắt sáng / hôm nay" },
    { skillId: "orders_late_delivery", label: "Đơn giao trễ" },
    { skillId: "inventory_low_stock", label: "Tồn thấp" },
    { skillId: "eod_stores_not_checked", label: "CH chưa kiểm kê" },
  ],
  chamcong: [
    { skillId: "attendance_my_today", label: "Chấm công hôm nay (tôi)" },
    { skillId: "attendance_late_arrival", label: "Ai trễ hôm nay" },
    { skillId: "shift_regs_pending_approval", label: "Ca chờ duyệt" },
    { skillId: "attendance_missing_checkin", label: "Chưa check-in" },
  ],
};
