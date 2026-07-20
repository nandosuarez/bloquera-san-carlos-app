import { AdministrationAccordion } from "@/components/admin-accordion";
import { AppShell } from "@/components/app-shell";
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
  server_error: "No fue posible guardar el registro."
};

const successMessages: Record<string, string> = {
  collaborator_saved: "Colaborador guardado.",
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
    error?: string;
    section?: string;
    success?: string;
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
  const successMessage = successCode
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
          id: customer.id,
          name: customer.name,
          phone: customer.phone
        }))}
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
  return "customers";
}
