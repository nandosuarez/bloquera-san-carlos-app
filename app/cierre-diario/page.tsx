import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireOperationsPage } from "@/lib/permissions";
import { getDailyClosing } from "@/lib/reports";

export const dynamic = "force-dynamic";

type DailyClosingPageProps = {
  searchParams?: {
    date?: string;
  };
};

export default async function DailyClosingPage({ searchParams }: DailyClosingPageProps) {
  requireOperationsPage();
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Bogota"
  });
  const date = normalizeDate(searchParams?.date) ?? today;
  const closing = await getDailyClosing(date);

  return (
    <AppShell
      actions={
        <form action="/api/auth/logout" method="post">
          <button className="ghost-button" type="submit">
            Cerrar sesion
          </button>
        </form>
      }
      eyebrow="Control"
      title="Cierre diario"
    >
      <section className="workspace-panel">
        <div className="panel-headline">
          <strong>Dia a revisar</strong>
          <Link className="ghost-button" href="/reportes">
            Ver reportes
          </Link>
        </div>

        <form className="stack-form" method="get">
          <div className="split-fields">
            <label className="field">
              <span>Fecha</span>
              <input defaultValue={date} name="date" type="date" />
            </label>
          </div>
          <button className="primary-button" type="submit">
            Consultar cierre
          </button>
        </form>
      </section>

      <div className="stats-grid stats-grid-summary">
        <article className="stat-card">
          <span>Programados</span>
          <strong>{closing.programmedServices}</strong>
        </article>
        <article className="stat-card">
          <span>Iniciados</span>
          <strong>{closing.startedServices}</strong>
        </article>
        <article className="stat-card">
          <span>Completados</span>
          <strong>{closing.completedServices}</strong>
        </article>
        <article className="stat-card">
          <span>Anulados</span>
          <strong>{closing.canceledServices}</strong>
        </article>
        <article className="stat-card">
          <span>Viajes</span>
          <strong>{closing.totalDeliveryTrips}</strong>
        </article>
        <article className="stat-card">
          <span>Transporte</span>
          <strong>{formatMoney(closing.totalTransportCost)}</strong>
        </article>
        <article className="stat-card">
          <span>Bloques hechos</span>
          <strong>{formatQuantity(closing.producedBlocks)}</strong>
        </article>
        <article className="stat-card">
          <span>Pendientes abiertos</span>
          <strong>{closing.pendingAccounts}</strong>
        </article>
      </div>
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
