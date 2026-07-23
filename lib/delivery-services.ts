import { getDb } from "@/lib/db";

const MAX_RECENT_SERVICES = 120;

export type DeliveryServiceStatus = "PROGRAMMED" | "STARTED" | "COMPLETED" | "CANCELED";

type CollaboratorOptionRow = {
  full_name: string;
  id: string;
};

type CustomerOptionRow = {
  address: string | null;
  cuenti_customer_id: string | null;
  id: string;
  identification: string | null;
  name: string;
  phone: string | null;
};

type VehicleOptionRow = {
  id: string;
  label: string;
  max_load_kg: string;
  plate: string | null;
};

type ProductOptionRow = {
  cuenti_product_id: string | null;
  id: string;
  name: string;
  sku: string | null;
  unit_name: string;
  weight_kg: string;
};

type DeliveryServiceRow = {
  collaborator_id: string;
  collaborator_name: string;
  completion_on: Date | string | null;
  completion_time: string | null;
  created_at: Date;
  customer_address: string;
  customer_name: string;
  customer_phone: string;
  departure_on: Date | string | null;
  departure_time: string | null;
  duration_minutes: string | null;
  id: string;
  notes: string | null;
  service_on: Date | string;
  status: DeliveryServiceStatus;
  vehicle_label: string;
};

type DeliveryServiceItemRow = {
  product_name: string;
  quantity: string;
  service_id: string;
  trip_count: string;
  unit_name: string;
};

type DeliveryProductSummaryRow = {
  product_id: string;
  product_name: string;
  total_trips: string;
  total_quantity: string;
  unit_name: string;
};

type DeliveryLineCostRow = {
  product_line_id: string | null;
  product_line_name: string;
  service_count: string;
  trip_count: string;
  total_quantity: string;
};

type DeliveryServiceStatsRow = {
  avg_duration_minutes: string;
  completed_services: string;
  programmed_services: string;
  started_services: string;
  today_services: string;
  total_services: string;
};

type ProductForInsertRow = {
  id: string;
  name: string;
  product_line_id: string | null;
  product_line_name: string | null;
  unit_name: string;
};

type CustomerForInsertRow = {
  address: string | null;
  id: string;
  name: string;
  phone: string | null;
};

type VehicleForInsertRow = {
  id: string;
  label: string;
};

type ServiceForTransitionRow = {
  status: DeliveryServiceStatus;
};

type TransportTotalRow = {
  total_cost: string;
};

type ServiceStatusFilter = "PENDING" | "PROGRAMMED" | "STARTED" | "COMPLETED" | "CANCELED" | "ALL";

export type DeliveryProductOption = {
  cuentiProductId: string | null;
  id: string;
  name: string;
  sku: string | null;
  unitName: string;
  weightKg: number;
};

export type DeliveryCollaboratorOption = {
  fullName: string;
  id: string;
};

export type DeliveryCustomerOption = {
  address: string | null;
  cuentiCustomerId: string | null;
  id: string;
  identification: string | null;
  name: string;
  phone: string | null;
};

export type DeliveryVehicleOption = {
  id: string;
  label: string;
  maxLoadKg: number;
  plate: string | null;
};

export type DeliveryServiceItem = {
  productName: string;
  quantity: number;
  tripCount: number;
  unitName: string;
};

export type DeliveryProductSummary = {
  productId: string;
  productName: string;
  totalTrips: number;
  totalQuantity: number;
  unitName: string;
};

export type DeliveryLineCostSummary = {
  participationRate: number;
  productLineId: string | null;
  productLineName: string;
  serviceCount: number;
  tripCount: number;
  totalQuantity: number;
  transportCost: number;
};

export type DeliveryServiceRecord = {
  collaboratorId: string;
  collaboratorName: string;
  completionOn: string | null;
  completionTime: string | null;
  createdAt: Date;
  customerAddress: string;
  customerName: string;
  customerPhone: string;
  departureOn: string | null;
  departureTime: string | null;
  durationMinutes: number | null;
  id: string;
  items: DeliveryServiceItem[];
  notes: string | null;
  serviceOn: string;
  status: DeliveryServiceStatus;
  vehicleLabel: string;
};

