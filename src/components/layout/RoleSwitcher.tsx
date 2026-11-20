"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "ROSTER_ADMIN" | "ROSTER_MANAGER" | "ROSTER_USER";
}

const PRESET_USERS: UserProfile[] = [
  {
    id: "admin",
    name: "Global Administrator",
    email: "admin@solvnow.internal",
    role: "ROSTER_ADMIN",
  },
  {
    id: "manager",
    name: "IT Operations Manager",
    email: "manager@solvnow.internal",
    role: "ROSTER_MANAGER",
  },
  {
    id: "user",
    name: "Arun Kumar",
    email: "arun.kumar@solvnow.internal",
    role: "ROSTER_USER",
  },
];

export function RoleSwitcher() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleRoleChange = async (role: string) => {
    setSwitching(true);
    try {
      const res = await fetch("/api/auth/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        router.refresh();
        window.location.reload();
      }
    } catch (err) {
      console.error("Failed to switch role:", err);
    } finally {
      setSwitching(false);
    }
  };

  const currentRole = currentUser?.role || "ROSTER_ADMIN";

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ROSTER_ADMIN":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "ROSTER_MANAGER":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "ROSTER_USER":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <span className="hidden sm:inline">Active User:</span>
        <span className="font-semibold text-slate-700">
          {currentUser?.name || "Loading..."}
        </span>
      </div>

      <div className="relative inline-flex items-center">
        <select
          value={currentRole}
          disabled={switching}
          onChange={(e) => handleRoleChange(e.target.value)}
          className={`text-xs font-semibold px-2.5 py-1 rounded-md border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${getRoleBadgeColor(
            currentRole
          )}`}
          aria-label="Development Role Switcher"
        >
          <option value="ROSTER_ADMIN">Admin (ROSTER_ADMIN)</option>
          <option value="ROSTER_MANAGER">Manager (ROSTER_MANAGER)</option>
          <option value="ROSTER_USER">User (ROSTER_USER)</option>
        </select>
        {switching && (
          <span className="ml-2 text-xs text-slate-400 animate-pulse">
            Switching...
          </span>
        )}
      </div>
    </div>
  );
}
