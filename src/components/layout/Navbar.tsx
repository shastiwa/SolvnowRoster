"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { RoleSwitcher } from "./RoleSwitcher";

export function Navbar() {
  const [providerMode, setProviderMode] = useState<string>("mock");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.BMC_PROVIDER_MODE?.value) {
          setProviderMode(data.settings.BMC_PROVIDER_MODE.value);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:bg-blue-700 transition-colors">
            R
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none group-hover:text-blue-600 transition-colors">
              Support Group Roster Management
            </h1>
            <p className="text-[11px] text-slate-500 font-medium leading-none mt-1">
              BMC Helix ITSM 26.2 External Integration
            </p>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {providerMode === "helix" ? (
          <div className="hidden md:flex items-center gap-2 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-semibold text-blue-700">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span>BMC Helix: Live Mode</span>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-medium text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>BMC Helix: Mock Mode</span>
          </div>
        )}

        <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

        <RoleSwitcher />
      </div>
    </header>
  );
}
