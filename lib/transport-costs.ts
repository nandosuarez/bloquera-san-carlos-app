import { getDb } from "@/lib/db";

const RECENT_LIMIT = 80;

export type TransportCostType = "FUEL" | "MAINTENANCE" | "REPAIR";

type TransportCostRow = {
  concept: string;
  cost_on: Date | string;
  cost_type: TransportCostType;
  created_at: Date;
  id: string;
  is_voided: boolean;
  notes: string | null;
  provider_name: string | null;
  total_cost: string;
  vehicle_label: string;
  vendor: string | null;
};

type TransportCostStatsRow = {
  fuel_total: string;
  maintenance_total: string;
  records: string;
  repair_total: string;
  total_cost: string;
};

export type TransportCost = {
  concept: string;
  costOn: string;
  costType: TransportCostType;
  createdAt: Date;
  id: string;
  isVoided: boolean;
  notes: string | null;
  providerName: string | null;
  totalCost: number;
  vehicleLabel: string;
};

export type TransportCostStats = {
  fuelTotal: number;
  maintenanceTotal: number;
  records: number;
  repairTotal: number;
  totalCost: number;
};

export type TransportCostFilters = {
  dateFrom?: string | null;
  dateTo?: string | null;
  costType?: TransportCostType | "ALL" | null;
  vehicleId?: string | null;
};

export type TransportCostOverview = {
  costs: TransportCost[];
  filters: NormalizedTransportCostFilters;
  stats: TransportCostStats;
};

type NormalizedTransportCostFilters = {
  costType: TransportCostType | "ALL";
  dateFrom: string | null;
  dateTo: string | null;
  vehicleId: string | null;
};

export class TransportCostError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function getTransportCostOverview(
  filters: TransportCostFilters = {}
): Promise<TransportCostOverview> {
  const normalizedFilters = normalizeFilters(filters);
  const where = buildWhereClause(normalizedFilters);

  const [costsResult, statsResult] = await Promise.all([
    getDb().query<TransportCostRow>(
      `
        SELECT
          id,
          cost_on,
          vehicle_label,
          cost_type,
          concept,
          is_voided,
          provider_name,
          vendor,
          total_cost,
          notes,
          created_at
        FROM transport_cost
        ${where.sql}
        ORDER BY cost_on DESC, created_at DESC
        LIMIT $${where.values.length + 1}
      `,
      [...where.values, RECENT_LIMIT]
    ),
    getDb().query<TransportCostStatsRow>(
      `
        SELECT
          COUNT(*)::text AS records,
          COALESCE(SUM(total_cost), 0)::text AS total_cost,
          COALESCE(SUM(total_cost) FILTER (WHERE cost_type = 'FUEL'), 0)::text AS fuel_total,
          COALESCE(SUM(total_cost) FILTER (WHERE cost_type = 'MAINTENANCE'), 0)::text AS maintenance_total,
          COALESCE(SUM(total_cost) FILTER (WHERE cost_type = 'REPAIR'), 0)::text AS repair_total
        FROM transport_cost
        ${where.sql}
      `,
      where.values
    )
  ]);

  return {
    costs: costsResult.rows.map(mapTransportCost),
    filters: normalizedFilters,
    stats: mapStats(statsResult.rows[0])
  };
}

export async function createTransportCost(input: {
  concept: string;
  costOn: string;
  costType: TransportCostType;
  notes?: string | null;
  providerId: string;
  recordedByUserId: string;
  totalCost?: number | null;
  vehicleId: string;
}) {
  const vehicleId = input.vehicleId.trim();
  const providerId = input.providerId.trim();
  const concept = normalizeLabel(input.concept);
  const totalCost = resolveTotalCost(input.totalCost);

  if (!vehicleId || !providerId || !concept || !input.costOn) {
    throw new TransportCostError(
      "missing_transport_cost_fields",
      "Completa fecha, carro, proveedor, tipo, concepto y valor."
    );
  }

  if (!isValidDate(input.costOn)) {
    throw new TransportCostError("invalid_date", "La fecha no es valida.");
  }

  const vehicleResult = await getDb().query<{ id: string; label: string }>(
    `
      SELECT id, label
      FROM delivery_vehicle
      WHERE id = $1
        AND is_active = TRUE
      LIMIT 1
    `,
    [vehicleId]
  );

  if (vehicleResult.rowCount === 0) {
    throw new TransportCostError("vehicle_not_found", "Selecciona un carro activo.");
  }

  const vehicle = vehicleResult.rows[0];
  const providerResult = await getDb().query<{ id: string; name: string }>(
    `
      SELECT id, name
      FROM transport_provider
      WHERE id = $1
        AND is_active = TRUE
      LIMIT 1
    `,
    [providerId]
  );

  if (providerResult.rowCount === 0) {
    throw new TransportCostError("provider_not_found", "Selecciona un proveedor activo.");
  }

  const provider = providerResult.rows[0];

  const result = await getDb().query<{ id: string }>(
    `
      INSERT INTO transport_cost (
        cost_on,
        vehicle_id,
        vehicle_label,
        cost_type,
        concept,
        provider_id,
        provider_name,
        vendor,
        total_cost,
        notes,
        recorded_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10)
      RETURNING id
    `,
    [
      input.costOn,
      vehicle.id,
      vehicle.label,
      input.costType,
      concept,
      provider.id,
      provider.name,
      totalCost,
      normalizeOptionalText(input.notes),
      input.recordedByUserId
    ]
  );

  return { costId: result.rows[0].id };
}

