import { AppShell } from "@/components/app-shell";
import { ProductionBatchForm } from "@/components/production-batch-form";
import { getProductionOverview } from "@/lib/operations";
import { requireOperationsPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  block_not_found: "Selecciona un bloque valido.",
  block_not_tracked: "El bloque seleccionado debe llevar inventario.",
  collaborator_not_found: "Selecciona un colaborador activo.",
  insufficient_raw_material: "No hay suficiente materia prima para esa produccion.",
  missing_production_fields: "Completa bloque, insumos, colaborador, cantidad y fecha.",
  raw_material_not_found: "Selecciona insumos validos para cemento y arena.",
  raw_material_not_tracked: "Cemento y arena deben llevar inventario.",
  server_error: "No fue posible guardar la produccion."
};

const successMessages: Record<string, string> = {
  production_saved: "Produccion registrada."
};

type BlockProductionPageProps = {
  searchParams?: {
    error?: string;
    success?: string;
  };
};

export default async function BlockProductionPage({
  searchParams
}: BlockProductionPageProps) {
  requireOperationsPage();
  const overview = await getProductionOverview();
  const explicitBlockProducts = overview.products.filter((product) => {
    if (!product.isActive) return false;
    if (product.category === "BLOCK") return true;
    if (product.dimensionLabel) return true;
    return product.name.toLocaleLowerCase("es-CO").includes("bloque");
  });
  const blockProducts =
    explicitBlockProducts.length > 0
      ? explicitBlockProducts
      : overview.products.filter((product) => product.isActive);
  const rawMaterials = overview.products.filter(
    (product) => product.isActive && product.category === "RAW_MATERIAL"
  );
  const cements = rawMaterials.filter((product) => product.rawMaterialType === "CEMENT");
  const sands = rawMaterials.filter((product) => product.rawMaterialType === "SAND");
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
      compact
      eyebrow="Planta"
      title="Produccion de bloques"
    >
      <div className="stats-grid stats-grid-compact production-stats-grid">
        <article className="stat-card">
          <span>Lotes</span>
          <strong>{overview.stats.batches}</strong>
        </article>
        <article className="stat-card">
          <span>Bloques hoy</span>
          <strong>{formatQuantity(overview.stats.todayBlocks)}</strong>
        </article>
        <article className="stat-card">
          <span>Total bloques</span>
          <strong>{formatQuantity(overview.stats.totalBlocks)}</strong>
        </article>
        <article className="stat-card">
          <span>Costo acumulado</span>
          <strong>{formatMoney(overview.stats.totalCost)}</strong>
        </article>
        <article className="stat-card">
          <span>Ingreso estimado</span>
          <strong>{formatMoney(overview.stats.totalRevenue)}</strong>
        </article>
        <article className="stat-card">
          <span>Margen estimado</span>
          <strong>{formatMoney(overview.stats.totalMargin)}</strong>
        </article>
        <article className="stat-card">
          <span>Cobros abiertos</span>
          <strong>{overview.stats.openLaborCharges}</strong>
        </article>
        <article className="stat-card">
          <span>Total por pagar</span>
          <strong>{formatMoney(overview.stats.openLaborAmount)}</strong>
        </article>
      </div>

      {errorMessage ? <div className="message message-error">{errorMessage}</div> : null}
      {successMessage ? (
        <div className="message message-success">{successMessage}</div>
      ) : null}

      <section className="panel-grid panel-grid-two">
        <article className="workspace-panel">
          <div className="panel-headline">
            <strong>Registrar produccion</strong>
          </div>

          <ProductionBatchForm
            blocks={blockProducts.map((product) => ({
              dimensionLabel: product.dimensionLabel,
              id: product.id,
              laborUnitCost: product.blockLaborUnitCost,
              name: product.name
            }))}
            cements={cements.map((product) => ({
              id: product.id,
              name: product.name,
              standardCost: product.standardCost,
              unitName: product.unitName
            }))}
            collaborators={overview.collaborators
              .filter((collaborator) => collaborator.isActive)
              .map((collaborator) => ({
                fullName: collaborator.fullName,
                id: collaborator.id
              }))}
            defaultDate={today}
            sands={sands.map((product) => ({
              id: product.id,
              name: product.name,
              standardCost: product.standardCost,
              unitName: product.unitName
            }))}
          />
        </article>

        <article className="workspace-panel">
          <div className="panel-headline">
            <strong>Insumos activos</strong>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Categoria</th>
                  <th>Unidad</th>
                  <th>Stock</th>
                  <th>Costo unidad</th>
                </tr>
              </thead>
              <tbody>
                {rawMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Crea primero los insumos en el modulo Insumos.</td>
                  </tr>
                ) : (
                  rawMaterials.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{formatRawMaterialType(product.rawMaterialType)}</td>
                      <td>{product.unitName}</td>
                      <td>{formatQuantity(product.currentStockQty)}</td>
                      <td>{formatMoney(product.standardCost)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="workspace-panel">
        <div className="panel-headline">
          <strong>Trazabilidad</strong>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Bloque</th>
                <th>Colaborador</th>
                <th>Cantidad</th>
                <th>Cemento</th>
                <th>Arena</th>
                <th>Mano de obra</th>
                <th>Costo unidad</th>
                <th>Precio ref</th>
                <th>Margen unidad</th>
                <th>Margen total</th>
                <th>% utilidad</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {overview.batches.map((batch) => (
                <tr key={batch.id}>
                  <td>{formatDate(batch.productionOn)}</td>
                  <td>{batch.blockName}</td>
                  <td>{batch.collaboratorName}</td>
                  <td>{formatQuantity(batch.producedQty)}</td>
                  <td>
                    {batch.cementName}: {formatQuantity(batch.cementUsedQty)} x{" "}
                    {formatMoney(batch.cementUnitCost)}
                  </td>
                  <td>
                    {batch.sandName}: {formatQuantity(batch.sandUsedQty)} x{" "}
                    {formatMoney(batch.sandUnitCost)}
                  </td>
                  <td>
                    {formatMoney(batch.laborUnitCost)} x {formatQuantity(batch.producedQty)} ={" "}
                    {formatMoney(batch.laborCost)}
                  </td>
                  <td>{formatMoney(batch.unitCost)}</td>
                  <td>{formatMoney(batch.blockSalePrice)}</td>
                  <td>{batch.unitMargin !== null ? formatMoney(batch.unitMargin) : "-"}</td>
                  <td>{batch.totalMargin !== null ? formatMoney(batch.totalMargin) : "-"}</td>
                  <td>{formatProfitPercent(batch.unitMargin, batch.unitCost)}</td>
                  <td>{formatMoney(batch.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="workspace-panel">
        <div className="panel-headline">
          <strong>Cuentas de cobro (mano de obra)</strong>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Colaborador</th>
                <th>Bloques</th>
                <th>Tarifa</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {overview.laborCharges.length === 0 ? (
                <tr>
                  <td colSpan={6}>Sin cuentas de cobro.</td>
                </tr>
              ) : (
                overview.laborCharges.map((charge) => (
                  <tr key={charge.id}>
                    <td>{formatDate(charge.chargeOn)}</td>
                    <td>{charge.collaboratorName}</td>
                    <td>{formatQuantity(charge.producedQty)}</td>
                    <td>{formatMoney(charge.unitRate)}</td>
                    <td>{formatMoney(charge.amountDue)}</td>
                    <td>{charge.status === "OPEN" ? "Abierta" : "Pagada"}</td>
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

function formatProfitPercent(unitMargin: number | null, unitCost: number) {
  if (unitMargin === null || unitCost <= 0) return "-";

  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "percent"
  }).format(unitMargin / unitCost);
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

function formatRawMaterialType(value: string | null) {
  if (value === "CEMENT") return "Cemento";
  if (value === "SAND") return "Arena";
  return "Sin definir";
}
