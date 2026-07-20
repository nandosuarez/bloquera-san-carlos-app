import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireOperationsPage } from "@/lib/permissions";
import { getRangeReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

type ReportsPageProps = {
  searchParams?: {
    dateFrom?: string;
    dateTo?: string;
  };
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  requireOperationsPage();
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Bogota"
  });
  const monthStart = `${today.slice(0, 8)}01`;
  const dateFrom = normalizeDate(searchParams?.dateFrom) ?? monthStart;
  const dateTo = normalizeDate(searchParams?.dateTo) ?? today;
  const report = await getRangeReport({ dateFrom, dateTo });

  return (
    <AppShell
      actions={
        <form action="/api/auth/logout" method="post">
          <button className="ghost-button" type="submit">
            Cerrar sesion
          </button>
        </form>
      }
      eyebrow="Analisis"
      title="Reportes"
    >
      <section className="workspace-panel">
        <div className="panel-headline">
          <strong>Consulta general</strong>
          <a className="ghost-button" href="/api/backup/export">
            Descargar backup CSV
          </a>
        </div>

        <form className="stack-form" method="get">
          <div className="split-fields">
            <label className="field">
              <span>Desde</span>
              <input defaultValue={dateFrom} name="dateFrom" type="date" />
            </label>
            <label className="field">
              <span>Hasta</span>
              <input defaultValue={dateTo} name="dateTo" type="date" />
            </label>
          </div>
          <button className="primary-button" type="submit">
            Consultar
          </button>
        </form>
      </section>

      <div className="stats-grid stats-grid-summary">
        <article className="stat-card">
          <span>Domicilios completados</span>
          <strong>{report.completedServices}</strong>
        </article>
        <article className="stat-card">
          <span>Viajes</span>
          <strong>{report.totalDeliveryTrips}</strong>
        </article>
        <article className="stat-card">
          <span>Transporte</span>
          <strong>{formatMoney(report.totalTransportCost)}</strong>
        </article>
        <article className="stat-card">
          <span>Bloques hechos</span>
          <strong>{formatQuantity(report.producedBlocks)}</strong>
        </article>
        <article className="stat-card">
          <span>Pendientes abiertos</span>
          <strong>{report.openPendingAccounts}</strong>
        </article>
        <article className="stat-card">
          <span>Saldo pendiente</span>
          <strong>{formatQuantity(report.totalPendingQty)}</strong>
        </article>
      </div>

      <section className="workspace-panel">
        <div className="panel-headline">
          <strong>Productos enviados en el rango</strong>
          <Link className="ghost-button" href="/domicilios?section=productos">
            Ir a detalle
          </Link>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Viajes</th>
              </tr>
            </thead>
            <tbody>
              {report.topProducts.length === 0 ? (
                <tr>
                  <td colSpan={3}>Sin productos enviados en el rango.</td>
                </tr>
              ) : (
                report.topProducts.map((product) => (
                  <tr key={`${product.productName}-${product.unitName}`}>
                    <td>{product.productName}</td>
                    <td>
                      {formatQuantity(product.totalQuantity)} {product.unitName}
                    </td>
                    <td>{product.totalTrips}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="workspace-panel">
        <div className="panel-headline">
          <strong>Auditoria reciente</strong>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Accion</th>
                <th>Entidad</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {report.auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5}>Sin actividad reciente registrada.</td>
                </tr>
              ) : (
                report.auditLogs.map((log, index) => (
                  <tr key={`${log.createdAt.toISOString()}-${index}`}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>{log.actorName ?? "-"}</td>
                    <td>{log.action}</td>
                    <td>{log.entityType}</td>
                    <td>{log.summary ?? "-"}</td>
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

function normalizeDate(value?: string) {
  const normalized = value?.trim();
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

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bogota"
  }).format(value);
}
