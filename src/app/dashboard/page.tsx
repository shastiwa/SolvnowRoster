"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface DashboardData {
  metrics: {
    totalSupportGroups: number;
    totalPeople: number;
    totalRosteredToday: number;
    activeOverrides: number;
    desiredAvailableCount: number;
    desiredUnavailableCount: number;
  };
  recentSyncs: Array<{
    id: string;
    syncType: string;
    result: string;
    operation: string;
    startedAt: string;
    correlationId: string;
    supportGroup?: { name: string };
    person?: { fullName: string };
  }>;
  recentAudits: Array<{
    id: string;
    action: string;
    entityType: string;
    performedBy: string;
    timestamp: string;
  }>;
  timestamp: string;
  providerMode?: string;
  user: {
    id: string;
    name: string;
    role: string;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleDryRun = async () => {
    try {
      setActionLoading("dry-run");
      setActionMessage(null);
      const res = await fetch("/api/sync/dry-run", { method: "POST" });
      const result = await res.json();
      if (res.ok) {
        setActionMessage(
          `Dry-run finished: Evaluated ${result.evaluatedCount || 0} targets. Desired changes: ${result.updatesRequiredCount || 0}.`
        );
        loadDashboard();
      } else {
        setActionMessage(`Dry-run failed: ${result.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDirectorySync = async () => {
    try {
      setActionLoading("directory");
      setActionMessage(null);
      const res = await fetch("/api/sync/directory", { method: "POST" });
      const result = await res.json();
      if (res.ok) {
        const processed = result.managedGroupsProcessed ?? result.unchangedCount ?? 0;
        setActionMessage(
          `Directory synchronized: ${processed} Managed Support Groups refreshed (${result.importedCount || 0} imported, ${result.updatedCount || 0} updated, ${result.unchangedCount || 0} unchanged).`
        );
        loadDashboard();
      } else {
        setActionMessage(`Directory sync failed: ${result.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500 text-sm flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          Loading dashboard metrics...
        </div>
      </div>
    );
  }

  const m = data?.metrics || {
    totalSupportGroups: 0,
    totalPeople: 0,
    totalRosteredToday: 0,
    activeOverrides: 0,
    desiredAvailableCount: 0,
    desiredUnavailableCount: 0,
  };

  const isAdmin = data?.user?.role === "ROSTER_ADMIN";

  return (
    <div className="space-y-6">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Operational Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time roster assignment availability and BMC Helix ITSM 26.2 synchronization status
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isAdmin && (
            <>
              <button
                onClick={handleDirectorySync}
                disabled={actionLoading !== null}
                className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-2"
              >
                {actionLoading === "directory" ? (
                  <span className="w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <span>🔄</span>
                )}
                <span>Sync Directory</span>
              </button>

              <button
                onClick={handleDryRun}
                disabled={actionLoading !== null}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-2"
              >
                {actionLoading === "dry-run" ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <span>⚡</span>
                )}
                <span>Execute Dry-Run</span>
              </button>
            </>
          )}

          <Link
            href="/roster"
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            Manage Rosters →
          </Link>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded-lg flex items-center justify-between">
          <span>{actionMessage}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-blue-500 hover:text-blue-800 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Support Groups</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {m.totalSupportGroups}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Managed units</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">People Directory</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {m.totalPeople}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Synced BMC members</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Rostered Today</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {m.totalRosteredToday}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Scheduled shifts</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Active Overrides</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {m.activeOverrides}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Temporary manual</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Desired Available</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {m.desiredAvailableCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Online for tickets</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Desired Unavailable</div>
          <div className="text-2xl font-bold text-slate-600 mt-1">
            {m.desiredUnavailableCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Off / Standby / Leave</div>
        </div>
      </div>

      {/* Integration Status & System of Record Clarity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Integration Architecture & Sync Engine
              </h2>
              <p className="text-xs text-slate-500">
                Separation of record between BMC Helix ITSM 26.2 and External Roster
              </p>
            </div>
            {data?.providerMode === "helix" ? (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                Provider: Live BMC Helix 26.2 Active
              </span>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Provider: Mock Active
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                BMC Helix ITSM (System of Record)
              </div>
              <ul className="text-slate-600 space-y-1 pl-3.5 list-disc">
                <li>People profiles & Corporate IDs</li>
                <li>Support Groups hierarchy & companies</li>
                <li>Support Group memberships</li>
                <li>Live ticket assignment availability</li>
              </ul>
            </div>

            <div className="p-3.5 rounded-lg bg-blue-50/50 border border-blue-200/80 space-y-1.5">
              <div className="font-bold text-blue-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                External Roster (System of Record)
              </div>
              <ul className="text-blue-800 space-y-1 pl-3.5 list-disc">
                <li>Shift schedules (including overnight shifts)</li>
                <li>Leave, Off, and On-Call planning</li>
                <li>Temporary manager availability overrides</li>
                <li>Calculated desired availability engine</li>
              </ul>
            </div>
          </div>

          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
            <span className="text-base">⚠️</span>
            <div>
              <strong>Rule 6 Enforcement:</strong> BMC Helix assignment availability is updated <u>only</u> when the calculated desired availability differs from the current or last-confirmed BMC state. Idempotent sync prevents duplicate calls.
            </div>
          </div>
        </div>

        {/* Quick Audit Timeline */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Recent Audit Trail</h2>
            <Link href="/audit" className="text-xs text-blue-600 hover:underline font-medium">
              View all
            </Link>
          </div>

          <div className="mt-3 space-y-3">
            {data?.recentAudits && data.recentAudits.length > 0 ? (
              data.recentAudits.map((a) => (
                <div key={a.id} className="text-xs flex items-start gap-2.5 pb-2 border-b border-slate-50 last:border-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0"></span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate">
                      {a.action}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {a.performedBy} • {new Date(a.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center">
                No audit entries yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Sync History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Recent Synchronization Executions
            </h2>
            <p className="text-xs text-slate-500">
              Audit log of availability evaluations, dry-runs, and BMC Helix interactions
            </p>
          </div>
          <Link
            href="/sync-history"
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            Full Sync History →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Target Support Group</th>
                <th className="py-2.5 px-4">Person</th>
                <th className="py-2.5 px-4">Operation</th>
                <th className="py-2.5 px-4">Result</th>
                <th className="py-2.5 px-4">Correlation ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.recentSyncs && data.recentSyncs.length > 0 ? (
                data.recentSyncs.map((sync) => (
                  <tr key={sync.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(sync.startedAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-medium text-slate-800">
                        {sync.syncType}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {sync.supportGroup?.name || "All Groups"}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {sync.person?.fullName || "Group Sync"}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                        {sync.operation}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          sync.result === "SUCCESS"
                            ? "bg-emerald-100 text-emerald-800"
                            : sync.result === "DRY_RUN"
                            ? "bg-blue-100 text-blue-800"
                            : sync.result === "SKIPPED"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {sync.result}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">
                      {sync.correlationId.substring(0, 16)}...
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No synchronization events recorded yet. Click &quot;Execute Dry-Run&quot; above to trigger initial evaluation.
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
