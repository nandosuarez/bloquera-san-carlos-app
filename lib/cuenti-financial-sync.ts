import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import {
  CuentiIntegrationError,
  getCuentiConfigStatus,
  getCuentiPaymentSyncDetail,
  getCuentiPaymentSyncPage,
  getCuentiPurchaseSyncDetail,
  type CuentiInvoiceSyncDetail,
  type CuentiInvoiceSyncItem,
  type CuentiPaymentSyncRecord
} from "@/lib/cuenti";
import { getDb } from "@/lib/db";

const SOURCE_SYSTEM = "CUENTI";
const PAYMENT_ENTITY = "PAYMENTS";
const PURCHASE_ENTITY = "PURCHASES";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 1;
const DEFAULT_OVERLAP_DAYS = 7;
const DEFAULT_SYNC_START_DATE = "2026-01-01";

type SyncWindow = {
  dateFrom: string;
  dateTo: string;
  mode: "INITIAL" | "INCREMENTAL" | "MANUAL";
  page: number;
};

type SyncStateRow = {
  active_date_from: string | null;
  active_date_to: string | null;
  backfill_complete: boolean;
  last_successful_to: string | null;
  next_page: number;
};

type LocalProductRow = {
  category: string;
  id: string;
  name: string;
  product_line_id: string | null;
  product_line_name: string | null;
  sale_price: string;
  sku: string | null;
  standard_cost: string;
  unit_name: string;
};

type SyncCounters = {
  details: number;
  pages: number;
  recordsCreated: number;
  recordsSkipped: number;
  recordsUpdated: number;
  sourceRows: number;
};

export type CuentiFinancialSyncStatus = {
  inventory: {
    latestSnapshotOn: string | null;
    productCount: number;
  };
  payments: {
    backfillComplete: boolean;
    count: number;
    lastRunAt: Date | null;
    lastRunError: string | null;
    lastRunStatus: string | null;
    nextPage: number;
  };
  purchases: {
    count: number;
    itemCount: number;
    lastRunAt: Date | null;
    lastRunError: string | null;
    lastRunStatus: string | null;
  };
};

export async function syncCuentiPaymentsWarehouse(input?: {
  dateFrom?: string | null;
  dateTo?: string | null;
  initiatedByUserId?: string | null;
  maxPages?: number;
}) {
  const config = getCuentiConfigStatus();

  if (!config.branchId) {
    throw new CuentiIntegrationError(
      "missing_cuenti_branch",
      "Falta configurar CUENTI_BRANCH_ID."
    );
  }

  const client = await getDb().connect();
  const lockKey = `analytics:${SOURCE_SYSTEM}:${PAYMENT_ENTITY}:${config.branchId}`;
  let hasLock = false;
  let runId: string | null = null;
  const counters: SyncCounters = {
    details: 0,
    pages: 0,
    recordsCreated: 0,
    recordsSkipped: 0,
    recordsUpdated: 0,
    sourceRows: 0
  };

  try {
    hasLock = await acquireLock(client, lockKey);

    if (!hasLock) {
      throw new CuentiIntegrationError(
        "cuenti_payment_sync_running",
        "Ya hay una sincronizacion de pagos en proceso."
      );
    }

    const window = await resolveSyncWindow(
      client,
      PAYMENT_ENTITY,
      config.branchId,
      input
    );
    runId = await createRun(client, {
      branchId: config.branchId,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      entityType: PAYMENT_ENTITY,
      initiatedByUserId: input?.initiatedByUserId ?? null,
      mode: window.mode
    });
    const pageSize = clampInteger(
      readPositiveInteger(process.env.CUENTI_ANALYTICS_PAGE_SIZE) ??
        DEFAULT_PAGE_SIZE,
      1,
      200
    );
    const maxPages = clampInteger(
      input?.maxPages ??
        readPositiveInteger(process.env.CUENTI_ANALYTICS_MAX_PAGES) ??
        DEFAULT_MAX_PAGES,
      1,
      10
    );
    let currentPage = window.page;
    let windowComplete = false;

    for (let offset = 0; offset < maxPages; offset += 1) {
      const pageResult = await getCuentiPaymentSyncPage({
        dateFrom: window.dateFrom,
        dateTo: window.dateTo,
        page: currentPage,
        pageSize
      });
      counters.pages += 1;
      counters.sourceRows += pageResult.rawItemsSeen;

      for (const summary of pageResult.records) {
        let payment = summary;

        try {
          const detail = await getCuentiPaymentSyncDetail(summary.externalId);
          payment = detail ? mergePayment(summary, detail) : summary;
        } catch (error) {
          console.warn("Could not load Cuenti payment detail", {
            externalId: summary.externalId,
            message: error instanceof Error ? error.message : "Unknown error"
          });
        }

        if (!payment.paymentDate || payment.amount === null) {
          counters.recordsSkipped += 1;
          continue;
        }

        await upsertSourceRecord(client, {
          branchId: config.branchId,
          documentNumber: payment.documentNumber,
          entityType: "PAYMENT",
          externalId: payment.externalId,
          payload: payment.rawPayload,
          runId,
          sourceDate: payment.paymentDate
        });
        const outcome = await upsertPayment(
          client,
          config.branchId,
          runId,
          payment
        );
        counters.details += 1;
        counters[outcome === "created" ? "recordsCreated" : "recordsUpdated"] += 1;
      }

      await updateRunCounters(client, runId, counters);
      const reachedKnownEnd =
        pageResult.totalPages !== null && currentPage >= pageResult.totalPages;
      const reachedInferredEnd =
        pageResult.totalPages === null &&
        pageResult.rawItemsSeen < pageResult.pageSize;

      if (
        pageResult.rawItemsSeen === 0 ||
        reachedKnownEnd ||
        reachedInferredEnd
      ) {
        windowComplete = true;
        break;
      }

      currentPage += 1;
    }

    const nextPage = windowComplete ? 1 : currentPage;
    const backfillComplete = await saveSyncState(client, {
      branchId: config.branchId,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      entityType: PAYMENT_ENTITY,
      nextPage,
      runId,
      windowComplete
    });
    await finishRun(client, runId, counters, windowComplete);

    return {
      ...counters,
      backfillComplete,
      branchId: config.branchId,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      nextPage,
      runId,
      windowComplete
    };
  } catch (error) {
    if (runId) {
      await failRun(client, runId, counters, error);
    }

    throw error;
  } finally {
    if (hasLock) {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey]);
    }

    client.release();
  }
}

