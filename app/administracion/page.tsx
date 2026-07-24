import { AdministrationAccordion } from "@/components/admin-accordion";
import { AppShell } from "@/components/app-shell";
import {
  CuentiIntegrationError,
  getCuentiConfigStatus,
  getCuentiReferenceData
} from "@/lib/cuenti";
import { getCuentiAnalyticsSyncStatus } from "@/lib/cuenti-analytics-sync";
import { getCuentiFinancialSyncStatus } from "@/lib/cuenti-financial-sync";
import { getAdminOverview } from "@/lib/operations";
import { requireAdminPage } from "@/lib/permissions";
import { listTransportProviders } from "@/lib/transport-providers";
import { listVehicles } from "@/lib/vehicles";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  duplicate_collaborator_document: "Ese documento ya existe.",
  duplicate_customer: "Ese cliente ya existe.",
  duplicate_product: "Ese producto ya existe.",
  duplicate_product_line: "Esa linea ya existe.",
  duplicate_transport_provider: "Ese proveedor ya existe.",
  duplicate_vehicle: "Ese carro o placa ya existe.",
  duplicate_user: "Ese usuario o correo ya existe.",
  cuenti_connection_failed: "Cuenti rechazo la conexion. Revisa token y empresa.",
  cuenti_sales_sync_failed:
    "No fue posible sincronizar las ventas. Revisa el ultimo intento en la bodega.",
  cuenti_payments_sync_failed:
    "No fue posible sincronizar los pagos. Revisa el ultimo intento.",
  cuenti_purchase_sync_running: "Ya hay una sincronizacion de compras en proceso.",
  cuenti_payment_sync_running: "Ya hay una sincronizacion de pagos en proceso.",
  cuenti_purchases_sync_failed:
    "No fue posible cargar las compras indicadas.",
  cuenti_warehouse_sync_failed:
    "No fue posible completar toda la sincronizacion de la bodega.",
  missing_cuenti_purchase_ref: "Escribe al menos un ID de compra de Cuenti.",
  cuenti_sync_running: "Ya hay una sincronizacion de ventas en proceso.",
  cuenti_unavailable: "No fue posible conectar con Cuenti.",
  invalid_sync_dates: "El rango de fechas de sincronizacion no es valido.",
  missing_cuenti_branch: "Falta configurar la sucursal de Cuenti.",
  missing_cuenti_company: "Falta configurar el ID de empresa de Cuenti.",
  missing_cuenti_token: "Falta configurar el token API de Cuenti.",
  missing_collaborator_name: "Escribe el nombre del colaborador.",
  missing_customer_name: "Escribe el nombre del cliente.",
  missing_formula_fields: "Completa la formula del bloque.",
  missing_product_line_name: "Escribe el nombre de la linea.",
  missing_product_name: "Escribe el nombre del producto.",
  missing_raw_material_type: "Selecciona si el insumo es cemento o arena.",
  missing_transport_provider_name: "Escribe el nombre del proveedor.",
  missing_vehicle_label: "Escribe el nombre del carro.",
  missing_user_fields: "Completa los datos del usuario.",
  product_line_not_found: "Selecciona una linea valida.",
  product_not_found: "No se encontro el producto.",
  reference_error: "No fue posible consultar las referencias de Cuenti.",
  server_error: "No fue posible guardar el registro."
};

const successMessages: Record<string, string> = {
  collaborator_saved: "Colaborador guardado.",
  cuenti_connected: "Conexion con Cuenti exitosa.",
  cuenti_customers_synced: "Clientes sincronizados desde Cuenti.",
  cuenti_products_synced: "Productos sincronizados desde Cuenti.",
  cuenti_sales_synced: "Ventas sincronizadas en la bodega.",
  cuenti_payments_synced: "Pagos sincronizados en la bodega.",
  cuenti_purchases_synced: "Compras sincronizadas en la bodega.",
  cuenti_warehouse_synced: "Bodega gerencial sincronizada.",
  cuenti_stock_synced: "Stock de Cuenti actualizado.",
  customer_saved: "Cliente guardado.",
  formula_saved: "Formula guardada.",
  product_line_saved: "Linea guardada.",
  product_saved: "Producto guardado.",
  product_updated: "Producto actualizado.",
  transport_provider_saved: "Proveedor guardado.",
  vehicle_updated: "Carro actualizado.",
  vehicle_saved: "Carro guardado.",
  user_saved: "Usuario guardado."
};

