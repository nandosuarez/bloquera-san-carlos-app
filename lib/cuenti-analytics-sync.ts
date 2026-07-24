import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import {
  CuentiIntegrationError,
  getCuentiConfigStatus,
  getCuentiInvoiceSyncDetail,
  getCuentiInvoiceSyncPage,
  getCuentiResolvedBranchId,
  type CuentiInvoiceSyncDetail,
  type CuentiInvoiceSyncItem,
  type CuentiInvoiceSyncRecord
} from "@/lib/cuenti";
import { getDb } from "@/lib/db";

const SOURCE_SYSTEM = "CUENTI";
const ENTITY_TYPE = "SALES";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 1;
const DEFAULT_OVERLAP_DAYS = 7;
const DEFAULT_SYNC_START_DATE = "2026-01-01";

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

type NormalizedSaleItem = {
  costAmount: number | null;
  costStatus: "SOURCE" | "PRODUCT" | "PRODUCTION" | "MISSING";
  discountAmount: number | null;
  externalLineId: string | null;
  grossAmount: number | null;
  grossProfit: number | null;
  lineKey: string;
  lineNumber: number;
  localProductId: string | null;
  marginPercent: number | null;
  netAmount: number | null;
  productDimensionId: string;
  productExternalId: string | null;
  productName: string;
  productSku: string | null;
  quantity: number;
  taxAmount: number | null;
  unitCost: number | null;
  unitName: string | null;
  unitPrice: number | null;
};

type SyncWindow = {
  backfillComplete: boolean;
  dateFrom: string;
  dateTo: string;
  mode: "INITIAL" | "INCREMENTAL" | "MANUAL";
  page: number;
};

type SyncRunCounters = {
  details: number;
  pages: number;
  recordsCreated: number;
  recordsSkipped: number;
  recordsUpdated: number;
  sourceRows: number;
};

export type CuentiSalesSyncResult = SyncRunCounters & {
  backfillComplete: boolean;
  branchId: string;
  dateFrom: string;
  dateTo: string;
  nextPage: number;
  runId: string;
  windowComplete: boolean;
};

export type CuentiAnalyticsSyncStatus = {
  activeDateFrom: string | null;
  activeDateTo: string | null;
  backfillComplete: boolean;
  invoiceCount: number;
  itemCount: number;
  lastRun: {
    dateFrom: string;
    dateTo: string;
    errorMessage: string | null;
    finishedAt: Date | null;
    recordsCreated: number;
    recordsUpdated: number;
    sourceRows: number;
    startedAt: Date;
    status: string;
    windowComplete: boolean;
  } | null;
  linesWithoutCost: number;
  nextPage: number;
};

