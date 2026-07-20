import { AppShell } from "@/components/app-shell";
import { getInventoryOverview } from "@/lib/operations";
import { requireOperationsPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  insufficient_stock: "La salida supera el inventario disponible.",
  missing_inventory_fields: "Completa producto, movimiento, cantidad y fecha.",
  product_not_found: "No se encontro el producto.",
  product_not_tracked: "Ese producto no lleva inventario.",
  server_error: "No fue posible guardar el movimiento."
};

const successMessages: Record<string, string> = {
  inventory_saved: "Movimiento guardado."
};

type InventoryPageProps = {
  searchParams?: {
    error?: string;
    success?: string;
  };
};

export default async function InventoryPage({
  searchParams
}: InventoryPageProps) {
  requireOperationsPage();
  const overview = await getInventoryOverview();
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
      eyebrow="Control"
      title="Inventario"
    >
      <div className="stats-grid">
        <article className="stat-card">
          <span>Productos</span>
          <strong>{overview.stats.activeProducts}</strong>
        </article>
        <article className="stat-card">
          <span>Materia prima</span>
          <strong>{overview.stats.rawMaterials}</strong>
        </article>
        <article className="stat-card">
          <span>Bloques</span>
          <strong>{overview.stats.blockProducts}</strong>
        </article>
        <article className="stat-card">
          <span>Bajo minimo</span>
          <strong>{overview.stats.lowStockProducts}</strong>
        </article>
      </div>

      <div className="money-chip">Costo de stock: {formatMoney(overview.stats.stockCost)}</div>

      {errorMessage ? <div className="message message-error">{errorMessage}</div> : null}
      {successMessage ? (
        <div className="message message-success">{successMessage}</div>
      ) : null}

      <section className="panel-grid panel-grid-two">
        <article className="workspace-panel">
          <div className="panel-headline">
            <strong>Movimiento manual</strong>
          </div>

          <form action="/api/inventory/movements" className="stack-form" method="post">
            <input name="returnTo" type="hidden" value="/inventario" />
            <label className="field">
              <span>Producto</span>
              <select defaultValue="" name="productId" required>
                <option value="">Seleccionar</option>
                {overview.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="split-fields">
              <label className="field">
                <span>Movimiento</span>
                <select defaultValue="MANUAL_IN" name="movementType">
                  <option value="MANUAL_IN">Entrada</option>
                  <option value="MANUAL_OUT">Salida</option>
                </select>
              </label>

              <label className="field">
                <span>Fecha</span>
                <input defaultValue={today} name="movementOn" required type="date" />
              </label>
            </div>

            <label className="field">
              <span>Cantidad</span>
              <input min="0.01" name="quantity" required step="0.01" type="number" />
            </label>

            <label className="field">
              <span>Costo unitario (compra)</span>
              <input min="0" name="unitCost" step="0.01" type="number" />
            </label>

            <label className="field">
              <span>Nota</span>
              <textarea name="notes" rows={2} />
            </label>

            <button className="primary-button" type="submit">
              Guardar movimiento
            </button>
          </form>
        </article>

        <article className="workspace-panel">
          <div className="panel-headline">
            <strong>Movimientos recientes</strong>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {overview.movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatDate(movement.movementOn)}</td>
                    <td>{movement.productName}</td>
                    <td>{formatMovementType(movement.movementType)}</td>
                    <td>
                      {formatQuantity(movement.quantity)} {movement.unitName}
                    </td>
                    <td>
                      {formatQuantity(movement.stockAfter)} {movement.unitName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="workspace-panel">
        <div className="panel-headline">
          <strong>Stock actual</strong>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoria</th>
                <th>Stock</th>
                <th>Minimo</th>
                <th>Costo</th>
                <th>Venta</th>
              </tr>
            </thead>
            <tbody>
              {overview.products.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{formatCategory(product.category)}</td>
                  <td>
                    {formatQuantity(product.currentStockQty)} {product.unitName}
                  </td>
                  <td>
                    {formatQuantity(product.minStockQty)} {product.unitName}
                  </td>
                  <td>{formatMoney(product.standardCost)}</td>
                  <td>{formatMoney(product.salePrice)}</td>
                </tr>
              ))}
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

function formatMovementType(value: string) {
  if (value === "MANUAL_IN") return "Entrada";
  if (value === "MANUAL_OUT") return "Salida";
  if (value === "PRODUCTION_IN") return "Produccion de bloque";
  if (value === "PRODUCTION_OUT") return "Consumo de materia prima";
  return value;
}

function formatCategory(category: string) {
  if (category === "RAW_MATERIAL") return "Materia prima";
  if (category === "BLOCK") return "Bloque";
  return "General";
}
