"use client";

import { useEffect, useRef, useState } from "react";

const PTR_THRESHOLD = 65;
// How long (ms) the page must be settled at the top before PTR is allowed.
// Prevents accidental triggers from fast momentum scrolls reaching scrollTop=0.
const PTR_SETTLE_DELAY = 220;

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
  // true only after the scroll has SETTLED at top — prevents fast-scroll false triggers
  const ptrSettledRef = useRef(false);
  const ptrSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Watch scroll position: lock PTR while scrolling, unlock after settling at top
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (ptrSettleTimerRef.current) clearTimeout(ptrSettleTimerRef.current);
      if (el.scrollTop > 2) {
        // Not at top — immediately lock
        ptrSettledRef.current = false;
      } else {
        // At top — wait for scroll momentum to fully stop before unlocking
        ptrSettleTimerRef.current = setTimeout(() => {
          ptrSettledRef.current = true;
        }, PTR_SETTLE_DELAY);
      }
    };
    // Initialise: if already at top on mount, settle immediately
    if (el.scrollTop <= 2) ptrSettledRef.current = true;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (ptrSettleTimerRef.current) clearTimeout(ptrSettleTimerRef.current);
    };
  }, [mainScrollRef]);

  useEffect(() => () => { if (ptrDoneTimerRef.current) clearTimeout(ptrDoneTimerRef.current); }, []);

  const handlePtrStart = (e: React.TouchEvent) => {
    const el = mainScrollRef.current;
    // Only allow PTR if scroll has SETTLED at the top (not just passing through)
    ptrAtTopRef.current = ptrSettledRef.current && (!el || el.scrollTop <= 2);
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
      // Reset position but keep spinner alive until refresh completes
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
