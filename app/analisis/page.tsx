import type { CSSProperties } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  getAnalyticsAvailableRange,
  getManagementAnalytics,
  type ManagementSummary
} from "@/lib/management-analytics";
import { requireAdminPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type AnalyticsPageProps = {
  searchParams?: {
    dateFrom?: string;
    dateTo?: string;
    targetMargin?: string;
  };
};

export default async function AnalyticsPage({
  searchParams
}: AnalyticsPageProps) {
  requireAdminPage();
  const today = getBogotaDate();
  const availableRange = await getAnalyticsAvailableRange();
  const latestAvailableDate = availableRange.dateTo ?? today;
  const defaultDateFrom = `${latestAvailableDate.slice(0, 8)}01`;
  const requestedDateFrom = normalizeDate(searchParams?.dateFrom);
  const requestedDateTo = normalizeDate(searchParams?.dateTo);
  const dateFrom = requestedDateFrom ?? defaultDateFrom;
  const dateToCandidate = requestedDateTo ?? latestAvailableDate;
  const dateTo = dateToCandidate >= dateFrom ? dateToCandidate : dateFrom;
  const targetMargin = normalizeTargetMargin(searchParams?.targetMargin);
  const analytics = await getManagementAnalytics({
    dateFrom,
    dateTo,
    targetMargin
  });
  const maxDailySales = Math.max(
    ...analytics.dailySales.map((day) => day.netAmount),
    0
  );

  return (
    <AppShell
      actions={
        <form action="/api/auth/logout" method="post">
          <button className="ghost-button" type="submit">
            Cerrar sesion
          </button>
        </form>
      }
      eyebrow="Gerencia"
      title="Analisis comercial"
    >
      <section className="workspace-panel analytics-filter-panel">
        <div className="panel-headline">
          <strong>Periodo de analisis</strong>
          {availableRange.dateFrom && availableRange.dateTo ? (
            <span className="table-muted analytics-available-range">
              Disponible: {formatDate(availableRange.dateFrom)} a{" "}
              {formatDate(availableRange.dateTo)}
            </span>
          ) : null}
        </div>

        <form className="analytics-filter-form" method="get">
          <label className="field">
            <span>Desde</span>
            <input defaultValue={dateFrom} name="dateFrom" type="date" />
          </label>
          <label className="field">
            <span>Hasta</span>
            <input defaultValue={dateTo} name="dateTo" type="date" />
          </label>
          <label className="field">
            <span>Margen objetivo</span>
            <div className="analytics-percent-input">
              <input
                defaultValue={formatPlainNumber(targetMargin * 100)}
                max="80"
                min="0"
                name="targetMargin"
                step="0.1"
                type="number"
              />
              <span>%</span>
            </div>
          </label>
          <button className="primary-button" type="submit">
            Analizar
          </button>
        </form>
      </section>

      {analytics.summary.invoiceCount === 0 ? (
        <section className="analytics-empty-state">
          <span className="analytics-empty-mark">SC</span>
          <div>
            <strong>La bodega aun no tiene ventas en este periodo</strong>
            <p>
              Inicia o continua la sincronizacion desde Cuenti para construir el
              analisis.
            </p>
          </div>
          <Link
            className="primary-button"
            href="/administracion?section=cuenti"
          >
            Ir a sincronizacion
          </Link>
        </section>
      ) : null}

      <section className="analytics-kpi-grid">
        <AnalyticsKpi
          comparison={calculateChange(
            analytics.summary.netAmount,
            analytics.previousSummary.netAmount
          )}
          label="Ventas netas"
          value={formatMoney(analytics.summary.netAmount)}
        />
        <AnalyticsKpi
          comparison={calculateChange(
            analytics.summary.grossProfit,
            analytics.previousSummary.grossProfit
          )}
          label="Utilidad bruta"
          tone={analytics.summary.grossProfit < 0 ? "danger" : "success"}
          value={formatMoney(analytics.summary.grossProfit)}
        />
        <AnalyticsKpi
          comparison={calculateMarginChange(
            analytics.summary,
            analytics.previousSummary
          )}
          label="Margen bruto"
          tone={getMarginTone(
            analytics.summary.marginPercent,
            analytics.targetMargin
          )}
          value={formatPercent(analytics.summary.marginPercent)}
        />
        <AnalyticsKpi
          comparison={calculateChange(
            analytics.summary.invoiceCount,
            analytics.previousSummary.invoiceCount
          )}
          label="Facturas"
          value={formatQuantity(analytics.summary.invoiceCount)}
        />
        <AnalyticsKpi
          comparison={calculateChange(
            analytics.summary.averageTicket,
            analytics.previousSummary.averageTicket
          )}
          label="Ticket promedio"
          value={formatMoney(analytics.summary.averageTicket)}
        />
        <AnalyticsKpi
          comparison={calculateChange(
            analytics.summary.unitsSold,
            analytics.previousSummary.unitsSold
          )}
          label="Unidades vendidas"
          value={formatQuantity(analytics.summary.unitsSold)}
        />
      </section>

      <div className="analytics-section-heading">
        <div>
          <span>Resultado integral</span>
          <strong>Finanzas, caja e inventario</strong>
        </div>
      </div>

      <section className="analytics-kpi-grid">
        <AnalyticsKpi
          detail="Utilidad bruta menos gastos operativos"
          label="Utilidad operativa"
          tone={analytics.financial.operatingProfit < 0 ? "danger" : "success"}
          value={formatMoney(analytics.financial.operatingProfit)}
        />
        <AnalyticsKpi
          detail="Incluye transporte y gastos generales"
          label="Gastos operativos"
          tone="warning"
          value={formatMoney(analytics.financial.operatingExpenses)}
        />
        <AnalyticsKpi
          detail="Pagos de entrada identificados"
          label="Entradas de caja"
          tone="success"
          value={formatMoney(analytics.financial.cashIn)}
        />
        <AnalyticsKpi
          detail="Pagos de salida identificados"
          label="Salidas de caja"
          tone="danger"
          value={formatMoney(analytics.financial.cashOut)}
        />
        <AnalyticsKpi
          detail={`${analytics.financial.purchaseCount} compras cargadas`}
          label="Compras"
          value={formatMoney(analytics.financial.purchaseAmount)}
        />
        <AnalyticsKpi
          detail={`${formatQuantity(
            analytics.financial.stockUnits
          )} unidades en ${analytics.financial.stockProducts} productos`}
          label="Valor inventario"
          value={formatMoney(analytics.financial.stockValue)}
        />
      </section>

      <div className="analytics-overview-grid">
        <section className="workspace-panel">
          <div className="panel-headline">
            <strong>Gastos por categoria</strong>
          </div>
          {analytics.financial.expenseBreakdown.length === 0 ? (
            <p className="analytics-table-empty">Sin gastos en el periodo.</p>
          ) : (
            <div className="analytics-financial-list">
              {analytics.financial.expenseBreakdown.map((expense) => (
                <div className="analytics-financial-row" key={expense.category}>
                  <div>
                    <strong>{formatExpenseCategory(expense.category)}</strong>
                    <span>{expense.records} movimientos</span>
                  </div>
                  <b>{formatMoney(expense.amount)}</b>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="workspace-panel">
          <div className="panel-headline">
            <strong>Movimientos de caja</strong>
          </div>
          {analytics.financial.paymentBreakdown.length === 0 ? (
            <p className="analytics-table-empty">
              Sin pagos sincronizados en el periodo.
            </p>
          ) : (
            <div className="analytics-financial-list">
              {analytics.financial.paymentBreakdown.map((payment) => (
                <div className="analytics-financial-row" key={payment.direction}>
                  <div>
                    <strong>{formatPaymentDirection(payment.direction)}</strong>
                    <span>{payment.records} movimientos</span>
                  </div>
                  <b>{formatMoney(payment.amount)}</b>
                </div>
              ))}
            </div>
          )}
          {analytics.financial.unknownCash > 0 ? (
            <p className="analytics-footnote">
              Hay {formatMoney(analytics.financial.unknownCash)} pendientes de
              clasificar como entrada o salida según la respuesta de Cuenti.
            </p>
          ) : null}
        </section>
      </div>

      <section className="workspace-panel">
        <div className="panel-headline">
          <strong>Inventario de Cuenti</strong>
          <span className="table-muted">Ultima fotografia disponible</span>
        </div>
        <div className="table-wrap analytics-table-wrap">
          <table className="data-table analytics-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Existencia</th>
                <th>Minimo</th>
                <th>Costo</th>
                <th>Valor</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {analytics.financial.inventory.length === 0 ? (
                <tr>
                  <td colSpan={6}>Aun no hay fotografias de inventario.</td>
                </tr>
              ) : (
                analytics.financial.inventory.map((product) => {
                  const needsStock = product.quantity <= product.minStockQty;

                  return (
                    <tr key={`${product.name}-${product.sku ?? ""}`}>
                      <td>
                        <strong>{product.name}</strong>
                        {product.sku ? (
                          <span className="table-meta">{product.sku}</span>
                        ) : null}
                      </td>
                      <td>{formatQuantity(product.quantity)}</td>
                      <td>{formatQuantity(product.minStockQty)}</td>
                      <td>{formatMoney(product.unitCost)}</td>
                      <td>{formatMoney(product.inventoryValue)}</td>
                      <td>
                        <span
                          className={`margin-chip ${
                            needsStock
                              ? "margin-chip-warning"
                              : "margin-chip-success"
                          }`}
                        >
                          {needsStock ? "Reponer" : "Disponible"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="analytics-overview-grid">
        <section className="workspace-panel analytics-chart-panel">
          <div className="panel-headline">
            <strong>Ventas diarias</strong>
            <span className="status-chip">
              {analytics.dailySales.length} dias
            </span>
          </div>

          {analytics.dailySales.length === 0 ? (
            <p className="analytics-table-empty">
              Sin ventas diarias para representar.
            </p>
          ) : (
            <div
              className="analytics-chart-scroll"
              style={
                {
                  "--analytics-days": Math.max(
                    analytics.dailySales.length,
                    7
                  )
                } as CSSProperties
              }
            >
              <div className="analytics-bars">
                {analytics.dailySales.map((day) => (
                  <div className="analytics-bar-column" key={day.saleOn}>
                    <span className="analytics-bar-value">
                      {formatCompactMoney(day.netAmount)}
                    </span>
                    <div className="analytics-bar-track">
                      <div
                        aria-label={`${formatDate(day.saleOn)}: ${formatMoney(
                          day.netAmount
                        )}`}
                        className="analytics-bar-fill"
                        style={{
                          height: `${getBarHeight(
                            day.netAmount,
                            maxDailySales
                          )}%`
                        }}
                        title={`${formatDate(day.saleOn)} - ${formatMoney(
                          day.netAmount
                        )}`}
                      />
                    </div>
                    <strong>{formatDay(day.saleOn)}</strong>
                    <small>{day.transactionCount} fact.</small>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="workspace-panel analytics-quality-panel">
          <div className="panel-headline">
            <strong>Calidad del dato</strong>
          </div>
          <QualityItem
            label="Lineas sin costo"
            value={analytics.quality.linesWithoutCost}
          />
          <QualityItem
            label="Facturas descuadradas"
            value={analytics.quality.unreconciledInvoices}
          />
          <QualityItem
            label="Facturas sin productos"
            value={analytics.quality.invoicesWithoutItems}
          />
          <QualityItem
            label="Facturas anuladas"
            neutral
            value={analytics.quality.voidedInvoices}
          />
        </section>
      </div>

      <section className="workspace-panel">
        <div className="panel-headline">
          <strong>Desempeno por linea</strong>
          <span className="table-muted">Participacion en ventas netas</span>
        </div>
        <div className="analytics-line-grid">
          {analytics.lineMix.length === 0 ? (
            <p className="analytics-table-empty">Sin lineas para mostrar.</p>
          ) : (
            analytics.lineMix.map((line) => (
              <article className="analytics-line-card" key={line.lineName}>
                <div>
                  <strong>{line.lineName}</strong>
                  <span>
                    {formatPercent(
                      analytics.summary.netAmount
                        ? line.netAmount / analytics.summary.netAmount
                        : null
                    )}{" "}
                    de las ventas
                  </span>
                </div>
                <b>{formatMoney(line.netAmount)}</b>
                <div className="analytics-line-meta">
                  <span>{line.transactionCount} facturas</span>
                  <MarginChip
                    margin={line.marginPercent}
                    target={analytics.targetMargin}
                  />
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="workspace-panel">
        <div className="panel-headline">
          <strong>Productos con mayores ventas</strong>
          <span className="table-muted">Top 15 del periodo</span>
        </div>
        <div className="table-wrap analytics-table-wrap">
          <table className="data-table analytics-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Ventas</th>
                <th>Utilidad</th>
                <th>Margen</th>
                <th>Precio prom.</th>
              </tr>
            </thead>
            <tbody>
              {analytics.topProducts.length === 0 ? (
                <tr>
                  <td colSpan={6}>Sin productos vendidos en el periodo.</td>
                </tr>
              ) : (
                analytics.topProducts.map((product) => (
                  <tr key={product.productId}>
                    <td>
                      <strong>{product.name}</strong>
                      <span className="table-meta">
                        {product.productLineName ?? "Sin linea"}
                        {product.sku ? ` | ${product.sku}` : ""}
                      </span>
                    </td>
                    <td>{formatQuantity(product.quantitySold)}</td>
                    <td>{formatMoney(product.netAmount)}</td>
                    <td>{formatMoney(product.grossProfit)}</td>
                    <td>
                      {product.linesWithoutCost > 0 ? (
                        <span className="margin-chip margin-chip-warning">
                          Falta costo
                        </span>
                      ) : (
                        <MarginChip
                          margin={product.marginPercent}
                          target={analytics.targetMargin}
                        />
                      )}
                    </td>
                    <td>{formatMoneyOrDash(product.averageGrossUnitPrice)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="workspace-panel analytics-opportunity-panel">
        <div className="panel-headline">
          <div>
            <strong>Oportunidades de precio</strong>
            <span className="table-muted">
              Meta de margen: {formatPercent(analytics.targetMargin)}
            </span>
          </div>
          <span className="status-chip">
            {analytics.priceOpportunities.length} productos
          </span>
        </div>
        <div className="table-wrap analytics-table-wrap">
          <table className="data-table analytics-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Margen actual</th>
                <th>Costo prom.</th>
                <th>Precio vendido</th>
                <th>Precio sugerido</th>
                <th>Oportunidad</th>
              </tr>
            </thead>
            <tbody>
              {analytics.priceOpportunities.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    No hay productos con costo completo por debajo de la meta.
                  </td>
                </tr>
              ) : (
                analytics.priceOpportunities.map((product) => (
                  <tr key={product.productId}>
                    <td>
                      <strong>{product.name}</strong>
                      <span className="table-meta">
                        {product.productLineName ?? "Sin linea"}
                      </span>
                    </td>
                    <td>
                      <MarginChip
                        margin={product.marginPercent}
                        target={analytics.targetMargin}
                      />
                    </td>
                    <td>{formatMoneyOrDash(product.averageUnitCost)}</td>
                    <td>
                      {formatMoneyOrDash(product.averageGrossUnitPrice)}
                      {product.currentSalePrice !== null ? (
                        <span className="table-meta">
                          Actual: {formatMoney(product.currentSalePrice)}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <strong>
                        {formatMoneyOrDash(product.suggestedGrossPrice)}
                      </strong>
                    </td>
                    <td>{formatMoney(product.opportunityAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="analytics-footnote">
          El precio sugerido estima el IVA observado y busca alcanzar el margen
          objetivo. Debe validarse comercialmente antes de cambiarlo en Cuenti.
        </p>
      </section>
    </AppShell>
  );
}

function AnalyticsKpi({
  comparison,
  detail,
  label,
  tone = "default",
  value
}: {
  comparison?: number | null;
  detail?: string;
  label: string;
  tone?: "default" | "danger" | "success" | "warning";
  value: string;
}) {
  return (
    <article className={`analytics-kpi-card analytics-kpi-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
      {comparison !== undefined ? (
        <small className={getTrendClass(comparison)}>
          {formatComparison(comparison)}
        </small>
      ) : null}
    </article>
  );
}

function QualityItem({
  label,
  neutral = false,
  value
}: {
  label: string;
  neutral?: boolean;
  value: number;
}) {
  const isHealthy = value === 0;

  return (
    <div className="analytics-quality-row">
      <span>{label}</span>
      <strong
        className={
          neutral
            ? "analytics-quality-neutral"
            : isHealthy
              ? "analytics-quality-ok"
              : "analytics-quality-alert"
        }
      >
        {formatQuantity(value)}
      </strong>
    </div>
  );
}

function MarginChip({
  margin,
  target
}: {
  margin: number | null;
  target: number;
}) {
  const tone = getMarginTone(margin, target);

  return (
    <span className={`margin-chip margin-chip-${tone}`}>
      {formatPercent(margin)}
    </span>
  );
}

function getMarginTone(
  margin: number | null,
  target: number
): "danger" | "success" | "warning" {
  if (margin === null || margin < 0) return "danger";
  if (margin < target) return "warning";
  return "success";
}

function calculateChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / Math.abs(previous);
}

function calculateMarginChange(
  current: ManagementSummary,
  previous: ManagementSummary
) {
  if (
    current.marginPercent === null ||
    previous.marginPercent === null
  ) {
    return null;
  }

  return current.marginPercent - previous.marginPercent;
}

function getTrendClass(value: number | null) {
  if (value === null || value === 0) return "analytics-trend-neutral";
  return value > 0 ? "analytics-trend-positive" : "analytics-trend-negative";
}

function formatComparison(value: number | null) {
  if (value === null) return "Sin base comparable";
  if (Math.abs(value) < 0.0001) return "Sin cambio vs. periodo anterior";

  return `${value > 0 ? "+" : ""}${formatPercent(value)} vs. periodo anterior`;
}

function normalizeDate(value?: string) {
  const normalized = value?.trim();
  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? normalized
    : null;
}

function normalizeTargetMargin(value?: string) {
  const parsed = Number(value);
  const percent = Number.isFinite(parsed) ? parsed : 15;
  return Math.min(80, Math.max(0, percent)) / 100;
}

function getBogotaDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Bogota"
  }).format(new Date());
}

function getBarHeight(value: number, maximum: number) {
  if (maximum <= 0) return 4;
  return Math.max(4, Math.min(100, (value / maximum) * 100));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    currency: "COP",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatMoneyOrDash(value: number | null) {
  return value === null ? "-" : formatMoney(value);
}

function formatCompactMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    currency: "COP",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency"
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";

  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: "percent"
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2
  }).format(value);
}

function formatExpenseCategory(value: string) {
  const labels: Record<string, string> = {
    OTHER: "Otros",
    PAYROLL: "Nomina",
    RENT: "Arriendo",
    SECURITY: "Seguridad",
    SERVICES: "Servicios",
    SUPPLIES: "Suministros",
    TAX: "Impuestos",
    TRANSPORT: "Transporte"
  };

  return labels[value] ?? value;
}

function formatPaymentDirection(value: "IN" | "OUT" | "UNKNOWN") {
  if (value === "IN") return "Entradas";
  if (value === "OUT") return "Salidas";
  return "Por clasificar";
}

function formatPlainNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    useGrouping: false
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  })
    .format(new Date(`${value}T12:00:00Z`))
    .replace(".", "");
}
