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
}) {
  const sales = await runWarehouseStage("sales", () =>
    syncCuentiSalesWarehouse({
      initiatedByUserId: input?.initiatedByUserId ?? null
    })
  );
  const payments = await runWarehouseStage("payments", () =>
    syncCuentiPaymentsWarehouse({
      initiatedByUserId: input?.initiatedByUserId ?? null
    })
  );
  const needsInventory =
    input?.includeInventory === true || (await shouldCaptureInventoryToday());
  const inventory = needsInventory
    ? await runWarehouseStage("inventory", syncCuentiProductStocks)
    : null;

  return { inventory, payments, sales };
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