export async function syncCuentiPurchasesByRefs(input: {
  initiatedByUserId?: string | null;
  refs: string[];
}) {
  const config = getCuentiConfigStatus();

  if (!config.branchId) {
    throw new CuentiIntegrationError(
      "missing_cuenti_branch",
      "Falta configurar CUENTI_BRANCH_ID."
    );
  }

  const refs = [...new Set(input.refs.map((ref) => ref.trim()).filter(Boolean))].slice(
    0,
    50
  );

  if (refs.length === 0) {
    throw new CuentiIntegrationError(
      "missing_cuenti_purchase_ref",
      "Escribe al menos un ID de compra de Cuenti."
    );
  }

  const client = await getDb().connect();
  const lockKey = `analytics:${SOURCE_SYSTEM}:${PURCHASE_ENTITY}:${config.branchId}`;
  let hasLock = false;
  let runId: string | null = null;
  const today = getBogotaDate();
  const counters: SyncCounters = {
    details: 0,
    pages: 1,
    recordsCreated: 0,
    recordsSkipped: 0,
    recordsUpdated: 0,
    sourceRows: refs.length
  };

  try {
    hasLock = await acquireLock(client, lockKey);

    if (!hasLock) {
      throw new CuentiIntegrationError(
        "cuenti_purchase_sync_running",
        "Ya hay una sincronizacion de compras en proceso."
      );
    }

    runId = await createRun(client, {
      branchId: config.branchId,
      dateFrom: today,
      dateTo: today,
      entityType: PURCHASE_ENTITY,
      initiatedByUserId: input.initiatedByUserId ?? null,
      mode: "MANUAL"
    });

    for (const ref of refs) {
      const detail = await getCuentiPurchaseSyncDetail(ref);

      if (!detail?.saleDate) {
        counters.recordsSkipped += 1;
        continue;
      }

      await upsertSourceRecord(client, {
        branchId: config.branchId,
        documentNumber: detail.documentNumber,
        entityType: "PURCHASE",
        externalId: ref,
        payload: detail.rawPayload,
        runId,
        sourceDate: detail.saleDate
      });
      const outcome = await upsertPurchase(
        client,
        config.branchId,
        runId,
        ref,
        detail
      );
      counters.details += detail.items.length;
      counters[outcome === "created" ? "recordsCreated" : "recordsUpdated"] += 1;
    }

    await finishRun(client, runId, counters, true);

    return {
      ...counters,
      branchId: config.branchId,
      runId
    };
  } catch (error) {
    if (runId) {
      await failRun(client, runId, counters, error);
    }

    throw error;
  } finally {
    if (hasLock) {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey]);
    }

    client.release();
  }
}

