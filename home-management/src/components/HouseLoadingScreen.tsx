"use client";

import { HomeLogo } from "@/components/HomeLogo";
import { SafeImage } from "@/components/SafeImage";
import { LoadingBar } from "@/components/LoadingBar";
import type { CachedHouseMeta, HouseMemberUser } from "@/types";

type HouseLoadingScreenProps = {
  cachedHouseMeta: CachedHouseMeta | null;
  houseMembers: HouseMemberUser[];
};

export function HouseLoadingScreen({ cachedHouseMeta, houseMembers }: HouseLoadingScreenProps) {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl items-center px-4 py-8">
      <section className="w-full rounded-3xl border border-white/80 bg-white/95 p-6 text-center shadow-xl shadow-slate-200/70">
        <HomeLogo houseName={cachedHouseMeta?.name} houseImage={cachedHouseMeta?.house_image} />
        <p className="mt-4 text-sm font-bold text-slate-700">טוען את הבית שלך...</p>
        <p className="mt-2 text-xs text-slate-500">מסנכרן נתונים עדכניים מהענן.</p>
        <LoadingBar />
        {houseMembers.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {houseMembers.slice(0, 4).map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <SafeImage
                  src={member.avatar_url}
                  alt={member.display_name}
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-xl object-cover"
                  fallback={
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-100 text-xs font-bold text-teal-700">
                      {member.display_name.slice(0, 1)}
                    </span>
                  }
                />
                <span className="text-xs font-bold text-slate-700">{member.display_name}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
