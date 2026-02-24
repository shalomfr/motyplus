import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/providers/session-provider";

export const metadata: Metadata = {
  title: "MotyPlus - מערכת ניהול לקוחות",
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
