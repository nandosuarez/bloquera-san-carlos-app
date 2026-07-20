import { getDb } from "@/lib/db";

const MAX_RECENT_MOVEMENTS = 40;
const MAX_COMPLETED_ACCOUNTS = 40;

type PendingAccountRow = {
  closed_on: Date | string | null;
  created_at: Date;
  customer_name: string;
  id: string;
  last_movement_on: Date | string;
  notes: string | null;
  opened_on: Date | string;
  product_name: string;
  remaining_qty: string;
  status: "OPEN" | "COMPLETED";
  total_delivered_qty: string;
  total_purchased_qty: string;
  unit_name: string;
  updated_at: Date;
};

type PendingMovementRow = {
  account_id: string;
  created_at: Date;
  customer_name: string;
  id: string;
  movement_on: Date | string;
  movement_type: "PURCHASE" | "DELIVERY";
  notes: string | null;
  product_name: string;
  quantity: string;
  unit_name: string;
};

type PendingStatsRow = {
  completed_accounts: string;
  open_accounts: string;
  pending_quantity: string;
  total_delivered: string;
  total_purchased: string;
};

type PendingCustomerOptionRow = {
  id: string;
  name: string;
};

type PendingProductOptionRow = {
  id: string;
  name: string;
  unit_name: string;
};

export type PendingDeliveryAccount = {
  closedOn: string | null;
  createdAt: Date;
  customerName: string;
  id: string;
  lastMovementOn: string;
  notes: string | null;
  openedOn: string;
  productName: string;
  remainingQty: number;
  status: "OPEN" | "COMPLETED";
  totalDeliveredQty: number;
  totalPurchasedQty: number;
  unitName: string;
  updatedAt: Date;
};

export type PendingDeliveryMovement = {
  accountId: string;
  createdAt: Date;
  customerName: string;
  id: string;
  movementOn: string;
  movementType: "PURCHASE" | "DELIVERY";
  notes: string | null;
  productName: string;
  quantity: number;
  unitName: string;
};

export type PendingDeliveryStats = {
  completedAccounts: number;
  openAccounts: number;
  pendingQuantity: number;
  totalDelivered: number;
  totalPurchased: number;
};

export type PendingDeliveryProductSummary = {
  completedAccounts: number;
  openAccounts: number;
  pendingQuantity: number;
  productName: string;
  totalDelivered: number;
  totalPurchased: number;
  unitName: string;
};

export type PendingCustomerOption = {
  id: string;
  name: string;
};

export type PendingProductOption = {
  id: string;
  name: string;
  unitName: string;
};

export type PendingDeliveryOverview = {
  completedAccounts: PendingDeliveryAccount[];
  customerOptions: PendingCustomerOption[];
  openAccounts: PendingDeliveryAccount[];
  productSummaries: PendingDeliveryProductSummary[];
  productOptions: PendingProductOption[];
  recentMovements: PendingDeliveryMovement[];
  stats: PendingDeliveryStats;
};

export type PendingDeliveryReport = {
  accounts: PendingDeliveryAccount[];
  movements: PendingDeliveryMovement[];
  stats: PendingDeliveryStats;
};

export type PendingDeliveryStatusFilter = "OPEN" | "COMPLETED" | "ALL";

export type PendingDeliveryFilters = {
  customerId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  productId?: string | null;
  status?: PendingDeliveryStatusFilter | null;
};

type RegisterPurchaseInput = {
  customerId: string;
  movementOn: string;
  notes?: string | null;
  productId: string;
  quantity: number;
  recordedByUserId: string;
};

type RegisterDeliveryInput = {
  accountId: string;
  movementOn: string;
  notes?: string | null;
  quantity: number;
  recordedByUserId: string;
};