export async function voidTransportCost(input: {
  costId: string;
  recordedByUserId: string;
  reason?: string | null;
}) {
  const costId = input.costId.trim();

  if (!costId) {
    throw new TransportCostError("transport_cost_not_found", "El costo no existe.");
  }

  const result = await getDb().query<{ id: string }>(
    `
      UPDATE transport_cost
      SET
        is_voided = TRUE,
        voided_at = NOW(),
        voided_by_user_id = $2,
        void_reason = $3,
        updated_at = NOW()
      WHERE id = $1
        AND is_voided = FALSE
      RETURNING id
    `,
    [costId, input.recordedByUserId, normalizeOptionalText(input.reason)]
  );

  if (result.rowCount === 0) {
    throw new TransportCostError("transport_cost_not_found", "El costo no existe.");
  }
}

export function normalizeCostType(value?: string | null): TransportCostType | "ALL" {
  if (value === "FUEL" || value === "MAINTENANCE" || value === "REPAIR") {
    return value;
  }

  return "ALL";
}

function normalizeFilters(filters: TransportCostFilters): NormalizedTransportCostFilters {
  return {
    costType: normalizeCostType(filters.costType),
    dateFrom: normalizeDateFilter(filters.dateFrom),
    dateTo: normalizeDateFilter(filters.dateTo),
    vehicleId: normalizeOptionalText(filters.vehicleId)
  };
}

function buildWhereClause(filters: NormalizedTransportCostFilters) {
  const conditions: string[] = [];
  const values: string[] = [];

  if (filters.vehicleId) {
    values.push(filters.vehicleId);
    conditions.push(`vehicle_id = $${values.length}`);
  }

  if (filters.costType !== "ALL") {
    values.push(filters.costType);
    conditions.push(`cost_type = $${values.length}`);
  }

  if (filters.dateFrom) {
    values.push(filters.dateFrom);
    conditions.push(`cost_on >= $${values.length}::date`);
  }

  if (filters.dateTo) {
    values.push(filters.dateTo);
    conditions.push(`cost_on <= $${values.length}::date`);
  }

  conditions.push(`is_voided = FALSE`);

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    values
  };
}

function resolveTotalCost(totalCost?: number | null) {
  const normalizedTotal = normalizeOptionalNumber(totalCost);

  if (normalizedTotal !== null && normalizedTotal > 0) {
    return roundMoney(normalizedTotal);
  }

  throw new TransportCostError("invalid_amount", "El valor debe ser mayor a cero.");
}

function mapTransportCost(row: TransportCostRow): TransportCost {
  return {
    concept: row.concept,
    costOn: normalizeDateOnly(row.cost_on),
    costType: row.cost_type,
    createdAt: row.created_at,
    id: row.id,
    isVoided: row.is_voided,
    notes: row.notes,
    providerName: row.provider_name ?? row.vendor,
    totalCost: Number(row.total_cost),
    vehicleLabel: row.vehicle_label
  };
}

function mapStats(row: TransportCostStatsRow | undefined): TransportCostStats {
  return {
    fuelTotal: Number(row?.fuel_total ?? 0),
    maintenanceTotal: Number(row?.maintenance_total ?? 0),
    records: Number(row?.records ?? 0),
    repairTotal: Number(row?.repair_total ?? 0),
    totalCost: Number(row?.total_cost ?? 0)
  };
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeDateFilter(value?: string | null) {
  const normalized = normalizeOptionalText(value);
  if (!normalized || !isValidDate(normalized)) return null;
  return normalized;
}

function normalizeDateOnly(value: Date | string) {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeOptionalNumber(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
