"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu, User } from "lucide-react";
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
  // Exact match first
  if (ROUTE_TITLES[pathname]) {
    return ROUTE_TITLES[pathname];
  }
  // Prefix match for nested routes
  const match = Object.entries(ROUTE_TITLES).find(
    ([path]) => path !== "/" && pathname.startsWith(path)
  );
  return match ? match[1] : "MotyPlus";
}

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const pageTitle = getPageTitle(pathname);
  const userName = session?.user?.name || "משתמש";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-white border-b border-gray-200 px-4 sm:px-6 py-3 min-h-[64px]">
      {/* Right side: mobile menu + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors md:hidden"
          aria-label="פתח תפריט"
        >
          <Menu size={22} />
        </button>
        <h1 className="text-lg sm:text-xl font-bold text-gray-800 truncate">
          {pageTitle}
        </h1>
      </div>

      {/* Left side: user info */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 hidden sm:block">
          {userName}
        </span>
        <div
          className={cn(
            "w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center",
            "text-blue-600 font-semibold text-sm"
          )}
        >
          {session?.user?.name ? (
            <span>{session.user.name.charAt(0)}</span>
          ) : (
            <User size={18} />
          )}
        </div>
      </div>
    </header>
  );
}
