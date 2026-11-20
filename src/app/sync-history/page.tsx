"use client";

import React, { useState, useEffect } from "react";

interface SyncRecord {
  id: string;
  syncType: string;
  previousAvailability: boolean | null;
  desiredAvailability: boolean | null;
  effectiveSource: string | null;
  operation: string;
  result: string;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  correlationId: string;
  startedAt: string;
  completedAt: string | null;
  person?: { fullName: string; loginId: string };
  supportGroup?: { name: string; company: string };
}

export default function SyncHistoryPage() {
  const [records, setRecords] = useState<SyncRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterResult, setFilterResult] = useState<string>("ALL");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const url = filterResult === "ALL" ? "/api/sync-history" : `/api/sync-history?result=${filterResult}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.syncHistories || []);
      }
    } catch (err) {
      console.error("Failed to load sync history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [filterResult]);

  const handleRetry = async (historyId: string) => {
    try {
      setRetryingId(historyId);
      setFeedback(null);
      const res = await fetch("/api/sync/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncHistoryId: historyId }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback(`Retry completed with result: ${data.result}`);
        loadRecords();
      } else {
        setFeedback(`Retry failed: ${data.error}`);
      }
    } catch (err: any) {
      setFeedback(`Retry error: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Synchronization History
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Full audit ledger of availability calculations, BMC updates, dry-runs, and retries
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Filter Result:</label>
          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value)}
            className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          >
            <option value="ALL">All Results</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="DRY_RUN">DRY_RUN</option>
            <option value="FAILURE">FAILURE</option>
            <option value="SKIPPED">SKIPPED</option>
            <option value="CONFIGURATION_REQUIRED">CONFIGURATION_REQUIRED</option>
          </select>
        </div>
      </div>

      {feedback && (
        <div className="p-3 text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded-lg flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="font-bold">
            ✕
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Support Group</th>
                <th className="py-3 px-4">Person</th>
                <th className="py-3 px-4">State Transition</th>
                <th className="py-3 px-4">Operation</th>
                <th className="py-3 px-4">Result</th>
                <th className="py-3 px-4">Details / Errors</th>
                <th className="py-3 px-4">Correlation ID</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Loading sync records...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No synchronization records found.
                  </td>
                </tr>
              ) : (
                records.map((rec) => {
                  const isEligibleRetry =
                    rec.result === "FAILURE" ||
                    rec.result === "CONFIGURATION_REQUIRED";

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(rec.startedAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {rec.syncType}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {rec.supportGroup?.name || "Global / All"}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {rec.person?.fullName || "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {rec.previousAvailability !== null && rec.desiredAvailability !== null ? (
                          <span>
                            {rec.previousAvailability ? "AVAIL" : "UNAVAIL"} →{" "}
                            <strong>
                              {rec.desiredAvailability ? "AVAIL" : "UNAVAIL"}
                            </strong>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                          {rec.operation}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            rec.result === "SUCCESS"
                              ? "bg-emerald-100 text-emerald-800"
                              : rec.result === "DRY_RUN"
                              ? "bg-blue-100 text-blue-800"
                              : rec.result === "SKIPPED"
                              ? "bg-slate-100 text-slate-700"
                              : rec.result === "CONFIGURATION_REQUIRED"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {rec.result}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-[11px] text-slate-500" title={rec.errorMessage || ""}>
                        {rec.errorMessage || "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {rec.correlationId.substring(0, 16)}...
                      </td>
                      <td className="py-3 px-4">
                        {isEligibleRetry && (
                          <button
                            onClick={() => handleRetry(rec.id)}
                            disabled={retryingId === rec.id}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-semibold text-[10px]"
                          >
                            {retryingId === rec.id ? "Retrying..." : "Retry"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
