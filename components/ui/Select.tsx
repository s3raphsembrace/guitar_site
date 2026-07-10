"use client";

import React from "react";

interface SelectProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
}

export default function Select({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  className = "",
}: SelectProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-white">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`px-4 py-2 border border-gray-600 rounded-lg bg-gray-900 text-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all hover:border-gray-500 ${className}`}
      >
        <option value="" className="bg-gray-900 text-white">
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-gray-900 text-white">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
