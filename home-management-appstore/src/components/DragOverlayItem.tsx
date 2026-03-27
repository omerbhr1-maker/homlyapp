"use client";

import { memo } from "react";
import type { Item } from "@/types";

export const DragOverlayItem = memo(function DragOverlayItem({ item }: { item: Item }) {
  return (
    <div className="flex w-[min(92vw,30rem)] items-center gap-2 rounded-2xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-800 px-3 py-2 shadow-2xl shadow-slate-300 dark:shadow-slate-900/50">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 dark:text-slate-500">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="9" cy="6" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="18" r="1" />
          <circle cx="15" cy="6" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="18" r="1" />
        </svg>
      </span>
      {item.completed ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600">
          <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 6l3 3 5-5" />
          </svg>
        </span>
      ) : (
        <span className="h-5 w-5 shrink-0 rounded-full border border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-800" />
      )}
      <span className={`truncate text-sm font-bold ${item.completed ? "text-slate-400 dark:text-slate-500 line-through opacity-60" : "text-slate-800 dark:text-slate-100"}`}>
        {item.text}
      </span>
    </div>
  );
});
