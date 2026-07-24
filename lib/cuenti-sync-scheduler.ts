import { syncCuentiWarehouse } from "@/lib/cuenti-sync-coordinator";

type SchedulerGlobal = typeof globalThis & {
  __cuentiSyncScheduler?: {
    running: boolean;
    timer: NodeJS.Timeout;
  };
};

export function ensureCuentiSyncScheduler() {
  if (process.env.CUENTI_AUTO_SYNC_ENABLED !== "true") {
    return;
  }

  const schedulerGlobal = globalThis as SchedulerGlobal;

  if (schedulerGlobal.__cuentiSyncScheduler) {
    return;
  }

  const intervalMinutes = clamp(
    Number(process.env.CUENTI_AUTO_SYNC_INTERVAL_MINUTES ?? 60),
    15,
    1440
  );
  const scheduler = {
    running: false,
    timer: setInterval(() => {
      void runScheduledSync(scheduler);
    }, intervalMinutes * 60_000)
  };
  scheduler.timer.unref();
  schedulerGlobal.__cuentiSyncScheduler = scheduler;

  const initialTimer = setTimeout(() => {
    void runScheduledSync(scheduler);
  }, 45_000);
  initialTimer.unref();
}

async function runScheduledSync(scheduler: { running: boolean }) {
  if (scheduler.running) {
    return;
  }

  scheduler.running = true;

  try {
    const result = await syncCuentiWarehouse();
    console.info("Automatic Cuenti sync completed", {
      inventory: result.inventory?.snapshotCount ?? 0,
      payments:
        result.payments.recordsCreated + result.payments.recordsUpdated,
      sales: result.sales.recordsCreated + result.sales.recordsUpdated
    });
  } catch (error) {
    console.error("Automatic Cuenti sync failed", error);
  } finally {
    scheduler.running = false;
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
