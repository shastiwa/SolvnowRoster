"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface PersonSummary {
  id: string;
  fullName: string;
  loginId: string;
  email: string;
  supportGroups: Array<{
    supportGroup: {
      id: string;
      name: string;
    };
  }>;
}

interface SupportGroupMembership {
  id: string;
  name: string;
  company: string;
  organization: string;
  bmcSupportGroupId: string;
  currentBmcAvailability: boolean;
  defaultGroup: boolean;
}

interface ActiveOverride {
  id: string;
  supportGroupId: string;
  batchId?: string | null;
  overrideState: "AVAILABLE" | "UNAVAILABLE";
  startAt: string;
  expiresAt?: string | null;
  reason: string;
  createdBy: string;
  supportGroup?: {
    id: string;
    name: string;
  };
}

interface Shift {
  id: string;
  rosterDate: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  rosterStatus: "WORKING" | "OFF" | "LEAVE" | "ON_CALL";
  notes?: string;
  supportGroup: {
    id: string;
    name: string;
    company: string;
  };
}

interface SelectedPersonData {
  id: string;
  fullName: string;
  loginId: string;
  email: string;
  supportGroups: SupportGroupMembership[];
  activeOverrides: ActiveOverride[];
  shifts: Shift[];
}

export default function UserRosterManagementPage() {
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [personData, setPersonData] = useState<SelectedPersonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPerson, setLoadingPerson] = useState(false);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Week navigation (Monday-Sunday)
  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    return date.toISOString().split("T")[0];
  };

  const [selectedMonday, setSelectedMonday] = useState(getMonday(new Date()));

  // Out of shift modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [overrideState, setOverrideState] = useState<"UNAVAILABLE" | "AVAILABLE">("UNAVAILABLE");
  const [durationOption, setDurationOption] = useState<string>("EOD");
  const [customHours, setCustomHours] = useState<string>("8");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // Restore state
  const [restoring, setRestoring] = useState(false);

  // Load people list
  useEffect(() => {
    fetch("/api/user-roster")
      .then((res) => res.json())
      .then((data) => {
        const list: PersonSummary[] = data.people || [];
        setPeople(list);
        if (list.length > 0 && !selectedPersonId) {
          setSelectedPersonId(list[0].id);
        }
      })
      .catch((err) => console.error("Failed to load people list:", err))
      .finally(() => setLoading(false));
  }, []);

  // Calculate week dates
  const weekDates = React.useMemo(() => {
    const dates: string[] = [];
    const base = new Date(selectedMonday);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  }, [selectedMonday]);

  // Load details for selected person
  const loadPersonDetails = useCallback(async (personId: string) => {
    if (!personId) return;
    try {
      setLoadingPerson(true);
      const start = weekDates[0];
      const end = weekDates[6];
      const res = await fetch(`/api/user-roster?personId=${personId}&startDate=${start}&endDate=${end}`);
      if (res.ok) {
        const data = await res.json();
        setPersonData(data.selectedPerson || null);
        if (data.selectedPerson?.supportGroups) {
          setSelectedGroupIds(data.selectedPerson.supportGroups.map((g: any) => g.id));
        }
      }
    } catch (err) {
      console.error("Failed to load person details:", err);
    } finally {
      setLoadingPerson(false);
    }
  }, [weekDates]);

  useEffect(() => {
    if (selectedPersonId) {
      loadPersonDetails(selectedPersonId);
    }
  }, [selectedPersonId, loadPersonDetails]);

  // Filter people list for search
  const filteredPeople = people.filter(
    (p) =>
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.loginId.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
  );

  // Open Out-of-shift dialog
  const handleOpenOutOfShiftModal = () => {
    if (!personData) return;
    setSelectedGroupIds(personData.supportGroups.map((g) => g.id));
    setOverrideState("UNAVAILABLE");
    setDurationOption("EOD");
    setOverrideReason("Going out of shift / End of shift");
    setModalOpen(true);
  };

  // Toggle group selection in modal
  const handleToggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleSelectAllGroups = () => {
    if (!personData) return;
    if (selectedGroupIds.length === personData.supportGroups.length) {
      setSelectedGroupIds([]);
    } else {
      setSelectedGroupIds(personData.supportGroups.map((g) => g.id));
    }
  };

  // Submit Override (Out-of-shift)
  const handleSubmitOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personData || selectedGroupIds.length === 0) return;

    try {
      setSubmittingOverride(true);
      setFeedback(null);

      const now = new Date();
      let expiresAt: string | null = null;

      if (durationOption === "1") {
        expiresAt = new Date(now.getTime() + 1 * 3600000).toISOString();
      } else if (durationOption === "2") {
        expiresAt = new Date(now.getTime() + 2 * 3600000).toISOString();
      } else if (durationOption === "4") {
        expiresAt = new Date(now.getTime() + 4 * 3600000).toISOString();
      } else if (durationOption === "8") {
        expiresAt = new Date(now.getTime() + 8 * 3600000).toISOString();
      } else if (durationOption === "24") {
        expiresAt = new Date(now.getTime() + 24 * 3600000).toISOString();
      } else if (durationOption === "EOD") {
        const eod = new Date(now);
        eod.setHours(23, 59, 59, 999);
        expiresAt = eod.toISOString();
      } else if (durationOption === "CUSTOM") {
        const h = parseFloat(customHours) || 8;
        expiresAt = new Date(now.getTime() + h * 3600000).toISOString();
      } else if (durationOption === "INDEFINITE") {
        expiresAt = null;
      }

      const res = await fetch("/api/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: personData.id,
          supportGroupIds: selectedGroupIds,
          overrideState,
          startAt: now.toISOString(),
          expiresAt,
          reason: overrideReason || "Out of shift availability update",
        }),
      });

      if (res.ok) {
        setModalOpen(false);
        setFeedback({
          type: "success",
          text: `Availability override activated! Successfully updated ${selectedGroupIds.length} support group(s). Changes are being pushed live to BMC Helix.`,
        });
        loadPersonDetails(personData.id);
      } else {
        const err = await res.json();
        setFeedback({ type: "error", text: `Override failed: ${err.error || "Unknown error"}` });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: `Error: ${err.message}` });
    } finally {
      setSubmittingOverride(false);
    }
  };

  // Restore person to normal schedule across all groups
  const handleRestoreNormalSchedule = async () => {
    if (!personData) return;
    if (
      !confirm(
        `Are you sure you want to cancel all active overrides for ${personData.fullName} and restore their normal shift schedule across all groups in BMC Helix?`
      )
    ) {
      return;
    }

    try {
      setRestoring(true);
      setFeedback(null);
      const res = await fetch(`/api/overrides?personId=${personData.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const data = await res.json();
        setFeedback({
          type: "success",
          text: `Restored to normal schedule! Cancelled ${data.count || 0} active override(s). BMC Helix availability is re-evaluated live.`,
        });
        loadPersonDetails(personData.id);
      } else {
        const err = await res.json();
        setFeedback({ type: "error", text: `Failed to restore: ${err.error || "Unknown error"}` });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: `Error: ${err.message}` });
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-sm text-slate-500">
        Loading User Roster Management...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>👤</span> User Roster Management
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage multi-group schedules, leave, and instant out-of-shift BMC Helix availability per user
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/roster"
            className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span>🏢</span> Switch to Support Group Rosters
          </Link>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-3.5 rounded-lg text-xs flex items-center justify-between shadow-2xs ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : feedback.type === "error"
              ? "bg-rose-50 text-rose-900 border border-rose-200"
              : "bg-blue-50 text-blue-900 border border-blue-200"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            className="font-bold hover:opacity-75 ml-2 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* User Selector & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
              Select or Search Support Personnel
            </label>
            <div className="relative">
              <select
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-2xs"
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({p.loginId}) — {p.supportGroups.length} Support Group{p.supportGroups.length === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenOutOfShiftModal}
              disabled={!personData || personData.supportGroups.length === 0}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs shadow-xs transition-colors flex items-center gap-2"
            >
              <span>⚡</span>
              <span>Mark Out-of-Shift / Offline (All Groups)</span>
            </button>
          </div>
        </div>

        {personData && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-900">{personData.fullName}</span> &bull;{" "}
              <span className="font-mono text-slate-500">{personData.loginId}</span> &bull;{" "}
              <span className="text-slate-500">{personData.email}</span>
            </div>
            <div className="flex items-center gap-1.5 text-blue-700 font-medium">
              <span>Member of</span>
              <span className="font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[11px]">
                {personData.supportGroups.length} Support Group{personData.supportGroups.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        )}
      </div>

      {loadingPerson ? (
        <div className="flex items-center justify-center min-h-[200px] text-xs text-slate-400">
          Loading user availability & group memberships...
        </div>
      ) : personData ? (
        <>
          {/* Active Overrides Alert */}
          {personData.activeOverrides.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <span className="text-base">⚠️</span>
                  <span>Active Availability Overrides in Effect ({personData.activeOverrides.length})</span>
                </div>
                <button
                  onClick={handleRestoreNormalSchedule}
                  disabled={restoring}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <span>🔄</span>
                  <span>{restoring ? "Restoring..." : "Restore to Normal Shift Schedule"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {personData.activeOverrides.map((ov) => (
                  <div
                    key={ov.id}
                    className="p-3 bg-white rounded-lg border border-amber-200 text-xs space-y-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{ov.supportGroup?.name || "Support Group"}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ov.overrideState === "AVAILABLE"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {ov.overrideState}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">{ov.reason}</div>
                    <div className="text-[10px] text-slate-400">
                      Expires: {ov.expiresAt ? new Date(ov.expiresAt).toLocaleString() : "Indefinite"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multi-Group Support Association Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>🏢</span> Associated Support Groups & Live BMC Availability
              </h2>
              <span className="text-xs text-slate-400">
                Direct Remedy records in <code>CTM:Support Group Association</code>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {personData.supportGroups.map((group) => (
                <div
                  key={group.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="font-bold text-sm text-slate-900">{group.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                          group.currentBmcAvailability
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            group.currentBmcAvailability ? "bg-emerald-600" : "bg-slate-400"
                          }`}
                        ></span>
                        {group.currentBmcAvailability ? "Available (Yes)" : "Unavailable (No)"}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-xs text-slate-500">
                      <div>Company: <strong className="text-slate-700">{group.company}</strong></div>
                      <div>Org: <strong className="text-slate-700">{group.organization}</strong></div>
                      <div className="font-mono text-[11px] text-slate-400">ID: {group.bmcSupportGroupId}</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <Link
                      href={`/roster/${group.id}`}
                      className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <span>Open Group Roster</span>
                      <span>&rarr;</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Combined Shifts View for Selected Week */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span>📅</span> Combined Schedule for Week ({weekDates[0]} to {weekDates[6]})
                </h2>
                <p className="text-xs text-slate-500">
                  Aggregated shift calendar across all support groups {personData.fullName} belongs to
                </p>
              </div>

              {/* Week Navigation */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => {
                    const prev = new Date(selectedMonday);
                    prev.setDate(prev.getDate() - 7);
                    setSelectedMonday(prev.toISOString().split("T")[0]);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 rounded shadow-2xs text-slate-700"
                >
                  &larr; Prev Week
                </button>
                <button
                  onClick={() => setSelectedMonday(getMonday(new Date()))}
                  className="px-2.5 py-1 hover:bg-white rounded text-slate-600"
                >
                  Current
                </button>
                <button
                  onClick={() => {
                    const next = new Date(selectedMonday);
                    next.setDate(next.getDate() + 7);
                    setSelectedMonday(next.toISOString().split("T")[0]);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 rounded shadow-2xs text-slate-700"
                >
                  Next Week &rarr;
                </button>
              </div>
            </div>

            {/* 7-Day Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
              {weekDates.map((dateStr) => {
                const dayShifts = personData.shifts.filter((s) => s.rosterDate === dateStr);
                const dayName = new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
                const isToday = dateStr === new Date().toISOString().split("T")[0];

                return (
                  <div
                    key={dateStr}
                    className={`p-3 rounded-xl border flex flex-col justify-between min-h-[120px] ${
                      isToday ? "bg-blue-50/50 border-blue-300" : "bg-slate-50/50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60 text-xs">
                      <span className="font-bold text-slate-800">{dayName}</span>
                      <span className="text-[11px] text-slate-500">{dateStr.substring(5)}</span>
                    </div>

                    <div className="py-2 space-y-1.5 flex-1">
                      {dayShifts.length > 0 ? (
                        dayShifts.map((s) => (
                          <div
                            key={s.id}
                            className="p-1.5 rounded bg-white border border-slate-200 text-[11px] shadow-2xs space-y-0.5"
                          >
                            <div className="font-semibold text-slate-800 truncate">{s.supportGroup.name}</div>
                            <div className="text-slate-600 font-mono text-[10px]">
                              {s.startTime} - {s.endTime}
                            </div>
                            <span
                              className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                s.rosterStatus === "WORKING"
                                  ? "bg-blue-100 text-blue-800"
                                  : s.rosterStatus === "LEAVE"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {s.rosterStatus}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-[11px] text-slate-400 italic text-center py-4">No shift</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      {/* Out of Shift / Availability Dialog Modal */}
      {modalOpen && personData && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>⚡</span> Out-of-Shift / Multi-Group Availability
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update Remedy Assignment Availability for <strong>{personData.fullName}</strong>
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitOverride} className="p-5 space-y-4 text-xs">
              {/* Group Checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700">
                    Select Target Support Groups ({selectedGroupIds.length} of {personData.supportGroups.length} selected):
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllGroups}
                    className="text-[11px] text-blue-600 hover:underline font-semibold"
                  >
                    {selectedGroupIds.length === personData.supportGroups.length ? "Deselect All" : "Select All"}
                  </button>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 max-h-40 overflow-y-auto">
                  {personData.supportGroups.map((g) => (
                    <label
                      key={g.id}
                      className="flex items-center gap-2.5 p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.includes(g.id)}
                        onChange={() => handleToggleGroup(g.id)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{g.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{g.company} &bull; {g.organization}</div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          g.currentBmcAvailability ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {g.currentBmcAvailability ? "Currently Yes" : "Currently No"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Target State */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target BMC Helix Assignment Availability</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOverrideState("UNAVAILABLE")}
                    className={`py-2 px-3 rounded-lg border font-semibold flex items-center justify-center gap-2 transition-all ${
                      overrideState === "UNAVAILABLE"
                        ? "bg-rose-50 border-rose-300 text-rose-800 shadow-2xs ring-1 ring-rose-300"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>🔴</span>
                    <span>Offline (No)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideState("AVAILABLE")}
                    className={`py-2 px-3 rounded-lg border font-semibold flex items-center justify-center gap-2 transition-all ${
                      overrideState === "AVAILABLE"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs ring-1 ring-emerald-300"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>🟢</span>
                    <span>Online (Yes)</span>
                  </button>
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Duration of Override</label>
                <select
                  value={durationOption}
                  onChange={(e) => setDurationOption(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="EOD">End of Day (Until Midnight tonight)</option>
                  <option value="2">2 Hours from now</option>
                  <option value="4">4 Hours from now</option>
                  <option value="8">8 Hours (Full Shift)</option>
                  <option value="24">24 Hours from now</option>
                  <option value="CUSTOM">Custom Hours</option>
                  <option value="INDEFINITE">Indefinite (Until manually cancelled)</option>
                </select>

                {durationOption === "CUSTOM" && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={customHours}
                      onChange={(e) => setCustomHours(e.target.value)}
                      className="w-24 px-2 py-1.5 border border-slate-300 rounded-lg"
                    />
                    <span className="text-slate-500">hours from now</span>
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Audit Trail (Required)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. End of shift, Doctor appointment, Sudden emergency leave"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOverride || selectedGroupIds.length === 0}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5"
                >
                  <span>⚡</span>
                  <span>
                    {submittingOverride
                      ? "Pushing Live..."
                      : `Set ${overrideState === "UNAVAILABLE" ? "Offline" : "Online"} for ${selectedGroupIds.length} Groups`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
