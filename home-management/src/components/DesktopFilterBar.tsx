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
      <section className="rounded-3xl border border-white/80 bg-white/95 p-4 shadow-lg shadow-slate-200/70">
        <p className="text-xs font-bold text-slate-500">חיפוש וסינון</p>
        <div className="mt-3 flex items-center gap-2">
          <input
            ref={desktopSearchRef}
            value={desktopQuery}
            onChange={(event) => setDesktopQuery(event.target.value)}
            placeholder="חיפוש מהיר בכל הרשימות..."
            className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
          <select
            value={desktopFilter}
            onChange={(event) => setDesktopFilter(event.target.value as "all" | "open" | "done")}
            className="min-h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          >
            <option value="all">הכול</option>
            <option value="open">פתוחים</option>
            <option value="done">הושלמו</option>
          </select>
        </div>
      </section>

      <section className="rounded-3xl border border-white/80 bg-white/95 p-4 shadow-lg shadow-slate-200/70">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-sky-50 px-3 py-3 text-center text-xs font-bold text-sky-700">
            משימות
            <br />
            {taskCount}
          </div>
          <div className="rounded-2xl bg-teal-50 px-3 py-3 text-center text-xs font-bold text-teal-700">
            כללי
            <br />
            {generalCount}
          </div>
          <div className="rounded-2xl bg-violet-50 px-3 py-3 text-center text-xs font-bold text-violet-700">
            סופר
            <br />
            {supermarketCount}
          </div>
        </div>
      </section>
    </div>
  );
});