type AdministrationPageProps = {
  searchParams?: {
    branch?: string;
    backfill?: string;
    branches?: string;
    catalogs?: string;
    checked?: string;
    complete?: string;
    created?: string;
    details?: string;
    error?: string;
    failed?: string;
    from?: string;
    nextPage?: string;
    pages?: string;
    payments?: string;
    raw?: string;
    section?: string;
    skipped?: string;
    sourceRows?: string;
    stock?: string;
    success?: string;
    to?: string;
    total?: string;
    tried?: string;
    updated?: string;
    sales?: string;
  };
};

export default async function AdministrationPage({
  searchParams
}: AdministrationPageProps) {
  requireAdminPage();
  const selectedSection = normalizeSection(searchParams?.section);
  const [
    overview,
    vehicles,
    transportProviders,
    cuentiAnalyticsStatus,
    cuentiFinancialStatus
  ] =
    await Promise.all([
    getAdminOverview(),
    listVehicles(),
    listTransportProviders(),
    selectedSection === "cuenti"
      ? getCuentiAnalyticsSyncStatus()
      : Promise.resolve(null),
    selectedSection === "cuenti"
      ? getCuentiFinancialSyncStatus()
      : Promise.resolve(null)
  ]);
  const blockProducts = overview.products
    .filter((product) => product.category === "BLOCK" && product.isActive)
    .map((product) => ({
      dimensionLabel: product.dimensionLabel,
      id: product.id,
      name: product.name
    }));
  const rawProducts = overview.products
    .filter((product) => product.category === "RAW_MATERIAL" && product.isActive)
    .map((product) => ({
      dimensionLabel: product.dimensionLabel,
      id: product.id,
      name: product.name
    }));
  const errorCode = searchParams?.error ?? null;
  const successCode = searchParams?.success ?? null;
  const errorMessage = errorCode
    ? errorMessages[errorCode] ?? "Ocurrio un error inesperado."
    : null;
  const cuentiReferenceData =
    selectedSection === "cuenti" && searchParams?.catalogs === "1"
      ? await loadCuentiReferenceData()
      : null;
  const successMessage =
    successCode === "cuenti_connected"
      ? buildCuentiSuccessMessage(searchParams)
      : successCode === "cuenti_customers_synced"
        ? buildCuentiCustomerSyncMessage(searchParams)
      : successCode === "cuenti_products_synced"
        ? buildCuentiProductSyncMessage(searchParams)
      : successCode === "cuenti_stock_synced"
        ? buildCuentiStockSyncMessage(searchParams)
      : successCode === "cuenti_sales_synced"
        ? buildCuentiSalesSyncMessage(searchParams)
      : successCode === "cuenti_payments_synced"
        ? buildCuentiEntitySyncMessage("Pagos", searchParams)
      : successCode === "cuenti_purchases_synced"
        ? buildCuentiEntitySyncMessage("Compras", searchParams)
      : successCode === "cuenti_warehouse_synced"
        ? buildCuentiWarehouseSyncMessage(searchParams)
      : successCode
        ? successMessages[successCode] ?? null
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
      eyebrow="Panel"
      title="Administracion"
    >
      <div className="stats-grid">
        <article className="stat-card">
          <span>Clientes</span>
          <strong>{overview.customers.length}</strong>
        </article>
        <article className="stat-card">
          <span>Colaboradores</span>
          <strong>{overview.collaborators.length}</strong>
        </article>
        <article className="stat-card">
          <span>Productos</span>
          <strong>{overview.products.length}</strong>
        </article>
        <article className="stat-card">
          <span>Usuarios</span>
          <strong>{overview.users.length}</strong>
        </article>
        <article className="stat-card">
          <span>Carros</span>
          <strong>{vehicles.length}</strong>
        </article>
      </div>

      {errorMessage ? <div className="message message-error">{errorMessage}</div> : null}
      {successMessage ? (
        <div className="message message-success">{successMessage}</div>
      ) : null}

      <AdministrationAccordion
        blockProducts={blockProducts}
        collaborators={overview.collaborators.map((collaborator) => ({
          dailyRate: collaborator.dailyRate,
          fullName: collaborator.fullName,
          id: collaborator.id,
          roleTitle: collaborator.roleTitle
        }))}
        customers={overview.customers.map((customer) => ({
          cuentiCustomerId: customer.cuentiCustomerId,
          id: customer.id,
          identification: customer.identification,
          name: customer.name,
          phone: customer.phone
        }))}
        cuentiConfig={getCuentiConfigStatus()}
        cuentiFinancialStatus={
          cuentiFinancialStatus
            ? {
                ...cuentiFinancialStatus,
                payments: {
                  ...cuentiFinancialStatus.payments,
                  lastRunAt:
                    cuentiFinancialStatus.payments.lastRunAt?.toISOString() ?? null
                },
                purchases: {
                  ...cuentiFinancialStatus.purchases,
                  lastRunAt:
                    cuentiFinancialStatus.purchases.lastRunAt?.toISOString() ?? null
                }
              }
            : null
        }
        cuentiAnalyticsStatus={
          cuentiAnalyticsStatus
            ? {
                ...cuentiAnalyticsStatus,
                lastRun: cuentiAnalyticsStatus.lastRun
                  ? {
                      ...cuentiAnalyticsStatus.lastRun,
                      finishedAt:
                        cuentiAnalyticsStatus.lastRun.finishedAt?.toISOString() ??
                        null,
                      startedAt:
                        cuentiAnalyticsStatus.lastRun.startedAt.toISOString()
                    }
                  : null
              }
            : null
        }
        cuentiReferenceData={cuentiReferenceData}
        formulas={overview.formulas.map((formula) => ({
          blockName: formula.blockName,
          cementBagsQty: formula.cementBagsQty,
          cementName: formula.cementName,
          id: formula.id,
          outputQty: formula.outputQty,
          sandLatasQty: formula.sandLatasQty,
          sandName: formula.sandName
        }))}
        products={overview.products.map((product) => ({
          blockLaborUnitCost: product.blockLaborUnitCost,
          category: product.category,
          cuentiProductId: product.cuentiProductId,
          cuentiStockQty: product.cuentiStockQty,
          cuentiStockSyncedAt: product.cuentiStockSyncedAt
            ? product.cuentiStockSyncedAt.toISOString()
            : null,
          currentStockQty: product.currentStockQty,
          dimensionLabel: product.dimensionLabel,
          id: product.id,
          minStockQty: product.minStockQty,
          name: product.name,
          notes: product.notes,
          productLineId: product.productLineId,
          productLineName: product.productLineName,
          rawMaterialType: product.rawMaterialType,
          salePrice: product.salePrice,
          sku: product.sku,
          standardCost: product.standardCost,
          unitName: product.unitName,
          weightKg: product.weightKg
        }))}
        productLines={overview.productLines.map((line) => ({
          id: line.id,
          name: line.name,
          productCount: line.productCount
        }))}
        rawProducts={rawProducts}
        section={selectedSection}
        transportProviders={transportProviders.map((provider) => ({
          id: provider.id,
          name: provider.name,
          phone: provider.phone
        }))}
        users={overview.users.map((user) => ({
          email: user.email,
          id: user.id,
          name: user.name,
          role: user.role,
          username: user.username
        }))}
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          label: vehicle.label,
          maxLoadKg: vehicle.maxLoadKg,
          notes: vehicle.notes,
          plate: vehicle.plate
        }))}
      />
    </AppShell>
  );
}