export class PendingDeliveryError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function getPendingDeliveryOverview(
  filters: PendingDeliveryFilters = {}
): Promise<PendingDeliveryOverview> {
  const [customersResult, productsResult] = await Promise.all([
    getDb().query<PendingCustomerOptionRow>(
      `
        SELECT id, name
        FROM customer
        WHERE is_active = TRUE
        ORDER BY name
      `
    ),
    getDb().query<PendingProductOptionRow>(
      `
        SELECT id, name, unit_name
        FROM product
        WHERE is_active = TRUE
        ORDER BY name
      `
    )
  ]);

  const normalizedFilters = normalizeFilters(
    filters,
    customersResult.rows,
    productsResult.rows
  );
  const accountWhere = buildAccountWhereClause(normalizedFilters);
  const movementWhere = buildMovementWhereClause(normalizedFilters);

  const [accountsResult, movementsResult, statsResult] = await Promise.all([
    getDb().query<PendingAccountRow>(
      `
        SELECT
          id,
          customer_name,
          product_name,
          unit_name,
          total_purchased_qty,
          total_delivered_qty,
          remaining_qty,
          opened_on,
          last_movement_on,
          closed_on,
          status,
          notes,
          created_at,
          updated_at
        FROM pending_delivery_account AS account
        ${accountWhere.sql}
        ORDER BY
          CASE WHEN status = 'OPEN' THEN 0 ELSE 1 END,
          last_movement_on DESC,
          created_at DESC
      `,
      accountWhere.values
    ),
    getDb().query<PendingMovementRow>(
      `
        SELECT
          movement.id,
          movement.account_id,
          movement.movement_type,
          movement.quantity,
          movement.movement_on,
          movement.notes,
          movement.created_at,
          account.customer_name,
          account.product_name,
          account.unit_name
        FROM pending_delivery_movement AS movement
        INNER JOIN pending_delivery_account AS account
          ON account.id = movement.account_id
        ${movementWhere.sql}
        ORDER BY movement.movement_on DESC, movement.created_at DESC
        LIMIT $${movementWhere.values.length + 1}
      `,
      [...movementWhere.values, MAX_RECENT_MOVEMENTS]
    ),
    getDb().query<PendingStatsRow>(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'OPEN')::text AS open_accounts,
          COUNT(*) FILTER (WHERE status = 'COMPLETED')::text AS completed_accounts,
          COALESCE(SUM(remaining_qty) FILTER (WHERE status = 'OPEN'), 0)::text AS pending_quantity,
          COALESCE(SUM(total_purchased_qty), 0)::text AS total_purchased,
          COALESCE(SUM(total_delivered_qty), 0)::text AS total_delivered
        FROM pending_delivery_account AS account
        ${accountWhere.sql}
      `,
      accountWhere.values
    )
  ]);

  const accounts = accountsResult.rows.map(mapAccountRow);

  return {
    completedAccounts: accounts
      .filter((account) => account.status === "COMPLETED")
      .slice(0, MAX_COMPLETED_ACCOUNTS),
    customerOptions: customersResult.rows.map((row) => ({
      id: row.id,
      name: row.name
    })),
    openAccounts: accounts.filter((account) => account.status === "OPEN"),
    productSummaries: buildProductSummaries(accounts),
    productOptions: productsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      unitName: row.unit_name
    })),
    recentMovements: movementsResult.rows.map(mapMovementRow),
    stats: mapStatsRow(statsResult.rows[0])
  };
}

export async function getPendingDeliveryReport(
  filters: PendingDeliveryFilters = {}
): Promise<PendingDeliveryReport> {
  const [customersResult, productsResult] = await Promise.all([
    getDb().query<PendingCustomerOptionRow>(
      `
        SELECT id, name
        FROM customer
        WHERE is_active = TRUE
        ORDER BY name
      `
    ),
    getDb().query<PendingProductOptionRow>(
      `
        SELECT id, name, unit_name
        FROM product
        WHERE is_active = TRUE
        ORDER BY name
      `
    )
  ]);

  const normalizedFilters = normalizeFilters(
    filters,
    customersResult.rows,
    productsResult.rows
  );
  const accountWhere = buildAccountWhereClause(normalizedFilters);
  const movementWhere = buildMovementWhereClause(normalizedFilters);

  const [accountsResult, movementsResult, statsResult] = await Promise.all([
    getDb().query<PendingAccountRow>(
      `
        SELECT
          id,
          customer_name,
          product_name,
          unit_name,
          total_purchased_qty,
          total_delivered_qty,
          remaining_qty,
          opened_on,
          last_movement_on,
          closed_on,
          status,
          notes,
          created_at,
          updated_at
        FROM pending_delivery_account AS account
        ${accountWhere.sql}
        ORDER BY
          CASE WHEN status = 'OPEN' THEN 0 ELSE 1 END,
          customer_name ASC,
          product_name ASC,
          last_movement_on DESC
      `,
      accountWhere.values
    ),
    getDb().query<PendingMovementRow>(
      `
        SELECT
          movement.id,
          movement.account_id,
          movement.movement_type,
          movement.quantity,
          movement.movement_on,
          movement.notes,
          movement.created_at,
          account.customer_name,
          account.product_name,
          account.unit_name
        FROM pending_delivery_movement AS movement
        INNER JOIN pending_delivery_account AS account
          ON account.id = movement.account_id
        ${movementWhere.sql}
        ORDER BY movement.movement_on DESC, movement.created_at DESC
      `,
      movementWhere.values
    ),
    getDb().query<PendingStatsRow>(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'OPEN')::text AS open_accounts,
          COUNT(*) FILTER (WHERE status = 'COMPLETED')::text AS completed_accounts,
          COALESCE(SUM(remaining_qty) FILTER (WHERE status = 'OPEN'), 0)::text AS pending_quantity,
          COALESCE(SUM(total_purchased_qty), 0)::text AS total_purchased,
          COALESCE(SUM(total_delivered_qty), 0)::text AS total_delivered
        FROM pending_delivery_account AS account
        ${accountWhere.sql}
      `,
      accountWhere.values
    )
  ]);

  return {
    accounts: accountsResult.rows.map(mapAccountRow),
    movements: movementsResult.rows.map(mapMovementRow),
    stats: mapStatsRow(statsResult.rows[0])
  };
}

