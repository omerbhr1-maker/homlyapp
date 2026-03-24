"use client";

import { useEffect, useRef, useState } from "react";

export function LoadingBar({ done }: { done?: boolean }) {
  const [pct, setPct] = useState(0);
  const pctRef = useRef(0);

  useEffect(() => {
    pctRef.current = 0;
    setPct(0);
    const timer = setInterval(() => {
      const cur = pctRef.current;
      if (cur >= 90) { clearInterval(timer); return; }
      const step = cur < 30 ? 9 : cur < 60 ? 6 : cur < 80 ? 3 : 1;
      pctRef.current = Math.min(90, cur + step);
      setPct(Math.round(pctRef.current));
    }, 130);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (done) setPct(100);
  }, [done]);

  return (
    <div className="mt-5">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-l from-teal-500 to-cyan-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs font-bold text-teal-600">{pct}%</p>
    </div>
  );
}
