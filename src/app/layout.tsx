import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/providers/session-provider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Motty Beats - מערכת ניהול לקוחות",
  description: "מערכת CRM לניהול לקוחות, עדכונים, מיילים ולידים",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-heebo antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