function normalizeSection(value?: string) {
  if (value === "customers") return "customers";
  if (value === "collaborators") return "collaborators";
  if (value === "products") return "products";
  if (value === "product-lines") return "product-lines";
  if (value === "users") return "users";
  if (value === "formulas") return "formulas";
  if (value === "vehicles") return "vehicles";
  if (value === "transport-providers") return "transport-providers";
  if (value === "cuenti") return "cuenti";
  return "customers";
}

function buildCuentiSuccessMessage(searchParams?: AdministrationPageProps["searchParams"]) {
  const branches = searchParams?.branches;

  if (!branches) {
    return "Conexion con Cuenti exitosa.";
  }

  return `Conexion con Cuenti exitosa. Sucursales encontradas: ${branches}.`;
}

function buildCuentiCustomerSyncMessage(
  searchParams?: AdministrationPageProps["searchParams"]
) {
  const created = Number(searchParams?.created ?? 0);
  const updated = Number(searchParams?.updated ?? 0);
  const skipped = Number(searchParams?.skipped ?? 0);
  const total = Number(searchParams?.total ?? created + updated + skipped);

  return `Clientes de Cuenti sincronizados. Total: ${total}. Nuevos: ${created}. Actualizados: ${updated}. Omitidos: ${skipped}.`;
}

