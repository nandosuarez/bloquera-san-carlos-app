import {
  CuentiIntegrationError,
  getCuentiProductStock
} from "@/lib/cuenti";
import { getDb } from "@/lib/db";
import type { PoolClient } from "pg";

type CuentiStockProductRow = {
  category: string;
  cuenti_product_id: string | null;
  cuenti_stock_qty: string | null;
  cuenti_stock_synced_at: Date | null;
  id: string;
  name: string;
  product_line_id: string | null;
  product_line_name: string | null;
  sale_price: string;
  sku: string | null;
  standard_cost: string;
  unit_name: string;
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

  const productsResult = await getDb().query<CuentiStockProductRow>(
    `
      SELECT
        product.id,
        product.name,
        product.sku,
        product.cuenti_product_id,
        product.cuenti_stock_qty,
        product.cuenti_stock_synced_at,
        product.category,
        product.unit_name,
        product.standard_cost,
        product.sale_price,
        product.product_line_id,
        product_line.name AS product_line_name
      FROM product
      LEFT JOIN product_line ON product_line.id = product.product_line_id
      WHERE product.is_active = TRUE
        AND product.cuenti_product_id IS NOT NULL
        AND BTRIM(product.cuenti_product_id) <> ''
      ORDER BY product.name
    `
  );
  const branchCandidates = new Set<string>();
  let branchId: string | null = null;
  let checked = 0;
  let failed = 0;
  let skipped = 0;
  let updated = 0;

  for (const product of productsResult.rows) {
    const ref = product.cuenti_product_id;

    if (!ref) {
      skipped += 1;
      continue;
    }

    try {
      const stockResult = await getCuentiProductStock(ref);
      checked += 1;

      for (const candidate of stockResult.branchCandidates) {
        branchCandidates.add(candidate);
      }

      if (stockResult.branchId) {
        branchId = stockResult.branchId;
      }

      if (stockResult.stockQty === null) {
        skipped += 1;
        continue;
      }

      await getDb().query(
        `
          UPDATE product
          SET
            cuenti_stock_qty = $2,
            cuenti_stock_synced_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
        `,
        [product.id, normalizeStock(stockResult.stockQty)]
      );
      updated += 1;
    } catch (error) {
      if (error instanceof CuentiIntegrationError) {
        throw error;
      }

      console.warn("Could not sync Cuenti stock for product", {
        message: error instanceof Error ? error.message : "Unknown Cuenti error",
        productId: product.id
      });
      failed += 1;
    }
  }
  const snapshotCount = branchId
    ? await saveCuentiInventorySnapshot(branchId)
    : 0;

  return {
    branchCandidates: [...branchCandidates],
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
    const products = await client.query<CuentiStockProductRow>(
      `
        SELECT
          product.id,
          product.name,
          product.sku,
          product.cuenti_product_id,
          product.cuenti_stock_qty,
          product.cuenti_stock_synced_at,
          product.category,
          product.unit_name,
          product.standard_cost,
          product.sale_price,
          product.product_line_id,
          product_line.name AS product_line_name
        FROM product
        LEFT JOIN product_line ON product_line.id = product.product_line_id
        WHERE product.is_active = TRUE
          AND product.cuenti_product_id IS NOT NULL
          AND BTRIM(product.cuenti_product_id) <> ''
          AND product.cuenti_stock_qty IS NOT NULL
      `
    );

    for (const product of products.rows) {
      const dimensionResult = await client.query<{ id: string }>(
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
          VALUES (
            'CUENTI', $1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
          )
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
          RETURNING id
        `,
        [
          branchId,
          product.cuenti_product_id,
          product.id,
          product.sku,
          product.name,
          product.unit_name,
          product.category,
          product.product_line_id,
          product.product_line_name,
          Number(product.sale_price),
          Number(product.standard_cost)
        ]
      );
      const productDimensionId = dimensionResult.rows[0].id;
      const quantity = Number(product.cuenti_stock_qty);
      const unitCost = Number(product.standard_cost);

      await client.query(
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
          VALUES (
            'CUENTI', $1, $2::date, $3, $4, $5, $6, $5 * $6, $7, $8
          )
          ON CONFLICT (source_system, branch_id, snapshot_on, product_id)
          DO UPDATE SET
            local_product_id = EXCLUDED.local_product_id,
            quantity = EXCLUDED.quantity,
            unit_cost = EXCLUDED.unit_cost,
            inventory_value = EXCLUDED.inventory_value,
            source_synced_at = EXCLUDED.source_synced_at,
            last_sync_run_id = EXCLUDED.last_sync_run_id,
            updated_at = NOW()
        `,
        [
          branchId,
          snapshotOn,
          productDimensionId,
          product.id,
          quantity,
          unitCost,
          product.cuenti_stock_synced_at,
          runId
        ]
      );
    }

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
      [runId, products.rows.length]
    );
    await client.query("COMMIT");

    return products.rows.length;
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

function getBogotaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}
