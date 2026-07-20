import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  getTransportCostOverview,
  normalizeCostType,
  type TransportCostType
} from "@/lib/transport-costs";
import { requireOperationsPage } from "@/lib/permissions";
import { listTransportProviders } from "@/lib/transport-providers";
import { listVehicles } from "@/lib/vehicles";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  invalid_amount: "El valor debe ser mayor a cero.",
  invalid_date: "La fecha no es valida.",
  missing_transport_cost_fields: "Completa fecha, carro, proveedor, tipo, concepto y valor.",
  provider_not_found: "Selecciona un proveedor activo.",
  server_error: "No fue posible guardar el costo.",
  transport_cost_not_found: "El costo no existe o ya fue anulado.",
  vehicle_not_found: "Selecciona un carro activo."
};

const successMessages: Record<string, string> = {
  transport_cost_saved: "Costo de transporte guardado.",
  transport_cost_voided: "Costo de transporte anulado."
};

type TransportCostsPageProps = {
  searchParams?: {
    costType?: string;
    dateFrom?: string;
    dateTo?: string;
    error?: string;
    success?: string;
    vehicleId?: string;
  };
};

export default async function TransportCostsPage({
  searchParams
}: TransportCostsPageProps) {
  requireOperationsPage();

  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Bogota"
  });
  const monthStart = `${today.slice(0, 8)}01`;
  const filters = {
    costType: normalizeCostType(searchParams?.costType),
    dateFrom: normalizeDateParam(searchParams?.dateFrom) ?? monthStart,
    dateTo: normalizeDateParam(searchParams?.dateTo) ?? today,
    vehicleId: normalizeOptionalParam(searchParams?.vehicleId)
  };
  const [overview, vehicles, providers] = await Promise.all([
    getTransportCostOverview(filters),
    listVehicles(),
    listTransportProviders()
  ]);
  const activeVehicles = vehicles.filter((vehicle) => vehicle.isActive);
  const activeProviders = providers.filter((provider) => provider.isActive);
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
      title="Costos de transporte"
    >
      <div className="stats-grid">
        <article className="stat-card">
          <span>Registros</span>
          <strong>{overview.stats.records}</strong>
        </article>
        <article className="stat-card">
          <span>Total</span>
          <strong>{formatMoney(overview.stats.totalCost)}</strong>
        </article>
        <article className="stat-card">
          <span>Combustible</span>
          <strong>{formatMoney(overview.stats.fuelTotal)}</strong>
        </article>
        <article className="stat-card">
          <span>Mantenimiento</span>
          <strong>{formatMoney(overview.stats.maintenanceTotal)}</strong>
        </article>
        <article className="stat-card">
          <span>Reparacion</span>
          <strong>{formatMoney(overview.stats.repairTotal)}</strong>
        </article>
      </div>

      {errorMessage ? <div className="message message-error">{errorMessage}</div> : null}
      {successMessage ? (
        <div className="message message-success">{successMessage}</div>
      ) : null}

      <section className="panel-grid panel-grid-two">
        <article className="workspace-panel">
          <div className="panel-headline">
            <strong>Registrar costo</strong>
          </div>

          <form action="/api/transport-costs" className="stack-form" method="post">
            <div className="split-fields">
              <label className="field">
                <span>Fecha</span>
                <input defaultValue={today} name="costOn" required type="date" />
              </label>

              <label className="field">
                <span>Carro</span>
                <select defaultValue="" name="vehicleId" required>
                  <option value="">Seleccionar</option>
                  {activeVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.label}
                      {vehicle.plate ? ` - ${vehicle.plate}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="split-fields">
              <label className="field">
                <span>Tipo</span>
                <select defaultValue="FUEL" name="costType" required>
                  <option value="FUEL">Combustible</option>
                  <option value="MAINTENANCE">Mantenimiento</option>
                  <option value="REPAIR">Reparacion</option>
                </select>
              </label>

              <label className="field">
                <span>Concepto</span>
                <input name="concept" placeholder="ACPM, aceite, llanta..." required type="text" />
              </label>
            </div>

            <div className="split-fields">
              <label className="field">
                <span>Valor total</span>
                <input min="0.01" name="totalCost" required step="0.01" type="number" />
              </label>

              <label className="field">
                <span>Proveedor</span>
                <select defaultValue="" name="providerId" required>
                  <option value="">Seleccionar</option>
                  {activeProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field">
              <span>Nota</span>
              <textarea name="notes" rows={2} />
            </label>

            <button
              className="primary-button"
              disabled={activeVehicles.length === 0 || activeProviders.length === 0}
              type="submit"
            >
              Guardar costo
            </button>
          </form>

          {activeVehicles.length === 0 ? (
            <div className="message message-error">
              Primero crea un carro activo en Administracion &gt; Carros.
            </div>
          ) : null}
          {activeProviders.length === 0 ? (
            <div className="message message-error">
              Primero crea un proveedor en Administracion &gt; Proveedores.
            </div>
          ) : null}
        </article>

        <article className="workspace-panel">
          <div className="panel-headline">
            <strong>Consulta</strong>
            <Link className="ghost-button" href="/costos-transporte">
              Limpiar
            </Link>
          </div>

          <form className="stack-form" method="get">
            <div className="split-fields">
              <label className="field">
                <span>Desde</span>
                <input defaultValue={filters.dateFrom ?? ""} name="dateFrom" type="date" />
              </label>

              <label className="field">
                <span>Hasta</span>
                <input defaultValue={filters.dateTo ?? ""} name="dateTo" type="date" />
              </label>
            </div>

            <div className="split-fields">
              <label className="field">
                <span>Carro</span>
                <select defaultValue={filters.vehicleId ?? ""} name="vehicleId">
                  <option value="">Todos</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.label}
                      {vehicle.plate ? ` - ${vehicle.plate}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Tipo</span>
                <select defaultValue={filters.costType ?? "ALL"} name="costType">
                  <option value="ALL">Todos</option>
                  <option value="FUEL">Combustible</option>
                  <option value="MAINTENANCE">Mantenimiento</option>
                  <option value="REPAIR">Reparacion</option>
                </select>
              </label>
            </div>

            <button className="primary-button" type="submit">
              Filtrar
            </button>
          </form>
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
                <th>Carro</th>
                <th>Tipo</th>
                <th>Concepto</th>
                <th>Proveedor</th>
                <th>Total</th>
                <th>Nota</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {overview.costs.length === 0 ? (
                <tr>
                  <td colSpan={8}>Sin costos para esta consulta.</td>
                </tr>
              ) : (
                overview.costs.map((cost) => (
                  <tr key={cost.id}>
                    <td>{formatDate(cost.costOn)}</td>
                    <td>{cost.vehicleLabel}</td>
                    <td>{formatCostType(cost.costType)}</td>
                    <td>{cost.concept}</td>
                    <td>{cost.providerName ?? "-"}</td>
                    <td>{formatMoney(cost.totalCost)}</td>
                    <td>{cost.notes ?? "-"}</td>
                    <td>
                      <form action="/api/transport-costs" className="inline-action-form" method="post">
                        <input name="action" type="hidden" value="void" />
                        <input name="costId" type="hidden" value={cost.id} />
                        <input name="reason" placeholder="Motivo" type="text" />
                        <button className="ghost-button" type="submit">
                          Anular
                        </button>
                      </form>
                    </td>
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

function normalizeOptionalParam(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeDateParam(value?: string) {
  const normalized = normalizeOptionalParam(value);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  return normalized;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    currency: "COP",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2
  }).format(value);
}

function formatDate(dateValue: string | Date) {
  const normalized =
    typeof dateValue === "string"
      ? dateValue.slice(0, 10)
      : dateValue.toISOString().slice(0, 10);
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(date);
}

function formatCostType(value: TransportCostType) {
  if (value === "FUEL") return "Combustible";
  if (value === "MAINTENANCE") return "Mantenimiento";
  return "Reparacion";
}
