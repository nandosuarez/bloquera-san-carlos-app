import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getHomeStats } from "@/lib/operations";
import { requireSession } from "@/lib/protected-page";

const quickLinks = [
  { href: "/domicilios", label: "Domicilios" },
  { href: "/pendientes-entrega", label: "Pendientes" },
  { href: "/calculadora-cemento", label: "Calculadora cemento" },
  { href: "/insumos", label: "Insumos" },
  { href: "/produccion-bloques", label: "Produccion" },
  { href: "/inventario", label: "Inventario" },
  { href: "/pagos-bloques", label: "Pagos bloques" },
  { href: "/cierre-diario", label: "Cierre diario" },
  { href: "/reportes", label: "Reportes" },
  { href: "/administracion", label: "Administracion" }
];

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: {
    error?: string;
  };
};

export default async function HomePage({ searchParams }: HomePageProps) {
  requireSession();
  const stats = await getHomeStats();
  const errorMessage =
    searchParams?.error === "forbidden"
      ? "Tu usuario no tiene permiso para entrar a ese modulo."
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
      eyebrow="Bloquera San Carlos"
      title="Inicio"
    >
      {errorMessage ? <div className="message message-error">{errorMessage}</div> : null}

      <div className="stats-grid">
        <article className="stat-card">
          <span>Pendientes</span>
          <strong>{stats.openPending}</strong>
        </article>

        <article className="stat-card">
          <span>Clientes</span>
          <strong>{stats.activeCustomers}</strong>
        </article>

        <article className="stat-card">
          <span>Productos</span>
          <strong>{stats.products}</strong>
        </article>

        <article className="stat-card">
          <span>Colaboradores</span>
          <strong>{stats.activeCollaborators}</strong>
        </article>

        <article className="stat-card">
          <span>Bloques</span>
          <strong>{stats.blockProducts}</strong>
        </article>

        <article className="stat-card">
          <span>Produccion hoy</span>
          <strong>{stats.todayBatches}</strong>
        </article>
      </div>

      <section className="cards-grid cards-grid-four">
        {quickLinks.map((item) => (
          <Link className="action-card" href={item.href} key={item.href}>
            <span className="action-card-label">Modulo</span>
            <strong>{item.label}</strong>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}
