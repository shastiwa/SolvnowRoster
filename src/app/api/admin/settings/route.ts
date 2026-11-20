import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { AuthorizationService } from "@/server/authorization/service";
import { prisma } from "@/lib/database";
import { AuditService } from "@/server/services/auditService";
import { SafeLogger } from "@/server/logging/logger";

const DEFAULT_SETTINGS: Record<string, { value: string; description: string }> =
  {
    MISSING_ROSTER_POLICY: {
      value: "TAKE_NO_ACTION",
      description:
        "Behavior when person has no roster entry: TAKE_NO_ACTION, KEEP_CURRENT_BMC_STATE, or SET_UNAVAILABLE",
    },
    ON_CALL_AVAILABILITY_POLICY: {
      value: "UNAVAILABLE",
      description:
        "Assignment availability during ON_CALL shifts: AVAILABLE or UNAVAILABLE",
    },
    SYNC_INTERVAL_MINUTES: {
      value: "15",
      description: "Interval in minutes for automatic availability reconciliation",
    },
    DRY_RUN_DEFAULT: {
      value: "false",
      description:
        "When true, availability sync runs in simulation mode without updating BMC Helix",
    },
    BMC_PROVIDER_MODE: {
      value: process.env.BMC_PROVIDER_MODE || "mock",
      description: "BMC Helix provider mode: mock or helix",
    },
    APP_TIMEZONE: {
      value: "Asia/Kolkata",
      description: "Default application timezone for shift calculations",
    },
  };

export async function GET() {
  try {
    const user = await getCurrentUser();
    const dbSettings = await prisma.applicationConfiguration.findMany();

    const settingsMap: Record<string, { value: string; description: string }> = {
      ...DEFAULT_SETTINGS,
    };

    for (const item of dbSettings) {
      settingsMap[item.key] = {
        value: item.value,
        description: item.description || settingsMap[item.key]?.description || "",
      };
    }

    // Prioritize active process.env overrides
    if (process.env.BMC_PROVIDER_MODE) {
      settingsMap.BMC_PROVIDER_MODE = {
        value: process.env.BMC_PROVIDER_MODE,
        description: "BMC Helix provider mode: mock or helix",
      };
    }

    return NextResponse.json({
      settings: settingsMap,
      isAdmin: user.role === "ROSTER_ADMIN",
    });
  } catch (error: any) {
    SafeLogger.error("Failed to fetch settings", { error: error.message });
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    AuthorizationService.assertAdmin(user);

    const body = await req.json();
    const { key, value } = body;

    if (!key || typeof value === "undefined") {
      return NextResponse.json(
        { error: "Setting key and value are required" },
        { status: 400 }
      );
    }

    const previous = await prisma.applicationConfiguration.findUnique({
      where: { key },
    });

    const updated = await prisma.applicationConfiguration.upsert({
      where: { key },
      create: {
        key,
        value: String(value),
        description: DEFAULT_SETTINGS[key]?.description || "Application setting",
        updatedBy: user.email,
      },
      update: {
        value: String(value),
        updatedBy: user.email,
      },
    });

    await AuditService.record({
      entityType: "CONFIGURATION",
      entityId: key,
      action: "UPDATE_SETTING",
      oldValue: previous ? { value: previous.value } : null,
      newValue: { value },
      performedBy: user.email,
    });

    return NextResponse.json({ success: true, setting: updated });
  } catch (error: any) {
    SafeLogger.error("Failed to update setting", { error: error.message });
    return NextResponse.json(
      { error: error.message || "Failed to update setting" },
      { status: error.status || 500 }
    );
  }
}
