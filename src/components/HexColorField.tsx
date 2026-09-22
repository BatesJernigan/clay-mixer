"use client";

import { useState } from "react";
import { isValidHex, normalizeHex } from "@/lib/color";

interface HexColorFieldProps {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}

export function HexColorField({ value, onChange, label }: HexColorFieldProps) {
  const [text, setText] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);

  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(value);
  }

  const valid = isValidHex(text);

  const commit = () => {
    if (isValidHex(text)) {
      onChange(normalizeHex(text));
    } else {
      setText(value);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-neutral-700">{label}</label>
      )}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isValidHex(text) ? normalizeHex(text) : value}
          onChange={(e) => {
            setText(e.target.value);
            onChange(e.target.value);
          }}
          className="h-10 w-10 rounded border border-neutral-300 cursor-pointer bg-transparent"
        />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          placeholder="#a1b2c3"
          className={`w-32 rounded-md border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 ${
            valid
              ? "border-neutral-300 focus:ring-neutral-400"
              : "border-red-400 focus:ring-red-400"
          }`}
        />
      </div>
      {!valid && <span className="text-xs text-red-500">Invalid hex color</span>}
    </div>
  );
}
