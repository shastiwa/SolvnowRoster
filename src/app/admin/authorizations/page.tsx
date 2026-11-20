"use client";

import React, { useState, useEffect } from "react";

interface Manager {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

interface SupportGroup {
  id: string;
  name: string;
  company: string;
  organization: string;
}

interface Assignment {
  id: string;
  managerUser: { id: string; displayName: string; email: string };
  supportGroup: { id: string; name: string; company: string };
  createdAt: string;
}

export default function AdminAuthorizationsPage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [supportGroups, setSupportGroups] = useState<SupportGroup[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/authorizations");
      if (res.ok) {
        const data = await res.json();
        setManagers(data.managers || []);
        setSupportGroups(data.supportGroups || []);
        setAssignments(data.assignments || []);
        if (data.managers?.length > 0) setSelectedManagerId(data.managers[0].id);
        if (data.supportGroups?.length > 0) setSelectedGroupId(data.supportGroups[0].id);
      }
    } catch (err) {
      console.error("Failed to load authorizations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/authorizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedManagerId,
          supportGroupId: selectedGroupId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "success", text: "Manager assigned to support group successfully!" });
        loadData();
      } else {
        throw new Error(data.error || "Failed to assign manager");
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (assignmentId: string) => {
    if (!confirm("Revoke manager authorization for this support group?")) return;
    try {
      const res = await fetch(`/api/admin/authorizations?id=${assignmentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFeedback({ type: "success", text: "Manager authorization revoked." });
        loadData();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to revoke authorization");
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Support Group Authorizations
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Assign authorized managers to BMC Helix support groups (enforced server-side)
        </p>
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

      {/* Assignment Form Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Assign Manager to Support Group
        </h2>

        <form onSubmit={handleAssign} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs items-end">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Select Manager (User)
            </label>
            <select
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName} ({m.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">
              Select Support Group
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {supportGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.company})
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? "Assigning..." : "Assign Authorization"}
            </button>
          </div>
        </form>
      </div>

      {/* Current Authorizations Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">
            Active Manager Assignments ({assignments.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-3 px-4">Authorized Manager</th>
                <th className="py-3 px-4">Support Group</th>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Assigned On</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Loading authorizations...
                  </td>
                </tr>
              ) : assignments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No active manager assignments. Use form above to assign managers.
                  </td>
                </tr>
              ) : (
                assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {a.managerUser.displayName}
                      <span className="block text-[11px] text-slate-400 font-normal">
                        {a.managerUser.email}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {a.supportGroup.name}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {a.supportGroup.company}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleRevoke(a.id)}
                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded font-semibold text-xs transition-colors"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