export async function getCuentiFinancialSyncStatus(): Promise<CuentiFinancialSyncStatus> {
  const config = getCuentiConfigStatus();

  if (!config.branchId) {
    return {
      inventory: { latestSnapshotOn: null, productCount: 0 },
      payments: {
        backfillComplete: false,
        count: 0,
        lastRunAt: null,
        lastRunError: null,
        lastRunStatus: null,
        nextPage: 1
      },
      purchases: {
        count: 0,
        itemCount: 0,
        lastRunAt: null,
        lastRunError: null,
        lastRunStatus: null
      }
    };
  }

  const result = await getDb().query<{
    inventory_count: string;
    latest_snapshot_on: string | null;
    payment_backfill_complete: boolean | null;
    payment_count: string;
    payment_error: string | null;
    payment_next_page: number | null;
    payment_run_at: Date | null;
    payment_status: string | null;
    purchase_count: string;
    purchase_error: string | null;
    purchase_item_count: string;
    purchase_run_at: Date | null;
    purchase_status: string | null;
  }>(
    `
      SELECT
        (SELECT COUNT(*) FROM analytics.fact_payment)::text AS payment_count,
        (SELECT COUNT(*) FROM analytics.fact_purchase)::text AS purchase_count,
        (SELECT COUNT(*) FROM analytics.fact_purchase_item)::text
          AS purchase_item_count,
        (
          SELECT MAX(snapshot_on)::text
          FROM analytics.fact_inventory_snapshot
        ) AS latest_snapshot_on,
        (
          SELECT COUNT(*)
          FROM analytics.fact_inventory_snapshot
          WHERE snapshot_on = (
            SELECT MAX(snapshot_on)
            FROM analytics.fact_inventory_snapshot
          )
        )::text AS inventory_count,
        payment_state.next_page AS payment_next_page,
        payment_state.backfill_complete AS payment_backfill_complete,
        payment_run.started_at AS payment_run_at,
        payment_run.status AS payment_status,
        payment_run.error_message AS payment_error,
        purchase_run.started_at AS purchase_run_at,
        purchase_run.status AS purchase_status,
        purchase_run.error_message AS purchase_error
      FROM (SELECT 1) AS singleton
      LEFT JOIN LATERAL (
        SELECT next_page, backfill_complete
        FROM integration.sync_state
        WHERE source_system = $1
          AND entity_type = $2
          AND branch_id = $4
        LIMIT 1
      ) AS payment_state ON TRUE
      LEFT JOIN LATERAL (
        SELECT started_at, status, error_message
        FROM integration.sync_run
        WHERE source_system = $1
          AND entity_type = $2
          AND branch_id = $4
        ORDER BY started_at DESC
        LIMIT 1
      ) AS payment_run ON TRUE
      LEFT JOIN LATERAL (
        SELECT started_at, status, error_message
        FROM integration.sync_run
        WHERE source_system = $1
          AND entity_type = $3
          AND branch_id = $4
        ORDER BY started_at DESC
        LIMIT 1
      ) AS purchase_run ON TRUE
    `,
    [SOURCE_SYSTEM, PAYMENT_ENTITY, PURCHASE_ENTITY, config.branchId]
  );
  const row = result.rows[0];

  return {
    inventory: {
      latestSnapshotOn: row?.latest_snapshot_on ?? null,
      productCount: Number(row?.inventory_count ?? 0)
    },
    payments: {
      backfillComplete: row?.payment_backfill_complete ?? false,
      count: Number(row?.payment_count ?? 0),
      lastRunAt: row?.payment_run_at ?? null,
      lastRunError: row?.payment_error ?? null,
      lastRunStatus: row?.payment_status ?? null,
      nextPage: Number(row?.payment_next_page ?? 1)
    },
    purchases: {
      count: Number(row?.purchase_count ?? 0),
      itemCount: Number(row?.purchase_item_count ?? 0),
      lastRunAt: row?.purchase_run_at ?? null,
      lastRunError: row?.purchase_error ?? null,
      lastRunStatus: row?.purchase_status ?? null
    }
  };
}

