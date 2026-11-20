"use client";

import React, { useState, useEffect } from "react";

interface SettingItem {
  value: string;
  description: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, SettingItem>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || {});
        setIsAdmin(Boolean(data.isAdmin));
        const initialFormValues: Record<string, string> = {};
        for (const [key, item] of Object.entries(data.settings || {})) {
          initialFormValues[key] = (item as SettingItem).value;
        }
        setFormValues(initialFormValues);
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: "Failed to load application settings" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (key: string) => {
    setSavingKey(key);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: formValues[key] }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "success", text: `Setting '${key}' updated successfully!` });
        loadSettings();
      } else {
        throw new Error(data.error || "Failed to update setting");
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Application Settings & Policies
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure synchronization parameters, calculation policies, and operational defaults
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

      {!isAdmin && !loading && (
        <div className="p-3 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg">
          <strong>Notice:</strong> You are currently signed in as a non-admin role. Settings can only be modified by ROSTER_ADMIN. Use the Role Switcher in the top bar to switch to ROSTER_ADMIN.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading settings...</div>
        ) : (
          <>
            {/* Setting: MISSING_ROSTER_POLICY */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2">
                <div className="text-sm font-semibold text-slate-900">
                  Missing Roster Policy
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Determines assignment availability behavior when a support group member has no roster entry defined for the active interval.
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  Key: MISSING_ROSTER_POLICY
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  disabled={!isAdmin || savingKey === "MISSING_ROSTER_POLICY"}
                  value={formValues.MISSING_ROSTER_POLICY || "TAKE_NO_ACTION"}
                  onChange={(e) => handleChange("MISSING_ROSTER_POLICY", e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="TAKE_NO_ACTION">TAKE_NO_ACTION (Skipped, leaves BMC unchanged)</option>
                  <option value="KEEP_CURRENT_BMC_STATE">KEEP_CURRENT_BMC_STATE (Explicitly preserve BMC status)</option>
                  <option value="SET_UNAVAILABLE">SET_UNAVAILABLE (Mark person No in BMC)</option>
                </select>
                <button
                  disabled={!isAdmin || savingKey === "MISSING_ROSTER_POLICY"}
                  onClick={() => handleSave("MISSING_ROSTER_POLICY")}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors"
                >
                  {savingKey === "MISSING_ROSTER_POLICY" ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {/* Setting: ON_CALL_AVAILABILITY_POLICY */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2">
                <div className="text-sm font-semibold text-slate-900">
                  On-Call Shift Assignment Policy
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Configures whether members on active ON_CALL schedule receive incident auto-assignments (AVAILABLE) or stand by as escalation only (UNAVAILABLE).
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  Key: ON_CALL_AVAILABILITY_POLICY
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  disabled={!isAdmin || savingKey === "ON_CALL_AVAILABILITY_POLICY"}
                  value={formValues.ON_CALL_AVAILABILITY_POLICY || "UNAVAILABLE"}
                  onChange={(e) => handleChange("ON_CALL_AVAILABILITY_POLICY", e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="UNAVAILABLE">UNAVAILABLE (Standby / Escalation only)</option>
                  <option value="AVAILABLE">AVAILABLE (Receive direct auto-assignments)</option>
                </select>
                <button
                  disabled={!isAdmin || savingKey === "ON_CALL_AVAILABILITY_POLICY"}
                  onClick={() => handleSave("ON_CALL_AVAILABILITY_POLICY")}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors"
                >
                  {savingKey === "ON_CALL_AVAILABILITY_POLICY" ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {/* Setting: SYNC_INTERVAL_MINUTES */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2">
                <div className="text-sm font-semibold text-slate-900">
                  Reconciliation Interval (Minutes)
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Frequency of the background reconciliation job that detects shift transitions and recalculates availability states.
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  Key: SYNC_INTERVAL_MINUTES
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="5"
                  max="1440"
                  disabled={!isAdmin || savingKey === "SYNC_INTERVAL_MINUTES"}
                  value={formValues.SYNC_INTERVAL_MINUTES || "15"}
                  onChange={(e) => handleChange("SYNC_INTERVAL_MINUTES", e.target.value)}
                  className="w-24 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  disabled={!isAdmin || savingKey === "SYNC_INTERVAL_MINUTES"}
                  onClick={() => handleSave("SYNC_INTERVAL_MINUTES")}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors"
                >
                  {savingKey === "SYNC_INTERVAL_MINUTES" ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {/* Setting: DRY_RUN_DEFAULT */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2">
                <div className="text-sm font-semibold text-slate-900">
                  Dry-Run Simulation Default
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  When enabled, scheduled and manual availability synchronizations default to simulation mode without executing live mutations on BMC Helix.
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  Key: DRY_RUN_DEFAULT
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  disabled={!isAdmin || savingKey === "DRY_RUN_DEFAULT"}
                  value={formValues.DRY_RUN_DEFAULT || "false"}
                  onChange={(e) => handleChange("DRY_RUN_DEFAULT", e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="false">false (Live synchronization enabled)</option>
                  <option value="true">true (Safety dry-run simulation mode)</option>
                </select>
                <button
                  disabled={!isAdmin || savingKey === "DRY_RUN_DEFAULT"}
                  onClick={() => handleSave("DRY_RUN_DEFAULT")}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors"
                >
                  {savingKey === "DRY_RUN_DEFAULT" ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {/* Setting: APP_TIMEZONE */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2">
                <div className="text-sm font-semibold text-slate-900">
                  Application Base Timezone
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Default IANA timezone used for shift interval boundaries, overnight shift splits, and schedule evaluation.
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  Key: APP_TIMEZONE
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled={!isAdmin || savingKey === "APP_TIMEZONE"}
                  value={formValues.APP_TIMEZONE || "Asia/Kolkata"}
                  onChange={(e) => handleChange("APP_TIMEZONE", e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  disabled={!isAdmin || savingKey === "APP_TIMEZONE"}
                  onClick={() => handleSave("APP_TIMEZONE")}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors"
                >
                  {savingKey === "APP_TIMEZONE" ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {/* Setting: BMC_PROVIDER_MODE */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2">
                <div className="text-sm font-semibold text-slate-900">
                  BMC Helix Integration Mode
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Choose between local simulated mock provider or real BMC Helix REST provider. In helix mode, availability sync requires verified BMC 26.2 REST endpoints.
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  Key: BMC_PROVIDER_MODE
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  disabled={!isAdmin || savingKey === "BMC_PROVIDER_MODE"}
                  value={formValues.BMC_PROVIDER_MODE || "mock"}
                  onChange={(e) => handleChange("BMC_PROVIDER_MODE", e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="mock">mock (Internal Mock Provider)</option>
                  <option value="helix">helix (BMC Helix 26.2 REST Integration)</option>
                </select>
                <button
                  disabled={!isAdmin || savingKey === "BMC_PROVIDER_MODE"}
                  onClick={() => handleSave("BMC_PROVIDER_MODE")}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors"
                >
                  {savingKey === "BMC_PROVIDER_MODE" ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
