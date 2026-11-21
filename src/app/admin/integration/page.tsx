"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface HelixSearchResult {
  bmcSupportGroupId: string;
  name: string;
  company: string;
  organization: string;
  active: boolean;
  alreadyManaged: boolean;
  localId?: string;
  localMemberCount?: number;
}

interface ManagedGroup {
  id: string;
  name: string;
  company: string;
  organization: string;
  bmcSupportGroupId: string;
  memberCount: number;
  lastSyncedAt?: string;
}

export default function AdminIntegrationPage() {
  const [providerMode, setProviderMode] = useState<string>("helix");
  const [syncing, setSyncing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Managed groups state
  const [managedGroups, setManagedGroups] = useState<ManagedGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Search & Import state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HelixSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  // Background Scheduler state
  const [schedulerStatus, setSchedulerStatus] = useState<{
    enabled: boolean;
    active: boolean;
    intervalMinutes: number;
    lastRunAt: string | null;
  } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        const mode = data.settings?.BMC_PROVIDER_MODE?.value || "mock";
        setProviderMode(mode);
      }
    } catch (e) {
      // fallback
    }
  }, []);

  const loadManagedGroups = useCallback(async () => {
    try {
      setLoadingGroups(true);
      const res = await fetch("/api/support-groups");
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.supportGroups || [];
      setManagedGroups(
        list.map((g: any) => ({
          id: g.id,
          name: g.name,
          company: g.company,
          organization: g.organization,
          bmcSupportGroupId: g.bmcSupportGroupId,
          memberCount: g.members?.length || 0,
          lastSyncedAt: g.lastSyncedAt,
        }))
      );
    } catch (err) {
      console.error("Failed to load managed groups:", err);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const loadSchedulerStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/scheduler");
      if (res.ok) {
        const data = await res.json();
        setSchedulerStatus(data);
      }
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadManagedGroups();
    loadSchedulerStatus();
  }, [loadStatus, loadManagedGroups, loadSchedulerStatus]);

  const handleToggleScheduler = async (action: "start" | "stop") => {
    try {
      setSyncing("scheduler");
      const res = await fetch("/api/sync/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        setSchedulerStatus(data);
        setFeedback({
          type: "success",
          text: action === "start" ? "Periodic background sync scheduler started!" : "Periodic background sync scheduler paused.",
        });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: `Scheduler error: ${err.message}` });
    } finally {
      setSyncing(null);
    }
  };

  const handleTestConnection = async () => {
    try {
      setSyncing("test-connection");
      setFeedback(null);
      const res = await fetch("/api/admin/integration/test-connection", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({
          type: "success",
          text: `Connection & AR-JWT Authentication Successful! Authenticated against ${data.baseUrl} as user '${data.username}'. AR-JWT Token received.`,
        });
      } else {
        setFeedback({
          type: "error",
          text: `Connection test failed: ${data.errorMessage || data.error || "Unknown error"} (Code: ${data.errorCode || res.status})`,
        });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: `Connection test error: ${err.message}` });
    } finally {
      setSyncing(null);
    }
  };

  const handleManagedDirectorySync = async () => {
    try {
      setSyncing("directory");
      setFeedback(null);
      const res = await fetch("/api/sync/directory", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.status !== "FAILED") {
        const processed = data.managedGroupsProcessed ?? data.unchangedCount ?? 0;
        const imported = data.importedCount || 0;
        const updated = data.updatedCount || 0;
        const unchanged = data.unchangedCount || 0;
        const inactivated = data.inactivatedCount || 0;

        setFeedback({
          type: "success",
          text: `Managed groups sync completed! Processed ${processed} managed support groups. (${imported} imported, ${updated} updated, ${unchanged} unchanged, ${inactivated} inactivated memberships).`,
        });
        loadManagedGroups();
      } else {
        setFeedback({
          type: "error",
          text: `Directory sync failed: ${data.errorMessage || data.error || "Unknown error"}`,
        });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: `Error: ${err.message}` });
    } finally {
      setSyncing(null);
    }
  };

  const handleSearchHelix = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSearching(true);
      setFeedback(null);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append("query", searchQuery.trim());
      params.append("limit", "15");

      const res = await fetch(`/api/bmc/support-groups/search?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data.results || []);
      } else {
        setFeedback({ type: "error", text: data.error || "Failed to search BMC Helix groups" });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: `Search error: ${err.message}` });
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async (bmcSupportGroupId: string, groupName: string) => {
    try {
      setImportingId(bmcSupportGroupId);
      setFeedback(null);

      const res = await fetch("/api/bmc/support-groups/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bmcSupportGroupId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({
          type: "success",
          text: `Support Group "${groupName}" imported successfully with ${data.membersImported} direct members!`,
        });
        setSearchResults((prev) =>
          prev.map((g) =>
            g.bmcSupportGroupId === bmcSupportGroupId
              ? { ...g, alreadyManaged: true, localMemberCount: data.membersImported }
              : g
          )
        );
        loadManagedGroups();
      } else {
        setFeedback({
          type: "error",
          text: `Failed to import group: ${data.error || "Unknown error"}`,
        });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: `Import error: ${err.message}` });
    } finally {
      setImportingId(null);
    }
  };

  const handleLiveAvailabilitySync = async () => {
    if (
      !confirm(
        "Are you sure you want to push real assignment availability updates to BMC Helix for all analysts with pending roster changes?"
      )
    ) {
      return;
    }
    try {
      setSyncing("live-sync");
      setFeedback(null);
      const res = await fetch("/api/sync/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      const data = await res.json();
      if (res.ok) {
        const successes = (data.results || []).filter(
          (r: any) => r.result === "SUCCESS" && r.operationAttempted === "UPDATE"
        ).length;
        const failures = (data.results || []).filter(
          (r: any) => r.result === "FAILURE"
        ).length;
        setFeedback({
          type: failures > 0 ? "error" : "success",
          text: `Live Availability Sync completed! Updated ${successes} analyst availability status in BMC Helix (${failures} failures across ${data.count || 0} evaluated targets).`,
        });
        loadManagedGroups();
      } else {
        setFeedback({ type: "error", text: `Live sync failed: ${data.error}` });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: `Error: ${err.message}` });
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            BMC Helix ITSM 26.2 Integration
          </h1>
          <span className="bg-blue-100 text-blue-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-blue-200">
            Option 2: Selective Ingestion
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">
          Provider status, connection testing, on-demand group import, and managed roster synchronization
        </p>
      </div>

      {feedback && (
        <div
          className={`p-3.5 text-xs rounded-lg flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : feedback.type === "error"
              ? "bg-red-50 border border-red-200 text-red-800"
              : "bg-blue-50 border border-blue-200 text-blue-800"
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Provider Status Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Active BMC Helix Provider Status
            </h2>
            <p className="text-xs text-slate-500">
              Operating boundary for roster synchronization
            </p>
          </div>
          {providerMode === "helix" ? (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold border border-blue-300">
              LIVE BMC HELIX REST ACTIVE
            </span>
          ) : (
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-300">
              MOCK PROVIDER ACTIVE
            </span>
          )}
        </div>

        <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
          {providerMode === "helix" ? (
            <p>
              The application is configured in <strong>Live Helix Mode</strong>. It authenticates with AR-JWT against <code>https://solvnow-dev-restapi.onbmc.com</code>. Operating in <strong>Selective On-Demand Ingestion (Option 2)</strong> to protect database size and prevent enterprise query throttling.
            </p>
          ) : (
            <p>
              The application is currently operating in <strong>Mock Mode</strong>. The mock provider serves directory records and simulates assignment availability without requiring a live BMC Helix server.
            </p>
          )}

          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-blue-900 text-xs">
            <strong>Architecture Note (Option 2):</strong> Instead of bulk-syncing tens of thousands of corporate employees from <code>CTM:People</code>, only the Support Groups actively imported into this roster (and their direct analysts) are stored and synchronized.
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={syncing !== null}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs shadow-xs transition-colors flex items-center gap-2"
          >
            {syncing === "test-connection" ? "Testing..." : "🔌 Test BMC Helix Connection"}
          </button>

          <button
            onClick={handleManagedDirectorySync}
            disabled={syncing !== null}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg font-semibold text-xs shadow-xs transition-colors flex items-center gap-2"
          >
            {syncing === "directory" ? "Syncing..." : "🔄 Sync Managed Groups Only"}
          </button>

          <button
            onClick={handleLiveAvailabilitySync}
            disabled={syncing !== null}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs shadow-xs transition-colors flex items-center gap-2"
          >
            {syncing === "live-sync" ? "Pushing Live..." : "⚡ Execute Live Availability Sync"}
          </button>
        </div>
      </div>

      {/* Live Automation & Scheduling Status Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>🤖</span> Automated Synchronization Engine
            </h2>
            <p className="text-xs text-slate-500">
              Immediate event-driven sync on roster change + background periodic checks
            </p>
          </div>
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            AUTOMATION ACTIVE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Immediate Auto-Sync */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>⚡</span> Immediate Auto-Sync on Save
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Whenever you create, edit, or delete a shift or leave entry in Roster Management or My Roster, the system automatically evaluates and updates Remedy Assignment Availability in the background immediately.
            </p>
            <div className="text-[11px] text-slate-500 pt-1">
              Triggered on: <code>Shift Save</code>, <code>Leave Request</code>, <code>Shift Delete</code>, <code>Emergency Override</code>
            </div>
          </div>

          {/* Card 2: Periodic Scheduler */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>⏱️</span> Periodic Background Scheduler
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  schedulerStatus?.active
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {schedulerStatus?.active ? "RUNNING" : "PAUSED"}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Continuously runs in the background every{" "}
              <strong>{schedulerStatus?.intervalMinutes || 5} minutes</strong>. Automatically flips analysts to Available or Unavailable as shift start and end times arrive.
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>
                Last run:{" "}
                {schedulerStatus?.lastRunAt
                  ? new Date(schedulerStatus.lastRunAt).toLocaleTimeString()
                  : "Recently started"}
              </span>
              {schedulerStatus?.active ? (
                <button
                  onClick={() => handleToggleScheduler("stop")}
                  disabled={syncing !== null}
                  className="text-xs text-red-600 hover:underline font-semibold"
                >
                  Pause
                </button>
              ) : (
                <button
                  onClick={() => handleToggleScheduler("start")}
                  disabled={syncing !== null}
                  className="text-xs text-emerald-600 hover:underline font-semibold"
                >
                  Resume
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* On-Demand Support Group Import Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Import Support Group from BMC Helix
            </h2>
            <p className="text-xs text-slate-500">
              Search BMC Helix <code>CTM:Support Group</code> and selectively ingest a group and its active analysts
            </p>
          </div>
          <Link
            href="/support-groups"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            View All Managed Groups ({managedGroups.length}) →
          </Link>
        </div>

        <form onSubmit={handleSearchHelix} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Group Name or ID (e.g. Service Desk, Incident, SGP...)"
            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
          <button
            type="submit"
            disabled={searching}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {searching ? "Searching..." : "🔍 Search Helix"}
          </button>
        </form>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="pt-2 space-y-2">
            <h3 className="text-xs font-bold text-slate-700">Search Results from BMC Helix:</h3>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {searchResults.map((res) => (
                <div
                  key={res.bmcSupportGroupId}
                  className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs transition-colors"
                >
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span>{res.name}</span>
                      <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px]">
                        {res.bmcSupportGroupId}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {res.company} • Org: {res.organization}
                    </div>
                  </div>

                  <div>
                    {res.alreadyManaged ? (
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-semibold text-[11px]">
                        ✓ Managed ({res.localMemberCount || 0} members)
                      </span>
                    ) : (
                      <button
                        onClick={() => handleImport(res.bmcSupportGroupId, res.name)}
                        disabled={importingId === res.bmcSupportGroupId}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-semibold transition-colors disabled:opacity-50"
                      >
                        {importingId === res.bmcSupportGroupId ? "Importing..." : "📥 Import"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Currently Managed Support Groups Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Currently Managed Support Groups ({managedGroups.length})
            </h2>
            <p className="text-xs text-slate-500">
              Only these groups and their members are included in periodic roster synchronization
            </p>
          </div>
        </div>

        {loadingGroups ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading managed groups...</div>
        ) : managedGroups.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No support groups imported yet. Use the search tool above to import groups from BMC Helix.
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="p-3">Support Group Name</th>
                  <th className="p-3">Company / Org</th>
                  <th className="p-3">Helix Group ID</th>
                  <th className="p-3 text-center">Analysts</th>
                  <th className="p-3">Last Synced</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {managedGroups.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{g.name}</td>
                    <td className="p-3 text-slate-500">{g.company} / {g.organization}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-600">{g.bmcSupportGroupId}</td>
                    <td className="p-3 text-center font-bold">{g.memberCount}</td>
                    <td className="p-3 text-slate-400 text-[11px]">
                      {g.lastSyncedAt ? new Date(g.lastSyncedAt).toLocaleString() : "Never"}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/roster/${g.id}`}
                        className="text-blue-600 hover:text-blue-800 font-semibold text-[11px]"
                      >
                        Manage Roster →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
