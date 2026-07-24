import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  getOperatingExpenseOverview,
  normalizeExpenseCategory,
  type OperatingExpenseCategory
} from "@/lib/operating-expenses";
import { requireOperationsPage } from "@/lib/permissions";
import { listTransportProviders } from "@/lib/transport-providers";

export const dynamic = "force-dynamic";

const categoryLabels: Record<OperatingExpenseCategory, string> = {
  OTHER: "Otro",
  PAYROLL: "Nomina",
  RENT: "Arriendo",
  SECURITY: "Seguridad",
  SERVICES: "Servicios",
  SUPPLIES: "Suministros",
  TAX: "Impuestos"
};

type ExpensesPageProps = {
  searchParams?: {
    category?: string;
    dateFrom?: string;
    dateTo?: string;
    error?: string;
    success?: string;
  };
};

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  requireOperationsPage();
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Bogota"
  });
  const filters = {
    category: normalizeExpenseCategory(searchParams?.category),
    dateFrom: normalizeDate(searchParams?.dateFrom) ?? `${today.slice(0, 8)}01`,
    dateTo: normalizeDate(searchParams?.dateTo) ?? today
  };
  const [overview, providers] = await Promise.all([
    getOperatingExpenseOverview(filters),
    listTransportProviders()
  ]);
  const activeProviders = providers.filter((provider) => provider.isActive);
  const errorMessage = getErrorMessage(searchParams?.error);

  return (
    <AppShell
      actions={
        <form action="/api/auth/logout" method="post">
          <button className="ghost-button" type="submit">
            Cerrar sesion
          </button>
        </form>
      }
      eyebrow="Finanzas"
      title="Gastos"
    >
      <div className="stats-grid">
        <article className="stat-card">
          <span>Registros</span>
          <strong>{overview.stats.records}</strong>
        </article>
        <article className="stat-card">
          <span>Total del periodo</span>
          <strong>{formatMoney(overview.stats.total)}</strong>
        </article>
        {overview.byCategory.slice(0, 3).map((item) => (
          <article className="stat-card" key={item.category}>
            <span>{categoryLabels[item.category]}</span>
            <strong>{formatMoney(item.total)}</strong>
          </article>
        ))}
      </div>

      {errorMessage ? <div className="message message-error">{errorMessage}</div> : null}
      {searchParams?.success === "expense_saved" ? (
        <div className="message message-success">Gasto guardado.</div>
      ) : null}
      {searchParams?.success === "expense_voided" ? (
        <div className="message message-success">Gasto anulado.</div>
      ) : null}

      <section className="panel-grid panel-grid-two">
        <article className="workspace-panel">
          <div className="panel-headline">
            <strong>Registrar gasto</strong>
          </div>
          <form action="/api/operating-expenses" className="stack-form" method="post">
            <div className="split-fields">
              <label className="field">
                <span>Fecha</span>
                <input defaultValue={today} name="expenseOn" required type="date" />
              </label>
              <label className="field">
                <span>Categoria</span>
                <select defaultValue="SERVICES" name="category" required>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Concepto</span>
              <input name="concept" required type="text" />
            </label>
            <div className="split-fields">
              <label className="field">
                <span>Proveedor</span>
                <select defaultValue="" name="providerId" required>
                  <option value="">Seleccionar</option>
                  {activeProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Valor total</span>
                <input min="0.01" name="totalAmount" required step="0.01" type="number" />
              </label>
            </div>
            <label className="field">
              <span>Medio de pago</span>
              <input name="paymentMethod" placeholder="Efectivo, transferencia..." type="text" />
            </label>
            <label className="field">
              <span>Nota</span>
              <textarea name="notes" rows={2} />
            </label>
            <button className="primary-button" disabled={activeProviders.length === 0} type="submit">
              Guardar gasto
            </button>
          </form>
        </article>

        <article className="workspace-panel">
          <div className="panel-headline">
            <strong>Consulta</strong>
            <Link className="ghost-button" href="/gastos">Limpiar</Link>
          </div>
          <form className="stack-form" method="get">
            <div className="split-fields">
              <label className="field">
                <span>Desde</span>
                <input defaultValue={filters.dateFrom} name="dateFrom" type="date" />
              </label>
              <label className="field">
                <span>Hasta</span>
                <input defaultValue={filters.dateTo} name="dateTo" type="date" />
              </label>
            </div>
            <label className="field">
              <span>Categoria</span>
              <select defaultValue={filters.category ?? ""} name="category">
                <option value="">Todas</option>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <button className="ghost-button" type="submit">Filtrar</button>
          </form>
        </article>
      </section>

      <section className="workspace-panel">
        <div className="panel-headline"><strong>Movimientos</strong></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Categoria</th>
                <th>Concepto</th>
                <th>Proveedor</th>
                <th>Valor</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {overview.expenses.length === 0 ? (
                <tr><td colSpan={6}>No hay gastos en este periodo.</td></tr>
              ) : overview.expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{formatDate(expense.expenseOn)}</td>
                  <td>{categoryLabels[expense.category]}</td>
                  <td>{expense.concept}</td>
                  <td>{expense.providerName ?? "-"}</td>
                  <td>{formatMoney(expense.totalAmount)}</td>
                  <td>
                    <form action="/api/operating-expenses" method="post">
                      <input name="action" type="hidden" value="void" />
                      <input name="expenseId" type="hidden" value={expense.id} />
                      <button className="ghost-button" type="submit">Anular</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function normalizeDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function getErrorMessage(code?: string) {
  if (!code) return null;
  if (code === "invalid_amount") return "El valor debe ser mayor a cero.";
  if (code === "provider_not_found") return "Selecciona un proveedor activo.";
  if (code === "missing_expense_fields") return "Completa todos los campos requeridos.";
  if (code === "expense_not_found") return "El gasto no existe o ya fue anulado.";
  return "No fue posible guardar el gasto.";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    currency: "COP",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(`${value}T12:00:00Z`));
}
