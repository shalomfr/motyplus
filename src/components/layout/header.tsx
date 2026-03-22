"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu, Bell, Mail, Search, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const ROUTE_TITLES: Record<string, string> = {
  "/": "דף הבית",
  "/customers": "לקוחות",
  "/updates": "עדכונים",
  "/emails": "מיילים",
  "/leads": "לידים",
  "/data": "נתונים",
  "/promotions": "מבצעים",
  "/activity-log": "יומן פעילות",
  "/settings": "הגדרות",
};

function getPageTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) {
    return ROUTE_TITLES[pathname];
  }
  const match = Object.entries(ROUTE_TITLES).find(
    ([path]) => path !== "/" && pathname.startsWith(path)
  );
  return match ? match[1] : "Motty Beats";
}

function getHebrewDate(): string {
  const now = new Date();
  const months = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  return `${now.getDate()} ${months[now.getMonth()]}, ${now.getFullYear()}`;
}

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const pageTitle = getPageTitle(pathname);
  const userName = session?.user?.name || "משתמש";
  const isHome = pathname === "/";

  return (
    <header className="sticky top-0 z-30 glass-header px-4 sm:px-6 py-3 min-h-[64px]">
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onMobileMenuToggle}
          className="p-2 rounded-lg hover:bg-gray-100/60 transition-colors md:hidden text-gray-700"
          aria-label="פתח תפריט"
        >
          <Menu size={22} />
        </button>

        {/* Greeting / Title */}
        <div className="flex-1 min-w-0">
          {isHome ? (
            <>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">
                שלום {userName}!
              </h1>
              <p className="text-sm text-gray-500 hidden sm:block">
                מדוד את הצמיחה החודשית — ניהול לקוחות, עדכונים ותשלומים
              </p>
            </>
          ) : (
            <h1 className="text-lg sm:text-xl font-bold text-gray-800 truncate">
              {pageTitle}
            </h1>
          )}
        </div>

        {/* Date pill */}
        <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-white border border-gray-200/80 rounded-xl text-sm text-gray-500 shadow-sm">
          <Calendar size={15} />
          <span>{getHebrewDate()}</span>
        </div>

        {/* Search */}
        <div className="hidden md:block relative">
          <input
            type="text"
            placeholder="חיפוש..."
            className="w-48 lg:w-56 pl-9 pr-4 py-2 border border-gray-200/80 rounded-full bg-white text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
          />
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        {/* Notification icons */}
        <div className="flex items-center gap-2">
          <button className="relative w-10 h-10 rounded-full bg-white border border-gray-200/80 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm">
            <Mail size={18} />
            <span className="absolute top-1 left-1.5 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-white" />
          </button>
          <button className="relative w-10 h-10 rounded-full bg-white border border-gray-200/80 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm">
            <Bell size={18} />
            <span className="absolute top-1 left-1.5 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-white" />
          </button>
        </div>

        {/* User avatar */}
        <div
          className={cn(
            "w-10 h-10 rounded-full gradient-blue-btn flex items-center justify-center font-heebo",
            "text-white font-bold text-sm border-[3px] border-white shadow-md cursor-pointer hover:scale-105 transition-transform"
          )}
        >
          {session?.user?.name ? (
            <span>{session.user.name.charAt(0)}</span>
          ) : (
            <span>מ</span>
          )}
        </div>
      </div>
    </header>
  );
}
