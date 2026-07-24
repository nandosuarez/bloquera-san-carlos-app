import { getCuentiPaymentDiagnostics } from "@/lib/cuenti";
import { requireAdminPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function CuentiExpenseDiagnosticsPage() {
  requireAdminPage();
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Bogota"
  });
  const diagnostics = await getCuentiPaymentDiagnostics({
    dateFrom: `${today.slice(0, 4)}-01-01`,
    dateTo: today
  });

  return (
    <main style={{ padding: "32px" }}>
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(diagnostics, null, 2)}
      </pre>
    </main>
  );
}
