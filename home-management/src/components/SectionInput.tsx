"use client";

import { forwardRef, memo, useCallback, useImperativeHandle, useRef, useState } from "react";

export type SectionInputHandle = { focus: () => void; submit: () => void };

export const SectionInput = memo(
  forwardRef<SectionInputHandle, { placeholder: string; onAdd: (text: string) => void }>(
    function SectionInput({ placeholder, onAdd }, ref) {
      const [value, setValue] = useState("");
      const inputRef = useRef<HTMLInputElement>(null);
      const valueRef = useRef("");

      const submit = useCallback(() => {
        const text = valueRef.current.trim();
        if (!text) return;
        onAdd(text);
        setValue("");
        valueRef.current = "";
      }, [onAdd]);

      useImperativeHandle(ref, () => ({
        focus: () => inputRef.current?.focus(),
        submit,
      }), [submit]);

      return (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => { valueRef.current = e.target.value; setValue(e.target.value); }}
          placeholder={placeholder}
          enterKeyHint="done"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        />
      );
    },
  ),
);
