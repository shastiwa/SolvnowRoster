"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface GroupSummary {
  id: string;
  name: string;
  company: string;
  organization: string;
  bmcSupportGroupId: string;
  memberCount: number;
}

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
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [personData, setPersonData] = useState<SelectedPersonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [loadingPerson, setLoadingPerson] = useState(false);
  const [personSearch, setPersonSearch] = useState("");
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

  // 1. Initial load: Load groups list
  useEffect(() => {
    fetch("/api/user-roster")
      .then((res) => res.json())
      .then((data) => {
        const groupList: GroupSummary[] = data.groups || [];
        setGroups(groupList);
        if (groupList.length > 0) {
          setSelectedGroupId(groupList[0].id);
        }
      })
      .catch((err) => console.error("Failed to load support groups:", err))
      .finally(() => setLoading(false));
  }, []);

  // 2. When selectedGroupId changes, fetch people belonging to that group only
  useEffect(() => {
    if (!selectedGroupId) {
      setPeople([]);
      setSelectedPersonId("");
      setPersonData(null);
      return;
    }

    setLoadingPeople(true);
    fetch(`/api/user-roster?groupId=${selectedGroupId}`)
      .then((res) => res.json())
      .then((data) => {
        const list: PersonSummary[] = data.people || [];
        setPeople(list);
        if (list.length > 0) {
          setSelectedPersonId(list[0].id);
        } else {
          setSelectedPersonId("");
          setPersonData(null);
        }
      })
      .catch((err) => console.error("Failed to load group personnel:", err))
      .finally(() => setLoadingPeople(false));
  }, [selectedGroupId]);

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
      p.fullName.toLowerCase().includes(personSearch.toLowerCase()) ||
      p.loginId.toLowerCase().includes(personSearch.toLowerCase()) ||
      p.email.toLowerCase().includes(personSearch.toLowerCase())
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

  // Toggle all groups in modal
  const handleToggleAllGroups = () => {
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

      {/* Group-Scoped Search & User Selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Step 1: Select Support Group */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 inline-flex items-center justify-center text-[10px] font-black">
                  1
                </span>
                Search by Support Group Name
              </span>
              <span className="text-[11px] font-normal text-slate-400 lowercase">{groups.length} groups</span>
            </label>
            <div className="relative">
              <select
                value={selectedGroupId}
                onChange={(e) => {
                  setSelectedGroupId(e.target.value);
                  setPersonSearch("");
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-2xs"
              >
                <option value="">-- Choose Support Group --</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.memberCount} member{g.memberCount === 1 ? "" : "s"})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Select a support group first to view only its assigned engineers
            </p>
          </div>

          {/* Step 2: Support Personnel in Group */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 inline-flex items-center justify-center text-[10px] font-black">
                  2
                </span>
                Support Personnel
              </span>
              {selectedGroupId && (
                <span className="text-[11px] font-semibold text-blue-600">
                  {people.length} member{people.length === 1 ? "" : "s"} in group
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <select
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                disabled={!selectedGroupId || loadingPeople || people.length === 0}
                className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-2xs disabled:bg-slate-100 disabled:text-slate-400"
              >
                {!selectedGroupId ? (
                  <option value="">-- Select a support group first --</option>
                ) : loadingPeople ? (
                  <option value="">Loading group members...</option>
                ) : people.length === 0 ? (
                  <option value="">No members found in this group</option>
                ) : (
                  filteredPeople.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.loginId})
                    </option>
                  ))
                )}
              </select>

              {people.length > 3 && (
                <input
                  type="text"
                  placeholder="Filter name/id..."
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                  className="w-36 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Select an engineer to manage their multi-group schedule & out-of-shift status
            </p>
          </div>
        </div>

        {personData && (
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              <span className="font-bold text-slate-900 text-sm">{personData.fullName}</span> &bull;{" "}
              <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{personData.loginId}</span> &bull;{" "}
              <span className="text-slate-500">{personData.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-blue-700 font-medium">
                <span>Total Memberships:</span>
                <span className="font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[11px]">
                  {personData.supportGroups.length} Support Group{personData.supportGroups.length === 1 ? "" : "s"}
                </span>
              </div>
              <button
                onClick={handleOpenOutOfShiftModal}
                disabled={!personData || personData.supportGroups.length === 0}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5"
              >
                <span>⚡</span>
                <span>Mark Out-of-Shift / Offline (All Groups)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {!selectedGroupId ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
          <div className="text-4xl">🏢</div>
          <h3 className="text-base font-bold text-slate-800">Select a Support Group to Begin</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Choose a support group above to view its engineers. Once you pick an engineer, you can manage their
            availability across all support groups they belong to.
          </p>
        </div>
      ) : loadingPerson ? (
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
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 rounded shadow-2xs border border-slate-200 text-slate-700"
                >
                  &larr; Prev Week
                </button>
                <button
                  onClick={() => setSelectedMonday(getMonday(new Date()))}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 rounded shadow-2xs border border-slate-200 text-slate-700"
                >
                  This Week
                </button>
                <button
                  onClick={() => {
                    const next = new Date(selectedMonday);
                    next.setDate(next.getDate() + 7);
                    setSelectedMonday(next.toISOString().split("T")[0]);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 rounded shadow-2xs border border-slate-200 text-slate-700"
                >
                  Next Week &rarr;
                </button>
              </div>
            </div>

            {/* 7-Day Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {weekDates.map((dateStr) => {
                const dayDate = new Date(dateStr);
                const dayName = dayDate.toLocaleDateString("en-US", { weekday: "short" });
                const dayShifts = personData.shifts.filter((s) => s.rosterDate === dateStr);
                const isToday = new Date().toISOString().split("T")[0] === dateStr;

                return (
                  <div
                    key={dateStr}
                    className={`rounded-lg border p-2.5 space-y-2 flex flex-col justify-between min-h-[140px] ${
                      isToday ? "border-blue-400 bg-blue-50/20" : "border-slate-200 bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 text-xs">
                      <span className={`font-bold ${isToday ? "text-blue-700" : "text-slate-800"}`}>
                        {dayName}
                      </span>
                      <span className="text-slate-400 text-[11px] font-mono">{dateStr.slice(5)}</span>
                    </div>

                    <div className="space-y-1.5 flex-1">
                      {dayShifts.length === 0 ? (
                        <div className="text-[11px] text-slate-400 italic pt-2 text-center">No shifts</div>
                      ) : (
                        dayShifts.map((shift) => (
                          <div
                            key={shift.id}
                            className={`p-1.5 rounded border text-[11px] space-y-0.5 ${
                              shift.rosterStatus === "WORKING"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                                : shift.rosterStatus === "LEAVE"
                                ? "bg-rose-50 border-rose-200 text-rose-950"
                                : shift.rosterStatus === "ON_CALL"
                                ? "bg-amber-50 border-amber-200 text-amber-950"
                                : "bg-slate-100 border-slate-200 text-slate-700"
                            }`}
                          >
                            <div className="font-bold flex items-center justify-between text-[10px]">
                              <span>{shift.rosterStatus}</span>
                              <span className="font-mono">
                                {shift.startTime}-{shift.endTime}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-600 truncate" title={shift.supportGroup.name}>
                              {shift.supportGroup.name}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400">
          No personnel selected or no members found in this support group.
        </div>
      )}

      {/* Out of Shift / Multi-Group Override Modal Dialog */}
      {modalOpen && personData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <form onSubmit={handleSubmitOverride} className="p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚡</span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Mark Out-of-Shift / Offline</h3>
                    <p className="text-xs text-slate-500">
                      Update Remedy Assignment Availability across support groups
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
                >
                  ✕
                </button>
              </div>

              {/* Person Summary */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-500">Support Person: </span>
                  <strong className="text-slate-900">{personData.fullName}</strong>{" "}
                  <span className="font-mono text-slate-500">({personData.loginId})</span>
                </div>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {personData.supportGroups.length} Groups
                </span>
              </div>

              {/* Target Availability State */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Target Remedy Availability
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOverrideState("UNAVAILABLE")}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-2 transition-all ${
                      overrideState === "UNAVAILABLE"
                        ? "bg-rose-50 border-rose-300 text-rose-800 shadow-2xs ring-2 ring-rose-500/20"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>🔴</span>
                    <span>Unavailable (No)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideState("AVAILABLE")}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border flex items-center justify-center gap-2 transition-all ${
                      overrideState === "AVAILABLE"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs ring-2 ring-emerald-500/20"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>🟢</span>
                    <span>Available (Yes)</span>
                  </button>
                </div>
              </div>

              {/* Support Group Selection Checkboxes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Apply to Support Groups ({selectedGroupIds.length} of {personData.supportGroups.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={handleToggleAllGroups}
                    className="text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    {selectedGroupIds.length === personData.supportGroups.length ? "Deselect All" : "Select All"}
                  </button>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                  {personData.supportGroups.map((g) => {
                    const isChecked = selectedGroupIds.includes(g.id);
                    return (
                      <label
                        key={g.id}
                        className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer border transition-colors ${
                          isChecked
                            ? "bg-white border-blue-300 text-slate-900 shadow-2xs"
                            : "bg-transparent border-transparent text-slate-500 hover:bg-white/60"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleGroup(g.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-semibold">{g.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{g.company}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Duration Options */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Duration / Time Window
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { id: "EOD", label: "Until End of Day" },
                    { id: "2", label: "Next 2 Hours" },
                    { id: "4", label: "Next 4 Hours" },
                    { id: "8", label: "Next 8 Hours" },
                    { id: "24", label: "Next 24 Hours" },
                    { id: "INDEFINITE", label: "Indefinite" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDurationOption(opt.id)}
                      className={`p-2 rounded-lg border text-xs font-medium text-center transition-all ${
                        durationOption === opt.id
                          ? "bg-blue-50 border-blue-400 text-blue-800 font-bold shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Audit Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. End of shift / Engineer handover complete"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={submittingOverride}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOverride || selectedGroupIds.length === 0}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {submittingOverride ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Pushing to BMC Helix...</span>
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>
                        Confirm & Set {overrideState === "UNAVAILABLE" ? "Offline" : "Available"} ({selectedGroupIds.length})
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