function buildCuentiProductSyncMessage(
  searchParams?: AdministrationPageProps["searchParams"]
) {
  const branch = searchParams?.branch;
  const created = Number(searchParams?.created ?? 0);
  const raw = Number(searchParams?.raw ?? 0);
  const stock = Number(searchParams?.stock ?? 0);
  const updated = Number(searchParams?.updated ?? 0);
  const skipped = Number(searchParams?.skipped ?? 0);
  const total = Number(searchParams?.total ?? created + updated + skipped);
  const tried = searchParams?.tried
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");

  if (total === 0) {
    return `Productos de Cuenti sincronizados. Total: 0. Cuenti devolvio ${raw} registros crudos. Sucursales probadas: ${tried || branch || "sin dato"}.`;
  }

  return `Productos de Cuenti sincronizados. Total: ${total}. Nuevos: ${created}. Actualizados: ${updated}. Omitidos: ${skipped}. Stock recibido: ${stock}. Sucursal usada: ${branch || "sin dato"}.`;
}

function buildCuentiStockSyncMessage(
  searchParams?: AdministrationPageProps["searchParams"]
) {
  const branch = searchParams?.branch;
  const checked = Number(searchParams?.checked ?? 0);
  const failed = Number(searchParams?.failed ?? 0);
  const skipped = Number(searchParams?.skipped ?? 0);
  const updated = Number(searchParams?.updated ?? 0);
  const tried = searchParams?.tried
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");

  return `Stock de Cuenti actualizado. Revisados: ${checked}. Actualizados: ${updated}. Sin stock: ${skipped}. Errores: ${failed}. Sucursal usada: ${branch || tried || "sin dato"}.`;
}

function buildCuentiSalesSyncMessage(
  searchParams?: AdministrationPageProps["searchParams"]
) {
  const created = Number(searchParams?.created ?? 0);
  const updated = Number(searchParams?.updated ?? 0);
  const details = Number(searchParams?.details ?? 0);
  const dateFrom = searchParams?.from ?? "-";
  const dateTo = searchParams?.to ?? "-";
  const windowComplete = searchParams?.complete === "1";
  const backfillComplete = searchParams?.backfill === "1";
  const progress = backfillComplete
    ? "La carga historica ya alcanzo el dia de hoy."
    : windowComplete
      ? "El periodo termino; la siguiente ejecucion continuara con el mes siguiente."
      : `El periodo continua en la pagina ${searchParams?.nextPage ?? "siguiente"}.`;

  return `Bodega actualizada del ${dateFrom} al ${dateTo}. Facturas nuevas: ${created}. Actualizadas: ${updated}. Lineas: ${details}. ${progress}`;
}

function buildCuentiEntitySyncMessage(
  entityLabel: string,
  searchParams?: AdministrationPageProps["searchParams"]
) {
  const created = Number(searchParams?.created ?? 0);
  const updated = Number(searchParams?.updated ?? 0);
  const skipped = Number(searchParams?.skipped ?? 0);

  return `${entityLabel} sincronizados. Nuevos: ${created}. Actualizados: ${updated}. Omitidos: ${skipped}.`;
}

function buildCuentiWarehouseSyncMessage(
  searchParams?: AdministrationPageProps["searchParams"]
) {
  return `Bodega gerencial actualizada. Ventas: ${Number(
    searchParams?.sales ?? 0
  )}. Pagos: ${Number(searchParams?.payments ?? 0)}. Inventario: ${Number(
    searchParams?.stock ?? 0
  )} productos.`;
}

async function loadCuentiReferenceData() {
  try {
    return await getCuentiReferenceData();
  } catch (error) {
    console.error("Error loading Cuenti references", error);

    const message =
      error instanceof CuentiIntegrationError
        ? error.message
        : "No fue posible consultar las referencias de Cuenti.";

    return {
      banks: [],
      branches: [],
      consecutives: [],
      employees: [],
      errors: [
        {
          label: "Referencias",
          message
        }
      ],
      loadedAt: new Date().toISOString(),
      paymentMethods: []
    };
  }
}
