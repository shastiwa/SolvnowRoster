export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSyncScheduler } = await import("@/server/scheduler/syncScheduler");
    startSyncScheduler();
  }
}