export async function syncCuentiSalesWarehouse(input?: {
  dateFrom?: string | null;
  dateTo?: string | null;
  initiatedByUserId?: string | null;
  maxPages?: number;
}): Promise<CuentiSalesSyncResult> {
  const config = getCuentiConfigStatus();

  if (!config.branchId) {
    throw new CuentiIntegrationError(
      "missing_cuenti_branch",
      "Falta configurar CUENTI_BRANCH_ID."
    );
  }

  const branchId = config.hasToken
    ? await getCuentiResolvedBranchId()
    : config.branchId;
  const client = await getDb().connect();
  const lockKey = `analytics:${SOURCE_SYSTEM}:${ENTITY_TYPE}:${branchId}`;
  let hasLock = false;
  let runId: string | null = null;
  let window: SyncWindow | null = null;
  const counters: SyncRunCounters = {
    details: 0,
    pages: 0,
    recordsCreated: 0,
    recordsSkipped: 0,
    recordsUpdated: 0,
    sourceRows: 0
  };

  try {
    const lockResult = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
      [lockKey]
    );
    hasLock = lockResult.rows[0]?.acquired === true;

    if (!hasLock) {
      throw new CuentiIntegrationError(
        "cuenti_sync_running",
        "Ya hay una sincronizacion de ventas en proceso."
      );
    }

    window = await resolveSyncWindow(client, branchId, input);
    const runResult = await client.query<{ id: string }>(
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
        ENTITY_TYPE,
        branchId,
        window.mode,
        window.dateFrom,
        window.dateTo,
        input?.initiatedByUserId ?? null
      ]
    );
    runId = runResult.rows[0].id;

    const maxPages = clampInteger(
      input?.maxPages ??
        readPositiveInteger(process.env.CUENTI_ANALYTICS_MAX_PAGES) ??
        DEFAULT_MAX_PAGES,
      1,
      10
    );
    const pageSize = clampInteger(
      readPositiveInteger(process.env.CUENTI_ANALYTICS_PAGE_SIZE) ??
        DEFAULT_PAGE_SIZE,
      1,
      100
    );
    let currentPage = window.page;
    let windowComplete = false;

    for (let pageOffset = 0; pageOffset < maxPages; pageOffset += 1) {
      const pageResult = await getCuentiInvoiceSyncPage({
        branchId,
        dateFrom: window.dateFrom,
        dateTo: window.dateTo,
        page: currentPage,
        pageSize
      });
      counters.pages += 1;
      counters.sourceRows += pageResult.rawItemsSeen;

      for (const record of pageResult.records) {
        await upsertSourceRecord(client, {
          branchId,
          documentNumber: record.summary.documentNumber,
          entityType: "INVOICE_SUMMARY",
          externalId: record.summary.cuentiSaleId,
          payload: record.rawPayload,
          runId,
          sourceDate: record.summary.saleDate
        });
      }

      const details = await loadInvoiceDetails(
        pageResult.records,
        pageResult.branchId
      );
      const detailErrors = details.filter(
        (result): result is { error: unknown; record: CuentiInvoiceSyncRecord } =>
          "error" in result
      );

      for (const result of details) {
        if ("error" in result) {
          continue;
        }

        if (!result.detail?.saleDate) {
          counters.recordsSkipped += 1;
          continue;
        }

        const outcome = await upsertInvoice(
          client,
          branchId,
          runId,
          result.detail
        );
        counters.details += result.detail.items.length;

        if (outcome === "created") {
          counters.recordsCreated += 1;
        } else {
          counters.recordsUpdated += 1;
        }
      }

      await updateRunningCounters(client, runId, counters);

      if (detailErrors.length > 0) {
        const firstError = detailErrors[0].error;
        throw new Error(
          `No fue posible consultar ${detailErrors.length} detalles de factura. ${
            firstError instanceof Error ? firstError.message : ""
          }`.trim()
        );
      }

      const reachedKnownEnd =
        pageResult.totalPages !== null &&
        currentPage >= pageResult.totalPages;
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
    const state = await saveSuccessfulState(client, {
      branchId,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      nextPage,
      runId,
      windowComplete
    });

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

    return {
      ...counters,
      backfillComplete: state.backfillComplete,
      branchId,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      nextPage,
      runId,
      windowComplete
    };
  } catch (error) {
    if (runId) {
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

    throw error;
  } finally {
    if (hasLock) {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey]);
    }

    client.release();
  }
}

