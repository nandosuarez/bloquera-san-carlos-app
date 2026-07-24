import { syncCuentiSalesWarehouse } from "@/lib/cuenti-analytics-sync";
import { syncCuentiPaymentsWarehouse } from "@/lib/cuenti-financial-sync";
import { syncCuentiProductStocks } from "@/lib/cuenti-stock-sync";
import { getDb } from "@/lib/db";

export type CuentiWarehouseSyncStage = "inventory" | "payments" | "sales";

export class CuentiWarehouseSyncError extends Error {
  readonly originalError: unknown;
  readonly stage: CuentiWarehouseSyncStage;

  constructor(stage: CuentiWarehouseSyncStage, originalError: unknown) {
    super(`Cuenti warehouse synchronization failed during ${stage}.`);
    this.name = "CuentiWarehouseSyncError";
    this.originalError = originalError;
    this.stage = stage;
  }
}

export async function syncCuentiWarehouse(input?: {
  includeInventory?: boolean;
  initiatedByUserId?: string | null;
  maxCyclesPerStage?: number;
}) {
  const maxCycles = clampCycles(input?.maxCyclesPerStage);
  const sales = await runWarehouseStage("sales", () =>
    runIncrementalCycles(
      () =>
        syncCuentiSalesWarehouse({
          initiatedByUserId: input?.initiatedByUserId ?? null
        }),
      maxCycles
    )
  );
  const payments = await runWarehouseStage("payments", () =>
    runIncrementalCycles(
      () =>
        syncCuentiPaymentsWarehouse({
          initiatedByUserId: input?.initiatedByUserId ?? null
        }),
      maxCycles
    )
  );
  const needsInventory =
    input?.includeInventory === true || (await shouldCaptureInventoryToday());
  const inventory = needsInventory
    ? await runWarehouseStage("inventory", syncCuentiProductStocks)
    : null;

  return { inventory, payments, sales };
}

type IncrementalSyncResult = {
  backfillComplete: boolean;
  details: number;
  pages: number;
  recordsCreated: number;
  recordsSkipped: number;
  recordsUpdated: number;
  sourceRows: number;
};

async function runIncrementalCycles<T extends IncrementalSyncResult>(
  operation: () => Promise<T>,
  maxCycles: number
): Promise<T> {
  let latest: T | null = null;
  const totals = {
    details: 0,
    pages: 0,
    recordsCreated: 0,
    recordsSkipped: 0,
    recordsUpdated: 0,
    sourceRows: 0
  };

  for (let cycle = 0; cycle < maxCycles; cycle += 1) {
    latest = await operation();
    totals.details += latest.details;
    totals.pages += latest.pages;
    totals.recordsCreated += latest.recordsCreated;
    totals.recordsSkipped += latest.recordsSkipped;
    totals.recordsUpdated += latest.recordsUpdated;
    totals.sourceRows += latest.sourceRows;

    if (latest.backfillComplete) {
      break;
    }
  }

  if (!latest) {
    throw new Error("Cuenti incremental synchronization did not run.");
  }

  return {
    ...latest,
    ...totals
  };
}

async function runWarehouseStage<T>(
  stage: CuentiWarehouseSyncStage,
  operation: () => Promise<T>
) {
  try {
    return await operation();
  } catch (error) {
    throw new CuentiWarehouseSyncError(stage, error);
  }
}

function clampCycles(value?: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(12, Math.max(1, Math.trunc(value ?? 1)));
}

async function shouldCaptureInventoryToday() {
  const result = await getDb().query<{ is_current: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM analytics.fact_inventory_snapshot
        WHERE snapshot_on = (
          NOW() AT TIME ZONE 'America/Bogota'
        )::date
      ) AS is_current
    `
  );

  return result.rows[0]?.is_current !== true;
}