export type DeliveryServiceOverview = {
  collaborators: DeliveryCollaboratorOption[];
  customers: DeliveryCustomerOption[];
  deliveredProducts: DeliveryProductSummary[];
  deliveryLineCosts: DeliveryLineCostSummary[];
  filters: {
    fromDate: string | null;
    sentProductId: string | null;
    status: ServiceStatusFilter;
    toDate: string | null;
  };
  products: DeliveryProductOption[];
  services: DeliveryServiceRecord[];
  stats: {
    avgDurationMinutes: number;
    completedServices: number;
    programmedServices: number;
    startedServices: number;
    todayServices: number;
    totalServices: number;
    totalTrips: number;
    totalTransportCost: number;
  };
  vehicles: DeliveryVehicleOption[];
};

export type DeliveryProductsReport = {
  filters: {
    fromDate: string | null;
    sentProductId: string | null;
    toDate: string | null;
  };
  items: DeliveryProductSummary[];
  products: DeliveryProductOption[];
  stats: {
    totalProducts: number;
    totalQuantity: number;
  };
};

export class DeliveryServiceError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function getDeliveryServiceOverview(input?: {
  fromDate?: string | null;
  sentProductId?: string | null;
  status?: string | null;
  toDate?: string | null;
}): Promise<DeliveryServiceOverview> {
  const today = resolveTodayDate();
  const status = normalizeStatusFilter(input?.status);
  const fromDate = validateOptionalDate(input?.fromDate) ?? today;
  const toDate = validateOptionalDate(input?.toDate) ?? today;
  const sentProductId = normalizeOptionalText(input?.sentProductId);
  const [
    collaboratorsResult,
    customersResult,
    vehiclesResult,
    productsResult,
    servicesResult,
    deliveredProductsResult,
    deliveryLineCostReport,
    statsResult
  ] =
    await Promise.all([
      getDb().query<CollaboratorOptionRow>(
        `
          SELECT id, full_name
          FROM collaborator
          WHERE is_active = TRUE
          ORDER BY full_name
        `
      ),
      getDb().query<CustomerOptionRow>(
        `
          SELECT id, name, cuenti_customer_id, identification, phone, address
          FROM customer
          WHERE is_active = TRUE
          ORDER BY name
        `
      ),
      getDb().query<VehicleOptionRow>(
        `
          SELECT id, label, plate, max_load_kg
          FROM delivery_vehicle
          WHERE is_active = TRUE
          ORDER BY label
        `
      ),
      getDb().query<ProductOptionRow>(
        `
          SELECT id, name, sku, cuenti_product_id, unit_name, weight_kg
          FROM product
          WHERE is_active = TRUE
          ORDER BY name
        `
      ),
      queryServices({ fromDate, status, toDate }),
      queryDeliveredProducts({ fromDate, sentProductId, toDate }),
      queryDeliveryLineCosts({ fromDate, sentProductId, toDate }),
      getDb().query<DeliveryServiceStatsRow>(
        `
          SELECT
            COUNT(*)::text AS total_services,
            COUNT(*) FILTER (WHERE service_on = CURRENT_DATE)::text AS today_services,
            COUNT(*) FILTER (WHERE status = 'PROGRAMMED')::text AS programmed_services,
            COUNT(*) FILTER (WHERE status = 'STARTED')::text AS started_services,
            COUNT(*) FILTER (WHERE status = 'COMPLETED')::text AS completed_services,
            COALESCE(
              AVG(
                EXTRACT(
                  EPOCH FROM (
                    (completion_on + completion_time) - (departure_on + departure_time)
                  )
                ) / 60
              ) FILTER (
                WHERE status = 'COMPLETED'
                  AND departure_on IS NOT NULL
                  AND departure_time IS NOT NULL
                  AND completion_on IS NOT NULL
                  AND completion_time IS NOT NULL
              ),
              0
            )::text AS avg_duration_minutes
          FROM delivery_service
        `
      )
    ]);

  const serviceIds = servicesResult.rows.map((service) => service.id);
  const itemsMap = new Map<string, DeliveryServiceItem[]>();

  if (serviceIds.length > 0) {
    const itemsResult = await getDb().query<DeliveryServiceItemRow>(
      `
        SELECT
          service_id,
          product_name,
          unit_name,
          quantity,
          trip_count::text AS trip_count
        FROM delivery_service_item
        WHERE service_id = ANY($1::uuid[])
        ORDER BY created_at ASC
      `,
      [serviceIds]
    );

    for (const row of itemsResult.rows) {
      const currentItems = itemsMap.get(row.service_id) ?? [];
      currentItems.push({
        productName: row.product_name,
        quantity: Number(row.quantity),
        tripCount: Number(row.trip_count),
        unitName: row.unit_name
      });
      itemsMap.set(row.service_id, currentItems);
    }
  }

  const statsRow = statsResult.rows[0];

  return {
    collaborators: collaboratorsResult.rows.map((row) => ({
      fullName: row.full_name,
      id: row.id
    })),
    customers: customersResult.rows.map((row) => ({
      address: row.address,
      cuentiCustomerId: row.cuenti_customer_id,
      id: row.id,
      identification: row.identification,
      name: row.name,
      phone: row.phone
    })),
    deliveredProducts: deliveredProductsResult.rows.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      totalTrips: Number(row.total_trips),
      totalQuantity: Number(row.total_quantity),
      unitName: row.unit_name
    })),
    deliveryLineCosts: deliveryLineCostReport.items,
    filters: {
      fromDate,
      sentProductId,
      status,
      toDate
    },
    products: productsResult.rows.map((row) => ({
      cuentiProductId: row.cuenti_product_id,
      id: row.id,
      name: row.name,
      sku: row.sku,
      unitName: row.unit_name,
      weightKg: Number(row.weight_kg)
    })),
    services: servicesResult.rows.map((row) => ({
      collaboratorId: row.collaborator_id,
      collaboratorName: row.collaborator_name,
      completionOn: normalizeDate(row.completion_on),
      completionTime: normalizeTime(row.completion_time),
      createdAt: row.created_at,
      customerAddress: row.customer_address,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      departureOn: normalizeDate(row.departure_on),
      departureTime: normalizeTime(row.departure_time),
      durationMinutes: row.duration_minutes ? Number(row.duration_minutes) : null,
      id: row.id,
      items: itemsMap.get(row.id) ?? [],
      notes: row.notes,
      serviceOn: normalizeRequiredDate(row.service_on),
      status: row.status,
      vehicleLabel: row.vehicle_label
    })),
    stats: {
      avgDurationMinutes: Number(statsRow?.avg_duration_minutes ?? 0),
      completedServices: Number(statsRow?.completed_services ?? 0),
      programmedServices: Number(statsRow?.programmed_services ?? 0),
      startedServices: Number(statsRow?.started_services ?? 0),
      todayServices: Number(statsRow?.today_services ?? 0),
      totalServices: Number(statsRow?.total_services ?? 0),
      totalTrips: deliveryLineCostReport.totalTrips,
      totalTransportCost: deliveryLineCostReport.totalTransportCost
    },
    vehicles: vehiclesResult.rows.map((row) => ({
      id: row.id,
      label: row.label,
      maxLoadKg: Number(row.max_load_kg),
      plate: row.plate
    }))
  };
}

