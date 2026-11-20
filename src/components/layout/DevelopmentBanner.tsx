"use client";

import React, { useState, useEffect } from "react";

export function DevelopmentBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [providerMode, setProviderMode] = useState<string>("mock");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.BMC_PROVIDER_MODE?.value) {
          setProviderMode(data.settings.BMC_PROVIDER_MODE.value);
        }
      })
      .catch(() => {});
  }, []);

  if (dismissed) return null;

  return (
    <aside
      aria-label="Development Mode Warning"
      className={`${
        providerMode === "helix"
          ? "bg-blue-600 text-white border-blue-700"
          : "bg-amber-500 text-amber-950 border-amber-600"
      } px-4 py-2 text-xs font-medium flex items-center justify-between border-b shadow-sm`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`${
            providerMode === "helix"
              ? "bg-blue-900 text-blue-100"
              : "bg-amber-900 text-amber-100"
          } text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider`}
        >
          {providerMode === "helix" ? "Live Helix Mode" : "Dev Mock Mode"}
        </span>
        <span>
          {providerMode === "helix" ? (
            <>
              <strong>BMC Helix ITSM 26.2 Live Provider Active:</strong> Selective On-Demand Ingestion (Option 2) enabled. Only imported Support Groups and their analysts are synchronized.
            </>
          ) : (
            <>
              <strong>BMC Helix ITSM 26.2 Mock Provider Active:</strong> Operating independently using mock directory and availability providers.
            </>
          )}
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className={`${
          providerMode === "helix"
            ? "text-blue-100 hover:text-white hover:bg-blue-700/50"
            : "text-amber-900 hover:text-amber-950 hover:bg-amber-400/50"
        } font-bold ml-4 px-2 py-0.5 rounded transition-colors`}
      >
        ✕ Dismiss
      </button>
    </aside>
  );
}