export async function registerPendingPurchase(input: RegisterPurchaseInput) {
  const db = getDb();
  const client = await db.connect();
  const customerId = input.customerId.trim();
  const productId = input.productId.trim();
  const quantity = roundQuantity(input.quantity);
  const notes = normalizeOptionalText(input.notes);

  if (!customerId || !productId) {
    throw new PendingDeliveryError(
      "missing_purchase_fields",
      "Completa cliente, producto, cantidad y fecha."
    );
  }

  try {
    await client.query("BEGIN");

    const customerResult = await client.query<{ id: string; name: string }>(
      `
        SELECT id, name
        FROM customer
        WHERE id = $1
          AND is_active = TRUE
        LIMIT 1
      `,
      [customerId]
    );

    if (customerResult.rowCount === 0) {
      throw new PendingDeliveryError("customer_not_found", "Selecciona un cliente valido.");
    }

    const productResult = await client.query<{ id: string; name: string; unit_name: string }>(
      `
        SELECT id, name, unit_name
        FROM product
        WHERE id = $1
          AND is_active = TRUE
        LIMIT 1
      `,
      [productId]
    );

    if (productResult.rowCount === 0) {
      throw new PendingDeliveryError("product_not_found", "Selecciona un producto valido.");
    }

    const customerName = normalizeLabel(customerResult.rows[0].name);
    const productName = normalizeLabel(productResult.rows[0].name);
    const unitName = normalizeLabel(productResult.rows[0].unit_name || "unidades");
    const customerKey = normalizeLookupKey(customerName);
    const productKey = normalizeLookupKey(productName);
    const unitKey = normalizeLookupKey(unitName);

    const existingAccountResult = await client.query<{ id: string }>(
      `
        SELECT id
        FROM pending_delivery_account
        WHERE customer_key = $1
          AND product_key = $2
          AND unit_key = $3
          AND status = 'OPEN'
        LIMIT 1
        FOR UPDATE
      `,
      [customerKey, productKey, unitKey]
    );

    let accountId: string;

    if (existingAccountResult.rowCount === 0) {
      const insertedAccount = await client.query<{ id: string }>(
        `
          INSERT INTO pending_delivery_account (
            customer_name,
            customer_key,
            product_name,
            product_key,
            unit_name,
            unit_key,
            total_purchased_qty,
            total_delivered_qty,
            remaining_qty,
            opened_on,
            last_movement_on,
            status,
            notes,
            created_by_user_id
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, 0, $7, $8, $8, 'OPEN', $9, $10
          )
          RETURNING id
        `,
        [
          customerName,
          customerKey,
          productName,
          productKey,
          unitName,
          unitKey,
          quantity,
          input.movementOn,
          notes,
          input.recordedByUserId
        ]
      );

      accountId = insertedAccount.rows[0].id;
    } else {
      accountId = existingAccountResult.rows[0].id;

      await client.query(
        `
          UPDATE pending_delivery_account
          SET
            total_purchased_qty = total_purchased_qty + $2,
            remaining_qty = remaining_qty + $2,
            last_movement_on = GREATEST(last_movement_on, $3::date),
            notes = COALESCE($4, notes)
          WHERE id = $1
        `,
        [accountId, quantity, input.movementOn, notes]
      );
    }

    await client.query(
      `
        INSERT INTO pending_delivery_movement (
          account_id,
          movement_type,
          quantity,
          movement_on,
          notes,
          recorded_by_user_id
        )
        VALUES ($1, 'PURCHASE', $2, $3, $4, $5)
      `,
      [accountId, quantity, input.movementOn, notes, input.recordedByUserId]
    );

    await client.query("COMMIT");

    return { accountId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function registerPendingDelivery(input: RegisterDeliveryInput) {
  const db = getDb();
  const client = await db.connect();
  const quantity = roundQuantity(input.quantity);
  const notes = normalizeOptionalText(input.notes);

  try {
    await client.query("BEGIN");

    const accountResult = await client.query<{
      id: string;
      remaining_qty: string;
      status: "OPEN" | "COMPLETED";
    }>(
      `
        SELECT id, remaining_qty, status
        FROM pending_delivery_account
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [input.accountId]
    );

    if (accountResult.rowCount === 0) {
      throw new PendingDeliveryError(
        "account_not_found",
        "No se encontro el pendiente seleccionado."
      );
    }

    const account = accountResult.rows[0];

    if (account.status !== "OPEN") {
      throw new PendingDeliveryError(
        "account_closed",
        "El pendiente seleccionado ya no esta abierto."
      );
    }

    const currentRemaining = Number(account.remaining_qty);

    if (quantity - currentRemaining > 0.0001) {
      throw new PendingDeliveryError(
        "delivery_exceeds_remaining",
        "La entrega supera el saldo pendiente."
      );
    }

    const nextRemaining = roundQuantity(currentRemaining - quantity);

    await client.query(
      `
        UPDATE pending_delivery_account
        SET
          total_delivered_qty = total_delivered_qty + $2::numeric,
          remaining_qty = $3::numeric,
          last_movement_on = GREATEST(last_movement_on, $4::date),
          status = CASE WHEN $3::numeric = 0 THEN 'COMPLETED' ELSE 'OPEN' END,
          closed_on = CASE WHEN $3::numeric = 0 THEN $4::date ELSE NULL END,
          notes = COALESCE($5, notes)
        WHERE id = $1
      `,
      [input.accountId, quantity, nextRemaining, input.movementOn, notes]
    );

    await client.query(
      `
        INSERT INTO pending_delivery_movement (
          account_id,
          movement_type,
          quantity,
          movement_on,
          notes,
          recorded_by_user_id
        )
        VALUES ($1, 'DELIVERY', $2, $3, $4, $5)
      `,
      [input.accountId, quantity, input.movementOn, notes, input.recordedByUserId]
    );

    await client.query("COMMIT");

    return { accountId: input.accountId, remainingQty: nextRemaining };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function parseQuantity(input: string) {
  const normalized = input.replace(",", ".").trim();
  const quantity = Number(normalized);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new PendingDeliveryError(
      "invalid_quantity",
      "La cantidad debe ser un numero mayor a cero."
    );
  }

  return roundQuantity(quantity);
}

export function validateMovementDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PendingDeliveryError(
      "invalid_date",
      "La fecha del movimiento no es valida."
    );
  }

  return value;
}

function mapAccountRow(row: PendingAccountRow): PendingDeliveryAccount {
  return {
    closedOn: row.closed_on ? normalizeDateOnly(row.closed_on) : null,
    createdAt: row.created_at,
    customerName: row.customer_name,
    id: row.id,
    lastMovementOn: normalizeDateOnly(row.last_movement_on),
    notes: row.notes,
    openedOn: normalizeDateOnly(row.opened_on),
    productName: row.product_name,
    remainingQty: Number(row.remaining_qty),
    status: row.status,
    totalDeliveredQty: Number(row.total_delivered_qty),
    totalPurchasedQty: Number(row.total_purchased_qty),
    unitName: row.unit_name,
    updatedAt: row.updated_at
  };
}

function mapMovementRow(row: PendingMovementRow): PendingDeliveryMovement {
  return {
    accountId: row.account_id,
    createdAt: row.created_at,
    customerName: row.customer_name,
    id: row.id,
    movementOn: normalizeDateOnly(row.movement_on),
    movementType: row.movement_type,
    notes: row.notes,
    productName: row.product_name,
    quantity: Number(row.quantity),
    unitName: row.unit_name
  };
}

function mapStatsRow(row: PendingStatsRow | undefined): PendingDeliveryStats {
  return {
    completedAccounts: Number(row?.completed_accounts ?? 0),
    openAccounts: Number(row?.open_accounts ?? 0),
    pendingQuantity: Number(row?.pending_quantity ?? 0),
    totalDelivered: Number(row?.total_delivered ?? 0),
    totalPurchased: Number(row?.total_purchased ?? 0)
  };
}

function buildProductSummaries(
  accounts: PendingDeliveryAccount[]
): PendingDeliveryProductSummary[] {
  const summaries = new Map<string, PendingDeliveryProductSummary>();

  for (const account of accounts) {
    const summaryKey = `${account.productName}\u0000${account.unitName}`;
    const current =
      summaries.get(summaryKey) ??
      {
        completedAccounts: 0,
        openAccounts: 0,
        pendingQuantity: 0,
        productName: account.productName,
        totalDelivered: 0,
        totalPurchased: 0,
        unitName: account.unitName
      };

    current.completedAccounts += account.status === "COMPLETED" ? 1 : 0;
    current.openAccounts += account.status === "OPEN" ? 1 : 0;
    current.pendingQuantity += account.status === "OPEN" ? account.remainingQty : 0;
    current.totalDelivered += account.totalDeliveredQty;
    current.totalPurchased += account.totalPurchasedQty;
    summaries.set(summaryKey, current);
  }

  return Array.from(summaries.values()).sort((a, b) =>
    a.productName.localeCompare(b.productName, "es-CO")
  );
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeLookupKey(value: string) {
  return normalizeLabel(value).toLocaleLowerCase("es-CO");
}

function normalizeDateOnly(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

type NormalizedPendingFilters = {
  customerKey: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  productKey: string | null;
  status: PendingDeliveryStatusFilter;
};

function normalizeFilters(
  filters: PendingDeliveryFilters,
  customers: PendingCustomerOptionRow[],
  products: PendingProductOptionRow[]
): NormalizedPendingFilters {
  const customerId = normalizeOptionalText(filters.customerId);
  const productId = normalizeOptionalText(filters.productId);
  const customer = customerId
    ? customers.find((option) => option.id === customerId) ?? null
    : null;
  const product = productId
    ? products.find((option) => option.id === productId) ?? null
    : null;

  return {
    customerKey: customer ? normalizeLookupKey(customer.name) : null,
    dateFrom: normalizeOptionalDate(filters.dateFrom),
    dateTo: normalizeOptionalDate(filters.dateTo),
    productKey: product ? normalizeLookupKey(product.name) : null,
    status: normalizeStatusFilter(filters.status)
  };
}

function buildAccountWhereClause(filters: NormalizedPendingFilters) {
  const conditions: string[] = [];
  const values: string[] = [];

  if (filters.customerKey) {
    values.push(filters.customerKey);
    conditions.push(`account.customer_key = $${values.length}`);
  }

  if (filters.productKey) {
    values.push(filters.productKey);
    conditions.push(`account.product_key = $${values.length}`);
  }

  if (filters.status !== "ALL") {
    values.push(filters.status);
    conditions.push(`account.status = $${values.length}`);
  }

  if (filters.dateFrom) {
    values.push(filters.dateFrom);
    conditions.push(`account.last_movement_on >= $${values.length}::date`);
  }

  if (filters.dateTo) {
    values.push(filters.dateTo);
    conditions.push(`account.last_movement_on <= $${values.length}::date`);
  }

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    values
  };
}

function buildMovementWhereClause(filters: NormalizedPendingFilters) {
  const conditions: string[] = [];
  const values: string[] = [];

  if (filters.customerKey) {
    values.push(filters.customerKey);
    conditions.push(`account.customer_key = $${values.length}`);
  }

  if (filters.productKey) {
    values.push(filters.productKey);
    conditions.push(`account.product_key = $${values.length}`);
  }

  if (filters.status !== "ALL") {
    values.push(filters.status);
    conditions.push(`account.status = $${values.length}`);
  }

  if (filters.dateFrom) {
    values.push(filters.dateFrom);
    conditions.push(`movement.movement_on >= $${values.length}::date`);
  }

  if (filters.dateTo) {
    values.push(filters.dateTo);
    conditions.push(`movement.movement_on <= $${values.length}::date`);
  }

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    values
  };
}

function normalizeStatusFilter(
  value?: PendingDeliveryStatusFilter | string | null
): PendingDeliveryStatusFilter {
  if (value === "OPEN" || value === "COMPLETED" || value === "ALL") {
    return value;
  }

  return "OPEN";
}

function normalizeOptionalDate(value?: string | null) {
  const normalized = normalizeOptionalText(value);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function roundQuantity(value: number) {
  return Math.round(value * 100) / 100;
}
