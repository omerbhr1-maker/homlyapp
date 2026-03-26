"use client";

import { memo, useCallback, useRef, useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AudioWaveIcon, MicIcon, RecipeIcon } from "@/components/icons";
import { SortableListItem } from "@/components/SortableListItem";
import { SectionInput, type SectionInputHandle } from "@/components/SectionInput";
import { formatAddedAt, toSortableId } from "@/lib/utils";
import { sectionAnchors } from "@/lib/constants";
import type { SectionKey, Section, Item, HouseMemberUser } from "@/types";

type SectionCardProps = {
  sectionKey: SectionKey;
  section: Section;
  visibleItems: Item[];
  progress: number;
  isRecordingHere: boolean;
  processingRecording: SectionKey | null;
  isSpeechSupported: boolean;
  houseMembersMap: Map<string, HouseMemberUser>;
  activeUserId: string | undefined;
  activeUserAvatarUrl: string | undefined;
  onAddItem: (key: SectionKey, text: string) => void;
  onToggle: (key: SectionKey, id: number) => void;
  onEdit: (key: SectionKey, id: number) => void;
  onDelete: (key: SectionKey, id: number) => void;
  onToggleRecording: (key: SectionKey) => void;
  onOpenRecipeModal: () => void;
  externalInputRefSetter: (node: SectionInputHandle | null) => void;
};

export const SectionCard = memo(function SectionCard({
  sectionKey,
  section,
  visibleItems,
  progress,
  isRecordingHere,
  processingRecording,
  isSpeechSupported,
  houseMembersMap,
  activeUserId,
  activeUserAvatarUrl,
  onAddItem,
  onToggle,
  onEdit,
  onDelete,
  onToggleRecording,
  onOpenRecipeModal,
  externalInputRefSetter,
}: SectionCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const localInputRef = useRef<SectionInputHandle | null>(null);

  const inputRefCallback = useCallback(
    (node: SectionInputHandle | null) => {
      localInputRef.current = node;
      externalInputRefSetter(node);
    },
    [externalInputRefSetter],
  );

  const handleAdd = useCallback(
    (text: string) => onAddItem(sectionKey, text),
    [onAddItem, sectionKey],
  );

  const handleToggleRecording = useCallback(
    () => onToggleRecording(sectionKey),
    [onToggleRecording, sectionKey],
  );

  return (
    <article
      id={sectionAnchors[sectionKey]}
      className={`scroll-mt-32 rounded-3xl border border-white/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-800/90 p-3 shadow-lg shadow-slate-200/70 dark:shadow-slate-900/50 backdrop-blur sm:p-4 lg:flex lg:flex-col${isCollapsed ? "" : " lg:min-h-[38rem]"}`}
    >
      <button
        type="button"
        onClick={() => setIsCollapsed((v) => !v)}
        className="w-full mb-3 flex flex-col gap-2 text-right"
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? `פתח ${section.title}` : `סגור ${section.title}`}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{section.title}</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-teal-50 dark:bg-teal-900/40 px-3 py-1 text-xs font-bold text-teal-700 dark:text-teal-400">
              {section.items.length} פריטים
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200${isCollapsed ? " rotate-180" : ""}`}
            >
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
        {isCollapsed && section.items.length > 0 && (
          <>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-l from-teal-500 to-cyan-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-right">
              {section.items.filter((i) => i.completed).length} מתוך {section.items.length} הושלמו
            </p>
          </>
        )}
      </button>

      {/* Animated collapse using CSS grid trick */}
      <div
        className={`grid transition-all duration-300 ease-in-out${isCollapsed ? " grid-rows-[0fr] opacity-0" : " grid-rows-[1fr] opacity-100"}`}
      >
        <div className="overflow-hidden">
          <div className="mb-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-l from-teal-500 to-cyan-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mb-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <SectionInput
                ref={inputRefCallback}
                placeholder={section.placeholder}
                onAdd={handleAdd}
              />
              {sectionKey === "supermarketShopping" && (
                <button
                  type="button"
                  onClick={onOpenRecipeModal}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="מתכון חכם"
                  aria-label="מתכון חכם"
                >
                  <RecipeIcon />
                </button>
              )}
              <button
                type="button"
                onClick={handleToggleRecording}
                aria-label={isRecordingHere ? "עצור הקלטה" : "הקלטה קולית"}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${
                  isRecordingHere
                    ? "border-rose-300 bg-rose-500 text-white shadow-lg shadow-rose-200"
                    : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                } ${!isSpeechSupported ? "pointer-events-none opacity-40" : ""}`}
              >
                {isRecordingHere ? <AudioWaveIcon /> : <MicIcon />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => localInputRef.current?.submit()}
              className="self-start rounded-xl bg-gradient-to-l from-teal-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
            >
              הוספה
            </button>
          </div>

          {isRecordingHere && (
            <p className="mb-2 rounded-xl bg-rose-50 dark:bg-red-900/30 px-3 py-2 text-xs font-bold text-rose-600">
              מקליט... עצירה בלחיצה חוזרת על המיקרופון.
            </p>
          )}
          {processingRecording === sectionKey && (
            <p className="mb-2 rounded-xl bg-teal-50 dark:bg-teal-900/40 px-3 py-2 text-xs font-bold text-teal-700 dark:text-teal-400">
              מפענח הקלטה עם AI...
            </p>
          )}

          <SortableContext
            items={visibleItems.map((item) => toSortableId(sectionKey, item.id))}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2 lg:max-h-[24rem] lg:overflow-y-auto lg:pl-1">
              {visibleItems.map((item) => {
                const creator = item.createdByUserId
                  ? houseMembersMap.get(item.createdByUserId)
                  : undefined;
                const avatarUrl =
                  creator?.avatar_url ||
                  (item.createdByUserId === activeUserId ? activeUserAvatarUrl : "");
                return (
                  <SortableListItem
                    key={item.id}
                    sortableId={toSortableId(sectionKey, item.id)}
                    item={item}
                    sectionKey={sectionKey}
                    createdByAvatarUrl={avatarUrl}
                    addedAtLabel={formatAddedAt(item.createdAt)}
                    onToggle={onToggle}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                );
              })}
            </ul>
          </SortableContext>

          {visibleItems.length === 0 && (
            <p className="rounded-2xl bg-slate-50 dark:bg-slate-900 px-3 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
              אין פריטים להצגה לפי הסינון הנוכחי.
            </p>
          )}
        </div>
      </div>
    </article>
  );
});