export async function getDeliveryProductsReport(input?: {
  fromDate?: string | null;
  sentProductId?: string | null;
  toDate?: string | null;
}): Promise<DeliveryProductsReport> {
  const today = resolveTodayDate();
  const fromDate = validateOptionalDate(input?.fromDate) ?? today;
  const toDate = validateOptionalDate(input?.toDate) ?? today;
  const sentProductId = normalizeOptionalText(input?.sentProductId);

  const [productsResult, deliveredProductsResult] = await Promise.all([
    getDb().query<ProductOptionRow>(
      `
        SELECT id, name, sku, cuenti_product_id, unit_name, weight_kg
        FROM product
        WHERE is_active = TRUE
        ORDER BY name
      `
    ),
    queryDeliveredProducts({ fromDate, sentProductId, toDate })
  ]);

  const items = deliveredProductsResult.rows.map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    totalTrips: Number(row.total_trips),
    totalQuantity: Number(row.total_quantity),
    unitName: row.unit_name
  }));

  return {
    filters: {
      fromDate,
      sentProductId,
      toDate
    },
    items,
    products: productsResult.rows.map((row) => ({
      cuentiProductId: row.cuenti_product_id,
      id: row.id,
      name: row.name,
      sku: row.sku,
      unitName: row.unit_name,
      weightKg: Number(row.weight_kg)
    })),
    stats: {
      totalProducts: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.totalQuantity, 0)
    }
  };
}

