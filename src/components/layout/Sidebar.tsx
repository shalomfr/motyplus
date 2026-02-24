"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Home,
  Users,
  RefreshCw,
  Mail,
  Target,
  Database,
  Percent,
  ScrollText,
  Settings,
  LogOut,
  X,
  ChevronRight,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedLogo } from "@/components/ui/AnimatedLogo";

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "דף הבית", icon: Home, path: "/" },
  { label: "לקוחות", icon: Users, path: "/customers" },
  { label: "עדכונים", icon: RefreshCw, path: "/updates" },
  { label: "מיילים", icon: Mail, path: "/emails" },
  { label: "לידים", icon: Target, path: "/leads" },
  { label: "נתונים", icon: Database, path: "/data" },
  { label: "מבצעים", icon: Percent, path: "/promotions" },
  { label: "יומן פעילות", icon: ScrollText, path: "/activity-log" },
  { label: "הגדרות", icon: Settings, path: "/settings" },
];

interface SidebarProps {
  userName?: string;
  userEmail?: string;
  isMobileOpen: boolean;
  onMobileToggle: () => void;
}

export function Sidebar({
  userName = "משתמש",
  userEmail = "",
  isMobileOpen,
  onMobileToggle,
}: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    if (isMobileOpen) {
      onMobileToggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex flex-col bg-gray-900 text-white transition-all duration-300",
          "md:static md:z-auto",
          isMobileOpen ? "translate-x-0" : "translate-x-full",
          "md:translate-x-0",
          isCollapsed ? "md:w-20" : "md:w-64",
          "w-64"
        )}
      >
        {/* Logo / Title area */}
        <div
          className={cn(
            "flex items-center border-b border-gray-700 p-4 min-h-[72px]",
            isCollapsed ? "justify-center flex-col gap-2" : "justify-between"
          )}
        >
          <AnimatedLogo size={isCollapsed ? 36 : 44} />

          <div className="flex items-center gap-1">
            {/* Mobile close button */}
            <button
              onClick={onMobileToggle}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors md:hidden"
              aria-label="סגור תפריט"
            >
              <X size={20} />
            </button>

            {/* Desktop collapse toggle */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex p-2 rounded-lg hover:bg-gray-800 transition-colors"
              aria-label={isCollapsed ? "הרחב תפריט" : "כווץ תפריט"}
            >
              {isCollapsed ? (
                <ChevronLeft size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === "/"
                ? pathname === "/"
                : pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white",
                  isCollapsed && "justify-center px-2"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={20} className="shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="border-t border-gray-700 p-4">
          {!isCollapsed && (
            <div className="mb-3 px-1">
              <p className="text-sm font-semibold text-white truncate">
                {userName}
              </p>
              {userEmail && (
                <p className="text-xs text-gray-400 truncate">{userEmail}</p>
              )}
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors",
              isCollapsed && "justify-center px-2"
            )}
            title={isCollapsed ? "התנתק" : undefined}
          >
            <LogOut size={20} className="shrink-0" />
            {!isCollapsed && <span>התנתק</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