async function upsertPayment(
  client: PoolClient,
  branchId: string,
  runId: string,
  payment: CuentiPaymentSyncRecord
) {
  const existing = await client.query<{ id: string }>(
    `
      SELECT id
      FROM analytics.fact_payment
      WHERE source_system = $1
        AND branch_id = $2
        AND external_id = $3
    `,
    [SOURCE_SYSTEM, branchId, payment.externalId]
  );

  await client.query(
    `
      INSERT INTO analytics.fact_payment (
        source_system,
        branch_id,
        external_id,
        document_number,
        payment_on,
        payment_time,
        direction,
        status,
        payment_method,
        bank_name,
        counterparty_name,
        counterparty_external_id,
        related_document_type,
        related_document_id,
        related_document_number,
        amount,
        is_voided,
        source_updated_at,
        last_sync_run_id
      )
      VALUES (
        $1, $2, $3, $4, $5::date, $6::time, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18::timestamptz, $19
      )
      ON CONFLICT (source_system, branch_id, external_id)
      DO UPDATE SET
        document_number = EXCLUDED.document_number,
        payment_on = EXCLUDED.payment_on,
        payment_time = EXCLUDED.payment_time,
        direction = EXCLUDED.direction,
        status = EXCLUDED.status,
        payment_method = EXCLUDED.payment_method,
        bank_name = EXCLUDED.bank_name,
        counterparty_name = EXCLUDED.counterparty_name,
        counterparty_external_id = EXCLUDED.counterparty_external_id,
        related_document_type = EXCLUDED.related_document_type,
        related_document_id = EXCLUDED.related_document_id,
        related_document_number = EXCLUDED.related_document_number,
        amount = EXCLUDED.amount,
        is_voided = EXCLUDED.is_voided,
        source_updated_at = EXCLUDED.source_updated_at,
        last_synced_at = NOW(),
        last_sync_run_id = EXCLUDED.last_sync_run_id
    `,
    [
      SOURCE_SYSTEM,
      branchId,
      payment.externalId,
      payment.documentNumber,
      payment.paymentDate,
      payment.paymentTime,
      payment.direction,
      payment.status,
      payment.paymentMethod,
      payment.bankName,
      payment.counterpartyName,
      payment.counterpartyExternalId,
      payment.relatedDocumentType,
      payment.relatedDocumentId,
      payment.relatedDocumentNumber,
      payment.amount,
      payment.isVoided,
      payment.sourceUpdatedAt,
      runId
    ]
  );

  return existing.rowCount ? "updated" : "created";
}

