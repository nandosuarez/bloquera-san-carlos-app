import { AppShell } from "@/components/app-shell";
import {
  DeliveryServiceForm,
  type DeliveryServiceInitialValue
} from "@/components/delivery-service-form";
import {
  getDeliveryServiceOverview,
  type DeliveryServiceOverview,
  type DeliveryServiceRecord
} from "@/lib/delivery-services";
import {
  CuentiIntegrationError,
  getCuentiSaleDetail,
  getCuentiSales,
  type CuentiSaleDetail,
  type CuentiSaleSummary
} from "@/lib/cuenti";
import { requireSalesPage } from "@/lib/permissions";
import Link from "next/link";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  collaborator_not_found: "Selecciona un colaborador activo.",
  customer_not_found: "Selecciona un cliente valido.",
  invalid_date: "La fecha no es valida.",
  invalid_quantity: "La cantidad debe ser mayor a cero.",
  invalid_status_transition: "El cambio de estado no es valido.",
  invalid_time: "La hora no es valida.",
  invalid_trip_count: "El numero de viajes debe ser mayor a cero.",
  missing_completion_fields: "Completa la hora final.",
  missing_service_fields: "Completa cliente, carro, colaborador y fecha.",
  missing_service_items: "Agrega al menos un producto con su cantidad.",
  missing_start_fields: "Completa fecha y hora de salida.",
  product_not_found: "Uno o varios productos no existen.",
  service_not_found: "El domicilio no existe.",
  server_error: "No fue posible guardar el domicilio.",
  vehicle_not_found: "Selecciona un carro valido."
};

const successMessages: Record<string, string> = {
  delivery_completed: "Domicilio completado.",
  delivery_canceled: "Domicilio anulado.",
  delivery_service_saved: "Domicilio programado.",
  delivery_started: "Domicilio iniciado."
};

type DomiciliosPageProps = {
  searchParams?: {
    error?: string;
    fromDate?: string;
    saleFromDate?: string;
    saleRef?: string;
    saleToDate?: string;
    section?: string;
    sentProductId?: string;
    status?: string;
    success?: string;
    toDate?: string;
  };
};

type DomiciliosSection = "programar" | "ventas" | "servicios" | "productos";

type CuentiSalesView = {
  branchCandidates: string[];
  branchId: string | null;
  dateFrom: string;
  dateTo: string;
  error: string | null;
  rawItemsSeen: number;
  sales: CuentiSaleSummary[];
};

type CuentiSaleSelectionView = {
  error: string | null;
  sale: CuentiSaleDetail | null;
};

type SalePrefillView = {
  initialValue: DeliveryServiceInitialValue;
  matchedProducts: number;
  saleLabel: string;
  unmatchedCustomer: boolean;
  unmatchedProducts: string[];
};

