"use client";

import React from "react";
import Image from "next/image";
import { HomeLogo } from "@/components/HomeLogo";
import { passthroughImageLoader } from "@/lib/utils";

type AuthScreenProps = {
  authMode: "login" | "create";
  usernameInput: string;
  emailInput: string;
  userPasswordInput: string;
  displayNameInput: string;
  userAvatarInput: string;
  isProcessingImage: boolean;
  authError: string;
  authLoading: boolean;
  isForgotPasswordOpen: boolean;
  forgotPasswordIdentifier: string;
  forgotPasswordError: string;
  forgotPasswordFeedback: string;
  isForgotPasswordLoading: boolean;
  isRecoveryMode: boolean;
  recoveryPasswordInput: string;
  recoveryPasswordConfirmInput: string;
  recoveryPasswordError: string;
  recoveryPasswordFeedback: string;
  isRecoveryPasswordLoading: boolean;
  setAuthMode: (mode: "login" | "create") => void;
  setAuthError: (value: string) => void;
  setUsernameInput: (value: string) => void;
  setEmailInput: (value: string) => void;
  setUserPasswordInput: (value: string) => void;
  setDisplayNameInput: (value: string) => void;
  setUserAvatarInput: (value: string) => void;
  setIsForgotPasswordOpen: (value: boolean) => void;
  setForgotPasswordIdentifier: (value: string) => void;
  setForgotPasswordError: (value: string) => void;
  setForgotPasswordFeedback: (value: string) => void;
  setRecoveryPasswordInput: (value: string) => void;
  setRecoveryPasswordConfirmInput: (value: string) => void;
  handleCreateUser: () => void;
  handleLoginUser: () => void;
  handleForgotPassword: () => void;
  handleRecoveryPasswordUpdate: () => void;
  handleUserAvatarFile: (file: File | undefined) => void;
  openUserAvatarPicker: () => void;
  userAvatarInputRef: React.RefObject<HTMLInputElement | null>;
};

