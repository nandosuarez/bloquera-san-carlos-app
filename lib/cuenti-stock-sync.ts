import {
  CuentiIntegrationError,
  getCuentiProductStock
} from "@/lib/cuenti";
import { getDb } from "@/lib/db";
import type { PoolClient } from "pg";

type CuentiStockProductRow = {
  cuenti_product_id: string | null;
  id: string;
};

export type CuentiStockSyncResult = {
  branchCandidates: string[];
  branchId: string | null;
  checked: number;
  failed: number;
  skipped: number;
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
        id,
        cuenti_product_id
      FROM product
      WHERE is_active = TRUE
        AND cuenti_product_id IS NOT NULL
        AND BTRIM(cuenti_product_id) <> ''
      ORDER BY name
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

  return {
    branchCandidates: [...branchCandidates],
    branchId,
    checked,
    failed,
    skipped,
    updated
  };
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
