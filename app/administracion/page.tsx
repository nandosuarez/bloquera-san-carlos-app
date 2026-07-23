import { AdministrationAccordion } from "@/components/admin-accordion";
import { AppShell } from "@/components/app-shell";
import {
  CuentiIntegrationError,
  getCuentiConfigStatus,
  getCuentiReferenceData
} from "@/lib/cuenti";
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
  cuenti_unavailable: "No fue posible conectar con Cuenti.",
  empty_customer_import: "El archivo no tiene clientes validos.",
  missing_cuenti_company: "Falta configurar el ID de empresa de Cuenti.",
  missing_cuenti_token: "Falta configurar el token API de Cuenti.",
  missing_customer_import_file: "Selecciona un archivo CSV de clientes.",
  missing_customer_import_name: "El archivo debe tener una columna Nombre.",
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
  customers_imported: "Clientes importados.",
  cuenti_connected: "Conexion con Cuenti exitosa.",
  cuenti_customers_synced: "Clientes sincronizados desde Cuenti.",
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
    branches?: string;
    catalogs?: string;
    created?: string;
    error?: string;
    section?: string;
    skipped?: string;
    success?: string;
    total?: string;
    updated?: string;
  };
};

export default async function AdministrationPage({
  searchParams
}: AdministrationPageProps) {
  requireAdminPage();
  const [overview, vehicles, transportProviders] = await Promise.all([
    getAdminOverview(),
    listVehicles(),
    listTransportProviders()
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
  const selectedSection = normalizeSection(searchParams?.section);
  const errorMessage = errorCode
    ? errorMessages[errorCode] ?? "Ocurrio un error inesperado."
    : null;
  const cuentiReferenceData =
    selectedSection === "cuenti" && searchParams?.catalogs === "1"
      ? await loadCuentiReferenceData()
      : null;
  const successMessage =
    successCode === "customers_imported"
      ? buildImportSuccessMessage(searchParams)
      : successCode === "cuenti_connected"
        ? buildCuentiSuccessMessage(searchParams)
      : successCode === "cuenti_customers_synced"
        ? buildCuentiCustomerSyncMessage(searchParams)
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

function buildImportSuccessMessage(searchParams?: AdministrationPageProps["searchParams"]) {
  const created = Number(searchParams?.created ?? 0);
  const updated = Number(searchParams?.updated ?? 0);
  const skipped = Number(searchParams?.skipped ?? 0);

  return `Clientes importados. Nuevos: ${created}. Actualizados: ${updated}. Omitidos: ${skipped}.`;
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