export async function scheduleDeliveryService(input: {
  collaboratorId: string;
  customerAddress?: string | null;
  customerId: string;
  customerPhone?: string | null;
  items: Array<{ productId: string; quantity: number; tripCount: number }>;
  notes?: string | null;
  recordedByUserId: string;
  serviceOn: string;
  vehicleId: string;
}) {
  const client = await getDb().connect();

  try {
    await client.query("BEGIN");

    const collaboratorId = input.collaboratorId.trim();
    const customerId = input.customerId.trim();
    const vehicleId = input.vehicleId.trim();
    const notes = normalizeOptionalText(input.notes);
    const items = input.items
      .map((item) => ({
        productId: item.productId.trim(),
        quantity: roundQuantity(item.quantity),
        tripCount: Math.trunc(item.tripCount)
      }))
      .filter((item) => item.productId && item.quantity > 0 && item.tripCount > 0);

    if (!customerId || !vehicleId || !collaboratorId) {
      throw new DeliveryServiceError(
        "missing_service_fields",
        "Completa cliente, carro y colaborador."
      );
    }

    if (items.length === 0) {
      throw new DeliveryServiceError(
        "missing_service_items",
        "Agrega al menos un producto con cantidad."
      );
    }

    const collaboratorResult = await client.query<{ id: string }>(
      `
        SELECT id
        FROM collaborator
        WHERE id = $1 AND is_active = TRUE
        LIMIT 1
      `,
      [collaboratorId]
    );

    if (collaboratorResult.rowCount === 0) {
      throw new DeliveryServiceError(
        "collaborator_not_found",
        "Selecciona un colaborador activo."
      );
    }

    const customerResult = await client.query<CustomerForInsertRow>(
      `
        SELECT id, name, phone, address
        FROM customer
        WHERE id = $1 AND is_active = TRUE
        LIMIT 1
        FOR UPDATE
      `,
      [customerId]
    );

    if (customerResult.rowCount === 0) {
      throw new DeliveryServiceError(
        "customer_not_found",
        "Selecciona un cliente valido."
      );
    }

    const vehicleResult = await client.query<VehicleForInsertRow>(
      `
        SELECT id, label
        FROM delivery_vehicle
        WHERE id = $1 AND is_active = TRUE
        LIMIT 1
      `,
      [vehicleId]
    );

    if (vehicleResult.rowCount === 0) {
      throw new DeliveryServiceError(
        "vehicle_not_found",
        "Selecciona un carro valido."
      );
    }

    const customer = customerResult.rows[0];
    const vehicle = vehicleResult.rows[0];
    const existingPhone = normalizeOptionalText(customer.phone);
    const existingAddress = normalizeOptionalText(customer.address);
    const inputPhone = normalizeOptionalText(input.customerPhone);
    const inputAddress = normalizeOptionalText(input.customerAddress);
    const resolvedPhone = inputPhone ?? existingPhone;
    const resolvedAddress = inputAddress ?? existingAddress;

    if (!resolvedPhone || !resolvedAddress) {
      throw new DeliveryServiceError(
        "missing_service_fields",
        "Completa telefono y direccion del cliente."
      );
    }

    if ((!existingPhone && inputPhone) || (!existingAddress && inputAddress)) {
      await client.query(
        `
          UPDATE customer
          SET
            phone = CASE
              WHEN (phone IS NULL OR BTRIM(phone) = '') AND $2::text IS NOT NULL
                THEN $2::text
              ELSE phone
            END,
            address = CASE
              WHEN (address IS NULL OR BTRIM(address) = '') AND $3::text IS NOT NULL
                THEN $3::text
              ELSE address
            END
          WHERE id = $1
        `,
        [customer.id, inputPhone ?? null, inputAddress ?? null]
      );
    }

    const uniqueProductIds = [...new Set(items.map((item) => item.productId))];
    const productsResult = await client.query<ProductForInsertRow>(
      `
        SELECT
          product.id,
          product.name,
          product.product_line_id,
          line.name AS product_line_name,
          product.unit_name
        FROM product
        LEFT JOIN product_line AS line
          ON line.id = product.product_line_id
        WHERE product.id = ANY($1::uuid[])
      `,
      [uniqueProductIds]
    );

    if (productsResult.rowCount !== uniqueProductIds.length) {
      throw new DeliveryServiceError(
        "product_not_found",
        "Uno o varios productos no existen."
      );
    }

    const productById = new Map<string, ProductForInsertRow>();
    for (const row of productsResult.rows) {
      productById.set(row.id, row);
    }

    const serviceResult = await client.query<{ id: string }>(
      `
        INSERT INTO delivery_service (
          service_on,
          customer_name,
          customer_phone,
          customer_address,
          vehicle_id,
          vehicle_label,
          collaborator_id,
          status,
          notes,
          recorded_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'PROGRAMMED', $8, $9)
        RETURNING id
      `,
      [
        input.serviceOn,
        customer.name,
        resolvedPhone,
        resolvedAddress,
        vehicle.id,
        vehicle.label,
        collaboratorId,
        notes,
        input.recordedByUserId
      ]
    );

    const serviceId = serviceResult.rows[0].id;

    for (const item of items) {
      const product = productById.get(item.productId);
      if (!product) {
        throw new DeliveryServiceError(
          "product_not_found",
          "Uno o varios productos no existen."
        );
      }

      await client.query(
        `
          INSERT INTO delivery_service_item (
            service_id,
            product_id,
            product_name,
            product_line_id,
            product_line_name,
            unit_name,
            quantity,
            trip_count
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          serviceId,
          product.id,
          product.name,
          product.product_line_id,
          product.product_line_name,
          product.unit_name,
          item.quantity,
          item.tripCount
        ]
      );
    }

    await client.query("COMMIT");

    return { serviceId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function startDeliveryService(input: {
  departureOn: string;
  departureTime: string;
  recordedByUserId: string;
  serviceId: string;
}) {
  const client = await getDb().connect();

  try {
    await client.query("BEGIN");

    const serviceResult = await client.query<ServiceForTransitionRow>(
      `
        SELECT status
        FROM delivery_service
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [input.serviceId]
    );

    if (serviceResult.rowCount === 0) {
      throw new DeliveryServiceError("service_not_found", "El domicilio no existe.");
    }

    const service = serviceResult.rows[0];

    if (service.status !== "PROGRAMMED") {
      throw new DeliveryServiceError(
        "invalid_status_transition",
        "Solo se puede iniciar un domicilio programado."
      );
    }

    await client.query(
      `
        UPDATE delivery_service
        SET
          status = 'STARTED',
          departure_on = $2,
          departure_time = $3,
          completion_on = NULL,
          completion_time = NULL
        WHERE id = $1
      `,
      [input.serviceId, input.departureOn, input.departureTime]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function completeDeliveryService(input: {
  completionTime: string;
  recordedByUserId: string;
  serviceId: string;
}) {
  const client = await getDb().connect();

  try {
    await client.query("BEGIN");

    const serviceResult = await client.query<ServiceForTransitionRow>(
      `
        SELECT status
        FROM delivery_service
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [input.serviceId]
    );

    if (serviceResult.rowCount === 0) {
      throw new DeliveryServiceError("service_not_found", "El domicilio no existe.");
    }

    const service = serviceResult.rows[0];

    if (service.status !== "STARTED") {
      throw new DeliveryServiceError(
        "invalid_status_transition",
        "Solo se puede completar un domicilio iniciado."
      );
    }

    await client.query(
      `
        UPDATE delivery_service
        SET
          status = 'COMPLETED',
          completion_on = COALESCE(departure_on, service_on),
          completion_time = $2
        WHERE id = $1
      `,
      [input.serviceId, input.completionTime]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function cancelDeliveryService(input: {
  reason?: string | null;
  recordedByUserId: string;
  serviceId: string;
}) {
  const client = await getDb().connect();

  try {
    await client.query("BEGIN");

    const serviceResult = await client.query<ServiceForTransitionRow>(
      `
        SELECT status
        FROM delivery_service
        WHERE id = $1
        FOR UPDATE
      `,
      [input.serviceId]
    );

    if (serviceResult.rowCount === 0) {
      throw new DeliveryServiceError("service_not_found", "El domicilio no existe.");
    }

    const service = serviceResult.rows[0];

    if (service.status === "COMPLETED" || service.status === "CANCELED") {
      throw new DeliveryServiceError(
        "invalid_status_transition",
        "Solo se puede anular un domicilio programado o iniciado."
      );
    }

    await client.query(
      `
        UPDATE delivery_service
        SET
          status = 'CANCELED',
          canceled_at = NOW(),
          canceled_by_user_id = $2,
          cancel_reason = $3
        WHERE id = $1
      `,
      [input.serviceId, input.recordedByUserId, normalizeOptionalText(input.reason)]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function queryDeliveryLineCosts(input: {
  fromDate: string | null;
  sentProductId: string | null;
  toDate: string | null;
}) {
  const [linesResult, transportTotalResult] = await Promise.all([
    queryDeliveryLineCostRows(input),
    queryTransportTotal(input)
  ]);
  const totalTrips = linesResult.rows.reduce(
    (sum, row) => sum + Number(row.trip_count),
    0
  );
  const totalTransportCost = Number(transportTotalResult.rows[0]?.total_cost ?? 0);

  return {
    items: linesResult.rows.map((row) => {
      const serviceCount = Number(row.service_count);
      const tripCount = Number(row.trip_count);
      const participationRate =
        totalTrips > 0 ? tripCount / totalTrips : 0;

      return {
        participationRate,
        productLineId: row.product_line_id,
        productLineName: row.product_line_name,
        serviceCount,
        tripCount,
        totalQuantity: Number(row.total_quantity),
        transportCost: roundMoney(totalTransportCost * participationRate)
      };
    }),
    totalTrips,
    totalTransportCost
  };
}

async function queryDeliveryLineCostRows(input: {
  fromDate: string | null;
  sentProductId: string | null;
  toDate: string | null;
}) {
  const params: Array<string | number> = [];
  const whereClauses: string[] = [];
  const dateField = `
    CASE
      WHEN service.status = 'COMPLETED'
        THEN COALESCE(service.completion_on, service.departure_on, service.service_on)
      WHEN service.status = 'STARTED'
        THEN COALESCE(service.departure_on, service.service_on)
      ELSE service.service_on
    END
  `;

  if (input.fromDate) {
    params.push(input.fromDate);
    whereClauses.push(`${dateField} >= $${params.length}::date`);
  }

  if (input.toDate) {
    params.push(input.toDate);
    whereClauses.push(`${dateField} <= $${params.length}::date`);
  }

  if (input.sentProductId) {
    params.push(input.sentProductId);
    whereClauses.push(`item.product_id::text = $${params.length}`);
  }

  whereClauses.push(`service.status IN ('STARTED', 'COMPLETED')`);

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  return getDb().query<DeliveryLineCostRow>(
    `
      SELECT
        COALESCE(item.product_line_id::text, product.product_line_id::text) AS product_line_id,
        COALESCE(item.product_line_name, item_line.name, line.name, 'Sin linea') AS product_line_name,
        COUNT(DISTINCT service.id)::text AS service_count,
        COALESCE(SUM(item.trip_count), 0)::text AS trip_count,
        COALESCE(SUM(item.quantity), 0)::text AS total_quantity
      FROM delivery_service_item AS item
      INNER JOIN delivery_service AS service
        ON service.id = item.service_id
      LEFT JOIN product
        ON product.id = item.product_id
      LEFT JOIN product_line AS item_line
        ON item_line.id = item.product_line_id
      LEFT JOIN product_line AS line
        ON line.id = product.product_line_id
      ${whereSql}
      GROUP BY
        COALESCE(item.product_line_id::text, product.product_line_id::text),
        COALESCE(item.product_line_name, item_line.name, line.name, 'Sin linea')
      ORDER BY COALESCE(SUM(item.trip_count), 0) DESC, product_line_name
    `,
    params
  );
}

async function queryTransportTotal(input: {
  fromDate: string | null;
  toDate: string | null;
}) {
  const params: string[] = [];
  const whereClauses: string[] = [];

  if (input.fromDate) {
    params.push(input.fromDate);
    whereClauses.push(`cost_on >= $${params.length}::date`);
  }

  if (input.toDate) {
    params.push(input.toDate);
    whereClauses.push(`cost_on <= $${params.length}::date`);
  }

  whereClauses.push("is_voided = FALSE");

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  return getDb().query<TransportTotalRow>(
    `
      SELECT COALESCE(SUM(total_cost), 0)::text AS total_cost
      FROM transport_cost
      ${whereSql}
    `,
    params
  );
}

async function queryDeliveredProducts(input: {
  fromDate: string | null;
  sentProductId: string | null;
  toDate: string | null;
}) {
  const params: Array<string | number> = [];
  const whereClauses: string[] = [];
  const dateField = `
    CASE
      WHEN service.status = 'COMPLETED'
        THEN COALESCE(service.completion_on, service.departure_on, service.service_on)
      WHEN service.status = 'STARTED'
        THEN COALESCE(service.departure_on, service.service_on)
      ELSE service.service_on
    END
  `;

  if (input.fromDate) {
    params.push(input.fromDate);
    whereClauses.push(`${dateField} >= $${params.length}::date`);
  }

  if (input.toDate) {
    params.push(input.toDate);
    whereClauses.push(`${dateField} <= $${params.length}::date`);
  }

  if (input.sentProductId) {
    params.push(input.sentProductId);
    whereClauses.push(`item.product_id::text = $${params.length}`);
  }

  whereClauses.push(`service.status IN ('STARTED', 'COMPLETED')`);

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  return getDb().query<DeliveryProductSummaryRow>(
    `
      SELECT
        item.product_id,
        item.product_name,
        item.unit_name,
        COALESCE(SUM(item.trip_count), 0)::text AS total_trips,
        COALESCE(SUM(item.quantity), 0)::text AS total_quantity
      FROM delivery_service_item AS item
      INNER JOIN delivery_service AS service
        ON service.id = item.service_id
      ${whereSql}
      GROUP BY item.product_id, item.product_name, item.unit_name
      ORDER BY item.product_name
    `,
    params
  );
}

async function queryServices(input: {
  fromDate: string | null;
  status: ServiceStatusFilter;
  toDate: string | null;
}) {
  const params: Array<string | number> = [];
  const whereClauses: string[] = [];
  const dateField = `
    CASE
      WHEN service.status = 'COMPLETED'
        THEN COALESCE(service.completion_on, service.departure_on, service.service_on)
      WHEN service.status = 'STARTED'
        THEN COALESCE(service.departure_on, service.service_on)
      ELSE service.service_on
    END
  `;

  if (input.fromDate) {
    params.push(input.fromDate);
    whereClauses.push(`${dateField} >= $${params.length}::date`);
  }

  if (input.toDate) {
    params.push(input.toDate);
    whereClauses.push(`${dateField} <= $${params.length}::date`);
  }

  if (input.status === "PROGRAMMED" || input.status === "STARTED" || input.status === "COMPLETED") {
    params.push(input.status);
    whereClauses.push(`service.status = $${params.length}`);
  } else if (input.status === "CANCELED") {
    params.push(input.status);
    whereClauses.push(`service.status = $${params.length}`);
  } else if (input.status === "PENDING") {
    whereClauses.push(`service.status IN ('PROGRAMMED', 'STARTED')`);
  }

  params.push(MAX_RECENT_SERVICES);
  const limitParam = `$${params.length}`;
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  return getDb().query<DeliveryServiceRow>(
    `
      SELECT
        service.id,
        service.service_on,
        service.customer_name,
        service.customer_phone,
        service.customer_address,
        COALESCE(vehicle.label, service.vehicle_label) AS vehicle_label,
        service.collaborator_id,
        collaborator.full_name AS collaborator_name,
        service.departure_on,
        service.departure_time,
        service.completion_on,
        service.completion_time,
        service.status,
        service.notes,
        service.created_at,
        CASE
          WHEN service.status = 'COMPLETED'
            AND service.departure_on IS NOT NULL
            AND service.departure_time IS NOT NULL
            AND service.completion_on IS NOT NULL
            AND service.completion_time IS NOT NULL
          THEN
            EXTRACT(
              EPOCH FROM (
                (service.completion_on + service.completion_time) -
                (service.departure_on + service.departure_time)
              )
            ) / 60
          ELSE NULL
        END::text AS duration_minutes
      FROM delivery_service AS service
      INNER JOIN collaborator
        ON collaborator.id = service.collaborator_id
      LEFT JOIN delivery_vehicle AS vehicle
        ON vehicle.id = service.vehicle_id
      ${whereSql}
      ORDER BY
        CASE
          WHEN service.status = 'PROGRAMMED' THEN 0
          WHEN service.status = 'STARTED' THEN 1
          WHEN service.status = 'CANCELED' THEN 3
          ELSE 2
        END,
        CASE
          WHEN service.status = 'COMPLETED'
            THEN COALESCE(service.completion_on, service.departure_on, service.service_on)
          WHEN service.status = 'STARTED'
            THEN COALESCE(service.departure_on, service.service_on)
          ELSE service.service_on
        END ASC,
        CASE
          WHEN service.status = 'COMPLETED'
            THEN COALESCE(service.completion_time, TIME '00:00')
          WHEN service.status = 'STARTED'
            THEN COALESCE(service.departure_time, TIME '00:00')
          ELSE TIME '00:00'
        END ASC,
        service.created_at ASC
      LIMIT ${limitParam}
    `,
    params
  );
}

function normalizeStatusFilter(value?: string | null): ServiceStatusFilter {
  if (value === "PROGRAMMED") return "PROGRAMMED";
  if (value === "STARTED") return "STARTED";
  if (value === "COMPLETED") return "COMPLETED";
  if (value === "CANCELED") return "CANCELED";
  if (value === "ALL") return "ALL";
  return "PENDING";
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeTime(value: string | null) {
  if (!value) return null;
  return value.slice(0, 5);
}

function normalizeRequiredTime(value: string) {
  return value.slice(0, 5);
}

function normalizeDate(value: Date | string | null) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function normalizeRequiredDate(value: Date | string) {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function roundQuantity(value: number) {
  return Math.round(value * 100) / 100;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function validateOptionalDate(value?: string | null) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  return normalized;
}

function resolveTodayDate() {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Bogota"
  });
}