async function upsertPurchase(
  client: PoolClient,
  branchId: string,
  runId: string,
  externalId: string,
  detail: CuentiInvoiceSyncDetail
) {
  const supplierId = await upsertSupplier(client, branchId, detail);
  const existing = await client.query<{ id: string }>(
    `
      SELECT id
      FROM analytics.fact_purchase
      WHERE source_system = $1
        AND branch_id = $2
        AND external_id = $3
    `,
    [SOURCE_SYSTEM, branchId, externalId]
  );
  const purchaseResult = await client.query<{ id: string }>(
    `
      INSERT INTO analytics.fact_purchase (
        source_system,
        branch_id,
        external_id,
        document_number,
        supplier_id,
        purchase_on,
        status,
        gross_amount,
        discount_amount,
        tax_amount,
        net_amount,
        paid_amount,
        balance_due,
        is_voided,
        source_updated_at,
        last_sync_run_id
      )
      VALUES (
        $1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12,
        $13, $14, $15::timestamptz, $16
      )
      ON CONFLICT (source_system, branch_id, external_id)
      DO UPDATE SET
        document_number = EXCLUDED.document_number,
        supplier_id = EXCLUDED.supplier_id,
        purchase_on = EXCLUDED.purchase_on,
        status = EXCLUDED.status,
        gross_amount = EXCLUDED.gross_amount,
        discount_amount = EXCLUDED.discount_amount,
        tax_amount = EXCLUDED.tax_amount,
        net_amount = EXCLUDED.net_amount,
        paid_amount = EXCLUDED.paid_amount,
        balance_due = EXCLUDED.balance_due,
        is_voided = EXCLUDED.is_voided,
        source_updated_at = EXCLUDED.source_updated_at,
        last_synced_at = NOW(),
        last_sync_run_id = EXCLUDED.last_sync_run_id
      RETURNING id
    `,
    [
      SOURCE_SYSTEM,
      branchId,
      externalId,
      detail.documentNumber,
      supplierId,
      detail.saleDate,
      detail.status,
      detail.grossAmount,
      detail.discountAmount,
      detail.taxAmount,
      detail.netAmount,
      detail.paidAmount,
      detail.balanceDue,
      detail.isVoided,
      detail.sourceUpdatedAt,
      runId
    ]
  );
  const purchaseId = purchaseResult.rows[0].id;
  const lineKeys: string[] = [];

  for (let index = 0; index < detail.items.length; index += 1) {
    const item = detail.items[index];
    const lineKey = buildLineKey(item, index);
    lineKeys.push(lineKey);
    const localProduct = await findLocalProduct(client, item);
    const productId = await upsertProductDimension(
      client,
      branchId,
      item,
      localProduct
    );

    await client.query(
      `
        INSERT INTO analytics.fact_purchase_item (
          purchase_id,
          line_key,
          external_line_id,
          line_number,
          product_id,
          local_product_id,
          product_external_id,
          product_sku,
          product_name,
          unit_name,
          quantity,
          unit_cost,
          gross_amount,
          discount_amount,
          tax_amount,
          net_amount,
          last_sync_run_id
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17
        )
        ON CONFLICT (purchase_id, line_key)
        DO UPDATE SET
          external_line_id = EXCLUDED.external_line_id,
          line_number = EXCLUDED.line_number,
          product_id = EXCLUDED.product_id,
          local_product_id = EXCLUDED.local_product_id,
          product_external_id = EXCLUDED.product_external_id,
          product_sku = EXCLUDED.product_sku,
          product_name = EXCLUDED.product_name,
          unit_name = EXCLUDED.unit_name,
          quantity = EXCLUDED.quantity,
          unit_cost = EXCLUDED.unit_cost,
          gross_amount = EXCLUDED.gross_amount,
          discount_amount = EXCLUDED.discount_amount,
          tax_amount = EXCLUDED.tax_amount,
          net_amount = EXCLUDED.net_amount,
          last_sync_run_id = EXCLUDED.last_sync_run_id,
          updated_at = NOW()
      `,
      [
        purchaseId,
        lineKey,
        item.externalLineId,
        item.lineNumber ?? index + 1,
        productId,
        localProduct?.id ?? null,
        item.cuentiProductId,
        item.sku,
        item.name,
        item.unitName,
        item.quantity,
        item.unitCost,
        item.grossAmount,
        item.discountAmount,
        item.taxAmount,
        item.netAmount,
        runId
      ]
    );
  }

  if (lineKeys.length > 0) {
    await client.query(
      `
        DELETE FROM analytics.fact_purchase_item
        WHERE purchase_id = $1
          AND NOT (line_key = ANY($2::varchar[]))
      `,
      [purchaseId, lineKeys]
    );
  }

  return existing.rowCount ? "updated" : "created";
}

