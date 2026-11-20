import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { AuthorizationService } from "@/server/authorization/service";
import {
  getSchedulerStatus,
  startSyncScheduler,
  stopSyncScheduler,
} from "@/server/scheduler/syncScheduler";

export async function GET() {
  // Ensure scheduler is initialized
  startSyncScheduler();
  const status = getSchedulerStatus();
  return NextResponse.json(status);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  AuthorizationService.assertCanExecuteSync(user);

  const body = await req.json().catch(() => ({}));
  if (body.action === "start") {
    startSyncScheduler();
  } else if (body.action === "stop") {
    stopSyncScheduler();
  }

  return NextResponse.json(getSchedulerStatus());
}
