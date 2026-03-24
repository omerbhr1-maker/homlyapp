"use client";

import { memo } from "react";
import type { Item } from "@/types";

export const DragOverlayItem = memo(function DragOverlayItem({ item }: { item: Item }) {
  return (
    <div className="flex w-[min(92vw,30rem)] items-center gap-2 rounded-2xl border border-teal-300 bg-white px-3 py-2 shadow-2xl shadow-slate-300">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="6" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="18" r="1" />
          <circle cx="15" cy="6" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="18" r="1" />
        </svg>
      </span>
      <span
        className={`truncate text-sm font-bold ${item.completed ? "text-slate-400 line-through" : "text-slate-800"}`}
      >
        {item.text}
      </span>
    </div>
  );
});
