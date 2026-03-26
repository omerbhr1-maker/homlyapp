import { memo } from "react";

type InviteModalProps = {
  invitePhone: string;
  onInvitePhoneChange: (value: string) => void;
  inviteIdentifierInput: string;
  onInviteIdentifierChange: (value: string) => void;
  inviteByUserLoading: boolean;
  inviteToken: string;
  inviteLink: string;
  normalizedPhone: string;
  smsHref: string;
  inviteFeedback: string;
  houseId?: string;
  onInviteMember: () => void;
  onShareLink: () => void;
  onCopyLink: () => void;
  onClose: () => void;
};

export const InviteModal = memo(function InviteModal({
  invitePhone,
  onInvitePhoneChange,
  inviteIdentifierInput,
  onInviteIdentifierChange,
  inviteByUserLoading,
  inviteToken,
  inviteLink,
  normalizedPhone,
  smsHref,
  inviteFeedback,
  houseId,
  onInviteMember,
  onShareLink,
  onCopyLink,
  onClose,
}: InviteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 dark:bg-black/70 p-2 sm:items-center sm:p-3">
      <div className="w-full max-w-[min(100vw-0.75rem,30rem)] rounded-3xl border border-white/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 p-4 shadow-2xl dark:shadow-slate-900/50 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">שיתוף והזמנה לבית</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            סגור
          </button>
        </div>

        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
          מספר טלפון להזמנה ב־SMS
          <input
            type="tel"
            inputMode="tel"
            dir="ltr"
            value={invitePhone}
            onChange={(event) => onInvitePhoneChange(event.target.value)}
            placeholder="0501234567"
            className="mt-1 min-h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-600"
          />
        </label>

        <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 p-3">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">הזמנה לפי שם משתמש או אימייל</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
            <input
              type="text"
              value={inviteIdentifierInput}
              onChange={(event) => onInviteIdentifierChange(event.target.value)}
              placeholder="שם משתמש או אימייל"
              className="min-h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 px-3 py-2 text-right text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-600"
            />
            <button
              type="button"
              onClick={onInviteMember}
              disabled={inviteByUserLoading}
              className="min-h-11 rounded-2xl bg-teal-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-500 disabled:opacity-50"
            >
              {inviteByUserLoading ? "שולח..." : "הזמן לבית"}
            </button>
          </div>
        </div>

        <div className="mt-2 rounded-xl bg-slate-50 dark:bg-slate-900 px-3 py-2">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">קוד הזמנה</p>
          <p className="text-sm font-bold tracking-wider text-slate-800 dark:text-slate-100">
            {inviteToken || houseId || "-"}
          </p>
          <p className="mt-1 truncate text-[11px] font-bold text-slate-500 dark:text-slate-400" dir="ltr">
            {inviteLink || ""}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <a
            href={normalizedPhone ? smsHref : "#"}
            className={`flex min-h-11 items-center justify-center rounded-2xl px-4 py-2 text-sm font-bold text-white transition ${
              normalizedPhone
                ? "bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600"
                : "pointer-events-none bg-slate-300 dark:bg-slate-600"
            }`}
          >
            שליחת SMS
          </a>
          <button
            type="button"
            onClick={onShareLink}
            className="min-h-11 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            שיתוף לינק
          </button>
          <button
            type="button"
            onClick={onCopyLink}
            className="min-h-11 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700 sm:col-span-2"
          >
            העתקת לינק לבית
          </button>
        </div>

        {inviteFeedback && (
          <p className="mt-2 rounded-xl bg-teal-50 dark:bg-teal-900/40 px-3 py-2 text-xs font-bold text-teal-700 dark:text-teal-400">
            {inviteFeedback}
          </p>
        )}
      </div>
    </div>
  );
});
