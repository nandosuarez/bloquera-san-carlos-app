import { Pool } from "pg";

const applyChanges = process.argv.includes("--apply");

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

    const previewResult = await client.query(`
      WITH latest_cost AS (
        SELECT DISTINCT ON (block_product_id)
          block_product_id,
          unit_cost
        FROM block_production_batch
        ORDER BY block_product_id, production_on DESC, created_at DESC
      )
      SELECT
        product.name,
        product.standard_cost::text AS previous_cost,
        latest_cost.unit_cost::text AS recalculated_cost
      FROM product
      INNER JOIN latest_cost
        ON latest_cost.block_product_id = product.id
      WHERE product.category = 'BLOCK'
      ORDER BY product.name
    `);

    if (applyChanges) {
      await client.query(`
        WITH latest_cost AS (
          SELECT DISTINCT ON (block_product_id)
            block_product_id,
            unit_cost
          FROM block_production_batch
          ORDER BY block_product_id, production_on DESC, created_at DESC
        )
        UPDATE product
        SET
          standard_cost = latest_cost.unit_cost,
          updated_at = NOW()
        FROM latest_cost
        WHERE product.id = latest_cost.block_product_id
          AND product.category = 'BLOCK'
      `);

      await client.query("COMMIT");
      console.log("Costos de bloques actualizados.");
    } else {
      await client.query("ROLLBACK");
      console.log("Simulacion sin cambios.");
    }

    if (previewResult.rows.length === 0) {
      console.log("No hay producciones registradas para recalcular costos.");
      return;
    }

    console.table(previewResult.rows);
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
