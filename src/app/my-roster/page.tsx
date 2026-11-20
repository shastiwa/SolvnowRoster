"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface MyRosterData {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  shifts: Array<{
    id: string;
    rosterDate: string;
    startTime: string;
    endTime: string;
    rosterStatus: "WORKING" | "OFF" | "LEAVE" | "ON_CALL";
    notes?: string;
    supportGroup: {
      id: string;
      name: string;
      company: string;
    };
  }>;
  memberships: Array<{
    supportGroup: {
      id: string;
      name: string;
      company: string;
      organization: string;
    };
    currentBmcAvailability: boolean;
  }>;
}

export default function MyRosterPage() {
  const [data, setData] = useState<MyRosterData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch current user and their roster entries
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then(async (authData) => {
        if (!authData.user) return;
        const peopleRes = await fetch("/api/people");
        const peopleData = await peopleRes.json();
        const peopleList = Array.isArray(peopleData) ? peopleData : peopleData.people || [];
        const me = peopleList.find(
          (p: any) =>
            p.email?.toLowerCase() === authData.user.email?.toLowerCase() ||
            p.loginId?.toLowerCase() === authData.user.loginName?.toLowerCase()
        );

        if (me) {
          const now = new Date();
          const start = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
          const end = new Date(now.getTime() + 14 * 86400000).toISOString().split("T")[0];
          const rosterRes = await fetch(`/api/roster?personId=${me.id}&startDate=${start}&endDate=${end}`);
          const rosterData = await rosterRes.json();
          const shifts = Array.isArray(rosterData) ? rosterData : rosterData.rosterEntries || [];

          setData({
            user: authData.user,
            shifts,
            memberships: me.supportGroups || [],
          });
        } else {
          setData({
            user: authData.user,
            shifts: [],
            memberships: [],
          });
        }
      })
      .catch((err) => console.error("Failed to load my roster:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-sm text-slate-500">
        Loading your roster schedule...
      </div>
    );
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const todayShifts = (data?.shifts || []).filter((s) => s.rosterDate === todayStr);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            My Roster & Availability
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Personalized schedule and real-time BMC Helix assignment status
          </p>
        </div>

        <div className="text-xs text-slate-500">
          Signed in as: <strong className="text-slate-800">{data?.user.name}</strong>
        </div>
      </div>

      {/* Today's Status Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Today&apos;s Status ({todayStr})
        </h2>

        {todayShifts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todayShifts.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2"
              >
                <div className="text-xs font-semibold text-blue-900">
                  {s.supportGroup.name}
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {s.startTime} - {s.endTime}
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-600 text-white">
                    {s.rosterStatus}
                  </span>
                  {s.notes && (
                    <span className="text-xs text-slate-600 truncate">{s.notes}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-xs">
            No specific shift scheduled for today. Missing-roster policy applies to assignment availability.
          </div>
        )}
      </div>

      {/* Support Group Memberships and BMC Helix Availability */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Support Group Memberships & BMC Availability
        </h2>

        <div className="divide-y divide-slate-100">
          {data?.memberships && data.memberships.length > 0 ? (
            data.memberships.map((m) => (
              <div
                key={m.supportGroup.id}
                className="py-3.5 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-sm text-slate-900">
                    {m.supportGroup.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {m.supportGroup.company} • {m.supportGroup.organization}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                      m.currentBmcAvailability
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        m.currentBmcAvailability ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                    ></span>
                    BMC: {m.currentBmcAvailability ? "Available" : "Unavailable"}
                  </span>

                  <Link
                    href={`/roster/${m.supportGroup.id}`}
                    className="text-xs text-blue-600 hover:underline font-semibold"
                  >
                    View Group Roster →
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-400 py-3">
              No active support group memberships found in local synchronized directory.
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Shifts */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Upcoming Shifts Schedule</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Support Group</th>
                <th className="py-2.5 px-4">Shift Time</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.shifts && data.shifts.length > 0 ? (
                data.shifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-800">
                      {shift.rosterDate}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900 font-medium">
                      {shift.supportGroup.name}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      {shift.startTime} - {shift.endTime}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                        {shift.rosterStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      {shift.notes || "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No scheduled shifts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