export function AuthScreen({
  authMode,
  usernameInput,
  emailInput,
  userPasswordInput,
  displayNameInput,
  userAvatarInput,
  isProcessingImage,
  authError,
  authLoading,
  isForgotPasswordOpen,
  forgotPasswordIdentifier,
  forgotPasswordError,
  forgotPasswordFeedback,
  isForgotPasswordLoading,
  isRecoveryMode,
  recoveryPasswordInput,
  recoveryPasswordConfirmInput,
  recoveryPasswordError,
  recoveryPasswordFeedback,
  isRecoveryPasswordLoading,
  setAuthMode,
  setAuthError,
  setUsernameInput,
  setEmailInput,
  setUserPasswordInput,
  setDisplayNameInput,
  setUserAvatarInput,
  setIsForgotPasswordOpen,
  setForgotPasswordIdentifier,
  setForgotPasswordError,
  setForgotPasswordFeedback,
  setRecoveryPasswordInput,
  setRecoveryPasswordConfirmInput,
  handleCreateUser,
  handleLoginUser,
  handleForgotPassword,
  handleRecoveryPasswordUpdate,
  handleUserAvatarFile,
  openUserAvatarPicker,
  userAvatarInputRef,
}: AuthScreenProps) {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl items-center px-4 py-8">
      <section className="w-full rounded-3xl border border-white/80 bg-white/95 dark:bg-slate-800/95 dark:border-slate-700/80 p-5 shadow-xl shadow-slate-200/70 dark:shadow-slate-900/50 sm:p-7">
        <HomeLogo />
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">התחברות היא לפי משתמש אישי. אחרי זה נכנסים לבית.</p>

        {isRecoveryMode && (
          <div className="mt-4 rounded-2xl border border-teal-200 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/40 p-3">
            <p className="text-xs font-bold text-teal-700 dark:text-teal-400">איפוס סיסמה</p>
            <p className="mt-1 text-xs text-teal-700 dark:text-teal-400">הכנס סיסמה חדשה כדי להשלים את תהליך האיפוס.</p>
            <div className="mt-2 space-y-2">
              <input
                value={recoveryPasswordInput}
                onChange={(event) => setRecoveryPasswordInput(event.target.value)}
                type="password"
                placeholder="סיסמה חדשה"
                className="min-h-11 w-full rounded-2xl border border-teal-200 dark:border-teal-700 bg-white dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-600"
              />
              <input
                value={recoveryPasswordConfirmInput}
                onChange={(event) => setRecoveryPasswordConfirmInput(event.target.value)}
                type="password"
                placeholder="אימות סיסמה חדשה"
                className="min-h-11 w-full rounded-2xl border border-teal-200 dark:border-teal-700 bg-white dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-600"
              />
              <button
                type="button"
                onClick={handleRecoveryPasswordUpdate}
                disabled={isRecoveryPasswordLoading}
                className="min-h-11 w-full rounded-2xl bg-teal-600 text-sm font-bold text-white disabled:opacity-50"
              >
                {isRecoveryPasswordLoading ? "מעדכן..." : "עדכן סיסמה"}
              </button>
            </div>
            {recoveryPasswordError && (
              <p className="mt-2 text-xs font-bold text-rose-600">{recoveryPasswordError}</p>
            )}
            {recoveryPasswordFeedback && (
              <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-400">{recoveryPasswordFeedback}</p>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-2 rounded-2xl bg-slate-100 dark:bg-slate-700 p-1">
          <button
            type="button"
            onClick={() => {
              setAuthMode("login");
              setAuthError("");
              setIsForgotPasswordOpen(false);
            }}
            className={`flex-1 rounded-xl py-2 text-sm font-bold ${
              authMode === "login" ? "bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-400" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            התחברות משתמש
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode("create");
              setAuthError("");
              setIsForgotPasswordOpen(false);
            }}
            className={`flex-1 rounded-xl py-2 text-sm font-bold ${
              authMode === "create" ? "bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-400" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            יצירת משתמש
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {authMode === "create" && (
            <>
              <input
                value={displayNameInput}
                onChange={(event) => setDisplayNameInput(event.target.value)}
                placeholder="שם מלא להצגה"
                className="min-h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-600"
              />
              <input
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                type="email"
                dir="ltr"
                placeholder="אימייל (לכניסה ולאיפוס סיסמה)"
                className="min-h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-600"
              />
              <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 p-3">
                <p className="mb-2 text-xs font-bold text-slate-600 dark:text-slate-300">תמונת פרופיל (אופציונלי)</p>
                <div className="flex items-center gap-3">
                  {userAvatarInput ? (
                    <Image
                      loader={passthroughImageLoader}
                      unoptimized
                      src={userAvatarInput}
                      alt="תמונת פרופיל"
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-2xl border border-slate-200 dark:border-slate-600 object-cover"
                    />
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 dark:bg-teal-900/60 text-sm font-bold text-teal-700 dark:text-teal-400">
                      {displayNameInput.trim().slice(0, 1) || "?"}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={openUserAvatarPicker}
                    disabled={isProcessingImage}
                    className="min-h-10 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                  >
                    {isProcessingImage ? "מעבד תמונה..." : "העלאת תמונה"}
                  </button>
                  {userAvatarInput && (
                    <button
                      type="button"
                      onClick={() => setUserAvatarInput("")}
                      className="min-h-10 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-xs font-bold text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      הסרה
                    </button>
                  )}
                  <input
                    ref={userAvatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleUserAvatarFile(event.target.files?.[0])}
                    className="hidden"
                  />
                </div>
              </div>
            </>
          )}
          <input
            value={usernameInput}
            onChange={(event) => setUsernameInput(event.target.value)}
            dir={authMode === "login" ? "rtl" : undefined}
            placeholder={authMode === "create" ? "שם משתמש" : "מייל/שם משתמש"}
            className="min-h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 px-3 text-right text-sm outline-none placeholder:text-right focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-600"
          />
          <input
            value={userPasswordInput}
            onChange={(event) => setUserPasswordInput(event.target.value)}
            type="password"
            placeholder="סיסמה"
            className="min-h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-600"
          />
          <button
            type="button"
            onClick={authMode === "create" ? handleCreateUser : handleLoginUser}
            disabled={authLoading}
            className="min-h-11 w-full rounded-2xl bg-gradient-to-l from-teal-600 to-cyan-600 text-sm font-bold text-white disabled:opacity-50"
          >
            {authLoading
              ? "טוען..."
              : authMode === "create"
                ? "צור משתמש"
                : "התחבר"}
          </button>
          {authMode === "login" && (
            <button
              type="button"
              onClick={() => {
                setForgotPasswordIdentifier(usernameInput.includes("@") ? usernameInput : "");
                setForgotPasswordError("");
                setForgotPasswordFeedback("");
                setIsForgotPasswordOpen(true);
              }}
              className="w-full text-center text-xs font-bold text-slate-500 dark:text-slate-400 underline-offset-2 transition hover:text-slate-700 dark:hover:text-slate-200 hover:underline"
            >
              שכחתי סיסמה
            </button>
          )}
        </div>

        {authError && <p className="mt-3 text-xs font-bold text-rose-600">{authError}</p>}
        {recoveryPasswordFeedback && (
          <p className="mt-3 text-xs font-bold text-teal-700 dark:text-teal-400">{recoveryPasswordFeedback}</p>
        )}
        {isForgotPasswordOpen && (
          <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">שחזור סיסמה</p>
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(false)}
                className="rounded-xl bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300"
              >
                סגור
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              הזן אימייל הרשמה. נשלח קישור לאיפוס סיסמה.
            </p>
            <input
              value={forgotPasswordIdentifier}
              onChange={(event) => setForgotPasswordIdentifier(event.target.value)}
              type="email"
              dir="ltr"
              placeholder="אימייל"
              className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-600"
            />
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={isForgotPasswordLoading}
              className="mt-2 min-h-11 w-full rounded-2xl bg-slate-900 dark:bg-slate-700 text-sm font-bold text-white disabled:opacity-50"
            >
              {isForgotPasswordLoading ? "שולח..." : "שלח קישור איפוס"}
            </button>
            {forgotPasswordError && (
              <p className="mt-2 text-xs font-bold text-rose-600">{forgotPasswordError}</p>
            )}
            {forgotPasswordFeedback && (
              <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-400">{forgotPasswordFeedback}</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
