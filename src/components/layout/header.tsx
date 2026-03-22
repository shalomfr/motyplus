"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu, Bell, Mail, Search, Calendar, LogOut, User, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";

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
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
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

interface SearchResult {
  id: number;
  fullName: string;
  phone: string;
  organName?: string;
}

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const pageTitle = getPageTitle(pathname);
  const userName = session?.user?.name || "משתמש";
  const isHome = pathname === "/";

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // User menu state
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Search debounce
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (q.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.customers?.slice(0, 6) || []);
          setSearchOpen(true);
        }
      } catch { /* ignore */ }
      finally { setSearchLoading(false); }
    }, 300);
  }, []);

  // Close search on navigate
  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setUserMenuOpen(false);
  }, [pathname]);

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

        {/* Search with results dropdown */}
        <div className="hidden md:block relative" ref={searchRef}>
          <input
            type="text"
            placeholder="חיפוש לקוח..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
            className="w-48 lg:w-56 pl-9 pr-4 py-2 border border-gray-200/80 rounded-full bg-white text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
            dir="rtl"
          />
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          {searchLoading && (
            <div className="absolute left-10 top-1/2 -translate-y-1/2">
              <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Search results dropdown */}
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 right-0 w-72 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <span className="text-xs text-gray-400 px-2">{searchResults.length} תוצאות</span>
              </div>
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    router.push(`/customers/${c.id}`);
                    setSearchOpen(false);
                    setSearchQuery("");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-right"
                >
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                    {c.fullName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">{c.fullName}</div>
                    <div className="text-xs text-gray-400 truncate">{c.organName || c.phone}</div>
                  </div>
                  <span className="text-xs text-gray-300 font-mono">{c.id}</span>
                </button>
              ))}
              <button
                onClick={() => {
                  router.push(`/customers?search=${encodeURIComponent(searchQuery)}`);
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
                className="w-full py-2.5 text-center text-xs font-semibold text-blue-600 hover:bg-blue-50 border-t border-gray-100"
              >
                חפש בכל הלקוחות →
              </button>
            </div>
          )}
          {searchOpen && searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading && (
            <div className="absolute top-full mt-2 right-0 w-72 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 p-6 text-center">
              <span className="text-sm text-gray-400">לא נמצאו תוצאות</span>
            </div>
          )}
        </div>

        {/* Mail button — navigate to emails */}
        <button
          onClick={() => router.push("/emails")}
          className="relative w-10 h-10 rounded-full bg-white border border-gray-200/80 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm"
          title="מיילים"
        >
          <Mail size={18} />
        </button>

        {/* Bell — navigate to activity log */}
        <button
          onClick={() => router.push("/activity-log")}
          className="relative w-10 h-10 rounded-full bg-white border border-gray-200/80 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm"
          title="יומן פעילות"
        >
          <Bell size={18} />
        </button>

        {/* User avatar + dropdown menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
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
          </button>

          {/* User dropdown */}
          {userMenuOpen && (
            <div className="absolute top-full mt-2 left-0 w-56 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 overflow-hidden">
              {/* User info */}
              <div className="p-4 border-b border-gray-100 text-center">
                <div className="w-12 h-12 rounded-full gradient-blue-btn flex items-center justify-center text-white font-bold text-lg mx-auto mb-2">
                  {userName.charAt(0)}
                </div>
                <div className="font-bold text-gray-800">{userName}</div>
                {session?.user?.email && (
                  <div className="text-xs text-gray-400 truncate" dir="ltr">{session.user.email}</div>
                )}
              </div>

              {/* Menu items */}
              <div className="p-1.5">
                <button
                  onClick={() => { setUserMenuOpen(false); router.push("/settings"); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <Settings size={16} />
                  <span>הגדרות</span>
                </button>
                <button
                  onClick={() => { setUserMenuOpen(false); router.push("/activity-log"); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <User size={16} />
                  <span>יומן פעילות</span>
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} />
                  <span>התנתק</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