export async function getCuentiAnalyticsSyncStatus(): Promise<CuentiAnalyticsSyncStatus> {
  const config = getCuentiConfigStatus();

  if (!config.branchId) {
    return {
      activeDateFrom: null,
      activeDateTo: null,
      backfillComplete: false,
      invoiceCount: 0,
      itemCount: 0,
      lastRun: null,
      linesWithoutCost: 0,
      nextPage: 1
    };
  }

  const branchId = config.hasToken
    ? await getCuentiResolvedBranchId()
    : config.branchId;
  const [stateResult, runResult, countResult] = await Promise.all([
    getDb().query<SyncStateRow>(
      `
        SELECT
          active_date_from::text AS active_date_from,
          active_date_to::text AS active_date_to,
          backfill_complete,
          last_successful_to::text AS last_successful_to,
          next_page
        FROM integration.sync_state
        WHERE source_system = $1
          AND entity_type = $2
          AND branch_id = $3
      `,
      [SOURCE_SYSTEM, ENTITY_TYPE, branchId]
    ),
    getDb().query<{
      date_from: string;
      date_to: string;
      error_message: string | null;
      finished_at: Date | null;
      records_created: number;
      records_updated: number;
      source_rows: number;
      started_at: Date;
      status: string;
      window_complete: boolean;
    }>(
      `
        SELECT
          date_from::text AS date_from,
          date_to::text AS date_to,
          error_message,
          finished_at,
          records_created,
          records_updated,
          source_rows,
          started_at,
          status,
          window_complete
        FROM integration.sync_run
        WHERE source_system = $1
          AND entity_type = $2
          AND branch_id = $3
        ORDER BY started_at DESC
        LIMIT 1
      `,
      [SOURCE_SYSTEM, ENTITY_TYPE, branchId]
    ),
    getDb().query<{
      invoice_count: string;
      item_count: string;
      lines_without_cost: string;
    }>(
      `
        SELECT
          (SELECT COUNT(*) FROM analytics.fact_sale)::text AS invoice_count,
          (SELECT COUNT(*) FROM analytics.fact_sale_item)::text AS item_count,
          (
            SELECT COUNT(*)
            FROM analytics.fact_sale_item
            WHERE cost_status = 'MISSING'
          )::text AS lines_without_cost
      `
    )
  ]);
  const state = stateResult.rows[0];
  const run = runResult.rows[0];
  const counts = countResult.rows[0];

  return {
    activeDateFrom: state?.active_date_from ?? null,
    activeDateTo: state?.active_date_to ?? null,
    backfillComplete: state?.backfill_complete ?? false,
    invoiceCount: Number(counts?.invoice_count ?? 0),
    itemCount: Number(counts?.item_count ?? 0),
    lastRun: run
      ? {
          dateFrom: run.date_from,
          dateTo: run.date_to,
          errorMessage: run.error_message,
          finishedAt: run.finished_at,
          recordsCreated: Number(run.records_created),
          recordsUpdated: Number(run.records_updated),
          sourceRows: Number(run.source_rows),
          startedAt: run.started_at,
          status: run.status,
          windowComplete: run.window_complete
        }
      : null,
    linesWithoutCost: Number(counts?.lines_without_cost ?? 0),
    nextPage: Number(state?.next_page ?? 1)
  };
}

async function resolveSyncWindow(
  client: PoolClient,
  branchId: string,
  input?: {
    dateFrom?: string | null;
    dateTo?: string | null;
  }
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

    return {
      backfillComplete: false,
      dateFrom,
      dateTo,
      mode: "MANUAL",
      page: 1
    };
  }

  const stateResult = await client.query<SyncStateRow>(
    `
      SELECT
        active_date_from::text AS active_date_from,
        active_date_to::text AS active_date_to,
        backfill_complete,
        last_successful_to::text AS last_successful_to,
        next_page
      FROM integration.sync_state
      WHERE source_system = $1
        AND entity_type = $2
        AND branch_id = $3
    `,
    [SOURCE_SYSTEM, ENTITY_TYPE, branchId]
  );
  const state = stateResult.rows[0];

  if (state?.active_date_from && state.active_date_to) {
    return {
      backfillComplete: state.backfill_complete,
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
      backfillComplete: true,
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
  const dateTo = minIsoDate(endOfMonth(dateFrom), today);

  return {
    backfillComplete: false,
    dateFrom: minIsoDate(dateFrom, today),
    dateTo,
    mode: "INITIAL",
    page: 1
  };
}

async function loadInvoiceDetails(
  records: CuentiInvoiceSyncRecord[],
  branchId: string
) {
  const concurrency = clampInteger(
    readPositiveInteger(process.env.CUENTI_ANALYTICS_CONCURRENCY) ?? 5,
    1,
    12
  );
  const results: Array<
    | { detail: CuentiInvoiceSyncDetail | null; record: CuentiInvoiceSyncRecord }
    | { error: unknown; record: CuentiInvoiceSyncRecord }
  > = [];

  for (let index = 0; index < records.length; index += concurrency) {
    const batch = records.slice(index, index + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (record) => {
        try {
          return {
            detail: await getCuentiInvoiceSyncDetail(
              record.summary.cuentiSaleId,
              branchId
            ),
            record
          };
        } catch (error) {
          return { error, record };
        }
      })
    );
    results.push(...batchResults);
  }

  return results;
}

