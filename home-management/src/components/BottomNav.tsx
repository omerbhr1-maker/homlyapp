"use client";

import { memo } from "react";
import type { SectionKey } from "@/types";

type BottomNavProps = {
  isMobile: boolean;
  isNavHidden: boolean;
  navDragY: number;
  activeRecording: SectionKey | null;
  setIsNavHidden: (value: boolean) => void;
  handleNavDragStart: (event: React.TouchEvent) => void;
  handleNavDragMove: (event: React.TouchEvent) => void;
  handleNavDragEnd: () => void;
};

export const BottomNav = memo(function BottomNav({
  isMobile,
  isNavHidden,
  navDragY,
  activeRecording,
  setIsNavHidden,
  handleNavDragStart,
  handleNavDragMove,
  handleNavDragEnd,
}: BottomNavProps) {
  if (!isMobile) return null;

  return (
    <>
      {isNavHidden && (
        <button
          type="button"
          aria-label="הצג תפריט"
          onClick={() => setIsNavHidden(false)}
          className="fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 z-40 h-1.5 w-20 -translate-x-1/2 rounded-full bg-slate-300/80 backdrop-blur-sm"
        />
      )}
      <nav
        className={`bottom-nav fixed inset-x-0 bottom-[max(0.45rem,env(safe-area-inset-bottom))] z-40 px-2 ${activeRecording ? "translate-y-full opacity-0 pointer-events-none" : ""}`}
        style={{
          transform: isNavHidden ? "translateY(200%)" : navDragY > 0 ? `translateY(${navDragY}px)` : undefined,
          transition: navDragY > 0 ? "none" : undefined,
        }}
      >
        <div className="mx-auto w-full max-w-[min(100vw-0.7rem,24.5rem)] rounded-t-[2.1rem] rounded-b-[1.45rem] border border-white/70 bg-white/70 p-2 shadow-xl shadow-slate-200/70 backdrop-blur-xl">
          <div
            className="mx-auto mb-1 h-1.5 w-20 cursor-grab rounded-full bg-slate-200/65 active:cursor-grabbing"
            onTouchStart={handleNavDragStart}
            onTouchMove={handleNavDragMove}
            onTouchEnd={handleNavDragEnd}
          />
          <div className="flex items-center justify-between rounded-[1.8rem] border border-white/60 bg-white/45 px-1 py-1.5">
            <a
              href="#tasks"
              className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl py-1.5 text-[11px] font-bold text-slate-700 transition active:scale-95"
            >
              <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-sky-100 bg-sky-50 text-sky-600 shadow-sm">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </span>
              משימות
            </a>
            <a
              href="#general"
              className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl py-1.5 text-[11px] font-bold text-slate-700 transition active:scale-95"
            >
              <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-teal-100 bg-teal-50 text-teal-600 shadow-sm">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 7h12" />
                  <path d="M8 7V5a4 4 0 0 1 8 0v2" />
                  <path d="M4 7l1 12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2l1-12" />
                </svg>
              </span>
              כללי
            </a>
            <a
              href="#supermarket"
              className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl py-1.5 text-[11px] font-bold text-slate-700 transition active:scale-95"
            >
              <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-violet-100 bg-violet-50 text-violet-600 shadow-sm">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="20" r="1" />
                  <circle cx="20" cy="20" r="1" />
                  <path d="M1 1h4l2.7 12.4a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 2-1.6L23 6H6" />
                </svg>
              </span>
              סופר
            </a>
          </div>
        </div>
      </nav>
    </>
  );
});
