"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <main
          dir="rtl"
          className="mx-auto flex min-h-[100dvh] w-full max-w-xl items-center justify-center px-4 py-8"
        >
          <section className="w-full rounded-3xl border border-rose-200 bg-white p-6 shadow-xl text-center">
            <div className="mb-4 flex justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                <svg
                  viewBox="0 0 24 24"
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
                </svg>
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">אירעה שגיאה בלתי צפויה</h2>
            <p className="mt-2 text-sm text-slate-600">
              משהו השתבש. אפשר לרענן את הדף כדי לנסות שוב.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 min-h-11 w-full rounded-2xl bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              רענן דף
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
