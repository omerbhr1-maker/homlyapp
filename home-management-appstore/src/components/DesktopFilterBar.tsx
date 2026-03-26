"use client";

import { memo } from "react";

type DesktopFilterBarProps = {
  desktopSearchRef: React.RefObject<HTMLInputElement | null>;
  desktopQuery: string;
  setDesktopQuery: (value: string) => void;
  desktopFilter: "all" | "open" | "done";
  setDesktopFilter: (value: "all" | "open" | "done") => void;
  taskCount: number;
  generalCount: number;
  supermarketCount: number;
};

export const DesktopFilterBar = memo(function DesktopFilterBar({
  desktopSearchRef,
  desktopQuery,
  setDesktopQuery,
  desktopFilter,
  setDesktopFilter,
  taskCount,
  generalCount,
  supermarketCount,
}: DesktopFilterBarProps) {
  return (
    <div className="mb-4 hidden grid-cols-1 gap-3 lg:grid lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-3xl border border-white/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-800/95 p-4 shadow-lg shadow-slate-200/70 dark:shadow-slate-900/50">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">חיפוש וסינון</p>
        <div className="mt-3 flex items-center gap-2">
          <input
            ref={desktopSearchRef}
            value={desktopQuery}
            onChange={(event) => setDesktopQuery(event.target.value)}
            placeholder="חיפוש מהיר בכל הרשימות..."
            className="min-h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-600"
          />
          <select
            value={desktopFilter}
            onChange={(event) => setDesktopFilter(event.target.value as "all" | "open" | "done")}
            className="min-h-11 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-100 px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-600"
          >
            <option value="all">הכול</option>
            <option value="open">פתוחים</option>
            <option value="done">הושלמו</option>
          </select>
        </div>
      </section>

      <section className="rounded-3xl border border-white/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-800/95 p-4 shadow-lg shadow-slate-200/70 dark:shadow-slate-900/50">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-sky-50 dark:bg-blue-900/30 px-3 py-3 text-center text-xs font-bold text-sky-700 dark:text-sky-400">
            משימות
            <br />
            {taskCount}
          </div>
          <div className="rounded-2xl bg-teal-50 dark:bg-teal-900/40 px-3 py-3 text-center text-xs font-bold text-teal-700 dark:text-teal-400">
            כללי
            <br />
            {generalCount}
          </div>
          <div className="rounded-2xl bg-violet-50 dark:bg-violet-900/30 px-3 py-3 text-center text-xs font-bold text-violet-700 dark:text-violet-400">
            סופר
            <br />
            {supermarketCount}
          </div>
        </div>
      </section>
    </div>
  );
});