async function upsertInvoice(
  client: PoolClient,
  branchId: string,
  runId: string,
  detail: CuentiInvoiceSyncDetail
) {
  await client.query("BEGIN");

  try {
    await upsertSourceRecord(client, {
      branchId,
      documentNumber: detail.documentNumber,
      entityType: "INVOICE_DETAIL",
      externalId: detail.cuentiSaleId,
      payload: detail.rawPayload,
      runId,
      sourceDate: detail.saleDate
    });
    const customerDimensionId = await upsertCustomerDimension(
      client,
      branchId,
      detail
    );
    const normalizedItems: NormalizedSaleItem[] = [];

    for (let index = 0; index < detail.items.length; index += 1) {
      normalizedItems.push(
        await normalizeSaleItem(
          client,
          branchId,
          detail.cuentiSaleId,
          index,
          detail.items[index]
        )
      );
    }

    const existingResult = await client.query<{ id: string }>(
      `
        SELECT id
        FROM analytics.fact_sale
        WHERE source_system = $1
          AND branch_id = $2
          AND external_id = $3
        FOR UPDATE
      `,
      [SOURCE_SYSTEM, branchId, detail.cuentiSaleId]
    );
    const existed = (existingResult.rowCount ?? 0) > 0;
    const completeCost =
      normalizedItems.length > 0 &&
      normalizedItems.every((item) => item.costAmount !== null);
    const netAmount =
      detail.netAmount ??
      sumCompleteAmounts(normalizedItems.map((item) => item.netAmount));
    const costAmount =
      detail.costAmount ??
      sumCompleteAmounts(normalizedItems.map((item) => item.costAmount));
    const grossAmount =
      detail.grossAmount ??
      sumCompleteAmounts(normalizedItems.map((item) => item.grossAmount));
    const taxAmount =
      detail.taxAmount ??
      sumCompleteAmounts(normalizedItems.map((item) => item.taxAmount));
    const grossProfit =
      detail.grossProfit ?? subtractAmounts(netAmount, costAmount);
    const saleResult = await client.query<{ id: string }>(
      `
        INSERT INTO analytics.fact_sale (
          source_system,
          branch_id,
          external_id,
          document_number,
          customer_id,
          sale_on,
          sale_time,
          status,
          payment_status,
          payment_method,
          gross_amount,
          discount_amount,
          return_amount,
          tax_amount,
          net_amount,
          cost_amount,
          gross_profit,
          paid_amount,
          balance_due,
          is_voided,
          has_complete_cost,
          source_updated_at,
          last_sync_run_id
        )
        VALUES (
          $1, $2, $3, $4, $5, $6::date, $7::time, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
          $22::timestamptz, $23
        )
        ON CONFLICT (source_system, branch_id, external_id)
        DO UPDATE SET
          document_number = EXCLUDED.document_number,
          customer_id = EXCLUDED.customer_id,
          sale_on = EXCLUDED.sale_on,
          sale_time = EXCLUDED.sale_time,
          status = EXCLUDED.status,
          payment_status = EXCLUDED.payment_status,
          payment_method = EXCLUDED.payment_method,
          gross_amount = EXCLUDED.gross_amount,
          discount_amount = EXCLUDED.discount_amount,
          return_amount = EXCLUDED.return_amount,
          tax_amount = EXCLUDED.tax_amount,
          net_amount = EXCLUDED.net_amount,
          cost_amount = EXCLUDED.cost_amount,
          gross_profit = EXCLUDED.gross_profit,
          paid_amount = EXCLUDED.paid_amount,
          balance_due = EXCLUDED.balance_due,
          is_voided = EXCLUDED.is_voided,
          has_complete_cost = EXCLUDED.has_complete_cost,
          source_updated_at = EXCLUDED.source_updated_at,
          last_synced_at = NOW(),
          last_sync_run_id = EXCLUDED.last_sync_run_id
        RETURNING id
      `,
      [
        SOURCE_SYSTEM,
        branchId,
        detail.cuentiSaleId,
        detail.documentNumber,
        customerDimensionId,
        detail.saleDate,
        detail.saleTime,
        detail.status,
        detail.paymentStatus,
        detail.paymentMethod,
        grossAmount,
        detail.discountAmount,
        detail.returnAmount,
        taxAmount,
        netAmount,
        costAmount,
        grossProfit,
        detail.paidAmount,
        detail.balanceDue,
        detail.isVoided,
        completeCost,
        detail.sourceUpdatedAt,
        runId
      ]
    );
    const saleId = saleResult.rows[0].id;

    for (const item of normalizedItems) {
      await client.query(
        `
          INSERT INTO analytics.fact_sale_item (
            sale_id,
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
            unit_price,
            gross_amount,
            discount_amount,
            tax_amount,
            net_amount,
            unit_cost,
            cost_amount,
            gross_profit,
            margin_percent,
            cost_status,
            last_sync_run_id
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
          )
          ON CONFLICT (sale_id, line_key)
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
            unit_price = EXCLUDED.unit_price,
            gross_amount = EXCLUDED.gross_amount,
            discount_amount = EXCLUDED.discount_amount,
            tax_amount = EXCLUDED.tax_amount,
            net_amount = EXCLUDED.net_amount,
            unit_cost = EXCLUDED.unit_cost,
            cost_amount = EXCLUDED.cost_amount,
            gross_profit = EXCLUDED.gross_profit,
            margin_percent = EXCLUDED.margin_percent,
            cost_status = EXCLUDED.cost_status,
            last_sync_run_id = EXCLUDED.last_sync_run_id,
            updated_at = NOW()
        `,
        [
          saleId,
          item.lineKey,
          item.externalLineId,
          item.lineNumber,
          item.productDimensionId,
          item.localProductId,
          item.productExternalId,
          item.productSku,
          item.productName,
          item.unitName,
          item.quantity,
          item.unitPrice,
          item.grossAmount,
          item.discountAmount,
          item.taxAmount,
          item.netAmount,
          item.unitCost,
          item.costAmount,
          item.grossProfit,
          item.marginPercent,
          item.costStatus,
          runId
        ]
      );
    }

    if (normalizedItems.length === 0) {
      await client.query(
        "DELETE FROM analytics.fact_sale_item WHERE sale_id = $1",
        [saleId]
      );
    } else {
      await client.query(
        `
          DELETE FROM analytics.fact_sale_item
          WHERE sale_id = $1
            AND NOT (line_key = ANY($2::varchar[]))
        `,
        [saleId, normalizedItems.map((item) => item.lineKey)]
      );
    }

    await client.query("COMMIT");
    return existed ? "updated" : "created";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function upsertCustomerDimension(
  client: PoolClient,
  branchId: string,
  detail: CuentiInvoiceSyncDetail
) {
  const name = detail.customerName?.trim();

  if (!name) {
    return null;
  }

  const localResult = await client.query<{ id: string }>(
    `
      SELECT id
      FROM public.customer
      WHERE
        ($1::text IS NOT NULL AND cuenti_customer_id = $1)
        OR ($2::text IS NOT NULL AND identification = $2)
        OR LOWER(name) = LOWER($3)
      ORDER BY
        CASE
          WHEN $1::text IS NOT NULL AND cuenti_customer_id = $1 THEN 1
          WHEN $2::text IS NOT NULL AND identification = $2 THEN 2
          ELSE 3
        END
      LIMIT 1
    `,
    [detail.cuentiCustomerId, detail.customerIdentification, name]
  );
  const customerKey = buildDimensionKey(
    detail.cuentiCustomerId
      ? `id:${detail.cuentiCustomerId}`
      : detail.customerIdentification
        ? `identification:${detail.customerIdentification}`
        : `name:${name}`
  );
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO analytics.dim_customer (
        source_system,
        branch_id,
        customer_key,
        external_id,
        local_customer_id,
        identification,
        name,
        phone,
        address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (source_system, branch_id, customer_key)
      DO UPDATE SET
        external_id = COALESCE(EXCLUDED.external_id, analytics.dim_customer.external_id),
        local_customer_id = COALESCE(
          EXCLUDED.local_customer_id,
          analytics.dim_customer.local_customer_id
        ),
        identification = COALESCE(
          EXCLUDED.identification,
          analytics.dim_customer.identification
        ),
        name = EXCLUDED.name,
        phone = COALESCE(EXCLUDED.phone, analytics.dim_customer.phone),
        address = COALESCE(EXCLUDED.address, analytics.dim_customer.address),
        last_seen_at = NOW(),
        updated_at = NOW()
      RETURNING id
    `,
    [
      SOURCE_SYSTEM,
      branchId,
      customerKey,
      detail.cuentiCustomerId,
      localResult.rows[0]?.id ?? null,
      detail.customerIdentification,
      name,
      detail.customerPhone,
      detail.customerAddress
    ]
  );

  return result.rows[0].id;
}

async function normalizeSaleItem(
  client: PoolClient,
  branchId: string,
  saleExternalId: string,
  index: number,
  item: CuentiInvoiceSyncItem
): Promise<NormalizedSaleItem> {
  const localProduct = await findLocalProduct(client, item);
  const productKey = buildDimensionKey(
    item.cuentiProductId
      ? `id:${item.cuentiProductId}`
      : item.sku
        ? `sku:${item.sku}`
        : `name:${item.name}`
  );
  const productResult = await client.query<{ id: string }>(
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
      localProduct ? Number(localProduct.standard_cost) : null
    ]
  );
  const hasSourceCost = item.costAmount !== null || item.unitCost !== null;
  const fallbackUnitCost = localProduct
    ? Number(localProduct.standard_cost)
    : 0;
  const costStatus: NormalizedSaleItem["costStatus"] = hasSourceCost
    ? "SOURCE"
    : fallbackUnitCost > 0
      ? localProduct?.category === "BLOCK"
        ? "PRODUCTION"
        : "PRODUCT"
      : "MISSING";
  const unitCost =
    item.unitCost ?? (fallbackUnitCost > 0 ? fallbackUnitCost : null);
  const costAmount =
    item.costAmount ??
    (unitCost !== null ? unitCost * item.quantity : null);
  const netAmount =
    item.netAmount ??
    (item.unitPrice !== null ? item.unitPrice * item.quantity : null);
  const taxAmount =
    item.taxAmount ??
    subtractAmounts(item.totalAmount, netAmount);
  const grossProfit = subtractAmounts(netAmount, costAmount);
  const marginPercent =
    netAmount !== null && netAmount !== 0 && grossProfit !== null
      ? grossProfit / netAmount
      : null;
  const lineIdentity =
    item.externalLineId ??
    `${saleExternalId}:${index + 1}:${item.cuentiProductId ?? item.sku ?? item.name}`;

  return {
    costAmount,
    costStatus,
    discountAmount: item.discountAmount,
    externalLineId: item.externalLineId,
    grossAmount: item.totalAmount ?? netAmount,
    grossProfit,
    lineKey: createHash("sha256").update(lineIdentity).digest("hex"),
    lineNumber: item.lineNumber ?? index + 1,
    localProductId: localProduct?.id ?? null,
    marginPercent,
    netAmount,
    productDimensionId: productResult.rows[0].id,
    productExternalId: item.cuentiProductId,
    productName: item.name,
    productSku: item.sku ?? localProduct?.sku ?? null,
    quantity: item.quantity,
    taxAmount,
    unitCost,
    unitName: item.unitName ?? localProduct?.unit_name ?? null,
    unitPrice: item.unitPrice
  };
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
        product.unit_name,
        product.category,
        product.standard_cost,
        product.sale_price,
        product.product_line_id,
        line.name AS product_line_name
      FROM public.product
      LEFT JOIN public.product_line AS line
        ON line.id = product.product_line_id
      WHERE
        ($1::text IS NOT NULL AND product.cuenti_product_id = $1)
        OR ($2::text IS NOT NULL AND LOWER(product.sku) = LOWER($2))
        OR LOWER(product.name) = LOWER($3)
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
  const payloadText = JSON.stringify(input.payload ?? null);
  const payloadHash = createHash("sha256").update(payloadText).digest("hex");

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
        last_changed_at = CASE
          WHEN integration.source_record.payload_hash <> EXCLUDED.payload_hash
            THEN NOW()
          ELSE integration.source_record.last_changed_at
        END,
        payload_hash = EXCLUDED.payload_hash,
        last_seen_at = NOW(),
        last_sync_run_id = EXCLUDED.last_sync_run_id
    `,
    [
      SOURCE_SYSTEM,
      input.entityType,
      input.branchId,
      input.externalId,
      input.documentNumber,
      input.sourceDate,
      payloadText,
      payloadHash,
      input.runId
    ]
  );
}

async function updateRunningCounters(
  client: PoolClient,
  runId: string,
  counters: SyncRunCounters
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

async function saveSuccessfulState(
  client: PoolClient,
  input: {
    branchId: string;
    dateFrom: string;
    dateTo: string;
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
        CASE WHEN $7 THEN $4::date ELSE NULL END,
        CASE WHEN $7 THEN $5::date ELSE NULL END,
        CASE WHEN $7 THEN NOW() ELSE NULL END,
        $6,
        CASE WHEN $7 THEN NULL ELSE $4::date END,
        CASE WHEN $7 THEN NULL ELSE $5::date END,
        $8,
        $9,
        NOW()
      )
      ON CONFLICT (source_system, entity_type, branch_id)
      DO UPDATE SET
        last_successful_from = CASE
          WHEN $7 THEN $4::date
          ELSE integration.sync_state.last_successful_from
        END,
        last_successful_to = CASE
          WHEN $7 THEN $5::date
          ELSE integration.sync_state.last_successful_to
        END,
        last_successful_at = CASE
          WHEN $7 THEN NOW()
          ELSE integration.sync_state.last_successful_at
        END,
        last_run_id = $6,
        active_date_from = CASE WHEN $7 THEN NULL ELSE $4::date END,
        active_date_to = CASE WHEN $7 THEN NULL ELSE $5::date END,
        next_page = $8,
        backfill_complete = integration.sync_state.backfill_complete OR $9,
        updated_at = NOW()
    `,
    [
      SOURCE_SYSTEM,
      ENTITY_TYPE,
      input.branchId,
      input.dateFrom,
      input.dateTo,
      input.runId,
      input.windowComplete,
      input.nextPage,
      backfillComplete
    ]
  );

  return { backfillComplete };
}

function buildDimensionKey(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length <= 190
    ? normalized
    : createHash("sha256").update(normalized).digest("hex");
}

function sumCompleteAmounts(values: Array<number | null>) {
  if (values.length === 0 || values.some((value) => value === null)) {
    return null;
  }

  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function subtractAmounts(
  minuend: number | null,
  subtrahend: number | null
) {
  return minuend !== null && subtrahend !== null
    ? minuend - subtrahend
    : null;
}

function normalizeIsoDate(value?: string | null) {
  const normalized = value?.trim();

  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? normalized
    : null;
}

function getBogotaDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Bogota"
  }).format(new Date());
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
  return left <= right ? left : right;
}

function readPositiveInteger(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
