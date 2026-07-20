import { getDb } from "@/lib/db";

type DailyClosingRow = {
  canceled_services: string;
  completed_services: string;
  pending_accounts: string;
  produced_blocks: string;
  programmed_services: string;
  started_services: string;
  total_delivery_trips: string;
  total_transport_cost: string;
};

type RangeReportRow = {
  completed_services: string;
  open_pending_accounts: string;
  produced_blocks: string;
  total_delivery_trips: string;
  total_pending_qty: string;
  total_transport_cost: string;
};

type TopProductRow = {
  product_name: string;
  total_quantity: string;
  total_trips: string;
  unit_name: string;
};

type AuditLogRow = {
  action: string;
  actor_name: string | null;
  created_at: Date;
  entity_type: string;
  summary: string | null;
};

export type DailyClosing = {
  canceledServices: number;
  closingOn: string;
  completedServices: number;
  pendingAccounts: number;
  producedBlocks: number;
  programmedServices: number;
  startedServices: number;
  totalDeliveryTrips: number;
  totalTransportCost: number;
};

export type RangeReport = {
  auditLogs: Array<{
    action: string;
    actorName: string | null;
    createdAt: Date;
    entityType: string;
    summary: string | null;
  }>;
  completedServices: number;
  dateFrom: string;
  dateTo: string;
  openPendingAccounts: number;
  producedBlocks: number;
  topProducts: Array<{
    productName: string;
    totalQuantity: number;
    totalTrips: number;
    unitName: string;
  }>;
  totalDeliveryTrips: number;
  totalPendingQty: number;
  totalTransportCost: number;
};

export async function getDailyClosing(closingOn: string): Promise<DailyClosing> {
  const result = await getDb().query<DailyClosingRow>(
    `
      SELECT
        (SELECT COUNT(*) FROM delivery_service WHERE service_on = $1::date AND status = 'PROGRAMMED')::text AS programmed_services,
        (SELECT COUNT(*) FROM delivery_service WHERE service_on = $1::date AND status = 'STARTED')::text AS started_services,
        (SELECT COUNT(*) FROM delivery_service WHERE service_on = $1::date AND status = 'COMPLETED')::text AS completed_services,
        (SELECT COUNT(*) FROM delivery_service WHERE service_on = $1::date AND status = 'CANCELED')::text AS canceled_services,
        (
          SELECT COALESCE(SUM(item.trip_count), 0)
          FROM delivery_service_item AS item
          INNER JOIN delivery_service AS service
            ON service.id = item.service_id
          WHERE service.service_on = $1::date
            AND service.status <> 'CANCELED'
        )::text AS total_delivery_trips,
        (
          SELECT COALESCE(SUM(total_cost), 0)
          FROM transport_cost
          WHERE cost_on = $1::date
            AND is_voided = FALSE
        )::text AS total_transport_cost,
        (
          SELECT COALESCE(SUM(produced_qty), 0)
          FROM block_production_batch
          WHERE production_on = $1::date
        )::text AS produced_blocks,
        (SELECT COUNT(*) FROM pending_delivery_account WHERE status = 'OPEN')::text AS pending_accounts
    `,
    [closingOn]
  );
  const row = result.rows[0];

  return {
    canceledServices: Number(row?.canceled_services ?? 0),
    closingOn,
    completedServices: Number(row?.completed_services ?? 0),
    pendingAccounts: Number(row?.pending_accounts ?? 0),
    producedBlocks: Number(row?.produced_blocks ?? 0),
    programmedServices: Number(row?.programmed_services ?? 0),
    startedServices: Number(row?.started_services ?? 0),
    totalDeliveryTrips: Number(row?.total_delivery_trips ?? 0),
    totalTransportCost: Number(row?.total_transport_cost ?? 0)
  };
}

export async function getRangeReport(input: {
  dateFrom: string;
  dateTo: string;
}): Promise<RangeReport> {
  const [summaryResult, productsResult, auditResult] = await Promise.all([
    getDb().query<RangeReportRow>(
      `
        SELECT
          (
            SELECT COUNT(*)
            FROM delivery_service
            WHERE service_on BETWEEN $1::date AND $2::date
              AND status = 'COMPLETED'
          )::text AS completed_services,
          (
            SELECT COALESCE(SUM(item.trip_count), 0)
            FROM delivery_service_item AS item
            INNER JOIN delivery_service AS service
              ON service.id = item.service_id
            WHERE service.service_on BETWEEN $1::date AND $2::date
              AND service.status <> 'CANCELED'
          )::text AS total_delivery_trips,
          (
            SELECT COALESCE(SUM(total_cost), 0)
            FROM transport_cost
            WHERE cost_on BETWEEN $1::date AND $2::date
              AND is_voided = FALSE
          )::text AS total_transport_cost,
          (
            SELECT COALESCE(SUM(produced_qty), 0)
            FROM block_production_batch
            WHERE production_on BETWEEN $1::date AND $2::date
          )::text AS produced_blocks,
          (SELECT COUNT(*) FROM pending_delivery_account WHERE status = 'OPEN')::text AS open_pending_accounts,
          (
            SELECT COALESCE(SUM(remaining_qty), 0)
            FROM pending_delivery_account
            WHERE status = 'OPEN'
          )::text AS total_pending_qty
      `,
      [input.dateFrom, input.dateTo]
    ),
    getDb().query<TopProductRow>(
      `
        SELECT
          item.product_name,
          item.unit_name,
          COALESCE(SUM(item.quantity), 0)::text AS total_quantity,
          COALESCE(SUM(item.trip_count), 0)::text AS total_trips
        FROM delivery_service_item AS item
        INNER JOIN delivery_service AS service
          ON service.id = item.service_id
        WHERE service.service_on BETWEEN $1::date AND $2::date
          AND service.status <> 'CANCELED'
        GROUP BY item.product_name, item.unit_name
        ORDER BY SUM(item.quantity) DESC, item.product_name
        LIMIT 12
      `,
      [input.dateFrom, input.dateTo]
    ),
    getDb().query<AuditLogRow>(
      `
        SELECT action, actor_name, entity_type, summary, created_at
        FROM audit_log
        ORDER BY created_at DESC
        LIMIT 12
      `
    )
  ]);
  const summary = summaryResult.rows[0];

  return {
    auditLogs: auditResult.rows.map((row) => ({
      action: row.action,
      actorName: row.actor_name,
      createdAt: row.created_at,
      entityType: row.entity_type,
      summary: row.summary
    })),
    completedServices: Number(summary?.completed_services ?? 0),
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    openPendingAccounts: Number(summary?.open_pending_accounts ?? 0),
    producedBlocks: Number(summary?.produced_blocks ?? 0),
    topProducts: productsResult.rows.map((row) => ({
      productName: row.product_name,
      totalQuantity: Number(row.total_quantity),
      totalTrips: Number(row.total_trips),
      unitName: row.unit_name
    })),
    totalDeliveryTrips: Number(summary?.total_delivery_trips ?? 0),
    totalPendingQty: Number(summary?.total_pending_qty ?? 0),
    totalTransportCost: Number(summary?.total_transport_cost ?? 0)
  };
}
