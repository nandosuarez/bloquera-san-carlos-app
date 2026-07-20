import { AppShell } from "@/components/app-shell";
import { CementCalculator } from "@/components/cement-calculator";
import { getCementCalculatorConfig } from "@/lib/cement-calculator";
import { requireSalesPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function CementCalculatorPage() {
  requireSalesPage();
  const config = await getCementCalculatorConfig();

  return (
    <AppShell
      actions={
        <form action="/api/auth/logout" method="post">
          <button className="ghost-button" type="submit">
            Cerrar sesion
          </button>
        </form>
      }
      eyebrow="Compras"
      title="Calculadora de cemento"
    >
      <section className="workspace-panel">
        <div className="panel-headline">
          <strong>
            Digita cantidad, costo compra (IVA), precio referencia, peso por unidad y bolsas de la mula.
            Mula y coteros se prorratean por bolsa equivalente de 42.5 kg.
          </strong>
        </div>
        <CementCalculator initialConfig={config} />
      </section>
    </AppShell>
  );
}
