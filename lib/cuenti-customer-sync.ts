import { getDb } from "@/lib/db";
import { getAllCuentiCustomers, type CuentiCustomer } from "@/lib/cuenti";
import type { PoolClient } from "pg";

export type CuentiCustomerSyncResult = {
  created: number;
  skipped: number;
  totalRows: number;
  updated: number;
};

export async function syncCustomersFromCuenti(): Promise<CuentiCustomerSyncResult> {
  const cuentiCustomers = await getAllCuentiCustomers();
  const client = await getDb().connect();
  let created = 0;
  let skipped = 0;
  let updated = 0;

  try {
    await client.query("BEGIN");
    await ensureCuentiCustomerColumns(client);

    for (const customer of cuentiCustomers) {
      if (!customer.name) {
        skipped += 1;
        continue;
      }

      const existingByCuentiId = customer.cuentiCustomerId
        ? await client.query<{ id: string }>(
            `
              SELECT id
              FROM customer
              WHERE cuenti_customer_id = $1
              LIMIT 1
            `,
            [customer.cuentiCustomerId]
          )
        : null;

      if (existingByCuentiId?.rows[0]?.id) {
        await updateCustomer(client, existingByCuentiId.rows[0].id, customer);
        updated += 1;
        continue;
      }

      const existingByIdentification = customer.identification
        ? await client.query<{ id: string }>(
            `
              SELECT id
              FROM customer
              WHERE identification = $1
              LIMIT 1
            `,
            [customer.identification]
          )
        : null;

      if (existingByIdentification?.rows[0]?.id) {
        await updateCustomer(client, existingByIdentification.rows[0].id, customer);
        updated += 1;
        continue;
      }

      const result = await client.query<{ inserted: boolean }>(
        `
          INSERT INTO customer (
            name,
            cuenti_customer_id,
            identification,
            phone,
            address,
            notes,
            is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, TRUE)
          ON CONFLICT ((LOWER(name)))
          DO UPDATE SET
            cuenti_customer_id = COALESCE(EXCLUDED.cuenti_customer_id, customer.cuenti_customer_id),
            identification = COALESCE(EXCLUDED.identification, customer.identification),
            phone = COALESCE(EXCLUDED.phone, customer.phone),
            address = COALESCE(EXCLUDED.address, customer.address),
            notes = COALESCE(customer.notes, EXCLUDED.notes),
            is_active = TRUE,
            updated_at = NOW()
          RETURNING (xmax = 0) AS inserted
        `,
        [
          customer.name,
          customer.cuentiCustomerId,
          customer.identification,
          customer.phone,
          customer.address,
          buildCustomerNotes(customer)
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
    created,
    skipped,
    totalRows: cuentiCustomers.length,
    updated
  };
}

async function ensureCuentiCustomerColumns(client: PoolClient) {
  await client.query(`
    ALTER TABLE customer
    ADD COLUMN IF NOT EXISTS cuenti_customer_id VARCHAR(80) NULL
  `);
  await client.query(`
    ALTER TABLE customer
    ADD COLUMN IF NOT EXISTS identification VARCHAR(80) NULL
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS customer_cuenti_customer_id_unique
      ON customer (cuenti_customer_id)
      WHERE cuenti_customer_id IS NOT NULL AND BTRIM(cuenti_customer_id) <> ''
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS customer_identification_idx
      ON customer (identification)
      WHERE identification IS NOT NULL AND BTRIM(identification) <> ''
  `);
}

async function updateCustomer(
  client: PoolClient,
  customerId: string,
  customer: CuentiCustomer
) {
  await client.query(
    `
      UPDATE customer
      SET
        name = CASE
          WHEN NOT EXISTS (
            SELECT 1
            FROM customer AS other_customer
            WHERE LOWER(other_customer.name) = LOWER($2)
              AND other_customer.id <> $1::uuid
          )
          THEN $2
          ELSE customer.name
        END,
        cuenti_customer_id = COALESCE($3, cuenti_customer_id),
        identification = COALESCE($4, identification),
        phone = COALESCE($5, phone),
        address = COALESCE($6, address),
        notes = COALESCE(notes, $7),
        is_active = TRUE,
        updated_at = NOW()
      WHERE id = $1
    `,
    [
      customerId,
      customer.name,
      customer.cuentiCustomerId,
      customer.identification,
      customer.phone,
      customer.address,
      buildCustomerNotes(customer)
    ]
  );
}

function buildCustomerNotes(customer: CuentiCustomer) {
  const parts = [
    customer.email ? `Email Cuenti: ${customer.email}` : null,
    customer.notes
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : null;
}
