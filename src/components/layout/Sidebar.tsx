"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  name: string;
  href: string;
  icon: string;
  adminOnly?: boolean;
  managerOrAdmin?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: "📊" },
  { name: "Roster Management", href: "/roster", icon: "📅", managerOrAdmin: true },
  { name: "My Roster", href: "/my-roster", icon: "👤" },
  { name: "People Directory", href: "/people", icon: "👥" },
  { name: "Support Groups", href: "/support-groups", icon: "🏢" },
  { name: "Sync History", href: "/sync-history", icon: "🔄" },
  { name: "Audit Log", href: "/audit", icon: "📋", managerOrAdmin: true },
];

const ADMIN_ITEMS: NavItem[] = [
  { name: "Authorizations", href: "/admin/authorizations", icon: "🔑", adminOnly: true },
  { name: "BMC Integration", href: "/admin/integration", icon: "⚙️", adminOnly: true },
  { name: "App Settings", href: "/admin/settings", icon: "🎛️", adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string>("ROSTER_ADMIN");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUserRole(data.user.role);
        }
      })
      .catch(() => {});
  }, []);

  const isAdmin = userRole === "ROSTER_ADMIN";
  const isManagerOrAdmin = userRole === "ROSTER_ADMIN" || userRole === "ROSTER_MANAGER";

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-[calc(100vh-4rem)] border-r border-slate-800">
      <div className="p-4 flex-1 space-y-6">
        <div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Operations
          </div>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              if (item.adminOnly && !isAdmin) return null;
              if (item.managerOrAdmin && !isManagerOrAdmin) return null;

              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    active
                      ? "bg-blue-600 text-white font-semibold shadow-xs"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {isAdmin && (
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Administration
            </div>
            <nav className="space-y-1">
              {ADMIN_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      active
                        ? "bg-blue-600 text-white font-semibold shadow-xs"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-300">BMC Helix 26.2</span>
          <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
            v1.0.0
          </span>
        </div>
        <p className="text-[11px] mt-1 text-slate-500">
          External Roster System of Record
        </p>
      </div>
    </aside>
  );
}
