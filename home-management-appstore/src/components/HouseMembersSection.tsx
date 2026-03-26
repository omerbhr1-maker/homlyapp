"use client";

import { memo } from "react";
import { SafeImage } from "@/components/SafeImage";
import type { HouseMemberUser } from "@/types";

type HouseMembersSectionProps = {
  houseMembers: HouseMemberUser[];
  isHouseMembersLoading: boolean;
  isOwner: boolean;
  openInviteModal: () => void;
  removeMember: (id: string) => void;
};

export const HouseMembersSection = memo(function HouseMembersSection({
  houseMembers,
  isHouseMembersLoading,
  isOwner,
  openInviteModal,
  removeMember,
}: HouseMembersSectionProps) {
  return (
    <section className="mb-4 rounded-3xl border border-white/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-800/95 p-3 shadow-lg shadow-slate-200/70 dark:shadow-slate-900/50">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">אנשים בבית</p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-teal-50 dark:bg-teal-900/40 px-2 py-1 text-[11px] font-bold text-teal-700 dark:text-teal-400">
            {isHouseMembersLoading && houseMembers.length === 0
              ? "טוען אנשים..."
              : `${houseMembers.length} משתמשים`}
          </span>
          <button
            type="button"
            onClick={openInviteModal}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700"
            title="שיתוף הזמנה לבית"
            aria-label="שיתוף הזמנה לבית"
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
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="m8.6 13.5 6.8 3.9" />
              <path d="m15.4 6.6-6.8 3.8" />
            </svg>
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {isHouseMembersLoading && houseMembers.length === 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400">
            טוען את אנשי הבית...
          </div>
        )}
        {houseMembers.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-2 py-1.5"
          >
            <SafeImage
              src={member.avatar_url}
              alt={member.display_name}
              width={28}
              height={28}
              className="h-7 w-7 rounded-xl object-cover"
              fallback={
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/60 text-xs font-bold text-teal-700 dark:text-teal-400">
                  {member.display_name.slice(0, 1)}
                </span>
              }
            />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{member.display_name}</span>
            {member.role === "owner" && (
              <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                בעל הבית
              </span>
            )}
            {isOwner && member.role !== "owner" && (
              <button
                type="button"
                onClick={() => void removeMember(member.id)}
                className="mr-auto rounded-lg bg-rose-50 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-rose-600 transition hover:bg-rose-100 dark:hover:bg-red-900/50"
                title="הסר מהבית"
              >
                הסר
              </button>
            )}
          </div>
        ))}
        {houseMembers.length === 0 && !isHouseMembersLoading && (
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">עדיין אין חברים בבית הזה.</p>
        )}
      </div>
    </section>
  );
});