export default async function DomiciliosPage({ searchParams }: DomiciliosPageProps) {
  requireSalesPage();
  const section = normalizeSection(searchParams?.section);
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Bogota"
  });
  const salesDateFrom = normalizeDateParam(searchParams?.saleFromDate) ?? today;
  const salesDateTo = normalizeDateParam(searchParams?.saleToDate) ?? today;
  const [overview, cuentiSalesView, selectedSaleView] = await Promise.all([
    getDeliveryServiceOverview({
      fromDate: searchParams?.fromDate,
      sentProductId: searchParams?.sentProductId,
      status: searchParams?.status,
      toDate: searchParams?.toDate
    }),
    section === "ventas"
      ? loadCuentiSalesView({ dateFrom: salesDateFrom, dateTo: salesDateTo })
      : Promise.resolve<CuentiSalesView | null>(null),
    searchParams?.saleRef
      ? loadCuentiSaleSelection(searchParams.saleRef)
      : Promise.resolve<CuentiSaleSelectionView>({ error: null, sale: null })
  ]);
  const salePrefill = selectedSaleView.sale
    ? buildSalePrefill(selectedSaleView.sale, overview, today)
    : null;
  const now = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "America/Bogota"
  }).format(new Date());
  const errorMessage = searchParams?.error
    ? errorMessages[searchParams.error] ?? "Ocurrio un error inesperado."
    : null;
  const successMessage = searchParams?.success
    ? successMessages[searchParams.success] ?? null
    : null;

  return (
    <AppShell
      actions={
        <form action="/api/auth/logout" method="post">
          <button className="ghost-button" type="submit">
            Cerrar sesion
          </button>
        </form>
      }
      eyebrow="Logistica"
      title="Domicilios"
    >
      <div className="stats-grid">
        <article className="stat-card">
          <span>Programados</span>
          <strong>{overview.stats.programmedServices}</strong>
        </article>
        <article className="stat-card">
          <span>Iniciados</span>
          <strong>{overview.stats.startedServices}</strong>
        </article>
        <article className="stat-card">
          <span>Completados</span>
          <strong>{overview.stats.completedServices}</strong>
        </article>
        <article className="stat-card">
          <span>Tiempo prom (min)</span>
          <strong>{formatMinutes(overview.stats.avgDurationMinutes)}</strong>
        </article>
      </div>

      {errorMessage ? <div className="message message-error">{errorMessage}</div> : null}
      {successMessage ? (
        <div className="message message-success">{successMessage}</div>
      ) : null}

      <section className="workspace-panel">
        <div className="module-subnav">
          <Link
            className={`module-subnav-link ${section === "programar" ? "module-subnav-link-active" : ""}`}
            href={buildSectionHref("programar", overview.filters)}
          >
            Programar
          </Link>
          <Link
            className={`module-subnav-link ${section === "ventas" ? "module-subnav-link-active" : ""}`}
            href={buildCuentiSalesHref({ dateFrom: salesDateFrom, dateTo: salesDateTo })}
          >
            Ventas Cuenti
          </Link>
          <Link
            className={`module-subnav-link ${section === "servicios" ? "module-subnav-link-active" : ""}`}
            href={buildSectionHref("servicios", overview.filters)}
          >
            Servicios
          </Link>
          <Link
            className={`module-subnav-link ${section === "productos" ? "module-subnav-link-active" : ""}`}
            href={buildSectionHref("productos", overview.filters)}
          >
            Productos enviados
          </Link>
        </div>
      </section>

      {section === "programar" ? (
        <section className="workspace-panel">
          <div className="panel-headline">
            <strong>Programar domicilio</strong>
          </div>

          {selectedSaleView.error ? (
            <div className="message message-error">{selectedSaleView.error}</div>
          ) : null}

          {salePrefill ? (
            <div className="message message-success">
              {salePrefill.saleLabel} cargada. Productos encontrados:{" "}
              {salePrefill.matchedProducts}.
            </div>
          ) : null}

          {salePrefill?.unmatchedCustomer ? (
            <div className="message message-error">
              No encontre el cliente de esta venta en la app. Sincroniza clientes o
              seleccionalo manualmente antes de guardar.
            </div>
          ) : null}

          {salePrefill && salePrefill.unmatchedProducts.length > 0 ? (
            <div className="message message-error">
              Productos sin conectar: {salePrefill.unmatchedProducts.join(", ")}.
              Sincroniza productos o agregalos manualmente.
            </div>
          ) : null}

          <DeliveryServiceForm
            collaborators={overview.collaborators}
            customers={overview.customers}
            defaultDate={today}
            initialValue={salePrefill?.initialValue ?? null}
            products={overview.products}
            vehicles={overview.vehicles}
          />
        </section>
      ) : null}

      {section === "ventas" ? (
        <section className="workspace-panel">
          <div className="panel-headline">
            <strong>Ventas de Cuenti</strong>
          </div>

          <form action="/domicilios" className="stack-form" method="get">
            <input name="section" type="hidden" value="ventas" />
            <div className="split-fields three-fields">
              <label className="field">
                <span>Desde</span>
                <input defaultValue={salesDateFrom} name="saleFromDate" type="date" />
              </label>
              <label className="field">
                <span>Hasta</span>
                <input defaultValue={salesDateTo} name="saleToDate" type="date" />
              </label>
              <label className="field">
                <span>Accion</span>
                <button className="primary-button" type="submit">
                  Buscar ventas
                </button>
              </label>
            </div>
          </form>

          {cuentiSalesView?.error ? (
            <div className="message message-error">{cuentiSalesView.error}</div>
          ) : null}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Documento</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {!cuentiSalesView || cuentiSalesView.sales.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      {cuentiSalesView?.error
                        ? "No fue posible consultar ventas."
                        : "Sin ventas de Cuenti para el filtro actual."}
                    </td>
                  </tr>
                ) : (
                  cuentiSalesView.sales.map((sale) => (
                    <tr key={`${sale.branchId ?? "branch"}-${sale.cuentiSaleId}`}>
                      <td>{sale.saleDate ? formatDate(sale.saleDate) : "-"}</td>
                      <td>
                        {sale.documentNumber ?? sale.cuentiSaleId}
                        <span className="table-meta">ID: {sale.cuentiSaleId}</span>
                      </td>
                      <td>
                        {sale.customerName ?? "-"}
                        {sale.customerPhone ? (
                          <span className="table-meta">{sale.customerPhone}</span>
                        ) : null}
                      </td>
                      <td>
                        {sale.totalAmount === null ? "-" : formatMoney(sale.totalAmount)}
                      </td>
                      <td>{sale.status ?? "-"}</td>
                      <td>
                        <Link className="ghost-button" href={buildLoadSaleHref(sale)}>
                          Cargar
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {section === "servicios" ? (
        <section className="workspace-panel">
          <div className="panel-headline">
            <strong>Servicios</strong>
          </div>

          <form action="/domicilios" className="stack-form" method="get">
            <input name="section" type="hidden" value="servicios" />
            <div className="split-fields three-fields">
              <label className="field">
                <span>Desde</span>
                <input defaultValue={overview.filters.fromDate ?? ""} name="fromDate" type="date" />
              </label>
              <label className="field">
                <span>Hasta</span>
                <input defaultValue={overview.filters.toDate ?? ""} name="toDate" type="date" />
              </label>
              <label className="field">
                <span>Estado</span>
                <select defaultValue={overview.filters.status} name="status">
                  <option value="PENDING">Programados y pendientes</option>
                  <option value="PROGRAMMED">Programado</option>
                  <option value="STARTED">Iniciado</option>
                  <option value="COMPLETED">Completado</option>
                  <option value="CANCELED">Anulado</option>
                  <option value="ALL">Todos</option>
                </select>
              </label>
            </div>

            <button className="primary-button" type="submit">
              Filtrar
            </button>
          </form>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Programado</th>
                  <th>Cliente</th>
              <th>Productos</th>
              <th>Viajes</th>
              <th>Carro</th>
                  <th>Colaborador</th>
                  <th>Estado</th>
                  <th>Salida</th>
                  <th>Final</th>
                  <th>Tiempo</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {overview.services.length === 0 ? (
                  <tr>
                    <td colSpan={11}>Sin domicilios para el filtro actual.</td>
                  </tr>
                ) : (
                  overview.services.map((service) => (
                    <ServiceRow key={service.id} now={now} service={service} today={today} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {section === "productos" ? (
        <section className="workspace-panel">
          <div className="panel-headline">
            <strong>Cantidad de productos enviados</strong>
            <a
              className="ghost-button"
              href={buildProductsExportHref(overview.filters)}
            >
              Exportar CSV
            </a>
          </div>

          <form action="/domicilios" className="stack-form" method="get">
            <input name="section" type="hidden" value="productos" />
            <div className="split-fields three-fields">
              <label className="field">
                <span>Desde</span>
                <input defaultValue={overview.filters.fromDate ?? ""} name="fromDate" type="date" />
              </label>
              <label className="field">
                <span>Hasta</span>
                <input defaultValue={overview.filters.toDate ?? ""} name="toDate" type="date" />
              </label>
              <label className="field">
                <span>Producto</span>
                <select defaultValue={overview.filters.sentProductId ?? ""} name="sentProductId">
                  <option value="">Todos</option>
                  {overview.products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button className="primary-button" type="submit">
              Filtrar
            </button>
          </form>

          <div className="stats-grid stats-grid-compact">
            <article className="stat-card">
              <span>Productos distintos</span>
              <strong>{overview.deliveredProducts.length}</strong>
            </article>
            <article className="stat-card">
              <span>Total unidades enviadas</span>
              <strong>
                {formatQuantity(
                  overview.deliveredProducts.reduce(
                    (sum, item) => sum + item.totalQuantity,
                    0
                  )
                )}
              </strong>
            </article>
            <article className="stat-card">
              <span>Total viajes</span>
              <strong>{overview.stats.totalTrips}</strong>
            </article>
            <article className="stat-card">
              <span>Transporte filtrado</span>
              <strong>{formatMoney(overview.stats.totalTransportCost)}</strong>
            </article>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto enviado</th>
                  <th>Cantidad total enviada</th>
                  <th>Viajes</th>
                </tr>
              </thead>
              <tbody>
                {overview.deliveredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={3}>Sin productos enviados para el filtro actual.</td>
                  </tr>
                ) : (
                  overview.deliveredProducts.map((item) => (
                    <tr key={`${item.productId}-${item.unitName}`}>
                      <td>{item.productName}</td>
                      <td>
                        {formatQuantity(item.totalQuantity)} {item.unitName}
                      </td>
                      <td>{item.totalTrips}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="panel-headline panel-headline-spaced">
            <strong>Costo transporte por linea segun viajes</strong>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Linea</th>
                  <th>Domicilios</th>
                  <th>Viajes</th>
                  <th>Cantidad enviada</th>
                  <th>Participacion</th>
                  <th>Costo asignado</th>
                </tr>
              </thead>
              <tbody>
                {overview.deliveryLineCosts.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Sin lineas con domicilios para el filtro actual.</td>
                  </tr>
                ) : (
                  overview.deliveryLineCosts.map((line) => (
                    <tr key={line.productLineId ?? line.productLineName}>
                      <td>{line.productLineName}</td>
                      <td>{line.serviceCount}</td>
                      <td>{line.tripCount}</td>
                      <td>{formatQuantity(line.totalQuantity)}</td>
                      <td>{formatPercent(line.participationRate)}</td>
                      <td>{formatMoney(line.transportCost)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}

function ServiceRow({
  now,
  service,
  today
}: {
  now: string;
  service: DeliveryServiceRecord;
  today: string;
}) {
  return (
    <tr>
      <td>{formatDate(service.serviceOn)}</td>
      <td>
        {service.customerName}
        <span className="table-meta">{service.customerAddress}</span>
        <span className="table-meta">{service.customerPhone}</span>
      </td>
      <td>
        <div className="meta-stack">
          {service.items.map((item, index) => (
            <span key={`${service.id}-${index}`}>
              {item.productName}: {formatQuantity(item.quantity)} {item.unitName}
              {item.tripCount > 1 ? ` (${item.tripCount} viajes)` : " (1 viaje)"}
            </span>
          ))}
        </div>
      </td>
      <td>{service.items.reduce((sum, item) => sum + item.tripCount, 0)}</td>
      <td>{service.vehicleLabel}</td>
      <td>{service.collaboratorName}</td>
      <td>
        <span className="status-chip">{formatStatus(service.status)}</span>
      </td>
      <td>
        {service.departureOn && service.departureTime
          ? `${formatDate(service.departureOn)} ${service.departureTime}`
          : "-"}
      </td>
      <td>
        {service.completionOn && service.completionTime
          ? `${formatDate(service.completionOn)} ${service.completionTime}`
          : "-"}
      </td>
      <td>{service.durationMinutes ? formatMinutes(service.durationMinutes) : "-"}</td>
      <td>
        {service.status === "PROGRAMMED" ? (
          <form action="/api/domicilios/start" className="inline-action-form" method="post">
            <input name="serviceId" type="hidden" value={service.id} />
            <input name="section" type="hidden" value="servicios" />
            <input defaultValue={today} name="departureOn" required type="date" />
            <input defaultValue={now} name="departureTime" required type="time" />
            <button className="ghost-button" type="submit">
              Iniciar
            </button>
          </form>
        ) : null}

        {service.status === "STARTED" ? (
          <form action="/api/domicilios/complete" className="inline-action-form" method="post">
            <input name="serviceId" type="hidden" value={service.id} />
            <input name="section" type="hidden" value="servicios" />
            <input defaultValue={now} name="completionTime" required type="time" />
            <button className="ghost-button" type="submit">
              Completar
            </button>
          </form>
        ) : null}

        {service.status === "PROGRAMMED" || service.status === "STARTED" ? (
          <form action="/api/domicilios/cancel" className="inline-action-form" method="post">
            <input name="serviceId" type="hidden" value={service.id} />
            <input name="section" type="hidden" value="servicios" />
            <input name="reason" placeholder="Motivo" type="text" />
            <button className="ghost-button" type="submit">
              Anular
            </button>
          </form>
        ) : null}
      </td>
    </tr>
  );
}

function formatDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(date);
}

function formatMinutes(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0
  }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    currency: "COP",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "percent"
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2
  }).format(value);
}

function formatStatus(status: DeliveryServiceRecord["status"]) {
  if (status === "PROGRAMMED") return "Programado";
  if (status === "STARTED") return "Iniciado";
  if (status === "CANCELED") return "Anulado";
  return "Completado";
}

function normalizeSection(value?: string): DomiciliosSection {
  if (value === "ventas") return "ventas";
  if (value === "servicios") return "servicios";
  if (value === "productos") return "productos";
  return "programar";
}

async function loadCuentiSalesView(input: {
  dateFrom: string;
  dateTo: string;
}): Promise<CuentiSalesView> {
  try {
    const result = await getCuentiSales({
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      page: 1,
      pageSize: 30
    });

    return {
      branchCandidates: result.branchCandidates,
      branchId: result.branchId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      error: null,
      rawItemsSeen: result.rawItemsSeen,
      sales: result.sales
    };
  } catch (error) {
    console.error("Error loading Cuenti sales", error);

    return {
      branchCandidates: [],
      branchId: null,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      error: buildCuentiErrorMessage(error),
      rawItemsSeen: 0,
      sales: []
    };
  }
}

async function loadCuentiSaleSelection(ref: string): Promise<CuentiSaleSelectionView> {
  try {
    const sale = await getCuentiSaleDetail(ref);

    return {
      error: sale ? null : "No encontre el detalle de esta venta en Cuenti.",
      sale
    };
  } catch (error) {
    console.error("Error loading Cuenti sale detail", error);

    return {
      error: buildCuentiErrorMessage(error),
      sale: null
    };
  }
}

function buildSalePrefill(
  sale: CuentiSaleDetail,
  overview: DeliveryServiceOverview,
  today: string
): SalePrefillView {
  const matchedCustomer = findMatchingCustomer(sale, overview.customers);
  const unmatchedProducts: string[] = [];
  const rowsByProductId = new Map<
    string,
    { productId: string; quantity: number; tripCount: number }
  >();

  for (const item of sale.items) {
    const product = findMatchingProduct(item, overview.products);

    if (!product) {
      unmatchedProducts.push(item.name);
      continue;
    }

    const currentRow = rowsByProductId.get(product.id);

    rowsByProductId.set(product.id, {
      productId: product.id,
      quantity: Math.round(((currentRow?.quantity ?? 0) + item.quantity) * 100) / 100,
      tripCount: 1
    });
  }

  const saleLabel = sale.documentNumber
    ? `Factura ${sale.documentNumber}`
    : `Venta Cuenti ${sale.cuentiSaleId}`;
  const notes = [
    saleLabel,
    `ID Cuenti: ${sale.cuentiSaleId}`,
    sale.customerName ? `Cliente Cuenti: ${sale.customerName}` : null
  ]
    .filter(Boolean)
    .join("\n");

  return {
    initialValue: {
      customerAddress: sale.customerAddress ?? matchedCustomer?.address ?? "",
      customerId: matchedCustomer?.id ?? "",
      customerPhone: sale.customerPhone ?? matchedCustomer?.phone ?? "",
      notes,
      productRows: [...rowsByProductId.values()],
      serviceOn: sale.saleDate ?? today
    },
    matchedProducts: rowsByProductId.size,
    saleLabel,
    unmatchedCustomer: !matchedCustomer,
    unmatchedProducts: [...new Set(unmatchedProducts)]
  };
}

function findMatchingCustomer(
  sale: CuentiSaleDetail,
  customers: DeliveryServiceOverview["customers"]
) {
  const cuentiCustomerId = normalizeComparableId(sale.cuentiCustomerId);
  const identification = normalizeComparableId(sale.customerIdentification);
  const customerName = normalizeComparableText(sale.customerName);

  return (
    customers.find(
      (customer) =>
        cuentiCustomerId &&
        normalizeComparableId(customer.cuentiCustomerId) === cuentiCustomerId
    ) ??
    customers.find(
      (customer) =>
        identification &&
        normalizeComparableId(customer.identification) === identification
    ) ??
    customers.find(
      (customer) =>
        customerName && normalizeComparableText(customer.name) === customerName
    ) ??
    null
  );
}

function findMatchingProduct(
  saleItem: CuentiSaleDetail["items"][number],
  products: DeliveryServiceOverview["products"]
) {
  const cuentiProductId = normalizeComparableId(saleItem.cuentiProductId);
  const sku = normalizeComparableId(saleItem.sku);
  const productName = normalizeComparableText(saleItem.name);

  return (
    products.find(
      (product) =>
        cuentiProductId &&
        normalizeComparableId(product.cuentiProductId) === cuentiProductId
    ) ??
    products.find((product) => sku && normalizeComparableId(product.sku) === sku) ??
    products.find(
      (product) => productName && normalizeComparableText(product.name) === productName
    ) ??
    null
  );
}

function buildCuentiErrorMessage(error: unknown) {
  if (error instanceof CuentiIntegrationError) {
    return error.message;
  }

  return error instanceof Error
    ? error.message
    : "No fue posible consultar Cuenti.";
}

function normalizeDateParam(value?: string) {
  const normalized = value?.trim();

  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function normalizeComparableId(value?: string | null) {
  return value
    ?.trim()
    .toLocaleLowerCase("es-CO")
    .replace(/\s/g, "") ?? null;
}

function normalizeComparableText(value?: string | null) {
  const normalized = value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
}

function buildSectionHref(
  section: DomiciliosSection,
  filters: {
    fromDate: string | null;
    sentProductId: string | null;
    status: string;
    toDate: string | null;
  }
) {
  const params = new URLSearchParams();
  params.set("section", section);

  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.toDate) params.set("toDate", filters.toDate);
  if (filters.status) params.set("status", filters.status);
  if (filters.sentProductId) params.set("sentProductId", filters.sentProductId);

  return `/domicilios?${params.toString()}`;
}

function buildCuentiSalesHref(filters: { dateFrom: string; dateTo: string }) {
  const params = new URLSearchParams();
  params.set("section", "ventas");
  params.set("saleFromDate", filters.dateFrom);
  params.set("saleToDate", filters.dateTo);

  return `/domicilios?${params.toString()}`;
}

function buildLoadSaleHref(sale: CuentiSaleSummary) {
  const params = new URLSearchParams();
  params.set("section", "programar");
  params.set("saleRef", sale.cuentiSaleId);

  return `/domicilios?${params.toString()}`;
}

function buildProductsExportHref(filters: {
  fromDate: string | null;
  sentProductId: string | null;
  toDate: string | null;
}) {
  const params = new URLSearchParams();
  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.toDate) params.set("toDate", filters.toDate);
  if (filters.sentProductId) params.set("sentProductId", filters.sentProductId);

  return `/api/domicilios/productos-enviados/export?${params.toString()}`;
}
