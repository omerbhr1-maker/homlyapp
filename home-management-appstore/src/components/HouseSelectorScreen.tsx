"use client";

import { SafeImage } from "@/components/SafeImage";
import type { CloudUserRow, CloudHouseRow } from "@/types";

type HouseSelectorScreenProps = {
  activeUser: CloudUserRow;
  houseCreateNameInput: string;
  setHouseCreateNameInput: (value: string) => void;
  handleCreateHouse: () => void;
  houseCreateLoading: boolean;
  joinTokenInput: string;
  setJoinTokenInput: (value: string) => void;
  handleJoinHouseByToken: (overrideCode?: string, fallbackHouseCode?: string) => Promise<boolean>;
  joinLoading: boolean;
  memberHouses: CloudHouseRow[];
  applyActiveHouse: (house: CloudHouseRow) => void;
  houseListError: string;
};

export function HouseSelectorScreen({
  activeUser,
  houseCreateNameInput,
  setHouseCreateNameInput,
  handleCreateHouse,
  houseCreateLoading,
  joinTokenInput,
  setJoinTokenInput,
  handleJoinHouseByToken,
  joinLoading,
  memberHouses,
  applyActiveHouse,
  houseListError,
}: HouseSelectorScreenProps) {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl items-center px-4 py-8">
      <section className="w-full rounded-3xl border border-white/80 bg-white/95 p-5 shadow-xl shadow-slate-200/70 sm:p-7">
        <div className="flex items-center gap-3">
          <SafeImage
            src={activeUser.avatar_url}
            alt="תמונת משתמש"
            width={52}
            height={52}
            className="h-13 w-13 rounded-2xl border border-slate-200 object-cover"
            fallback={
              <span className="flex h-13 w-13 items-center justify-center rounded-2xl bg-teal-100 text-lg font-bold text-teal-700">
                {activeUser.display_name.slice(0, 1)}
              </span>
            }
          />
          <div>
            <h2 className="text-lg font-bold text-slate-900">{activeUser.display_name}</h2>
            <p className="text-xs font-bold text-slate-500">@{activeUser.username}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-800">יצירת בית חדש</p>
            <input
              value={houseCreateNameInput}
              onChange={(event) => setHouseCreateNameInput(event.target.value)}
              placeholder="שם הבית"
              className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            <button
              type="button"
              onClick={handleCreateHouse}
              disabled={houseCreateLoading}
              className="mt-2 min-h-11 w-full rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {houseCreateLoading ? "יוצר..." : "צור בית"}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-800">הצטרפות לבית קיים</p>
            <input
              value={joinTokenInput}
              onChange={(event) => setJoinTokenInput(event.target.value.toUpperCase())}
              placeholder="קוד הזמנה"
              className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm uppercase outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            <button
              type="button"
              onClick={() => {
                void handleJoinHouseByToken();
              }}
              disabled={joinLoading}
              className="mt-2 min-h-11 w-full rounded-2xl bg-teal-600 px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {joinLoading ? "מצרף..." : "הצטרף לבית"}
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold text-slate-800">הבתים שלי</p>
          {memberHouses.length === 0 ? (
            <p className="mt-2 text-xs font-bold text-slate-500">עדיין אין לך בתים. צור בית או הצטרף בהזמנה.</p>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {memberHouses.map((house) => (
                <button
                  key={house.id}
                  type="button"
                  onClick={() => applyActiveHouse(house)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-right transition hover:bg-slate-100"
                >
                  <p className="text-sm font-bold text-slate-900">{house.name}</p>
                  <p className="text-xs font-bold text-slate-500">{house.id}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {houseListError && <p className="mt-3 text-xs font-bold text-rose-600">{houseListError}</p>}
      </section>
    </main>
  );
}
