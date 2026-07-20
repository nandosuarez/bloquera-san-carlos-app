import { AppShell } from "@/components/app-shell";
import { getInventoryOverview, getProductionOverview } from "@/lib/operations";
import { requireOperationsPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  insufficient_stock: "La salida supera el inventario disponible.",
  missing_raw_material_type: "Selecciona la categoria del insumo: cemento o arena.",
  missing_inventory_fields: "Completa insumo, movimiento, cantidad y fecha.",
  product_not_found: "No se encontro el insumo.",
  product_not_tracked: "Ese insumo no lleva inventario.",
  server_error: "No fue posible guardar el movimiento."
};

const successMessages: Record<string, string> = {
  inventory_saved: "Movimiento de insumo guardado.",
  raw_material_added: "Producto agregado a insumos.",
  raw_material_removed: "Producto quitado de insumos."
};

type InputsPageProps = {
  searchParams?: {
    error?: string;
    success?: string;
  };
};

export default async function InputsPage({ searchParams }: InputsPageProps) {
  requireOperationsPage();
  const [inventoryOverview, productionOverview] = await Promise.all([
    getInventoryOverview(),
    getProductionOverview()
  ]);
  const rawMaterials = productionOverview.products.filter(
    (product) => product.category === "RAW_MATERIAL" && product.isActive
  );
  const availableProducts = productionOverview.products.filter(
    (product) => product.isActive && product.category === "GENERAL"
  );
  const rawMaterialNames = new Set(rawMaterials.map((product) => product.name));
  const rawMovements = inventoryOverview.movements.filter((movement) =>
    rawMaterialNames.has(movement.productName)
  );
  const stockValue = rawMaterials.reduce(
    (total, product) => total + product.currentStockQty * product.standardCost,
    0
  );
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
      eyebrow="Planta"
      title="Insumos"
    >
      <div className="stats-grid">
        <article className="stat-card">
          <span>Insumos activos</span>
          <strong>{rawMaterials.length}</strong>
        </article>
        <article className="stat-card">
          <span>Valor de stock</span>
          <strong>{formatMoney(stockValue)}</strong>
        </article>
        <article className="stat-card">
          <span>Cobros abiertos</span>
          <strong>{productionOverview.stats.openLaborCharges}</strong>
        </article>
        <article className="stat-card">
          <span>Total por pagar</span>
          <strong>{formatMoney(productionOverview.stats.openLaborAmount)}</strong>
        </article>
      </div>

      {errorMessage ? <div className="message message-error">{errorMessage}</div> : null}
      {successMessage ? (
        <div className="message message-success">{successMessage}</div>
      ) : null}

      <section className="panel-grid panel-grid-two">
        <article className="workspace-panel">
          <div className="panel-headline">
            <strong>Compra o ajuste de insumos</strong>
          </div>

          <form action="/api/inventory/movements" className="stack-form" method="post">
            <input name="returnTo" type="hidden" value="/insumos" />
            <label className="field">
              <span>Insumo</span>
              <select defaultValue="" name="productId" required>
                <option value="">Seleccionar</option>
                {rawMaterials.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({formatRawMaterialType(product.rawMaterialType)})
                  </option>
                ))}
              </select>
            </label>

            {rawMaterials.length === 0 ? (
              <div className="message message-error">
                No hay insumos activos. Agrega productos en la seccion de la derecha.
              </div>
            ) : null}

            <div className="split-fields">
              <label className="field">
                <span>Movimiento</span>
                <select defaultValue="MANUAL_IN" name="movementType">
                  <option value="MANUAL_IN">Entrada (compra)</option>
                  <option value="MANUAL_OUT">Salida</option>
                </select>
              </label>

              <label className="field">
                <span>Fecha</span>
                <input defaultValue={today} name="movementOn" required type="date" />
              </label>
            </div>

            <div className="split-fields">
              <label className="field">
                <span>Cantidad</span>
                <input min="0.01" name="quantity" required step="0.01" type="number" />
              </label>

              <label className="field">
                <span>Costo unitario</span>
                <input min="0" name="unitCost" step="0.01" type="number" />
              </label>
            </div>

            <label className="field">
              <span>Nota</span>
              <textarea name="notes" rows={2} />
            </label>

            <button className="primary-button" type="submit">
              Guardar insumo
            </button>
          </form>
        </article>

        <article className="workspace-panel">
          <div className="panel-headline">
            <strong>Lista y stock de insumos</strong>
          </div>

          <form action="/api/insumos/products" className="stack-form" method="post">
            <input name="action" type="hidden" value="add" />
            <div className="split-fields">
              <label className="field">
                <span>Producto para agregar a insumos</span>
                <select defaultValue="" name="productId" required>
                  <option value="">Seleccionar</option>
                  {availableProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="field">
                <span>Accion</span>
                <button className="primary-button" type="submit">
                  Agregar a insumos
                </button>
              </div>
            </div>

            <label className="field">
              <span>Categoria del insumo</span>
              <select defaultValue="CEMENT" name="rawMaterialType">
                <option value="CEMENT">Cemento</option>
                <option value="SAND">Arena</option>
              </select>
            </label>
          </form>

          {availableProducts.length === 0 ? (
            <div className="message message-success">
              No hay mas productos disponibles para agregar a insumos.
            </div>
          ) : null}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Categoria</th>
                  <th>Unidad</th>
                  <th>Stock</th>
                  <th>Costo</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {rawMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No hay insumos registrados.</td>
                  </tr>
                ) : (
                  rawMaterials.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{formatRawMaterialType(product.rawMaterialType)}</td>
                      <td>{product.unitName}</td>
                      <td>{formatQuantity(product.currentStockQty)}</td>
                      <td>{formatMoney(product.standardCost)}</td>
                      <td>
                        <form action="/api/insumos/products" method="post">
                          <input name="action" type="hidden" value="remove" />
                          <input name="productId" type="hidden" value={product.id} />
                          <button className="ghost-button" type="submit">
                            Quitar
                          </button>
                        </form>
                      </td>
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
          <strong>Cuentas de cobro por mano de obra</strong>
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
              {productionOverview.laborCharges.length === 0 ? (
                <tr>
                  <td colSpan={6}>Sin cuentas de cobro.</td>
                </tr>
              ) : (
                productionOverview.laborCharges.map((charge) => (
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

      <section className="workspace-panel">
        <div className="panel-headline">
          <strong>Movimientos recientes de insumos</strong>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Insumo</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {rawMovements.map((movement) => (
                <tr key={movement.id}>
                  <td>{formatDate(movement.movementOn)}</td>
                  <td>{movement.productName}</td>
                  <td>{formatInputMovementType(movement.movementType)}</td>
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

function formatRawMaterialType(value: string | null) {
  if (value === "CEMENT") return "Cemento";
  if (value === "SAND") return "Arena";
  return "Sin definir";
}

function formatInputMovementType(value: string) {
  if (value === "MANUAL_IN") return "Entrada";
  if (value === "MANUAL_OUT") return "Salida";
  if (value === "PRODUCTION_OUT") return "Consumo en produccion";
  return value;
}
