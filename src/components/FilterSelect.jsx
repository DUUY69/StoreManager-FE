import React from "react";

/**
 * Select dùng native <select> để dropdown luôn mở xuống dưới (không bị flip lên trên).
 * Dùng cho các bộ lọc trong danh sách.
 */
export function FilterSelect({ label, value, onChange, options, placeholder = "Tất cả", className = "", ...rest }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-blue-gray-500">{label}</label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-blue-gray-200 bg-white px-3 py-2.5 text-sm text-blue-gray-700 outline-none transition-all placeholder:opacity-0 focus:border-blue-500 focus:outline-none disabled:bg-blue-gray-50 disabled:border-blue-gray-200"
        {...rest}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default FilterSelect;
