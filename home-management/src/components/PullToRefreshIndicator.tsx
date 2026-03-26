"use client";

type PullToRefreshIndicatorProps = {
  ptrDist: number;
  isRefreshing: boolean;
  isPtrDone: boolean;
  ptrThreshold: number;
};

export function PullToRefreshIndicator({
  ptrDist,
  isRefreshing,
  isPtrDone,
  ptrThreshold,
}: PullToRefreshIndicatorProps) {
  if (ptrDist === 0 && !isRefreshing && !isPtrDone) return null;

  const progress = Math.min(ptrDist / ptrThreshold, 1);
  const r = 14;
  const circumference = 2 * Math.PI * r;
  const dashOffset = isRefreshing || isPtrDone ? 0 : circumference * (1 - progress);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-50 flex items-center justify-center"
      style={{
        paddingTop: `${isRefreshing || isPtrDone ? 14 : Math.max(4, ptrDist * 0.5)}px`,
        transition: "padding-top 0.15s",
      }}
    >
      <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-lg shadow-slate-200 dark:shadow-slate-900/50">
        <svg
          viewBox="0 0 34 34"
          className={`absolute inset-0 h-full w-full -rotate-90 ${isRefreshing || isPtrDone ? "animate-spin" : ""}`}
        >
          <circle cx="17" cy="17" r={r} fill="none" stroke="#e2e8f0" strokeWidth="2" />
          <circle
            cx="17"
            cy="17"
            r={r}
            fill="none"
            stroke={isRefreshing || isPtrDone || progress >= 1 ? "#14b8a6" : "#94a3b8"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={`${dashOffset}`}
          />
        </svg>
        {isPtrDone ? (
          <svg
            viewBox="0 0 24 24"
            className="relative z-10 h-4 w-4 text-teal-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className={`relative z-10 h-4 w-4 ${progress >= 1 || isRefreshing ? "text-teal-500" : "text-slate-400 dark:text-slate-500"} ${isRefreshing ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        )}
      </div>
    </div>
  );
}
