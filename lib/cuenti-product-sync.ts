import { getAllCuentiProducts, type CuentiProduct } from "@/lib/cuenti";
import { getDb } from "@/lib/db";
import type { PoolClient } from "pg";

export type CuentiProductSyncResult = {
  branchCandidates: string[];
  branchId: string | null;
  created: number;
  rawRows: number;
  skipped: number;
  totalRows: number;
  updated: number;
};

export async function syncProductsFromCuenti(): Promise<CuentiProductSyncResult> {
  const productList = await getAllCuentiProducts();
  const cuentiProducts = productList.products;
  const client = await getDb().connect();
  let created = 0;
  let skipped = 0;
  let updated = 0;

  try {
    await client.query("BEGIN");
    await ensureCuentiProductColumns(client);

    for (const product of cuentiProducts) {
      if (!product.name) {
        skipped += 1;
        continue;
      }

      const existingByCuentiId = product.cuentiProductId
        ? await client.query<{ id: string }>(
            `
              SELECT id
              FROM product
              WHERE cuenti_product_id = $1
              LIMIT 1
            `,
            [product.cuentiProductId]
          )
        : null;

      if (existingByCuentiId?.rows[0]?.id) {
        await updateProduct(client, existingByCuentiId.rows[0].id, product);
        updated += 1;
        continue;
      }

      const existingBySku = product.sku
        ? await client.query<{ id: string }>(
            `
              SELECT id
              FROM product
              WHERE LOWER(sku) = LOWER($1)
              LIMIT 1
            `,
            [product.sku]
          )
        : null;

      if (existingBySku?.rows[0]?.id) {
        await updateProduct(client, existingBySku.rows[0].id, product);
        updated += 1;
        continue;
      }

      const result = await client.query<{ inserted: boolean }>(
        `
          INSERT INTO product (
            name,
            sku,
            cuenti_product_id,
            category,
            raw_material_type,
            unit_name,
            weight_kg,
            track_inventory,
            current_stock_qty,
            min_stock_qty,
            standard_cost,
            sale_price,
            notes,
            is_active
          )
          VALUES ($1, $2, $3, 'GENERAL', NULL, $4, $5, FALSE, 0, 0, 0, $6, $7, TRUE)
          ON CONFLICT ((LOWER(name)))
          DO UPDATE SET
            cuenti_product_id = COALESCE(EXCLUDED.cuenti_product_id, product.cuenti_product_id),
            sku = COALESCE(EXCLUDED.sku, product.sku),
            unit_name = COALESCE(EXCLUDED.unit_name, product.unit_name),
            weight_kg = CASE
              WHEN EXCLUDED.weight_kg > 0 THEN EXCLUDED.weight_kg
              ELSE product.weight_kg
            END,
            sale_price = CASE
              WHEN EXCLUDED.sale_price > 0 THEN EXCLUDED.sale_price
              ELSE product.sale_price
            END,
            notes = COALESCE(product.notes, EXCLUDED.notes),
            is_active = TRUE,
            updated_at = NOW()
          RETURNING (xmax = 0) AS inserted
        `,
        [
          product.name,
          normalizeOptionalText(product.sku),
          normalizeOptionalText(product.cuentiProductId),
          normalizeUnitName(product.unitName),
          normalizePositiveNumber(product.weightKg),
          normalizeMoney(product.salePrice),
          buildProductNotes(product)
        ]
      );

      if (result.rows[0]?.inserted) {
        created += 1;
      } else {
        updated += 1;
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    branchCandidates: productList.branchCandidates,
    branchId: productList.branchId,
    created,
    rawRows: productList.rawItemsSeen,
    skipped,
    totalRows: cuentiProducts.length,
    updated
  };
}

async function ensureCuentiProductColumns(client: PoolClient) {
  await client.query(`
    ALTER TABLE product
    ADD COLUMN IF NOT EXISTS cuenti_product_id VARCHAR(80) NULL
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS product_cuenti_product_id_unique
      ON product (cuenti_product_id)
      WHERE cuenti_product_id IS NOT NULL AND BTRIM(cuenti_product_id) <> ''
  `);
}

async function updateProduct(
  client: PoolClient,
  productId: string,
  product: CuentiProduct
) {
  await client.query(
    `
      UPDATE product
      SET
        name = CASE
          WHEN product.category = 'GENERAL'
            AND NOT EXISTS (
              SELECT 1
              FROM product AS other_product
              WHERE LOWER(other_product.name) = LOWER($2)
                AND other_product.id <> $1::uuid
            )
          THEN $2
          ELSE product.name
        END,
        cuenti_product_id = COALESCE($3, cuenti_product_id),
        sku = COALESCE($4, sku),
        unit_name = COALESCE($5, unit_name),
        weight_kg = CASE
          WHEN $6 > 0 THEN $6
          ELSE weight_kg
        END,
        sale_price = CASE
          WHEN $7 > 0 THEN $7
          ELSE sale_price
        END,
        notes = COALESCE(notes, $8),
        is_active = TRUE,
        updated_at = NOW()
      WHERE id = $1
    `,
    [
      productId,
      product.name,
      normalizeOptionalText(product.cuentiProductId),
      normalizeOptionalText(product.sku),
      normalizeUnitName(product.unitName),
      normalizePositiveNumber(product.weightKg),
      normalizeMoney(product.salePrice),
      buildProductNotes(product)
    ]
  );
}

function buildProductNotes(product: CuentiProduct) {
  const parts = [
    product.barcode ? `Codigo barras Cuenti: ${product.barcode}` : null,
    product.notes
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : null;
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeUnitName(value?: string | null) {
  return normalizeOptionalText(value) ?? "unidades";
}

function normalizePositiveNumber(value?: number | null) {
  if (!Number.isFinite(value ?? Number.NaN) || (value ?? 0) <= 0) {
    return 0;
  }

  return Math.round((value ?? 0) * 1000) / 1000;
}

function normalizeMoney(value?: number | null) {
  if (!Number.isFinite(value ?? Number.NaN) || (value ?? 0) <= 0) {
    return 0;
  }

  return Math.round((value ?? 0) * 100) / 100;
}
