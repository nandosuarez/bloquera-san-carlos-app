import { getAllCuentiProducts } from "@/lib/cuenti";
import { getDb } from "@/lib/db";
import type { PoolClient } from "pg";

type CuentiStockTargetRow = {
  cuenti_product_id: string | null;
  id: string;
  sku: string | null;
};

export type CuentiStockSyncResult = {
  branchCandidates: string[];
  branchId: string | null;
  checked: number;
  failed: number;
  skipped: number;
  snapshotCount: number;
  updated: number;
};

export async function syncCuentiProductStocks(): Promise<CuentiStockSyncResult> {
  const client = await getDb().connect();

  try {
    await ensureCuentiStockColumns(client);
  } finally {
    client.release();
  }

  const [productList, productsResult] = await Promise.all([
    getAllCuentiProducts(),
    getDb().query<CuentiStockTargetRow>(
      `
        SELECT id, sku, cuenti_product_id
        FROM product
        WHERE is_active = TRUE
      `
    )
  ]);
  const productsByCuentiId = new Map(
    productsResult.rows
      .filter((product) => product.cuenti_product_id)
      .map((product) => [product.cuenti_product_id as string, product])
  );
  const productsBySku = new Map(
    productsResult.rows
      .filter((product) => product.sku)
      .map((product) => [normalizeKey(product.sku as string), product])
  );
  const updateClient = await getDb().connect();
  let checked = 0;
  let failed = 0;
  let skipped = 0;
  let updated = 0;

  try {
    for (const product of productList.products) {
      checked += 1;

      if (product.stockQty === null) {
        skipped += 1;
        continue;
      }

      const target =
        (product.cuentiProductId
          ? productsByCuentiId.get(product.cuentiProductId)
          : null) ??
        (product.sku ? productsBySku.get(normalizeKey(product.sku)) : null);

      if (!target) {
        skipped += 1;
        continue;
      }

      try {
        await updateClient.query(
          `
            UPDATE product
            SET
              cuenti_stock_qty = $2,
              cuenti_stock_synced_at = NOW(),
              updated_at = NOW()
            WHERE id = $1
          `,
          [target.id, normalizeStock(product.stockQty)]
        );
        updated += 1;
      } catch (error) {
        console.warn("Could not update local Cuenti stock", {
          message: error instanceof Error ? error.message : "Unknown error",
          productId: target.id
        });
        failed += 1;
      }
    }
  } finally {
    updateClient.release();
  }
  const branchId = productList.branchId;
  const snapshotCount = branchId
    ? await saveCuentiInventorySnapshot(branchId)
    : 0;

  return {
    branchCandidates: productList.branchCandidates,
    branchId,
    checked,
    failed,
    skipped,
    snapshotCount,
    updated
  };
}

export async function saveCuentiInventorySnapshot(branchId: string) {
  const client = await getDb().connect();
  const snapshotOn = getBogotaDate();

  try {
    await client.query("BEGIN");
    const runResult = await client.query<{ id: string }>(
      `
        INSERT INTO integration.sync_run (
          source_system,
          entity_type,
          branch_id,
          mode,
          date_from,
          date_to
        )
        VALUES ('CUENTI', 'INVENTORY', $1, 'INCREMENTAL', $2::date, $2::date)
        RETURNING id
      `,
      [branchId, snapshotOn]
    );
    const runId = runResult.rows[0].id;
    await client.query(
      `
        INSERT INTO analytics.dim_product (
          source_system,
          branch_id,
          product_key,
          external_id,
          local_product_id,
          sku,
          name,
          unit_name,
          category,
          product_line_id,
          product_line_name,
          current_sale_price,
          current_standard_cost
        )
        SELECT
          'CUENTI',
          $1,
          product.cuenti_product_id,
          product.cuenti_product_id,
          product.id,
          product.sku,
          product.name,
          product.unit_name,
          product.category,
          product.product_line_id,
          product_line.name,
          product.sale_price,
          product.standard_cost
        FROM product
        LEFT JOIN product_line
          ON product_line.id = product.product_line_id
        WHERE product.is_active = TRUE
          AND product.cuenti_product_id IS NOT NULL
          AND BTRIM(product.cuenti_product_id) <> ''
          AND product.cuenti_stock_qty IS NOT NULL
        ON CONFLICT (source_system, branch_id, product_key)
        DO UPDATE SET
          local_product_id = EXCLUDED.local_product_id,
          sku = COALESCE(EXCLUDED.sku, analytics.dim_product.sku),
          name = EXCLUDED.name,
          unit_name = EXCLUDED.unit_name,
          category = EXCLUDED.category,
          product_line_id = EXCLUDED.product_line_id,
          product_line_name = EXCLUDED.product_line_name,
          current_sale_price = EXCLUDED.current_sale_price,
          current_standard_cost = EXCLUDED.current_standard_cost,
          last_seen_at = NOW(),
          updated_at = NOW()
      `,
      [branchId]
    );
    const snapshotResult = await client.query(
      `
        INSERT INTO analytics.fact_inventory_snapshot (
          source_system,
          branch_id,
          snapshot_on,
          product_id,
          local_product_id,
          quantity,
          unit_cost,
          inventory_value,
          source_synced_at,
          last_sync_run_id
        )
        SELECT
          'CUENTI',
          $1,
          $2::date,
          dimension.id,
          product.id,
          product.cuenti_stock_qty,
          product.standard_cost,
          product.cuenti_stock_qty * product.standard_cost,
          product.cuenti_stock_synced_at,
          $3
        FROM product
        INNER JOIN analytics.dim_product AS dimension
          ON dimension.source_system = 'CUENTI'
          AND dimension.branch_id = $1
          AND dimension.product_key = product.cuenti_product_id
        WHERE product.is_active = TRUE
          AND product.cuenti_product_id IS NOT NULL
          AND BTRIM(product.cuenti_product_id) <> ''
          AND product.cuenti_stock_qty IS NOT NULL
        ON CONFLICT (source_system, branch_id, snapshot_on, product_id)
        DO UPDATE SET
          local_product_id = EXCLUDED.local_product_id,
          quantity = EXCLUDED.quantity,
          unit_cost = EXCLUDED.unit_cost,
          inventory_value = EXCLUDED.inventory_value,
          source_synced_at = EXCLUDED.source_synced_at,
          last_sync_run_id = EXCLUDED.last_sync_run_id,
          updated_at = NOW()
        RETURNING id
      `,
      [branchId, snapshotOn, runId]
    );
    const snapshotCount = snapshotResult.rowCount ?? 0;

    await client.query(
      `
        UPDATE integration.sync_run
        SET
          status = 'SUCCESS',
          pages_processed = 1,
          source_rows = $2,
          records_updated = $2,
          detail_rows = $2,
          window_complete = TRUE,
          finished_at = NOW()
        WHERE id = $1
      `,
      [runId, snapshotCount]
    );
    await client.query("COMMIT");

    return snapshotCount;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureCuentiStockColumns(client: PoolClient) {
  await client.query(`
    ALTER TABLE product
    ADD COLUMN IF NOT EXISTS cuenti_stock_qty NUMERIC(14, 2) NULL
  `);
  await client.query(`
    ALTER TABLE product
    ADD COLUMN IF NOT EXISTS cuenti_stock_synced_at TIMESTAMPTZ NULL
  `);
}

function normalizeStock(value: number) {
  return Math.round(Math.max(value, 0) * 100) / 100;
}

function normalizeKey(value: string) {
  return value.trim().toLocaleLowerCase("es-CO");
}

function getBogotaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}
