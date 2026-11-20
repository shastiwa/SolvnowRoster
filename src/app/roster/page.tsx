"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Calendar, ArrowRight, Building2, ShieldCheck } from "lucide-react";

interface SupportGroup {
  id: string;
  name: string;
  company: string;
  organization: string;
  bmcSupportGroupId: string;
  memberCount?: number;
}

export default function RosterIndexPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<SupportGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("");

  useEffect(() => {
    fetch("/api/support-groups")
      .then((res) => res.json())
      .then((data) => {
        const list: SupportGroup[] = Array.isArray(data) ? data : data.supportGroups || [];
        setGroups(list);
        if (list.length > 0) {
          const firstCompany = list[0].company || "";
          setSelectedCompany(firstCompany);
          const matching = list.filter((g) => !firstCompany || g.company === firstCompany);
          if (matching.length > 0) {
            setSelectedGroup(matching[0].id);
          } else {
            setSelectedGroup(list[0].id);
          }
        }
      })
      .catch((err) => console.error("Failed to load support groups:", err))
      .finally(() => setLoading(false));
  }, []);

  const companies = Array.from(new Set(groups.map((g) => g.company).filter(Boolean)));
  const filteredGroups = groups.filter(
    (g) => !selectedCompany || g.company === selectedCompany
  );

  const handleGo = () => {
    if (selectedGroup) {
      router.push(`/roster/${selectedGroup}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[350px] text-sm text-slate-500">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading support groups...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pt-4 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Support Group Rosters
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Choose a BMC Helix Support Group to view, schedule, or modify member shifts and assignment availability.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center space-y-4">
          <Users className="w-10 h-10 text-slate-400 mx-auto" />
          <div>
            <h3 className="text-base font-semibold text-slate-800">No Support Groups Managed</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              No active BMC Helix support groups are currently ingested for roster scheduling.
            </p>
          </div>
          <Link
            href="/support-groups"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors"
          >
            Import from BMC Helix
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <>
          {/* Quick Dropdown Selector Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Company
                </label>
                <select
                  value={selectedCompany}
                  onChange={(e) => {
                    const comp = e.target.value;
                    setSelectedCompany(comp);
                    const matching = groups.filter((g) => !comp || g.company === comp);
                    if (matching.length > 0) {
                      setSelectedGroup(matching[0].id);
                    } else {
                      setSelectedGroup("");
                    }
                  }}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {companies.length > 1 && <option value="">All Companies</option>}
                  {companies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Support Group
                </label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {filteredGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.organization}) • {g.memberCount ?? 0} members
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleGo}
              disabled={!selectedGroup}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold text-sm rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              Open Roster Grid
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Direct Support Group Card Directory */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Available Support Groups ({filteredGroups.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredGroups.map((g) => (
                <div
                  key={g.id}
                  onClick={() => router.push(`/roster/${g.id}`)}
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {g.name}
                      </h3>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1 shrink-0">
                        <Users className="w-3 h-3" />
                        {g.memberCount ?? 0}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {g.company}
                      </span>
                      <span>•</span>
                      <span className="text-slate-600 font-medium">
                        {g.organization}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      View Weekly Schedule
                    </span>
                    <span className="flex items-center gap-1">
                      Open Roster
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
