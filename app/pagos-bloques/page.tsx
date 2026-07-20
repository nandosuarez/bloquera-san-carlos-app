import { AppShell } from "@/components/app-shell";
import { LaborPaymentsBulkForm } from "@/components/labor-payments-bulk-form";
import { getLaborPaymentOverview } from "@/lib/operations";
import { requireOperationsPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  labor_charge_not_found: "La cuenta de cobro no existe o ya fue pagada.",
  missing_payment_fields: "Completa la fecha del pago.",
  missing_payment_selection: "Selecciona al menos una cuenta para pagar.",
  server_error: "No fue posible registrar el pago."
};

const successMessages: Record<string, string> = {
  labor_payment_saved: "Pago registrado."
};

type LaborPaymentsPageProps = {
  searchParams?: {
    error?: string;
    success?: string;
  };
};

export default async function LaborPaymentsPage({
  searchParams
}: LaborPaymentsPageProps) {
  requireOperationsPage();
  const overview = await getLaborPaymentOverview();
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Bogota"
  });
  const errorMessage = searchParams?.error
    ? errorMessages[searchParams.error] ?? "Ocurrio un error inesperado."
    : null;
  const successMessage = searchParams?.success
    ? successMessages[searchParams.success] ?? null
    : null;
  const openCharges = overview.charges.filter((charge) => charge.status === "OPEN");
  const paidCharges = overview.charges.filter((charge) => charge.status === "PAID");

  return (
    <AppShell
      actions={
        <form action="/api/auth/logout" method="post">
          <button className="ghost-button" type="submit">
            Cerrar sesion
          </button>
        </form>
      }
      eyebrow="Bloques"
      title="Pagos de mano de obra"
    >
      <div className="stats-grid">
        <article className="stat-card">
          <span>Cobros abiertos</span>
          <strong>{overview.stats.openCharges}</strong>
        </article>
        <article className="stat-card">
          <span>Total pendiente</span>
          <strong>{formatMoney(overview.stats.openAmount)}</strong>
        </article>
        <article className="stat-card">
          <span>Cobros pagados</span>
          <strong>{overview.stats.paidCharges}</strong>
        </article>
        <article className="stat-card">
          <span>Total pagado</span>
          <strong>{formatMoney(overview.stats.paidAmount)}</strong>
        </article>
      </div>

      {errorMessage ? <div className="message message-error">{errorMessage}</div> : null}
      {successMessage ? (
        <div className="message message-success">{successMessage}</div>
      ) : null}

      <section className="workspace-panel">
        <div className="panel-headline">
          <strong>Cuentas pendientes por pagar</strong>
        </div>
        <LaborPaymentsBulkForm charges={openCharges} defaultDate={today} />
      </section>

      <section className="workspace-panel">
        <div className="panel-headline">
          <strong>Historial de pagos</strong>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha cobro</th>
                <th>Fecha pago</th>
                <th>Colaborador</th>
                <th>Total</th>
                <th>Nota pago</th>
              </tr>
            </thead>
            <tbody>
              {paidCharges.length === 0 ? (
                <tr>
                  <td colSpan={5}>Sin pagos registrados.</td>
                </tr>
              ) : (
                paidCharges.map((charge) => (
                  <tr key={charge.id}>
                    <td>{formatDate(charge.chargeOn)}</td>
                    <td>{charge.paidOn ? formatDate(charge.paidOn) : "-"}</td>
                    <td>{charge.collaboratorName}</td>
                    <td>{formatMoney(charge.amountDue)}</td>
                    <td>{charge.paymentNotes ?? "-"}</td>
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

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    currency: "COP",
    maximumFractionDigits: 0,
    style: "currency"
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
