"use client";

import { memo } from "react";
import { SafeImage } from "@/components/SafeImage";
import type { CloudUserRow } from "@/types";

type UserProfileModalProps = {
  activeUser: CloudUserRow;
  userProfileImage: string;
  userProfileName: string;
  setUserProfileName: (value: string) => void;
  userProfileError: string;
  isSavingUserProfile: boolean;
  isProcessingImage: boolean;
  saveUserProfileSettings: () => void;
  openUserProfileImagePicker: () => void;
  handleUserProfileImageFile: (file: File | undefined) => void;
  userProfileImageInputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
};

export const UserProfileModal = memo(function UserProfileModal({
  activeUser,
  userProfileImage,
  userProfileName,
  setUserProfileName,
  userProfileError,
  isSavingUserProfile,
  isProcessingImage,
  saveUserProfileSettings,
  openUserProfileImagePicker,
  handleUserProfileImageFile,
  userProfileImageInputRef,
  onClose,
}: UserProfileModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 sm:items-center">
      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">הפרופיל שלי</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700"
          >
            סגור
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="relative mx-auto mb-3 h-24 w-24">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-200">
              <SafeImage
                src={userProfileImage}
                alt="תמונת משתמש"
                width={96}
                height={96}
                className="h-full w-full object-cover"
                fallback={
                  <span className="text-3xl font-bold text-teal-700">
                    {userProfileName.trim().slice(0, 1) || "?"}
                  </span>
                }
              />
            </div>
            <button
              type="button"
              onClick={openUserProfileImagePicker}
              disabled={isProcessingImage}
              className="absolute -bottom-1 -left-1 flex h-8 w-8 items-center justify-center rounded-full border border-white bg-slate-900 text-white shadow-lg disabled:opacity-50"
              title={isProcessingImage ? "מעבד תמונה..." : "החלפת תמונה"}
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
              ref={userProfileImageInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => handleUserProfileImageFile(event.target.files?.[0])}
              className="hidden"
            />
          </div>

          <label className="block text-xs font-bold text-slate-600">
            שם לתצוגה
            <input
              value={userProfileName}
              onChange={(event) => setUserProfileName(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              placeholder="השם שיופיע בבית"
            />
          </label>
          <p className="mt-2 text-center text-xs font-bold text-slate-500">@{activeUser.username}</p>
        </div>

        {userProfileError && (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            {userProfileError}
          </p>
        )}

        <button
          type="button"
          onClick={saveUserProfileSettings}
          disabled={isSavingUserProfile}
          className="mt-4 min-h-11 w-full rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {isSavingUserProfile ? "שומר..." : "שמור פרופיל"}
        </button>
      </div>
    </div>
  );
});
