"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface Person {
  id: string;
  fullName: string;
  loginId: string;
  email: string;
  active: boolean;
  supportGroups: Array<{
    currentBmcAvailability: boolean;
    supportGroup: {
      id: string;
      name: string;
      company: string;
    };
  }>;
}

export default function PeopleDirectoryPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/people")
      .then((res) => res.json())
      .then((data) => setPeople(Array.isArray(data) ? data : data.people || []))
      .catch((err) => console.error("Failed to load people:", err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = people.filter(
    (p) =>
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.loginId.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            People Directory
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Synchronized BMC Helix support personnel and group memberships
          </p>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search by name, login, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Login ID</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Support Group Memberships</th>
                <th className="py-3 px-4">BMC Availability</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading directory...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No people found matching your criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((person) => (
                  <tr key={person.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {person.fullName}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {person.loginId}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{person.email}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {person.supportGroups && person.supportGroups.length > 0 ? (
                          person.supportGroups.map((sg) => (
                            <Link
                              key={sg.supportGroup.id}
                              href={`/roster/${sg.supportGroup.id}`}
                              className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700 transition-colors"
                            >
                              {sg.supportGroup.name}
                            </Link>
                          ))
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        {person.supportGroups.map((sg) => (
                          <div
                            key={sg.supportGroup.id}
                            className="flex items-center gap-1.5 text-[11px]"
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                sg.currentBmcAvailability
                                  ? "bg-emerald-500"
                                  : "bg-slate-300"
                              }`}
                            ></span>
                            <span className="text-slate-600 font-medium">
                              {sg.supportGroup.name}:
                            </span>
                            <span
                              className={`font-semibold ${
                                sg.currentBmcAvailability
                                  ? "text-emerald-700"
                                  : "text-slate-500"
                              }`}
                            >
                              {sg.currentBmcAvailability ? "Yes" : "No"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {person.supportGroups.length > 0 && (
                        <Link
                          href={`/roster/${person.supportGroups[0].supportGroup.id}`}
                          className="text-xs text-blue-600 hover:underline font-semibold"
                        >
                          View Roster →
                        </Link>
                      )}
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
