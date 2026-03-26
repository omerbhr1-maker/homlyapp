"use client";

import { useEffect, useRef, useState } from "react";

const PTR_THRESHOLD = 65;

export function usePullToRefresh({
  mainScrollRef,
  onRefresh,
}: {
  mainScrollRef: React.RefObject<HTMLElement | null>;
  onRefresh: () => Promise<void>;
}) {
  const [ptrDist, setPtrDist] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPtrDone, setIsPtrDone] = useState(false);
  const ptrStartYRef = useRef(0);
  const ptrAtTopRef = useRef(false);
  const ptrDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (ptrDoneTimerRef.current) clearTimeout(ptrDoneTimerRef.current); }, []);

  const handlePtrStart = (e: React.TouchEvent) => {
    const el = mainScrollRef.current;
    ptrAtTopRef.current = !el || el.scrollTop <= 0;
    ptrStartYRef.current = e.touches[0].clientY;
  };

  const handlePtrMove = (e: React.TouchEvent) => {
    if (!ptrAtTopRef.current || isRefreshing) return;
    const dy = e.touches[0].clientY - ptrStartYRef.current;
    if (dy <= 0) { setPtrDist(0); return; }
    // Apply resistance so it doesn't stretch too far
    setPtrDist(Math.min(dy * 0.45, 80));
  };

  const handlePtrEnd = async () => {
    if (ptrDist >= PTR_THRESHOLD && !isRefreshing) {
      setPtrDist(0);
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
      setIsPtrDone(true);
      if (ptrDoneTimerRef.current) clearTimeout(ptrDoneTimerRef.current);
      ptrDoneTimerRef.current = setTimeout(() => setIsPtrDone(false), 900);
    } else {
      setPtrDist(0);
    }
  };

  return {
    ptrDist,
    isRefreshing,
    isPtrDone,
    PTR_THRESHOLD,
    handlePtrStart,
    handlePtrMove,
    handlePtrEnd,
  };
}