async function upsertSupplier(
  client: PoolClient,
  branchId: string,
  detail: CuentiInvoiceSyncDetail
) {
  if (!detail.customerName && !detail.cuentiCustomerId) {
    return null;
  }

  const key =
    detail.cuentiCustomerId ??
    detail.customerIdentification ??
    normalizeKey(detail.customerName ?? "Proveedor");
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO analytics.dim_supplier (
        source_system,
        branch_id,
        supplier_key,
        external_id,
        identification,
        name,
        phone,
        address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (source_system, branch_id, supplier_key)
      DO UPDATE SET
        external_id = COALESCE(EXCLUDED.external_id, analytics.dim_supplier.external_id),
        identification = COALESCE(
          EXCLUDED.identification,
          analytics.dim_supplier.identification
        ),
        name = EXCLUDED.name,
        phone = COALESCE(EXCLUDED.phone, analytics.dim_supplier.phone),
        address = COALESCE(EXCLUDED.address, analytics.dim_supplier.address),
        last_seen_at = NOW(),
        updated_at = NOW()
      RETURNING id
    `,
    [
      SOURCE_SYSTEM,
      branchId,
      key,
      detail.cuentiCustomerId,
      detail.customerIdentification,
      detail.customerName ?? "Proveedor Cuenti",
      detail.customerPhone,
      detail.customerAddress
    ]
  );

  return result.rows[0].id;
}

async function findLocalProduct(
  client: PoolClient,
  item: CuentiInvoiceSyncItem
) {
  const result = await client.query<LocalProductRow>(
    `
      SELECT
        product.id,
        product.name,
        product.sku,
        product.category,
        product.unit_name,
        product.standard_cost,
        product.sale_price,
        product.product_line_id,
        product_line.name AS product_line_name
      FROM product
      LEFT JOIN product_line ON product_line.id = product.product_line_id
      WHERE product.is_active = TRUE
        AND (
          ($1::text IS NOT NULL AND product.cuenti_product_id = $1)
          OR ($2::text IS NOT NULL AND LOWER(product.sku) = LOWER($2))
          OR LOWER(product.name) = LOWER($3)
        )
      ORDER BY
        CASE
          WHEN $1::text IS NOT NULL AND product.cuenti_product_id = $1 THEN 1
          WHEN $2::text IS NOT NULL AND LOWER(product.sku) = LOWER($2) THEN 2
          ELSE 3
        END
      LIMIT 1
    `,
    [item.cuentiProductId, item.sku, item.name]
  );

  return result.rows[0] ?? null;
}

async function upsertProductDimension(
  client: PoolClient,
  branchId: string,
  item: CuentiInvoiceSyncItem,
  localProduct: LocalProductRow | null
) {
  const productKey =
    item.cuentiProductId ??
    item.sku ??
    localProduct?.id ??
    normalizeKey(item.name);
  const result = await client.query<{ id: string }>(
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
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      )
      ON CONFLICT (source_system, branch_id, product_key)
      DO UPDATE SET
        external_id = COALESCE(EXCLUDED.external_id, analytics.dim_product.external_id),
        local_product_id = COALESCE(
          EXCLUDED.local_product_id,
          analytics.dim_product.local_product_id
        ),
        sku = COALESCE(EXCLUDED.sku, analytics.dim_product.sku),
        name = EXCLUDED.name,
        unit_name = COALESCE(EXCLUDED.unit_name, analytics.dim_product.unit_name),
        category = COALESCE(EXCLUDED.category, analytics.dim_product.category),
        product_line_id = COALESCE(
          EXCLUDED.product_line_id,
          analytics.dim_product.product_line_id
        ),
        product_line_name = COALESCE(
          EXCLUDED.product_line_name,
          analytics.dim_product.product_line_name
        ),
        current_sale_price = COALESCE(
          EXCLUDED.current_sale_price,
          analytics.dim_product.current_sale_price
        ),
        current_standard_cost = COALESCE(
          EXCLUDED.current_standard_cost,
          analytics.dim_product.current_standard_cost
        ),
        last_seen_at = NOW(),
        updated_at = NOW()
      RETURNING id
    `,
    [
      SOURCE_SYSTEM,
      branchId,
      productKey,
      item.cuentiProductId,
      localProduct?.id ?? null,
      item.sku ?? localProduct?.sku ?? null,
      item.name,
      item.unitName ?? localProduct?.unit_name ?? null,
      localProduct?.category ?? null,
      localProduct?.product_line_id ?? null,
      localProduct?.product_line_name ?? null,
      localProduct ? Number(localProduct.sale_price) : null,
      localProduct ? Number(localProduct.standard_cost) : item.unitCost
    ]
  );

  return result.rows[0].id;
}

async function acquireLock(client: PoolClient, lockKey: string) {
  const result = await client.query<{ acquired: boolean }>(
    "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
    [lockKey]
  );

  return result.rows[0]?.acquired === true;
}

