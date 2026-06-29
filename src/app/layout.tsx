import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "logr — log your life",
  description:
    "A personal life-log built for two readers: humans, and the machines they raise. One timeline, kept once.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Fonts loaded by literal family name so the theme system's
            font-family variables (Geist, Geist Mono) resolve across all scopes.
            Loading via <link> in the App Router head is intended. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
