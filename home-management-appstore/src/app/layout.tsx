import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className="antialiased">
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
