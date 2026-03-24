"use client";

import { useEffect, useRef, useState } from "react";

export function useNavDrag() {
  const [isNavHidden, setIsNavHidden] = useState(false);
  const [navDragY, setNavDragY] = useState(0);
  const navDragStartRef = useRef(0);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const prev = lastScrollTopRef.current;
      if (scrollTop > prev && scrollTop > 50) {
        setIsNavHidden(true);
      } else if (scrollTop < prev) {
        setIsNavHidden(false);
      }
      lastScrollTopRef.current = scrollTop;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavDragStart = (e: React.TouchEvent) => {
    navDragStartRef.current = e.touches[0].clientY;
  };

  const handleNavDragMove = (e: React.TouchEvent) => {
    const dy = e.touches[0].clientY - navDragStartRef.current;
    if (dy <= 0) return;
    setNavDragY(Math.min(dy, 130));
  };

  const handleNavDragEnd = () => {
    if (navDragY >= 55) {
      setNavDragY(0);
      setIsNavHidden(true);
    } else {
      setNavDragY(0);
    }
  };

  return {
    isNavHidden,
    setIsNavHidden,
    navDragY,
    handleNavDragStart,
    handleNavDragMove,
    handleNavDragEnd,
  };
}
