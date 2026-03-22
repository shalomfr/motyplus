"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Home, Users, RefreshCw, Mail, Target, Database, Percent,
  ScrollText, LayoutDashboard, ClipboardList, Receipt, Settings,
  LogOut, X, ChevronRight, ChevronLeft, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedLogo } from "@/components/ui/AnimatedLogo";

interface NavItem { label: string; icon: LucideIcon; path: string; }

const NAV_ITEMS: NavItem[] = [
  { label: "דף הבית", icon: Home, path: "/" },
  { label: "לקוחות", icon: Users, path: "/customers" },
  { label: "עדכונים", icon: RefreshCw, path: "/updates" },
  { label: "מיילים", icon: Mail, path: "/emails" },
  { label: "לידים", icon: Target, path: "/leads" },
  { label: "נתונים", icon: Database, path: "/data" },
  { label: "מבצעים", icon: Percent, path: "/promotions" },
  { label: "לוח בקרה", icon: LayoutDashboard, path: "/dashboard" },
  { label: "חשבונות", icon: Receipt, path: "/accounting" },
  { label: "יומן פעילות", icon: ScrollText, path: "/activity-log" },
  { label: "משימות", icon: ClipboardList, path: "/tasks" },
];

interface SidebarProps {
  userName?: string;
  userEmail?: string;
  isMobileOpen: boolean;
  onMobileToggle: () => void;
  isCollapsed?: boolean;
  onCollapseToggle?: () => void;
}

export function Sidebar({
  userName = "משתמש",
  userEmail = "",
  isMobileOpen,
  onMobileToggle,
  isCollapsed = true,
  onCollapseToggle,
}: SidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (isMobileOpen) onMobileToggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const allItems = [...NAV_ITEMS, { label: "הגדרות", icon: Settings, path: "/settings" }];

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={onMobileToggle} />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex flex-col glass-sidebar text-gray-700 w-64 transition-transform duration-300 md:hidden",
          isMobileOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-200/60 p-4 min-h-[72px]">
          <AnimatedLogo size={36} />
          <button onClick={onMobileToggle} className="p-2 rounded-lg hover:bg-gray-100/60"><X size={20} /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {allItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === "/" ? pathname === "/" : pathname.startsWith(item.path);
            return (
              <Link key={item.path} href={item.path}
                className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                  isActive ? "gradient-blue-btn text-white shadow-lg" : "text-gray-600 hover:bg-blue-50/60 hover:text-blue-800"
                )}>
                <Icon size={20} className="shrink-0" /><span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-200/60 p-4">
          <div className="mb-3 px-1">
            <p className="text-sm font-semibold text-gray-800 truncate">{userName}</p>
            {userEmail && <p className="text-xs text-gray-500 truncate">{userEmail}</p>}
          </div>
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50/60">
            <LogOut size={20} className="shrink-0" /><span>התנתק</span>
          </button>
        </div>
      </aside>

      {/* Desktop sidebar — static, pushes content */}
      <aside
        className={cn(
          "hidden md:flex flex-col glass-sidebar transition-all duration-300 shrink-0",
          isCollapsed ? "w-[72px] items-center py-5" : "w-64 py-4"
        )}
      >
        {/* Logo + toggle */}
        <div className={cn("flex items-center min-h-[56px] mb-2", isCollapsed ? "justify-center px-2.5" : "justify-between px-4 border-b border-gray-200/60 pb-4")}>
          <AnimatedLogo size={isCollapsed ? 40 : 44} />
          {!isCollapsed && (
            <button onClick={onCollapseToggle} className="p-2 rounded-lg hover:bg-gray-100/60 text-gray-400 hover:text-gray-600">
              <ChevronRight size={18} />
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {isCollapsed && (
          <button
            onClick={onCollapseToggle}
            className="mb-3 w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
        )}

        {/* Nav */}
        <nav className={cn("flex-1 overflow-y-auto", isCollapsed ? "flex flex-col items-center gap-1 w-full px-2.5" : "px-3 py-2 space-y-1")}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === "/" ? pathname === "/" : pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  isCollapsed
                    ? cn("w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200",
                        isActive ? "gradient-blue-btn text-white shadow-lg" : "text-gray-400 hover:bg-blue-50 hover:text-blue-700")
                    : cn("flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                        isActive ? "gradient-blue-btn text-white shadow-lg" : "text-gray-600 hover:bg-blue-50/60 hover:text-blue-800")
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={isCollapsed ? 22 : 20} className="shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className={cn("border-t border-gray-200/60 pt-3", isCollapsed ? "flex flex-col items-center gap-1 w-full px-2.5" : "px-3 space-y-1")}>
          <Link href="/settings"
            className={cn(
              isCollapsed
                ? cn("w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200",
                    pathname.startsWith("/settings") ? "gradient-blue-btn text-white shadow-lg" : "text-gray-400 hover:bg-blue-50 hover:text-blue-700")
                : cn("flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                    pathname.startsWith("/settings") ? "gradient-blue-btn text-white shadow-lg" : "text-gray-600 hover:bg-blue-50/60 hover:text-blue-800")
            )}
            title={isCollapsed ? "הגדרות" : undefined}>
            <Settings size={isCollapsed ? 22 : 20} className="shrink-0" />
            {!isCollapsed && <span>הגדרות</span>}
          </Link>

          {!isCollapsed && (
            <div className="px-3 py-2">
              <p className="text-sm font-semibold text-gray-800 truncate">{userName}</p>
              {userEmail && <p className="text-xs text-gray-500 truncate">{userEmail}</p>}
            </div>
          )}

          <button onClick={handleLogout}
            className={cn(
              isCollapsed
                ? "w-12 h-12 rounded-xl flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all duration-200"
                : "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50/60 transition-colors"
            )}
            title={isCollapsed ? "התנתק" : undefined}>
            <LogOut size={isCollapsed ? 22 : 20} className="shrink-0" />
            {!isCollapsed && <span>התנתק</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
