import { SafeImage } from "@/components/SafeImage";

export function HomeLogo({ houseName, houseImage }: { houseName?: string; houseImage?: string }) {
  return (
    <div className="flex items-center gap-3">
      <SafeImage
        src={houseImage}
        alt="תמונת בית"
        width={44}
        height={44}
        className="h-11 w-11 rounded-2xl border border-slate-200 object-cover shadow-lg shadow-slate-200"
        fallback={
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 via-cyan-500 to-sky-500 text-white shadow-lg shadow-teal-200">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 10.6 12 4l8 6.6V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
              <path d="M9 20v-6.2" />
              <path d="M15 20v-6.2" />
              <path d="M9 14h6" />
              <path d="M16.8 6.1V4.6" />
              <path d="M18.4 3.2v2.1" />
              <path d="M17.35 4.25h2.1" />
            </svg>
          </span>
        }
      />
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{houseName || "Homly"}</h1>
        <p className="text-sm text-slate-500 sm:text-base">
          {houseName ? "Homly" : "ניהול בית חכם, מהיר ונוח"}
        </p>
      </div>
    </div>
  );
}
