import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CustomerSearchSelect } from "@/components/customer-search-select";
import {
  getPendingDeliveryOverview,
  type PendingDeliveryAccount,
  type PendingDeliveryStatusFilter
} from "@/lib/pending-deliveries";
import { requireSalesPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  account_closed: "Ese pendiente ya estaba cerrado.",
  account_not_found: "No se encontro el pendiente.",
  customer_not_found: "Selecciona un cliente valido.",
  delivery_exceeds_remaining: "La entrega supera el saldo pendiente.",
  invalid_date: "La fecha no es valida.",
  invalid_quantity: "La cantidad debe ser mayor a cero.",
  missing_delivery_fields: "Completa pendiente, cantidad y fecha.",
  missing_purchase_fields: "Completa cliente, producto, cantidad y fecha.",
  product_not_found: "Selecciona un producto valido.",
  server_error: "No fue posible guardar el movimiento."
};

const successMessages: Record<string, string> = {
  delivery_saved: "Entrega guardada.",
  purchase_saved: "Compra pendiente guardada."
};

type PendingDeliveryPageProps = {
  searchParams?: {
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
    error?: string;
    productId?: string;
    status?: string;
    success?: string;
  };
};

export default async function PendingDeliveryPage({
  searchParams
}: PendingDeliveryPageProps) {
  requireSalesPage();

  const filters = {
    customerId: normalizeOptionalParam(searchParams?.customerId),
    dateFrom: normalizeOptionalParam(searchParams?.dateFrom),
    dateTo: normalizeOptionalParam(searchParams?.dateTo),
    productId: normalizeOptionalParam(searchParams?.productId),
    status: normalizeStatus(searchParams?.status)
  };
  const overview = await getPendingDeliveryOverview(filters);
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Bogota"
  });
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
      eyebrow="Operacion"
      title="Pendientes por entregar"
    >
      <div className="stats-grid">
        <article className="stat-card">
          <span>Abiertos</span>
          <strong>{overview.stats.openAccounts}</strong>
        </article>
        <article className="stat-card">
          <span>Saldo</span>
          <strong>{formatQuantity(overview.stats.pendingQuantity)}</strong>
        </article>
        <article className="stat-card">
          <span>Comprado</span>
          <strong>{formatQuantity(overview.stats.totalPurchased)}</strong>
        </article>
        <article className="stat-card">
          <span>Entregado</span>
          <strong>{formatQuantity(overview.stats.totalDelivered)}</strong>
        </article>
      </div>

      {errorMessage ? <div className="message message-error">{errorMessage}</div> : null}
      {successMessage ? (
        <div className="message message-success">{successMessage}</div>
      ) : null}

      <section className="workspace-panel">
        <div className="panel-headline">
          <strong>Consulta</strong>
          <div className="workspace-actions">
            <Link className="ghost-button" href={buildExportHref(filters)}>
              Exportar
            </Link>
            <Link className="ghost-button" href="/pendientes-entrega">
              Limpiar
            </Link>
          </div>
        </div>

        <form className="stack-form" method="get">
          <div className="split-fields three-fields">
            <CustomerSearchSelect
              customers={overview.customerOptions}
              defaultValue={filters.customerId}
              helperText="Dejalo vacio para consultar todos los clientes."
              placeholder="Todos los clientes"
            />

            <label className="field">
              <span>Producto</span>
              <select defaultValue={filters.productId ?? ""} name="productId">
                <option value="">Todos</option>
                {overview.productOptions.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Estado</span>
              <select defaultValue={filters.status} name="status">
                <option value="OPEN">Abiertos</option>
                <option value="COMPLETED">Cerrados</option>
                <option value="ALL">Todos</option>
              </select>
            </label>
          </div>

          <div className="split-fields three-fields">
            <label className="field">
              <span>Desde</span>
              <input defaultValue={filters.dateFrom ?? ""} name="dateFrom" type="date" />
            </label>

            <label className="field">
              <span>Hasta</span>
              <input defaultValue={filters.dateTo ?? ""} name="dateTo" type="date" />
            </label>

            <button className="primary-button" type="submit">
              Filtrar
            </button>
          </div>
        </form>
      </section>

      <section className="panel-grid panel-grid-two">
        <article className="workspace-panel">
          <div className="panel-headline">
            <strong>Nueva compra pendiente</strong>
          </div>

          <form action="/api/pending-deliveries/purchases" className="stack-form" method="post">
            <div className="split-fields">
              <CustomerSearchSelect
                customers={overview.customerOptions}
                disabled={overview.customerOptions.length === 0}
                required
              />

              <label className="field">
                <span>Producto</span>
                <select
                  defaultValue=""
                  disabled={overview.productOptions.length === 0}
                  name="productId"
                  required
                >
                  <option value="">Seleccionar</option>
                  {overview.productOptions.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="split-fields">
              <label className="field">
                <span>Cantidad</span>
                <input
                  inputMode="decimal"
                  min="0.01"
                  name="quantity"
                  required
                  step="0.01"
                  type="number"
                />
              </label>

              <label className="field">
                <span>Fecha</span>
                <input defaultValue={today} name="movementOn" required type="date" />
              </label>
            </div>

            <label className="field">
              <span>Nota</span>
              <textarea name="notes" rows={2} />
            </label>

            <button
              className="primary-button"
              disabled={
                overview.customerOptions.length === 0 || overview.productOptions.length === 0
              }
              type="submit"
            >
              Guardar compra
            </button>
          </form>

          {overview.customerOptions.length === 0 || overview.productOptions.length === 0 ? (
            <div className="message message-error">
              Necesitas clientes y productos activos para crear compras pendientes.
            </div>
          ) : null}
        </article>

        <article className="workspace-panel">
          <div className="panel-headline">
            <strong>Entrega parcial</strong>
          </div>

          <form action="/api/pending-deliveries/deliveries" className="stack-form" method="post">
            <label className="field">
              <span>Pendiente</span>
              <select
                defaultValue=""
                disabled={overview.openAccounts.length === 0}
                name="accountId"
                required
              >
                <option value="">Seleccionar</option>
                {overview.openAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {buildAccountLabel(account)}
                  </option>
                ))}
              </select>
            </label>

            <div className="split-fields">
              <label className="field">
                <span>Cantidad</span>
                <input
                  inputMode="decimal"
                  min="0.01"
                  name="quantity"
                  required
                  step="0.01"
                  type="number"
                />
              </label>

              <label className="field">
                <span>Fecha</span>
                <input defaultValue={today} name="movementOn" required type="date" />
              </label>
            </div>

            <label className="field">
              <span>Nota</span>
              <textarea name="notes" rows={2} />
            </label>

            <button
              className="primary-button"
              disabled={overview.openAccounts.length === 0}
              type="submit"
            >
              Guardar entrega
            </button>
          </form>
        </article>
      </section>

      <section className="panel-grid panel-grid-two">
        <article className="workspace-panel">
          <div className="panel-headline">
            <strong>Abiertos</strong>
          </div>

          <div className="entity-grid">
            {overview.openAccounts.length === 0 ? (
              <div className="empty-card">Sin pendientes abiertos.</div>
            ) : (
              overview.openAccounts.map((account) => (
                <PendingAccountCard account={account} key={account.id} />
              ))
            )}
          </div>
        </article>

        <article className="workspace-panel">
          <div className="panel-headline">
            <strong>Cerrados</strong>
          </div>

          <div className="entity-grid">
            {overview.completedAccounts.length === 0 ? (
              <div className="empty-card">Sin pendientes cerrados en la consulta.</div>
            ) : (
              overview.completedAccounts.map((account) => (
                <PendingAccountCard account={account} key={account.id} />
              ))
            )}
          </div>
        </article>
      </section>

      <section className="workspace-panel">
        <div className="panel-headline">
          <strong>Movimientos</strong>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentMovements.length === 0 ? (
                <tr>
                  <td colSpan={6}>Sin movimientos para esta consulta.</td>
                </tr>
              ) : (
                overview.recentMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatDate(movement.movementOn)}</td>
                    <td>{movement.movementType === "PURCHASE" ? "Compra" : "Entrega"}</td>
                    <td>{movement.customerName}</td>
                    <td>{movement.productName}</td>
                    <td>{formatQuantity(movement.quantity)}</td>
                    <td>{movement.notes || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="workspace-panel">
          <div className="panel-headline">
            <strong>Resumen por producto</strong>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Abiertos</th>
                  <th>Cerrados</th>
                  <th>Comprado</th>
                  <th>Entregado</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {overview.productSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Sin productos para esta consulta.</td>
                  </tr>
                ) : (
                  overview.productSummaries.map((summary) => (
                    <tr key={`${summary.productName}-${summary.unitName}`}>
                      <td>
                        <strong>{summary.productName}</strong>
                        <span className="table-muted">{summary.unitName}</span>
                      </td>
                      <td>{summary.openAccounts}</td>
                      <td>{summary.completedAccounts}</td>
                      <td>{formatQuantity(summary.totalPurchased)}</td>
                      <td>{formatQuantity(summary.totalDelivered)}</td>
                      <td>{formatQuantity(summary.pendingQuantity)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
      </section>
    </AppShell>
  );
}

function buildAccountLabel(account: PendingDeliveryAccount) {
  return `${account.customerName} - ${account.productName} | ${formatQuantity(
    account.remainingQty
  )}`;
}

function PendingAccountCard({ account }: { account: PendingDeliveryAccount }) {
  const deliveredPercent =
    account.totalPurchasedQty === 0
      ? 0
      : Math.min(
          100,
          Math.round((account.totalDeliveredQty / account.totalPurchasedQty) * 100)
        );

  return (
    <article className="entity-card">
      <div className="entity-card-head">
        <strong>{account.customerName}</strong>
        <span className="status-chip">
          {account.status === "OPEN" ? "Abierto" : "Cerrado"}
        </span>
      </div>
      <span className="entity-subtitle">{account.productName}</span>
      <div className="entity-figure">{formatQuantity(account.remainingQty)}</div>
      <div className="progress-track">
        <div className="progress-bar" style={{ width: `${deliveredPercent}%` }} />
      </div>
      <div className="meta-stack">
        <span>Comprado: {formatQuantity(account.totalPurchasedQty)}</span>
        <span>Entregado: {formatQuantity(account.totalDeliveredQty)}</span>
        <span>Ultimo movimiento: {formatDate(account.lastMovementOn)}</span>
      </div>
    </article>
  );
}

function normalizeOptionalParam(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeStatus(value?: string): PendingDeliveryStatusFilter {
  if (value === "COMPLETED" || value === "ALL") return value;
  return "OPEN";
}

function buildExportHref(filters: {
  customerId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  productId: string | null;
  status: PendingDeliveryStatusFilter;
}) {
  const params = new URLSearchParams();
  params.set("status", filters.status);

  if (filters.customerId) params.set("customerId", filters.customerId);
  if (filters.productId) params.set("productId", filters.productId);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);

  return `/api/pending-deliveries/export?${params.toString()}`;
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2
  }).format(value);
}

function formatDate(dateValue: Date | string | null) {
  if (!dateValue) return "-";

  const normalizedDate =
    dateValue instanceof Date
      ? dateValue.toISOString().slice(0, 10)
      : String(dateValue).slice(0, 10);
  const [year, month, day] = normalizedDate.split("-").map(Number);

  if (!year || !month || !day) return "-";

  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(date);
}