async function createRun(
  client: PoolClient,
  input: {
    branchId: string;
    dateFrom: string;
    dateTo: string;
    entityType: string;
    initiatedByUserId: string | null;
    mode: "INITIAL" | "INCREMENTAL" | "MANUAL";
  }
) {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO integration.sync_run (
        source_system,
        entity_type,
        branch_id,
        mode,
        date_from,
        date_to,
        initiated_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5::date, $6::date, $7)
      RETURNING id
    `,
    [
      SOURCE_SYSTEM,
      input.entityType,
      input.branchId,
      input.mode,
      input.dateFrom,
      input.dateTo,
      input.initiatedByUserId
    ]
  );

  return result.rows[0].id;
}

async function resolveSyncWindow(
  client: PoolClient,
  entityType: string,
  branchId: string,
  input?: { dateFrom?: string | null; dateTo?: string | null }
): Promise<SyncWindow> {
  const today = getBogotaDate();
  const manualFrom = normalizeIsoDate(input?.dateFrom);
  const manualTo = normalizeIsoDate(input?.dateTo);

  if (manualFrom || manualTo) {
    const dateFrom = manualFrom ?? manualTo ?? today;
    const dateTo = manualTo ?? manualFrom ?? today;

    if (dateTo < dateFrom) {
      throw new CuentiIntegrationError(
        "invalid_sync_dates",
        "La fecha final no puede ser anterior a la fecha inicial."
      );
    }

    return { dateFrom, dateTo, mode: "MANUAL", page: 1 };
  }

  const stateResult = await client.query<SyncStateRow>(
    `
      SELECT
        active_date_from,
        active_date_to,
        backfill_complete,
        last_successful_to,
        next_page
      FROM integration.sync_state
      WHERE source_system = $1
        AND entity_type = $2
        AND branch_id = $3
    `,
    [SOURCE_SYSTEM, entityType, branchId]
  );
  const state = stateResult.rows[0];

  if (state?.active_date_from && state.active_date_to) {
    return {
      dateFrom: state.active_date_from,
      dateTo: state.active_date_to,
      mode: state.backfill_complete ? "INCREMENTAL" : "INITIAL",
      page: Math.max(1, Number(state.next_page))
    };
  }

  if (state?.backfill_complete) {
    const overlapDays =
      readPositiveInteger(process.env.CUENTI_ANALYTICS_OVERLAP_DAYS) ??
      DEFAULT_OVERLAP_DAYS;

    return {
      dateFrom: addDays(today, -overlapDays),
      dateTo: today,
      mode: "INCREMENTAL",
      page: 1
    };
  }

  const configuredStart =
    normalizeIsoDate(process.env.CUENTI_ANALYTICS_START_DATE) ??
    DEFAULT_SYNC_START_DATE;
  const dateFrom = state?.last_successful_to
    ? addDays(state.last_successful_to, 1)
    : configuredStart;

  return {
    dateFrom: minIsoDate(dateFrom, today),
    dateTo: minIsoDate(endOfMonth(dateFrom), today),
    mode: "INITIAL",
    page: 1
  };
}

async function saveSyncState(
  client: PoolClient,
  input: {
    branchId: string;
    dateFrom: string;
    dateTo: string;
    entityType: string;
    nextPage: number;
    runId: string;
    windowComplete: boolean;
  }
) {
  const today = getBogotaDate();
  const backfillComplete = input.windowComplete && input.dateTo >= today;

  await client.query(
    `
      INSERT INTO integration.sync_state (
        source_system,
        entity_type,
        branch_id,
        last_successful_from,
        last_successful_to,
        last_successful_at,
        last_run_id,
        active_date_from,
        active_date_to,
        next_page,
        backfill_complete,
        updated_at
      )
      VALUES (
        $1, $2, $3,
        CASE WHEN $8 THEN $4::date ELSE NULL END,
        CASE WHEN $8 THEN $5::date ELSE NULL END,
        CASE WHEN $8 THEN NOW() ELSE NULL END,
        $7,
        CASE WHEN $8 THEN NULL ELSE $4::date END,
        CASE WHEN $8 THEN NULL ELSE $5::date END,
        $6,
        $9,
        NOW()
      )
      ON CONFLICT (source_system, entity_type, branch_id)
      DO UPDATE SET
        last_successful_from = CASE
          WHEN $8 THEN $4::date
          ELSE integration.sync_state.last_successful_from
        END,
        last_successful_to = CASE
          WHEN $8 THEN $5::date
          ELSE integration.sync_state.last_successful_to
        END,
        last_successful_at = CASE
          WHEN $8 THEN NOW()
          ELSE integration.sync_state.last_successful_at
        END,
        last_run_id = $7,
        active_date_from = CASE WHEN $8 THEN NULL ELSE $4::date END,
        active_date_to = CASE WHEN $8 THEN NULL ELSE $5::date END,
        next_page = $6,
        backfill_complete = integration.sync_state.backfill_complete OR $9,
        updated_at = NOW()
    `,
    [
      SOURCE_SYSTEM,
      input.entityType,
      input.branchId,
      input.dateFrom,
      input.dateTo,
      input.nextPage,
      input.runId,
      input.windowComplete,
      backfillComplete
    ]
  );

  return backfillComplete;
}

async function upsertSourceRecord(
  client: PoolClient,
  input: {
    branchId: string;
    documentNumber: string | null;
    entityType: string;
    externalId: string;
    payload: unknown;
    runId: string;
    sourceDate: string | null;
  }
) {
  const payload = JSON.stringify(input.payload ?? null);
  const payloadHash = createHash("sha256").update(payload).digest("hex");

  await client.query(
    `
      INSERT INTO integration.source_record (
        source_system,
        entity_type,
        branch_id,
        external_id,
        document_number,
        source_date,
        payload,
        payload_hash,
        last_sync_run_id
      )
      VALUES ($1, $2, $3, $4, $5, $6::date, $7::jsonb, $8, $9)
      ON CONFLICT (source_system, entity_type, branch_id, external_id)
      DO UPDATE SET
        document_number = EXCLUDED.document_number,
        source_date = EXCLUDED.source_date,
        payload = EXCLUDED.payload,
        last_seen_at = NOW(),
        last_changed_at = CASE
          WHEN integration.source_record.payload_hash <> EXCLUDED.payload_hash
            THEN NOW()
          ELSE integration.source_record.last_changed_at
        END,
        payload_hash = EXCLUDED.payload_hash,
        last_sync_run_id = EXCLUDED.last_sync_run_id
    `,
    [
      SOURCE_SYSTEM,
      input.entityType,
      input.branchId,
      input.externalId,
      input.documentNumber,
      input.sourceDate,
      payload,
      payloadHash,
      input.runId
    ]
  );
}

async function updateRunCounters(
  client: PoolClient,
  runId: string,
  counters: SyncCounters
) {
  await client.query(
    `
      UPDATE integration.sync_run
      SET
        pages_processed = $2,
        source_rows = $3,
        records_created = $4,
        records_updated = $5,
        records_skipped = $6,
        detail_rows = $7
      WHERE id = $1
    `,
    [
      runId,
      counters.pages,
      counters.sourceRows,
      counters.recordsCreated,
      counters.recordsUpdated,
      counters.recordsSkipped,
      counters.details
    ]
  );
}

async function finishRun(
  client: PoolClient,
  runId: string,
  counters: SyncCounters,
  windowComplete: boolean
) {
  await client.query(
    `
      UPDATE integration.sync_run
      SET
        status = 'SUCCESS',
        pages_processed = $2,
        source_rows = $3,
        records_created = $4,
        records_updated = $5,
        records_skipped = $6,
        detail_rows = $7,
        window_complete = $8,
        finished_at = NOW()
      WHERE id = $1
    `,
    [
      runId,
      counters.pages,
      counters.sourceRows,
      counters.recordsCreated,
      counters.recordsUpdated,
      counters.recordsSkipped,
      counters.details,
      windowComplete
    ]
  );
}

async function failRun(
  client: PoolClient,
  runId: string,
  counters: SyncCounters,
  error: unknown
) {
  await client.query(
    `
      UPDATE integration.sync_run
      SET
        status = 'FAILED',
        pages_processed = $2,
        source_rows = $3,
        records_created = $4,
        records_updated = $5,
        records_skipped = $6,
        detail_rows = $7,
        error_message = $8,
        finished_at = NOW()
      WHERE id = $1
    `,
    [
      runId,
      counters.pages,
      counters.sourceRows,
      counters.recordsCreated,
      counters.recordsUpdated,
      counters.recordsSkipped,
      counters.details,
      error instanceof Error ? error.message.slice(0, 2000) : "Error desconocido"
    ]
  );
}

function mergePayment(
  summary: CuentiPaymentSyncRecord,
  detail: CuentiPaymentSyncRecord
): CuentiPaymentSyncRecord {
  return {
    amount: detail.amount ?? summary.amount,
    bankName: detail.bankName ?? summary.bankName,
    counterpartyExternalId:
      detail.counterpartyExternalId ?? summary.counterpartyExternalId,
    counterpartyName: detail.counterpartyName ?? summary.counterpartyName,
    direction:
      detail.direction === "UNKNOWN" ? summary.direction : detail.direction,
    documentNumber: detail.documentNumber ?? summary.documentNumber,
    externalId: summary.externalId,
    isVoided: detail.isVoided || summary.isVoided,
    paymentDate: detail.paymentDate ?? summary.paymentDate,
    paymentMethod: detail.paymentMethod ?? summary.paymentMethod,
    paymentTime: detail.paymentTime ?? summary.paymentTime,
    rawPayload: detail.rawPayload,
    relatedDocumentId: detail.relatedDocumentId ?? summary.relatedDocumentId,
    relatedDocumentNumber:
      detail.relatedDocumentNumber ?? summary.relatedDocumentNumber,
    relatedDocumentType:
      detail.relatedDocumentType ?? summary.relatedDocumentType,
    sourceUpdatedAt: detail.sourceUpdatedAt ?? summary.sourceUpdatedAt,
    status: detail.status ?? summary.status
  };
}

function buildLineKey(item: CuentiInvoiceSyncItem, index: number) {
  return (
    item.externalLineId ??
    `${item.cuentiProductId ?? item.sku ?? normalizeKey(item.name)}:${index + 1}`
  ).slice(0, 200);
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);
}

function getBogotaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function normalizeIsoDate(value?: string | null) {
  const normalized = value?.trim();

  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? normalized
    : null;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function endOfMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function minIsoDate(left: string, right: string) {
  return left < right ? left : right;
}

function readPositiveInteger(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
