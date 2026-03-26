"use client";

import { memo, useCallback, useState } from "react";
import Image from "next/image";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { passthroughImageLoader } from "@/lib/utils";
import type { Item, SectionKey } from "@/types";

export const SortableListItem = memo(function SortableListItem({
  sortableId,
  item,
  sectionKey,
  createdByAvatarUrl,
  addedAtLabel,
  onToggle,
  onEdit,
  onDelete,
}: {
  sortableId: string;
  item: Item;
  sectionKey: SectionKey;
  createdByAvatarUrl?: string;
  addedAtLabel: string;
  onToggle: (key: SectionKey, id: number) => void;
  onEdit: (key: SectionKey, id: number) => void;
  onDelete: (key: SectionKey, id: number) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: sortableId });

  const handleToggle = useCallback(() => onToggle(sectionKey, item.id), [onToggle, sectionKey, item.id]);
  const handleEdit = useCallback(() => { onEdit(sectionKey, item.id); setShowActions(false); }, [onEdit, sectionKey, item.id]);
  const handleDelete = useCallback(() => onDelete(sectionKey, item.id), [onDelete, sectionKey, item.id]);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-2xl border border-slate-200/90 dark:border-slate-600/90 bg-white dark:bg-slate-800 px-3 py-2 transition-opacity ${
        isDragging ? "z-20 opacity-40 shadow-lg" : item.completed ? "opacity-60" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex h-8 w-8 shrink-0 touch-none cursor-grab items-center justify-center rounded-xl text-slate-400 dark:text-slate-500 active:cursor-grabbing"
        title="גרור לשינוי סדר"
        aria-label="גרור לשינוי סדר"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="9" cy="6" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="18" r="1" />
          <circle cx="15" cy="6" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="18" r="1" />
        </svg>
      </button>

      <button
        type="button"
        onClick={handleToggle}
        className="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-right"
      >
        {item.completed ? (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600">
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 6l3 3 5-5" />
            </svg>
          </span>
        ) : (
          <span className="h-5 w-5 shrink-0 rounded-full border border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-800" />
        )}
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${item.completed ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-700 dark:text-slate-200"}`}>
            {item.text}
          </span>
          {showActions && (
            <span className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500">
              {createdByAvatarUrl ? (
                <Image loader={passthroughImageLoader} unoptimized src={createdByAvatarUrl} alt="משתמש" width={14} height={14} className="h-3.5 w-3.5 rounded-full object-cover" />
              ) : (
                <span className="h-3.5 w-3.5 rounded-full bg-slate-300 dark:bg-slate-600" />
              )}
              <span>{addedAtLabel}</span>
            </span>
          )}
        </span>
      </button>

      {showActions ? (
        <>
          <button type="button" onClick={handleEdit} aria-label="עריכה" className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m12 20 7-7-3-3-7 7-1 4z" />
              <path d="m15 7 3 3" />
            </svg>
          </button>
          <button type="button" onClick={handleDelete} aria-label="מחיקה" className="flex h-8 w-8 items-center justify-center rounded-xl text-rose-600 transition hover:bg-rose-50 dark:hover:bg-red-900/30">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
          <button type="button" onClick={() => setShowActions(false)} aria-label="סגור" className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setShowActions(true)} aria-label="אפשרויות" className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
      )}
    </li>
  );
});
