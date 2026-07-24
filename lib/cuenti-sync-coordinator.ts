import { syncCuentiSalesWarehouse } from "@/lib/cuenti-analytics-sync";
import { syncCuentiPaymentsWarehouse } from "@/lib/cuenti-financial-sync";
import { syncCuentiProductStocks } from "@/lib/cuenti-stock-sync";
import { getDb } from "@/lib/db";

export async function syncCuentiWarehouse(input?: {
  includeInventory?: boolean;
  initiatedByUserId?: string | null;
}) {
  const sales = await syncCuentiSalesWarehouse({
    initiatedByUserId: input?.initiatedByUserId ?? null
  });
  const payments = await syncCuentiPaymentsWarehouse({
    initiatedByUserId: input?.initiatedByUserId ?? null
  });
  const needsInventory =
    input?.includeInventory === true || (await shouldCaptureInventoryToday());
  const inventory = needsInventory ? await syncCuentiProductStocks() : null;

  return { inventory, payments, sales };
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
