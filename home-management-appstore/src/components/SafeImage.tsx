"use client";

import { useEffect, useState } from "react";

export function SafeImage({
  src,
  alt,
  width,
  height,
  className,
  fallback,
}: {
  src?: string;
  alt: string;
  width: number;
  height: number;
  className: string;
  fallback: React.ReactNode;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
}
