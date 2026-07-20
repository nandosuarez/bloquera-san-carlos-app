import { Pool } from "pg";

const applyChanges = process.argv.includes("--apply");

const resetQueries = [
  {
    label: "Cuentas de cobro de mano de obra",
    countSql: "SELECT COUNT(*)::int AS count FROM production_labor_charge",
    deleteSql: "DELETE FROM production_labor_charge"
  },
  {
    label: "Movimientos de inventario de bloques e insumos",
    countSql: `
      SELECT COUNT(*)::int AS count
      FROM inventory_movement AS movement
      LEFT JOIN product
        ON product.id = movement.product_id
      WHERE product.category IN ('RAW_MATERIAL', 'BLOCK')
        OR movement.block_production_batch_id IS NOT NULL
    `,
    deleteSql: `
      DELETE FROM inventory_movement AS movement
      USING product
      WHERE product.id = movement.product_id
        AND (
          product.category IN ('RAW_MATERIAL', 'BLOCK')
          OR movement.block_production_batch_id IS NOT NULL
        )
    `
  },
  {
    label: "Lotes de produccion de bloques",
    countSql: "SELECT COUNT(*)::int AS count FROM block_production_batch",
    deleteSql: "DELETE FROM block_production_batch"
  }
];

const stockResetQuery = {
  label: "Productos tipo bloque o insumo con stock diferente de cero",
  countSql: `
    SELECT COUNT(*)::int AS count
    FROM product
    WHERE category IN ('RAW_MATERIAL', 'BLOCK')
      AND current_stock_qty <> 0
  `,
  updateSql: `
    UPDATE product
    SET current_stock_qty = 0
    WHERE category IN ('RAW_MATERIAL', 'BLOCK')
  `
};

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.POSTGRES_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const summary = [];

    for (const query of resetQueries) {
      const countResult = await client.query(query.countSql);
      const count = Number(countResult.rows[0]?.count ?? 0);
      summary.push({ count, label: query.label });

      if (applyChanges) {
        await client.query(query.deleteSql);
      }
    }

    const stockCountResult = await client.query(stockResetQuery.countSql);
    const stockCount = Number(stockCountResult.rows[0]?.count ?? 0);
    summary.push({ count: stockCount, label: stockResetQuery.label });

    if (applyChanges) {
      await client.query(stockResetQuery.updateSql);
      await client.query("COMMIT");
    } else {
      await client.query("ROLLBACK");
    }

    console.log(applyChanges ? "Reset aplicado." : "Simulacion sin cambios.");

    for (const item of summary) {
      console.log(`${item.label}: ${item.count}`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
