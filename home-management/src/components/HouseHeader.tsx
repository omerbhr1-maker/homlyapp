"use client";

import { memo } from "react";
import { HomeLogo } from "@/components/HomeLogo";
import { SafeImage } from "@/components/SafeImage";
import type { CloudHouseRow, CloudUserRow } from "@/types";

type HouseHeaderProps = {
  activeHouse: CloudHouseRow;
  activeUser: CloudUserRow;
  onOpenUserProfile: () => void;
  onOpenSettings: () => void;
};

export const HouseHeader = memo(function HouseHeader({
  activeHouse,
  activeUser,
  onOpenUserProfile,
  onOpenSettings,
}: HouseHeaderProps) {
  return (
    <header className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-30 mb-3 rounded-3xl border border-white/70 dark:border-slate-700/70 bg-white/90 dark:bg-slate-800/90 p-3 shadow-xl shadow-slate-200/70 dark:shadow-slate-900/50 backdrop-blur sm:mb-4 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <HomeLogo houseName={activeHouse.name} houseImage={activeHouse.house_image} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenUserProfile}
            className="hidden items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 lg:flex"
          >
            <SafeImage
              src={activeUser.avatar_url}
              alt="תמונת משתמש"
              width={28}
              height={28}
              className="h-7 w-7 rounded-xl object-cover"
              fallback={
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/60 text-xs font-bold text-teal-700 dark:text-teal-400">
                  {activeUser.display_name.slice(0, 1)}
                </span>
              }
            />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{activeUser.display_name}</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1 rounded-xl bg-slate-900 dark:bg-slate-700 px-3 py-2 text-xs font-bold text-white"
          >
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
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
            הגדרות
          </button>
        </div>
      </div>
    </header>
  );
});
