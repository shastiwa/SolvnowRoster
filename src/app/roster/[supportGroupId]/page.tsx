"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Person {
  id: string;
  fullName: string;
  loginId: string;
  email: string;
  currentBmcAvailability?: boolean;
}

interface SupportGroup {
  id: string;
  name: string;
  company: string;
  organization: string;
  bmcSupportGroupId: string;
}

interface RosterShift {
  id: string;
  personId: string;
  supportGroupId: string;
  rosterDate: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  rosterStatus: "WORKING" | "OFF" | "LEAVE" | "ON_CALL";
  notes?: string;
  person: Person;
}

interface Override {
  id: string;
  personId: string;
  overrideState: "AVAILABLE" | "UNAVAILABLE";
  startAt: string;
  expiresAt: string | null;
  reason: string;
  person: { fullName: string };
}

export default function SupportGroupRosterPage({
  params,
}: {
  params: Promise<{ supportGroupId: string }>;
}) {
  const resolvedParams = use(params);
  const supportGroupId = resolvedParams.supportGroupId;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<SupportGroup | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [rosterEntries, setRosterEntries] = useState<RosterShift[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [allGroups, setAllGroups] = useState<SupportGroup[]>([]);

  // Current selected week (Monday date string YYYY-MM-DD)
  const [selectedMonday, setSelectedMonday] = useState<string>(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return monday.toISOString().split("T")[0];
  });

  // Modal States
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<RosterShift | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [rosterStatus, setRosterStatus] = useState<"WORKING" | "OFF" | "LEAVE" | "ON_CALL">("WORKING");
  const [notes, setNotes] = useState("");

  const [copyWeekModalOpen, setCopyWeekModalOpen] = useState(false);
  const [targetMonday, setTargetMonday] = useState("");

  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overridePersonId, setOverridePersonId] = useState("");
  const [overrideState, setOverrideState] = useState<"AVAILABLE" | "UNAVAILABLE">("UNAVAILABLE");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideStartHours, setOverrideStartHours] = useState("2");

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Compute 7 days of the selected week
  const weekDates = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = new Date(selectedMonday);
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupRes, rosterRes, overrideRes, allGroupsRes] = await Promise.all([
        fetch("/api/support-groups"),
        fetch(`/api/roster?supportGroupId=${supportGroupId}&startDate=${weekDates[0]}&endDate=${weekDates[6]}`),
        fetch(`/api/overrides?supportGroupId=${supportGroupId}`),
        fetch("/api/support-groups"),
      ]);

      if (groupRes.ok) {
        const data = await groupRes.json();
        const list = Array.isArray(data) ? data : data.supportGroups || [];
        const found = list.find((g: any) => g.id === supportGroupId);
        if (found) {
          setGroup(found);
          setPeople(found.members?.map((m: any) => ({
            ...m.person,
            currentBmcAvailability: m.currentBmcAvailability,
          })) || []);
        }
        setAllGroups(list);
      }

      if (rosterRes.ok) {
        const rData = await rosterRes.json();
        setRosterEntries(rData.rosterEntries || []);
      }

      if (overrideRes.ok) {
        const oData = await overrideRes.json();
        setOverrides(oData.overrides || []);
      }
    } catch (err) {
      console.error("Failed to load roster data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supportGroupId, selectedMonday]);

  // Navigate weeks
  const changeWeek = (offsetDays: number) => {
    const current = new Date(selectedMonday);
    current.setDate(current.getDate() + offsetDays);
    setSelectedMonday(current.toISOString().split("T")[0]);
  };

  // Open add shift modal for a specific person & day
  const handleOpenAddShift = (personId: string, date: string) => {
    setEditingShift(null);
    setSelectedPersonId(personId);
    setSelectedDate(date);
    setStartTime("09:00");
    setEndTime("17:00");
    setRosterStatus("WORKING");
    setNotes("");
    setShiftModalOpen(true);
  };

  // Open edit shift modal
  const handleOpenEditShift = (shift: RosterShift) => {
    setEditingShift(shift);
    setSelectedPersonId(shift.personId);
    setSelectedDate(shift.rosterDate);
    setStartTime(shift.startTime);
    setEndTime(shift.endTime);
    setRosterStatus(shift.rosterStatus);
    setNotes(shift.notes || "");
    setShiftModalOpen(true);
  };

  // Save shift (create or update)
  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingShift) {
        const res = await fetch(`/api/roster/${editingShift.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startTime,
            endTime,
            rosterStatus,
            notes,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update shift");
        }
      } else {
        const res = await fetch("/api/roster", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personId: selectedPersonId,
            supportGroupId,
            rosterDate: selectedDate,
            startTime,
            endTime,
            timeZone: "Asia/Kolkata",
            rosterStatus,
            notes,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create shift");
        }
      }
      setShiftModalOpen(false);
      setFeedback({ type: "success", text: "Shift saved successfully." });
      loadData();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    }
  };

  // Delete shift
  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm("Are you sure you want to delete this shift entry?")) return;
    try {
      const res = await fetch(`/api/roster/${shiftId}`, { method: "DELETE" });
      if (res.ok) {
        setFeedback({ type: "success", text: "Shift deleted." });
        loadData();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete shift");
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    }
  };

  // Save copy week
  const handleCopyWeek = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/roster/bulk-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "COPY_WEEK",
          supportGroupId,
          sourceMonday: selectedMonday,
          targetMonday,
        }),
      });
      if (res.ok) {
        setCopyWeekModalOpen(false);
        setFeedback({ type: "success", text: "Week schedule copied successfully!" });
        setSelectedMonday(targetMonday);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to copy week");
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    }
  };

  // Save override
  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date();
      const expires = new Date(now.getTime() + parseInt(overrideStartHours, 10) * 60 * 60 * 1000);

      const res = await fetch("/api/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: overridePersonId,
          supportGroupId,
          overrideState,
          reason: overrideReason,
          startAt: now.toISOString(),
          expiresAt: expires.toISOString(),
        }),
      });
      if (res.ok) {
        setOverrideModalOpen(false);
        setFeedback({ type: "success", text: "Availability override activated!" });
        loadData();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to create override");
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    }
  };

  // Cancel override
  const handleCancelOverride = async (overrideId: string) => {
    try {
      const res = await fetch(`/api/overrides/${overrideId}/cancel`, { method: "POST" });
      if (res.ok) {
        setFeedback({ type: "success", text: "Override cancelled." });
        loadData();
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    }
  };

  // Sync Availability for this group
  const handleSyncGroup = async (dryRun: boolean) => {
    setSyncing(true);
    try {
      const url = dryRun ? "/api/sync/dry-run" : "/api/sync/availability";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supportGroupId }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: "success",
          text: dryRun
            ? `Dry-Run completed: ${data.evaluatedCount || 0} evaluated, ${data.updatesRequiredCount || 0} updates required.`
            : `Availability synced: ${data.successCount || 0} successful.`,
        });
        loadData();
      } else {
        throw new Error(data.error || "Sync failed");
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const getShiftBadge = (shift: RosterShift) => {
    const isOvernight = shift.startTime > shift.endTime;
    switch (shift.rosterStatus) {
      case "WORKING":
        return (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 p-2 rounded-lg text-xs shadow-2xs group relative">
            <div className="font-bold flex items-center justify-between">
              <span>{shift.startTime} - {shift.endTime}</span>
              {isOvernight && (
                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-1 rounded" title="Spans into next calendar day">
                  🌙 +1d
                </span>
              )}
            </div>
            <div className="text-[10px] text-blue-600 font-medium mt-0.5">WORKING</div>
            {shift.notes && (
              <div className="text-[10px] text-slate-500 truncate mt-0.5">{shift.notes}</div>
            )}
            <div className="mt-1 flex items-center justify-end gap-1.5 opacity-90">
              <button
                onClick={(e) => { e.stopPropagation(); handleOpenEditShift(shift); }}
                className="text-[10px] text-blue-700 hover:underline font-semibold"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteShift(shift.id); }}
                className="text-[10px] text-red-600 hover:underline font-semibold"
              >
                ✕
              </button>
            </div>
          </div>
        );
      case "OFF":
        return (
          <div className="bg-slate-100 border border-slate-200 text-slate-700 p-2 rounded-lg text-xs group relative">
            <div className="font-bold">OFF (Weekly)</div>
            <div className="text-[10px] text-slate-500">Scheduled Off</div>
            <div className="mt-1 flex items-center justify-end gap-1.5 opacity-90">
              <button
                onClick={(e) => { e.stopPropagation(); handleOpenEditShift(shift); }}
                className="text-[10px] text-blue-700 hover:underline font-semibold"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteShift(shift.id); }}
                className="text-[10px] text-red-600 hover:underline font-semibold"
              >
                ✕
              </button>
            </div>
          </div>
        );
      case "LEAVE":
        return (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2 rounded-lg text-xs group relative">
            <div className="font-bold">LEAVE</div>
            <div className="text-[10px] text-amber-700 truncate">{shift.notes || "Approved Leave"}</div>
            <div className="mt-1 flex items-center justify-end gap-1.5 opacity-90">
              <button
                onClick={(e) => { e.stopPropagation(); handleOpenEditShift(shift); }}
                className="text-[10px] text-blue-700 hover:underline font-semibold"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteShift(shift.id); }}
                className="text-[10px] text-red-600 hover:underline font-semibold"
              >
                ✕
              </button>
            </div>
          </div>
        );
      case "ON_CALL":
        return (
          <div className="bg-purple-50 border border-purple-200 text-purple-900 p-2 rounded-lg text-xs group relative">
            <div className="font-bold">ON_CALL ({shift.startTime}-{shift.endTime})</div>
            <div className="text-[10px] text-purple-700">Standby Coverage</div>
            <div className="mt-1 flex items-center justify-end gap-1.5 opacity-90">
              <button
                onClick={(e) => { e.stopPropagation(); handleOpenEditShift(shift); }}
                className="text-[10px] text-blue-700 hover:underline font-semibold"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteShift(shift.id); }}
                className="text-[10px] text-red-600 hover:underline font-semibold"
              >
                ✕
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Group Switcher */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/roster" className="hover:text-blue-600 hover:underline">
              Support Groups
            </Link>
            <span>/</span>
            <span>{group?.company}</span>
            <span>/</span>
            <span>{group?.organization}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {group?.name || "Support Group Roster"}
            </h1>
            <span className="text-xs bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded border border-slate-200">
              {group?.bmcSupportGroupId}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={supportGroupId}
            onChange={(e) => router.push(`/roster/${e.target.value}`)}
            className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {allGroups.map((g) => (
              <option key={g.id} value={g.id}>
                Switch: {g.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              const nextMonday = new Date(selectedMonday);
              nextMonday.setDate(nextMonday.getDate() + 7);
              setTargetMonday(nextMonday.toISOString().split("T")[0]);
              setCopyWeekModalOpen(true);
            }}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span>📋</span>
            <span>Copy Week</span>
          </button>

          <button
            onClick={() => {
              if (people.length > 0) setOverridePersonId(people[0].id);
              setOverrideReason("");
              setOverrideModalOpen(true);
            }}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span>⚡</span>
            <span>Add Override</span>
          </button>

          <button
            onClick={() => handleSyncGroup(true)}
            disabled={syncing}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span>🔄</span>
            <span>{syncing ? "Evaluating..." : "Dry-Run Group"}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 text-xs rounded-lg flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Active Overrides Alert for Group */}
      {overrides.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl space-y-2">
          <div className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
            <span>⚡</span>
            <span>Active Availability Overrides ({overrides.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {overrides.map((ov) => (
              <div
                key={ov.id}
                className="bg-white p-2.5 rounded-lg border border-amber-300 text-xs flex items-center justify-between shadow-2xs"
              >
                <div>
                  <div className="font-bold text-slate-900">{ov.person.fullName}</div>
                  <div className="text-[11px] text-slate-500">
                    <span
                      className={`font-semibold ${
                        ov.overrideState === "AVAILABLE"
                          ? "text-emerald-700"
                          : "text-red-700"
                      }`}
                    >
                      {ov.overrideState}
                    </span>{" "}
                    • {ov.reason}
                  </div>
                </div>
                <button
                  onClick={() => handleCancelOverride(ov.id)}
                  className="text-[11px] text-red-600 hover:text-red-800 font-semibold ml-2 hover:underline"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week Navigator Toolbar */}
      <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeWeek(-7)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 text-xs font-bold"
            title="Previous Week"
          >
            ◀ Previous
          </button>
          <button
            onClick={() => {
              const now = new Date();
              const day = now.getDay();
              const diff = day === 0 ? -6 : 1 - day;
              const monday = new Date(now);
              monday.setDate(now.getDate() + diff);
              setSelectedMonday(monday.toISOString().split("T")[0]);
            }}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md"
          >
            Current Week
          </button>
          <button
            onClick={() => changeWeek(7)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 text-xs font-bold"
            title="Next Week"
          >
            Next ▶
          </button>
        </div>

        <div className="text-xs font-semibold text-slate-800">
          Week: {weekDates[0]} to {weekDates[6]}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Timezone:</span>
          <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold">
            Asia/Kolkata (IST)
          </span>
        </div>
      </div>

      {/* Roster Grid Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-700 font-semibold">
                <th className="py-3 px-4 w-56 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                  Support Member
                </th>
                {weekDates.map((dateStr, idx) => (
                  <th key={dateStr} className="py-3 px-3 min-w-[140px] border-r border-slate-200 last:border-r-0">
                    <div className="font-bold text-slate-900">{dayNames[idx]}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{dateStr}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {people.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-400">
                    No active members found for this support group. Run &quot;Sync Directory&quot; from the Dashboard to retrieve BMC Helix members.
                  </td>
                </tr>
              ) : (
                people.map((person) => (
                  <tr key={person.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-3 px-4 sticky left-0 bg-white z-10 border-r border-slate-200 shadow-2xs">
                      <div className="font-semibold text-xs text-slate-900">
                        {person.fullName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {person.loginId}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            person.currentBmcAvailability ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                        ></span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          BMC: {person.currentBmcAvailability ? "Available" : "Unavailable"}
                        </span>
                      </div>
                    </td>

                    {weekDates.map((dateStr) => {
                      const shifts = rosterEntries.filter(
                        (r) => r.personId === person.id && r.rosterDate === dateStr
                      );

                      return (
                        <td
                          key={dateStr}
                          onClick={() => {
                            if (shifts.length === 0) {
                              handleOpenAddShift(person.id, dateStr);
                            }
                          }}
                          className={`py-2 px-2.5 border-r border-slate-200 last:border-r-0 align-top cursor-pointer transition-colors ${
                            shifts.length === 0
                              ? "hover:bg-blue-50/30 text-center text-slate-300 text-xs"
                              : ""
                          }`}
                        >
                          {shifts.length > 0 ? (
                            <div className="space-y-1.5">
                              {shifts.map((s) => (
                                <div key={s.id}>{getShiftBadge(s)}</div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-3 text-[11px] text-slate-300 hover:text-blue-500 font-medium select-none">
                              + Add Shift
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Shift Modal */}
      {shiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {editingShift ? "Edit Shift Schedule" : "Create Shift Entry"}
              </h2>
              <button
                onClick={() => setShiftModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Team Member
                </label>
                <select
                  value={selectedPersonId}
                  disabled={editingShift !== null}
                  onChange={(e) => setSelectedPersonId(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.loginId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Shift Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  disabled={editingShift !== null}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Shift Status Type
                </label>
                <select
                  value={rosterStatus}
                  onChange={(e: any) => setRosterStatus(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="WORKING">WORKING (Active Ticket Assignment)</option>
                  <option value="OFF">OFF (Weekly Rest Day)</option>
                  <option value="LEAVE">LEAVE (Approved Absence)</option>
                  <option value="ON_CALL">ON_CALL (Standby Coverage)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Start Time (HH:mm)
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    End Time (HH:mm)
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {startTime > endTime && (
                <div className="p-2 bg-indigo-50 border border-indigo-200 rounded text-indigo-900 text-[11px]">
                  🌙 <strong>Overnight Shift Detected:</strong> This shift starts at {startTime} and concludes at {endTime} on the following day.
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Notes / Label (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Morning Primary, Graveyard, On-Call Escalation"
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShiftModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Save Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Copy Week Modal */}
      {copyWeekModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Copy Week Schedule
              </h2>
              <button
                onClick={() => setCopyWeekModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCopyWeek} className="space-y-3.5 text-xs">
              <p className="text-slate-600">
                Duplicate all scheduled shifts from source week <strong>{selectedMonday}</strong> into the target week starting on the selected Monday.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Week Monday Date
                </label>
                <input
                  type="date"
                  value={targetMonday}
                  onChange={(e) => setTargetMonday(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCopyWeekModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Copy Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Availability Override Modal */}
      {overrideModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Create Temporary Availability Override
              </h2>
              <button
                onClick={() => setOverrideModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-3.5 text-xs">
              <p className="text-slate-600">
                Manual overrides take precedence over scheduled shifts in availability calculations until their expiration time.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Team Member
                </label>
                <select
                  value={overridePersonId}
                  onChange={(e) => setOverridePersonId(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.loginId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Assignment State
                </label>
                <select
                  value={overrideState}
                  onChange={(e: any) => setOverrideState(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="UNAVAILABLE">UNAVAILABLE (Emergency leave / Away from desk)</option>
                  <option value="AVAILABLE">AVAILABLE (Emergency coverage / Stand-in)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Duration (from now)
                </label>
                <select
                  value={overrideStartHours}
                  onChange={(e) => setOverrideStartHours(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1">1 Hour</option>
                  <option value="2">2 Hours</option>
                  <option value="4">4 Hours</option>
                  <option value="8">8 Hours (Full Shift)</option>
                  <option value="24">24 Hours</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Override (Audit trail)
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Doctor appointment, sudden system emergency cover"
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold shadow-xs"
                >
                  Activate Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
