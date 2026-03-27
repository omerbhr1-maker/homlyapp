import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Analytics } from "@vercel/analytics/next";

const ICON_VERSION = "20260308";

export const metadata: Metadata = {
  title: "Homly",
  description: "Homly - אפליקציית ניהול בית בעברית",
  applicationName: "Homly",
  appleWebApp: {
    capable: true,
    title: "Homly",
    statusBarStyle: "default",
  },
  manifest: `/site.webmanifest?v=${ICON_VERSION}`,
  icons: {
    icon: [
      { url: `/favicon.ico?v=${ICON_VERSION}`, type: "image/x-icon", sizes: "any" },
      { url: `/icon-192.png?v=${ICON_VERSION}`, type: "image/png", sizes: "192x192" },
      { url: `/icon-512.png?v=${ICON_VERSION}`, type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: `/apple-touch-icon.png?v=${ICON_VERSION}`, sizes: "180x180", type: "image/png" },
    ],
    shortcut: [`/favicon.ico?v=${ICON_VERSION}`],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#14b8a6" },
    { media: "(prefers-color-scheme: dark)", color: "#0f766e" },
  ],
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <head>
        {SUPABASE_URL && (
          <link rel="preconnect" href={SUPABASE_URL} crossOrigin="anonymous" />
        )}
      </head>
      <body className="antialiased">
        <ErrorBoundary>{children}</ErrorBoundary>
        <Analytics />
      </body>
    </html>
  );
}
