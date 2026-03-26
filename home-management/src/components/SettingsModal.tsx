import { memo, useRef } from "react";
import { SafeImage } from "@/components/SafeImage";

type SettingsModalProps = {
  settingsHouseName: string;
  onSettingsHouseNameChange: (value: string) => void;
  settingsHouseImage: string;
  onSettingsImageFile: (file?: File) => void;
  isSavingSettings: boolean;
  isDeletingHouse: boolean;
  settingsError: string;
  isOwner: boolean;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
  onOpenUserProfile: () => void;
  onOpenInvite: () => void;
  onSwitchHouse: () => void;
  onSignOut: () => void;
  onLeaveHouse: () => void;
};

export const SettingsModal = memo(function SettingsModal({
  settingsHouseName,
  onSettingsHouseNameChange,
  settingsHouseImage,
  onSettingsImageFile,
  isSavingSettings,
  isDeletingHouse,
  settingsError,
  isOwner,
  onSave,
  onDelete,
  onClose,
  onOpenUserProfile,
  onOpenInvite,
  onSwitchHouse,
  onSignOut,
  onLeaveHouse,
}: SettingsModalProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 dark:bg-black/70 p-3 sm:items-center">
      <div className="w-full max-w-md rounded-3xl border border-white/70 dark:border-slate-700/70 bg-white dark:bg-slate-800 p-5 shadow-2xl dark:shadow-slate-900/50">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">הגדרות בית</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            סגור
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 p-4">
          <div className="relative mx-auto mb-3 h-24 w-24">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg shadow-slate-200 dark:shadow-slate-900/50">
              <SafeImage
                src={settingsHouseImage}
                alt="תמונת בית"
                width={96}
                height={96}
                className="h-full w-full object-cover"
                fallback={<span className="text-4xl">🏠</span>}
              />
            </div>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="absolute -bottom-1 -left-1 flex h-8 w-8 items-center justify-center rounded-full border border-white dark:border-slate-600 bg-slate-900 dark:bg-slate-700 text-white shadow-lg"
              title="החלפת תמונה"
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
                <path d="m12 20 7-7-3-3-7 7-1 4z" />
                <path d="m15 7 3 3" />
              </svg>
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => onSettingsImageFile(event.target.files?.[0])}
              className="hidden"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
              שם הבית
              <input
                value={settingsHouseName}
                onChange={(event) => onSettingsHouseNameChange(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-100 px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-600"
                placeholder="הכנס שם לבית"
              />
            </label>
            <p className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
              שינוי תמונה דרך אייקון העריכה ליד התמונה
            </p>
          </div>
        </div>

        {settingsError && (
          <p className="mt-3 rounded-xl bg-rose-50 dark:bg-red-900/30 px-3 py-2 text-xs font-bold text-rose-700">
            {settingsError}
          </p>
        )}

        <button
          type="button"
          onClick={onSave}
          disabled={isSavingSettings}
          className="mt-4 min-h-11 w-full rounded-2xl bg-slate-900 dark:bg-slate-700 px-4 text-sm font-bold text-white transition hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
        >
          {isSavingSettings ? "שומר..." : "שמור הגדרות"}
        </button>

        <button
          type="button"
          onClick={onOpenUserProfile}
          className="mt-3 min-h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          פרופיל משתמש
        </button>

        <button
          type="button"
          onClick={onOpenInvite}
          className="mt-3 min-h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          שיתוף והזמנה לבית
        </button>

        <button
          type="button"
          onClick={onSwitchHouse}
          className="mt-3 min-h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          בחירת בית אחר
        </button>

        {isOwner && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeletingHouse}
            className="mt-3 min-h-11 w-full rounded-2xl bg-rose-600 px-4 text-sm font-bold text-white transition hover:bg-rose-500 disabled:opacity-50"
          >
            {isDeletingHouse ? "מוחק בית..." : "מחיקת בית"}
          </button>
        )}

        {!isOwner && (
          <button
            type="button"
            onClick={onLeaveHouse}
            className="mt-3 min-h-11 w-full rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-red-900/30 px-4 text-sm font-bold text-rose-700 dark:text-rose-400 transition hover:bg-rose-100 dark:hover:bg-red-900/50"
          >
            עזוב בית
          </button>
        )}

        <button
          type="button"
          onClick={onSignOut}
          className="mt-4 min-h-11 w-full rounded-2xl bg-rose-600 px-4 text-sm font-bold text-white transition hover:bg-rose-500"
        >
          התנתק
        </button>
      </div>
    </div>
  );
});
