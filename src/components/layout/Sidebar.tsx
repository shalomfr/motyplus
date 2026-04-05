"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Home, Users, RefreshCw, Mail, Target, Database, Percent,
  ScrollText, LayoutDashboard, ClipboardList, Receipt, Settings,
  LogOut, X, ChevronRight, ChevronLeft, PackageCheck, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedLogo } from "@/components/ui/AnimatedLogo";

interface NavItem { label: string; icon: LucideIcon; path: string; badge?: number; }

const NAV_ITEMS: NavItem[] = [
  { label: "דף הבית", icon: Home, path: "/" },
  { label: "לקוחות", icon: Users, path: "/customers" },
  { label: "עדכונים", icon: RefreshCw, path: "/updates" },
  { label: "מיילים", icon: Mail, path: "/emails" },
  { label: "לידים", icon: Target, path: "/leads" },
  { label: "נתונים", icon: Database, path: "/data" },
  { label: "מבצעים", icon: Percent, path: "/promotions" },
  { label: "לוח בקרה", icon: LayoutDashboard, path: "/dashboard" },
  { label: "רשימת עבודה", icon: PackageCheck, path: "/work-orders" },
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
  const [workOrderBadge, setWorkOrderBadge] = useState(0);

  useEffect(() => {
    if (isMobileOpen) onMobileToggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Fetch work-orders badge count
  const fetchBadge = useCallback(async () => {
    try {
      const res = await fetch("/api/work-orders?cube=all");
      if (res.ok) {
        const data = await res.json();
        const total =
          (data.counts?.samples?.pending || 0) +
          (data.counts?.sets?.total || 0) +
          (data.counts?.approval?.total || 0);
        setWorkOrderBadge(total);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchBadge();
    const interval = setInterval(fetchBadge, 60_000);
    return () => clearInterval(interval);
  }, [fetchBadge]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  // Inject badge into work-orders nav item
  const navItemsWithBadge = NAV_ITEMS.map((item) =>
    item.path === "/work-orders" ? { ...item, badge: workOrderBadge } : item
  );
  const allItems = [...navItemsWithBadge, { label: "הגדרות", icon: Settings, path: "/settings" }];

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/30 z-40 md:hidden transition-opacity duration-300",
          isMobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onMobileToggle}
      />

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex flex-col glass-sidebar text-gray-700 w-[85vw] max-w-[320px] transition-transform duration-300 ease-in-out md:hidden",
          isMobileOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-200/60 p-4 min-h-[72px]">
          <AnimatedLogo size={36} />
          <button onClick={onMobileToggle} className="p-2 rounded-lg hover:bg-gray-100/60 min-w-[44px] min-h-[44px] flex items-center justify-center"><X size={20} /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 overscroll-contain">
          {allItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === "/" ? pathname === "/" : pathname.startsWith(item.path);
            return (
              <Link key={item.path} href={item.path}
                className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium min-h-[44px]",
                  isActive ? "gradient-blue-btn text-white shadow-lg" : "text-gray-600 hover:bg-blue-50/60 hover:text-blue-800"
                )}>
                <Icon size={20} className="shrink-0" />
                <span className="flex-1">{item.label}</span>
                {"badge" in item && (item as NavItem).badge! > 0 && (
                  <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5">
                    {(item as NavItem).badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-200/60 p-4">
          <div className="mb-3 px-1">
            <p className="text-sm font-semibold text-gray-800 truncate">{userName}</p>
            {userEmail && <p className="text-xs text-gray-500 truncate">{userEmail}</p>}
          </div>
          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50/60 min-h-[44px]">
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
          {navItemsWithBadge.map((item) => {
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
                <div className="relative shrink-0">
                  <Icon size={isCollapsed ? 22 : 20} />
                  {isCollapsed && item.badge! > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
                      {item.badge}
                    </span>
                  )}
                </div>
                {!isCollapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge! > 0 && (
                      <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
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
