"use client";

import * as Sentry from "@sentry/nextjs";

let initialized = false;

export function initMonitoring() {
  if (initialized || typeof window === "undefined") return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "production",
    tracesSampleRate: 0.1,
    // Disable session replay — not needed for this app
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Ignore common benign errors
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Network request failed",
      "Load failed",
      "UNIMPLEMENTED",
    ],
    beforeSend(event) {
      // Don't send errors in development
      if (process.env.NODE_ENV === "development") return null;
      return event;
    },
  });
  initialized = true;
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (context) Sentry.setContext("extra", context);
  Sentry.captureException(error);
}
