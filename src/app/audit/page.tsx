"use client";

import React, { useState, useEffect } from "react";

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  performedBy: string;
  correlationId: string;
  timestamp: string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      let url = "/api/audit?";
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (actionFilter) url += `action=${encodeURIComponent(actionFilter)}&`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Audit Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Immutable log of all roster modifications, availability overrides, authorizations, and sync actions
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search details or user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-900 text-white font-semibold text-xs rounded-lg hover:bg-slate-800"
          >
            Search
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity Type</th>
                <th className="py-3 px-4">Entity ID</th>
                <th className="py-3 px-4">Performed By</th>
                <th className="py-3 px-4">Correlation ID</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading audit records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {log.entityType}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 truncate max-w-[120px]">
                      {log.entityId}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {log.performedBy}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {log.correlationId.substring(0, 16)}...
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-xs text-blue-600 hover:underline font-semibold"
                      >
                        Inspect Diff
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Diff Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Audit Entry: {selectedLog.action}
                </h2>
                <div className="text-xs text-slate-400">
                  {selectedLog.performedBy} • {new Date(selectedLog.timestamp).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="font-semibold text-slate-700 mb-1">Entity Details:</div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200 font-mono text-[11px]">
                  Type: {selectedLog.entityType} | ID: {selectedLog.entityId}
                </div>
              </div>

              {selectedLog.oldValue && (
                <div>
                  <div className="font-semibold text-slate-700 mb-1">Previous Value:</div>
                  <pre className="p-2.5 bg-red-50/50 rounded border border-red-200 text-red-900 font-mono text-[11px] overflow-x-auto max-h-40">
                    {selectedLog.oldValue}
                  </pre>
                </div>
              )}

              {selectedLog.newValue && (
                <div>
                  <div className="font-semibold text-slate-700 mb-1">New Value:</div>
                  <pre className="p-2.5 bg-emerald-50/50 rounded border border-emerald-200 text-emerald-900 font-mono text-[11px] overflow-x-auto max-h-40">
                    {selectedLog.newValue}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
