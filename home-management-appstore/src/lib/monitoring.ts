"use client";

type SentryModule = typeof import("@sentry/nextjs");
let sentry: SentryModule | null = null;

export async function initMonitoring() {
  if (sentry || typeof window === "undefined") return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  sentry = await import("@sentry/nextjs");
  sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "production",
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Network request failed",
      "Load failed",
      "UNIMPLEMENTED",
    ],
    beforeSend(event) {
      if (process.env.NODE_ENV === "development") return null;
      return event;
    },
  });
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!sentry) return;
  if (context) sentry.setContext("extra", context);
  sentry.captureException(error);
}
