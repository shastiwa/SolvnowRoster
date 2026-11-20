"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface SupportGroup {
  id: string;
  name: string;
  company: string;
  organization: string;
  bmcSupportGroupId: string;
  active: boolean;
  lastSyncedAt?: string;
  members: Array<{
    id: string;
    person: { fullName: string; loginId: string };
  }>;
  managers: Array<{
    id: string;
    managerUser: { displayName: string };
  }>;
}

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

export default function SupportGroupsPage() {
  const [groups, setGroups] = useState<SupportGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Import Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HelixSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [unmanagingId, setUnmanagingId] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/support-groups");
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : data.supportGroups || []);
    } catch (err) {
      console.error("Failed to load support groups:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const searchHelixGroups = async (query: string) => {
    try {
      setSearching(true);
      const params = new URLSearchParams();
      if (query.trim()) params.append("query", query.trim());
      params.append("limit", "20");

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

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setSearchQuery("");
    searchHelixGroups("");
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
          text: `Support Group "${groupName}" imported successfully with ${data.membersImported} members!`,
        });
        // Update search results list to mark it as already managed
        setSearchResults((prev) =>
          prev.map((g) =>
            g.bmcSupportGroupId === bmcSupportGroupId
              ? { ...g, alreadyManaged: true, localMemberCount: data.membersImported }
              : g
          )
        );
        // Refresh local groups list
        loadGroups();
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

  const handleUnmanage = async (groupId: string, groupName: string) => {
    if (!confirm(`Are you sure you want to stop managing "${groupName}" in the roster? Shifts will be preserved, but automatic sync for this group will cease.`)) {
      return;
    }

    try {
      setUnmanagingId(groupId);
      const res = await fetch(`/api/bmc/support-groups/${groupId}/unmanage`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({
          type: "info",
          text: `Support group "${groupName}" is no longer actively managed.`,
        });
        loadGroups();
      } else {
        setFeedback({
          type: "error",
          text: `Failed to unmanage group: ${data.error || "Unknown error"}`,
        });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: `Error: ${err.message}` });
    } finally {
      setUnmanagingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Support Groups
            </h1>
            <span className="bg-blue-100 text-blue-800 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-blue-200">
              Option 2: Selective Ingestion
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage only the specific Support Groups and analysts selected for roster scheduling.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-2"
          >
            <span>➕</span>
            <span>Import from BMC Helix</span>
          </button>

          <Link
            href="/admin/authorizations"
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            Manage Authorizations →
          </Link>
        </div>
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

      {/* Selective Ingestion Guidance Note */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs text-slate-600 flex items-start gap-3">
        <span className="text-lg">💡</span>
        <div>
          <strong className="text-slate-800">Why Selective On-Demand Ingestion?</strong>
          <p className="mt-0.5 text-slate-500 leading-relaxed">
            BMC Helix enterprise instances hold tens of thousands of corporate employees and support groups. By selectively importing only the groups you manage, the roster application runs in milliseconds and prevents enterprise directory overload.
          </p>
        </div>
      </div>

      {/* Support Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-sm text-slate-400">
            Loading managed support groups...
          </div>
        ) : groups.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-xl border border-slate-200 p-8 space-y-3">
            <div className="text-3xl">📋</div>
            <h3 className="text-base font-bold text-slate-800">No Support Groups Managed Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              You haven&apos;t imported any support groups from BMC Helix. Click below to search your BMC Helix instance and import your first support group.
            </p>
            <button
              onClick={handleOpenModal}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors inline-flex items-center gap-2"
            >
              <span>➕ Import Support Group from BMC Helix</span>
            </button>
          </div>
        ) : (
          groups.map((group) => (
            <div
              key={group.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between space-y-4 hover:border-blue-300 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-medium text-slate-500">{group.company}</span>
                  <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                    {group.bmcSupportGroupId}
                  </span>
                </div>

                <h2 className="text-base font-bold text-slate-900 leading-snug">
                  {group.name}
                </h2>
                <div className="text-xs text-slate-500 mt-0.5 font-medium">
                  Org: {group.organization}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Rostered Analysts:</span>
                    <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full text-[11px]">
                      {group.members?.length || 0} People
                    </span>
                  </div>

                  <div className="flex items-start justify-between">
                    <span className="text-slate-500">Authorized Managers:</span>
                    <div className="text-right">
                      {group.managers && group.managers.length > 0 ? (
                        group.managers.map((m) => (
                          <div
                            key={m.id}
                            className="font-semibold text-blue-700 text-[11px]"
                          >
                            {m.managerUser?.displayName}
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-400 text-[11px]">Unassigned</span>
                      )}
                    </div>
                  </div>

                  {group.lastSyncedAt && (
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>Last Synced:</span>
                      <span>{new Date(group.lastSyncedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <Link
                  href={`/roster/${group.id}`}
                  className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Open Roster Management</span>
                  <span>→</span>
                </Link>

                <button
                  onClick={() => handleUnmanage(group.id, group.name)}
                  disabled={unmanagingId === group.id}
                  title="Remove from roster management"
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs"
                >
                  {unmanagingId === group.id ? "..." : "🗑️"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Import Support Group from BMC Helix Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Import Support Group from BMC Helix
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search live BMC Helix ITSM to import a Support Group and its direct analysts into the roster
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Search Input */}
            <div className="p-6 pb-3 border-b border-slate-100 space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchHelixGroups(e.target.value);
                  }}
                  placeholder="Type Support Group Name or ID (e.g., Service Desk, Backoffice, SGP...)"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all pr-10"
                />
                {searching && (
                  <div className="absolute right-3.5 top-3 text-slate-400 text-xs animate-spin">
                    ⏳
                  </div>
                )}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Queries CTM:Support Group directly with live AR-JWT authentication</span>
                <span>Found: {searchResults.length} groups</span>
              </div>
            </div>

            {/* Search Results List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {searching && searchResults.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Searching BMC Helix directory...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No matching Support Groups found in BMC Helix. Try a different search term.
                </div>
              ) : (
                searchResults.map((result) => (
                  <div
                    key={result.bmcSupportGroupId}
                    className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 flex items-center justify-between gap-4 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {result.name}
                        </span>
                        <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                          {result.bmcSupportGroupId}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        <span>Company: <strong>{result.company}</strong></span>
                        <span className="mx-2">•</span>
                        <span>Org: <strong>{result.organization}</strong></span>
                      </div>
                    </div>

                    <div>
                      {result.alreadyManaged ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg font-semibold">
                          <span>✓</span>
                          <span>Managed</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleImport(result.bmcSupportGroupId, result.name)}
                          disabled={importingId === result.bmcSupportGroupId}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {importingId === result.bmcSupportGroupId ? (
                            <>
                              <span className="animate-spin text-[10px]">⏳</span>
                              <span>Importing...</span>
                            </>
                          ) : (
                            <>
                              <span>📥</span>
                              <span>Import Group</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Importing a group fetches its direct members and person profiles from BMC Helix.</span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg shadow-xs transition-colors"
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
