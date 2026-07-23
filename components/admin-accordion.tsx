"use client";

import { useRef, useState } from "react";

type SectionId =
  | "customers"
  | "collaborators"
  | "products"
  | "product-lines"
  | "users"
  | "formulas"
  | "vehicles"
  | "transport-providers"
  | "cuenti";

type CustomerView = {
  cuentiCustomerId: string | null;
  id: string;
  identification: string | null;
  name: string;
  phone: string | null;
};

type CollaboratorView = {
  dailyRate: number;
  fullName: string;
  id: string;
  roleTitle: string | null;
};

type ProductView = {
  blockLaborUnitCost: number;
  category: "GENERAL" | "RAW_MATERIAL" | "BLOCK";
  cuentiProductId: string | null;
  currentStockQty: number;
  dimensionLabel: string | null;
  id: string;
  minStockQty: number;
  name: string;
  notes: string | null;
  productLineId: string | null;
  productLineName: string | null;
  rawMaterialType: "CEMENT" | "SAND" | null;
  salePrice: number;
  sku: string | null;
  standardCost: number;
  unitName: string;
  weightKg: number;
};

type UserView = {
  email: string;
  id: string;
  name: string;
  role: string;
  username: string;
};

type FormulaView = {
  blockName: string;
  cementBagsQty: number;
  cementName: string;
  id: string;
  outputQty: number;
  sandLatasQty: number;
  sandName: string;
};

type ProductOption = {
  dimensionLabel: string | null;
  id: string;
  name: string;
};

type ProductLineView = {
  id: string;
  name: string;
  productCount: number;
};

type VehicleView = {
  id: string;
  label: string;
  maxLoadKg: number;
  notes: string | null;
  plate: string | null;
};

type TransportProviderView = {
  id: string;
  name: string;
  phone: string | null;
};

type CuentiConfigView = {
  baseUrl: string;
  branchId: string | null;
  companyId: string;
  consecutiveId: string | null;
  employeeId: string | null;
  hasToken: boolean;
  isReadyForDocuments: boolean;
  isReadyForQueries: boolean;
  missingForDocuments: string[];
  sellerId: string | null;
  warehouseId: string | null;
};

type CuentiReferenceItemView = {
  detail: string | null;
  id: string;
  name: string;
};

type CuentiReferenceDataView = {
  banks: CuentiReferenceItemView[];
  branches: CuentiReferenceItemView[];
  consecutives: CuentiReferenceItemView[];
  employees: CuentiReferenceItemView[];
  errors: Array<{
    label: string;
    message: string;
  }>;
  loadedAt: string;
  paymentMethods: CuentiReferenceItemView[];
};

type AdministrationAccordionProps = {
  blockProducts: ProductOption[];
  collaborators: CollaboratorView[];
  customers: CustomerView[];
  cuentiConfig: CuentiConfigView;
  cuentiReferenceData: CuentiReferenceDataView | null;
  formulas: FormulaView[];
  products: ProductView[];
  productLines: ProductLineView[];
  rawProducts: ProductOption[];
  section: SectionId;
  transportProviders: TransportProviderView[];
  users: UserView[];
  vehicles: VehicleView[];
};

const sectionTitles: Record<SectionId, string> = {
  collaborators: "Colaboradores",
  cuenti: "Integracion Cuenti",
  customers: "Clientes",
  formulas: "Formulas de bloques",
  "product-lines": "Lineas",
  products: "Productos",
  "transport-providers": "Proveedores",
  users: "Usuarios",
  vehicles: "Carros"
};

export function AdministrationAccordion({
  blockProducts,
  collaborators,
  customers,
  cuentiConfig,
  cuentiReferenceData,
  formulas,
  products,
  productLines,
  rawProducts,
  section,
  transportProviders,
  users,
  vehicles
}: AdministrationAccordionProps) {
  return (
    <section className="workspace-panel">
      <div className="panel-headline">
        <strong>{sectionTitles[section]}</strong>
      </div>

      {section === "customers" ? <CustomerSection customers={customers} /> : null}
      {section === "collaborators" ? (
        <CollaboratorSection collaborators={collaborators} />
      ) : null}
      {section === "products" ? (
        <ProductSection productLines={productLines} products={products} />
      ) : null}
      {section === "product-lines" ? (
        <ProductLineSection productLines={productLines} />
      ) : null}
      {section === "users" ? <UserSection users={users} /> : null}
      {section === "formulas" ? (
        <FormulaSection
          blockProducts={blockProducts}
          formulas={formulas}
          rawProducts={rawProducts}
        />
      ) : null}
      {section === "vehicles" ? <VehicleSection vehicles={vehicles} /> : null}
      {section === "transport-providers" ? (
        <TransportProviderSection providers={transportProviders} />
      ) : null}
      {section === "cuenti" ? (
        <CuentiSection config={cuentiConfig} referenceData={cuentiReferenceData} />
      ) : null}
    </section>
  );
}

function CuentiSection({
  config,
  referenceData
}: {
  config: CuentiConfigView;
  referenceData: CuentiReferenceDataView | null;
}) {
  return (
    <div className="stack-form">
      <section className="import-card">
        <div>
          <strong>Conexion con Cuenti</strong>
          <p>
            La empresa quedo preconfigurada con ID 7760. El token se maneja como
            variable de entorno para no exponerlo en la pantalla ni en Git.
          </p>
        </div>
        <form action="/api/admin/cuenti/test" className="stack-form" method="post">
          <button className="primary-button" type="submit">
            Probar conexion
          </button>
        </form>
      </section>

      <form action="/administracion" className="form-actions" method="get">
        <input name="section" type="hidden" value="cuenti" />
        <input name="catalogs" type="hidden" value="1" />
        <button className="ghost-button" disabled={!config.isReadyForQueries} type="submit">
          Consultar IDs en Cuenti
        </button>
      </form>

      <section className="import-card">
        <div>
          <strong>Clientes de Cuenti</strong>
          <p>
            Trae los clientes registrados en Cuenti y los crea o actualiza en la
            app usando el ID de Cuenti, la identificacion o el nombre.
          </p>
        </div>
        <form
          action="/api/admin/cuenti/customers/import"
          className="stack-form"
          method="post"
        >
          <button
            className="primary-button"
            disabled={!config.isReadyForQueries}
            type="submit"
          >
            Sincronizar clientes
          </button>
        </form>
      </section>

      <section className="import-card">
        <div>
          <strong>Productos de Cuenti</strong>
          <p>
            Trae los productos de Cuenti como productos generales sin inventario
            y los conecta por ID de Cuenti, SKU o nombre.
          </p>
        </div>
        <form
          action="/api/admin/cuenti/products/import"
          className="stack-form"
          method="post"
        >
          <button
            className="primary-button"
            disabled={!config.isReadyForQueries || !config.branchId}
            type="submit"
          >
            Sincronizar productos
          </button>
        </form>
      </section>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Dato</th>
              <th>Valor</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <CuentiConfigRow label="Servidor" status="Listo" value={config.baseUrl} />
            <CuentiConfigRow label="Empresa" status="Listo" value={config.companyId} />
            <CuentiConfigRow
              label="Token API"
              status={config.hasToken ? "Configurado" : "Pendiente"}
              value={config.hasToken ? "Protegido" : "CUENTI_API_TOKEN"}
            />
            <CuentiConfigRow
              label="Sucursal"
              status={config.branchId ? "Configurado" : "Pendiente"}
              value={config.branchId ?? "CUENTI_BRANCH_ID"}
            />
            <CuentiConfigRow
              label="Bodega"
              status={config.warehouseId ? "Configurado" : "Pendiente"}
              value={config.warehouseId ?? "CUENTI_WAREHOUSE_ID"}
            />
            <CuentiConfigRow
              label="Vendedor"
              status={config.sellerId ? "Configurado" : "Pendiente"}
              value={config.sellerId ?? "CUENTI_SELLER_ID"}
            />
            <CuentiConfigRow
              label="Empleado"
              status={config.employeeId ? "Configurado" : "Pendiente"}
              value={config.employeeId ?? "CUENTI_EMPLOYEE_ID"}
            />
            <CuentiConfigRow
              label="Consecutivo"
              status={config.consecutiveId ? "Configurado" : "Pendiente"}
              value={config.consecutiveId ?? "CUENTI_CONSECUTIVE_ID"}
            />
          </tbody>
        </table>
      </div>

      <div
        className={`message ${
          config.isReadyForDocuments ? "message-success" : "message-error"
        }`}
      >
        {config.isReadyForQueries
          ? "La app ya queda lista para consultas cuando la prueba de conexion responda correctamente."
          : "Falta configurar el token API de Cuenti para poder consultar datos."}
        {!config.isReadyForDocuments && config.missingForDocuments.length > 0
          ? ` Para crear documentos faltan: ${config.missingForDocuments.join(", ")}.`
          : ""}
      </div>

      {referenceData ? (
        <section className="cuenti-reference-panel">
          <div className="panel-headline">
            <strong>IDs encontrados en Cuenti</strong>
            <span className="table-muted">
              Consulta: {formatDateTime(referenceData.loadedAt)}
            </span>
          </div>

          {referenceData.errors.length > 0 ? (
            <div className="message message-error">
              {referenceData.errors
                .map((error) => `${error.label}: ${error.message}`)
                .join(" ")}
            </div>
          ) : null}

          <div className="cuenti-reference-grid">
            <CuentiCatalogCard
              envKey="CUENTI_BRANCH_ID"
              items={referenceData.branches}
              title="Sucursales"
            />
            <CuentiCatalogCard
              envKey="CUENTI_EMPLOYEE_ID / CUENTI_SELLER_ID"
              items={referenceData.employees}
              title="Empleados y vendedores"
            />
            <CuentiCatalogCard
              envKey="CUENTI_CONSECUTIVE_ID"
              items={referenceData.consecutives}
              title="Consecutivos"
            />
            <CuentiCatalogCard
              envKey="Referencia futura"
              items={referenceData.paymentMethods}
              title="Medios de pago"
            />
            <CuentiCatalogCard
              envKey="Referencia futura"
              items={referenceData.banks}
              title="Bancos"
            />
            <article className="cuenti-catalog-card">
              <div className="entity-card-head">
                <strong>Bodega</strong>
                <span className="status-chip status-chip-muted">Manual</span>
              </div>
              <p>
                El Swagger de Cuenti no muestra un endpoint para listar bodegas.
                Este valor se debe confirmar en Cuenti y configurarlo en Render
                como CUENTI_WAREHOUSE_ID.
              </p>
            </article>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CuentiConfigRow({
  label,
  status,
  value
}: {
  label: string;
  status: string;
  value: string;
}) {
  return (
    <tr>
      <td>{label}</td>
      <td>{value}</td>
      <td>
        <span className={status === "Pendiente" ? "status-chip status-chip-muted" : "status-chip"}>
          {status}
        </span>
      </td>
    </tr>
  );
}

function CuentiCatalogCard({
  envKey,
  items,
  title
}: {
  envKey: string;
  items: CuentiReferenceItemView[];
  title: string;
}) {
  return (
    <article className="cuenti-catalog-card">
      <div className="entity-card-head">
        <strong>{title}</strong>
        <span className="status-chip">{items.length}</span>
      </div>
      <span className="table-muted">{envKey}</span>

      {items.length === 0 ? (
        <p>No se encontraron registros.</p>
      ) : (
        <div className="cuenti-id-list">
          {items.slice(0, 18).map((item) => (
            <div className="cuenti-id-row" key={`${title}-${item.id}-${item.name}`}>
              <code>{item.id}</code>
              <div>
                <strong>{item.name}</strong>
                {item.detail ? <small>{item.detail}</small> : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 18 ? (
        <span className="table-muted">Mostrando 18 de {items.length} registros.</span>
      ) : null}
    </article>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota"
  }).format(new Date(value));
}

function CustomerSection({ customers }: { customers: CustomerView[] }) {
  const [customerSearch, setCustomerSearch] = useState("");
  const filteredCustomers = filterCustomers(customers, customerSearch);

  return (
    <>
      <form action="/api/admin/customers" className="stack-form" method="post">
        <div className="split-fields">
          <label className="field">
            <span>Nombre</span>
            <input name="name" required type="text" />
          </label>
          <label className="field">
            <span>Telefono</span>
            <input name="phone" type="text" />
          </label>
        </div>
        <label className="field">
          <span>Direccion</span>
          <input name="address" type="text" />
        </label>
        <label className="field">
          <span>Nota</span>
          <textarea name="notes" rows={2} />
        </label>
        <button className="primary-button" type="submit">
          Guardar cliente
        </button>
      </form>

      <div className="customer-list-tools">
        <label className="field">
          <span>Buscar cliente</span>
          <input
            onChange={(event) => setCustomerSearch(event.target.value)}
            placeholder="Nombre o telefono"
            type="search"
            value={customerSearch}
          />
        </label>
        <div className="customer-list-count">
          Mostrando <strong>{filteredCustomers.length}</strong> de{" "}
          <strong>{customers.length}</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Identificacion</th>
              <th>Telefono</th>
              <th>Cuenti</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={4}>No encontre clientes con esa busqueda.</td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td>{customer.identification ?? "-"}</td>
                  <td>{customer.phone ?? "-"}</td>
                  <td>{customer.cuentiCustomerId ? "Conectado" : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function filterCustomers(customers: CustomerView[], query: string) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return customers;
  }

  return customers.filter((customer) =>
    normalizeSearchText(
      `${customer.name} ${customer.phone ?? ""} ${customer.identification ?? ""} ${customer.cuentiCustomerId ?? ""}`
    ).includes(normalizedQuery)
  );
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .trim();
}

function CollaboratorSection({ collaborators }: { collaborators: CollaboratorView[] }) {
  return (
    <>
      <form action="/api/admin/collaborators" className="stack-form" method="post">
        <div className="split-fields">
          <label className="field">
            <span>Nombre</span>
            <input name="fullName" required type="text" />
          </label>
          <label className="field">
            <span>Cargo</span>
            <input name="roleTitle" type="text" />
          </label>
        </div>
        <div className="split-fields three-fields">
          <label className="field">
            <span>Telefono</span>
            <input name="phone" type="text" />
          </label>
          <label className="field">
            <span>Documento</span>
            <input name="documentNumber" type="text" />
          </label>
          <label className="field">
            <span>Jornal</span>
            <input min="0" name="dailyRate" step="0.01" type="number" />
          </label>
        </div>
        <label className="field">
          <span>Nota</span>
          <textarea name="notes" rows={2} />
        </label>
        <button className="primary-button" type="submit">
          Guardar colaborador
        </button>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Cargo</th>
              <th>Jornal</th>
            </tr>
          </thead>
          <tbody>
            {collaborators.map((collaborator) => (
              <tr key={collaborator.id}>
                <td>{collaborator.fullName}</td>
                <td>{collaborator.roleTitle ?? "-"}</td>
                <td>{formatMoney(collaborator.dailyRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProductSection({
  productLines,
  products
}: {
  productLines: ProductLineView[];
  products: ProductView[];
}) {
  const [editingProduct, setEditingProduct] = useState<ProductView | null>(null);
  const productFormRef = useRef<HTMLFormElement>(null);
  const isEditing = editingProduct !== null;

  function startEditing(product: ProductView) {
    setEditingProduct(product);
    requestAnimationFrame(() => {
      productFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <>
      <form
        action="/api/admin/products"
        className="stack-form product-main-form"
        key={editingProduct?.id ?? "create-product"}
        method="post"
        ref={productFormRef}
      >
        <input name="action" type="hidden" value={isEditing ? "update-product" : "create"} />
        {editingProduct ? (
          <input name="productId" type="hidden" value={editingProduct.id} />
        ) : null}

        {editingProduct ? (
          <div className="edit-banner">
            <span>
              Editando: <strong>{editingProduct.name}</strong>
            </span>
            <button
              className="ghost-button"
              onClick={() => setEditingProduct(null)}
              type="button"
            >
              Cancelar
            </button>
          </div>
        ) : null}

        <div className="split-fields">
          <label className="field">
            <span>Nombre</span>
            <input
              defaultValue={editingProduct?.name ?? ""}
              name="name"
              readOnly={isEditing}
              required
              type="text"
            />
          </label>
          <label className="field">
            <span>SKU</span>
            <input defaultValue={editingProduct?.sku ?? ""} name="sku" type="text" />
          </label>
        </div>

        <div className="split-fields four-fields">
          <label className="field">
            <span>Categoria</span>
            <select defaultValue={editingProduct?.category ?? "GENERAL"} name="category">
              <option value="GENERAL">General</option>
              <option value="RAW_MATERIAL">Materia prima</option>
              <option value="BLOCK">Bloque</option>
            </select>
          </label>

          <label className="field">
            <span>Linea</span>
            <select defaultValue={editingProduct?.productLineId ?? ""} name="productLineId">
              <option value="">Sin linea</option>
              {productLines.map((line) => (
                <option key={line.id} value={line.id}>
                  {line.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Unidad</span>
            <input
              defaultValue={editingProduct?.unitName ?? "unidades"}
              name="unitName"
              type="text"
            />
          </label>

          <label className="field">
            <span>Peso kg / unidad</span>
            <input
              defaultValue={editingProduct ? formatInputNumber(editingProduct.weightKg) : ""}
              min="0"
              name="weightKg"
              step="0.001"
              type="number"
            />
          </label>

          <label className="field">
            <span>Medida del bloque</span>
            <input
              defaultValue={editingProduct?.dimensionLabel ?? ""}
              name="dimensionLabel"
              placeholder="12x20x40"
              type="text"
            />
          </label>
        </div>

        <div className="split-fields">
          <label className="field">
            <span>Tipo de insumo</span>
            <select defaultValue={editingProduct?.rawMaterialType ?? ""} name="rawMaterialType">
              <option value="">No aplica</option>
              <option value="CEMENT">Cemento</option>
              <option value="SAND">Arena</option>
            </select>
          </label>

          <label className="field">
            <span>Costo mano de obra por bloque</span>
            <input
              defaultValue={
                editingProduct ? formatInputNumber(editingProduct.blockLaborUnitCost) : ""
              }
              min="0"
              name="blockLaborUnitCost"
              step="0.01"
              type="number"
            />
          </label>
        </div>

        <div className="split-fields four-fields">
          <label className="field">
            <span>Stock inicial</span>
            <input
              defaultValue={
                editingProduct ? formatInputNumber(editingProduct.currentStockQty) : ""
              }
              min="0"
              name="currentStockQty"
              step="0.01"
              type="number"
            />
          </label>
          <label className="field">
            <span>Stock minimo</span>
            <input
              defaultValue={editingProduct ? formatInputNumber(editingProduct.minStockQty) : ""}
              min="0"
              name="minStockQty"
              step="0.01"
              type="number"
            />
          </label>
          <label className="field">
            <span>Costo</span>
            <input
              defaultValue={editingProduct ? formatInputNumber(editingProduct.standardCost) : ""}
              min="0"
              name="standardCost"
              step="0.01"
              type="number"
            />
          </label>
          <label className="field">
            <span>Precio venta</span>
            <input
              defaultValue={editingProduct ? formatInputNumber(editingProduct.salePrice) : ""}
              min="0"
              name="salePrice"
              step="0.01"
              type="number"
            />
          </label>
        </div>

        <label className="field">
          <span>Nota</span>
          <textarea defaultValue={editingProduct?.notes ?? ""} name="notes" rows={2} />
        </label>

        <div className="form-actions">
          <button className="primary-button" type="submit">
            {isEditing ? "Actualizar producto" : "Guardar producto"}
          </button>
          {isEditing ? (
            <button
              className="ghost-button"
              onClick={() => setEditingProduct(null)}
              type="button"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoria</th>
              <th>Linea</th>
              <th>Tipo insumo</th>
              <th>Stock</th>
              <th>Peso kg</th>
              <th>Costo</th>
              <th>MO bloque</th>
              <th>Venta</th>
              <th>% utilidad</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  {product.name}
                  {product.dimensionLabel ? (
                    <span className="table-meta">{product.dimensionLabel}</span>
                  ) : null}
                  {product.cuentiProductId ? (
                    <span className="table-meta">Cuenti: {product.cuentiProductId}</span>
                  ) : null}
                </td>
                <td>{formatCategory(product.category)}</td>
                <td>{product.productLineName ?? "-"}</td>
                <td>{formatRawMaterialType(product.rawMaterialType)}</td>
                <td>
                  {formatQuantity(product.currentStockQty)} {product.unitName}
                </td>
                <td>{formatQuantity(product.weightKg)}</td>
                <td>{formatMoney(product.standardCost)}</td>
                <td>{formatMoney(product.blockLaborUnitCost)}</td>
                <td>{formatMoney(product.salePrice)}</td>
                <td>{formatProfitPercent(product.salePrice, product.standardCost)}</td>
                <td>
                  <button
                    className="ghost-button"
                    onClick={() => startEditing(product)}
                    type="button"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function UserSection({ users }: { users: UserView[] }) {
  return (
    <>
      <form action="/api/admin/users" className="stack-form" method="post">
        <div className="split-fields">
          <label className="field">
            <span>Nombre</span>
            <input name="name" required type="text" />
          </label>
          <label className="field">
            <span>Usuario</span>
            <input name="username" required type="text" />
          </label>
        </div>

        <div className="split-fields three-fields">
          <label className="field">
            <span>Correo</span>
            <input name="email" required type="email" />
          </label>
          <label className="field">
            <span>Rol</span>
            <select defaultValue="ADMIN" name="role">
              <option value="ADMIN">Admin</option>
              <option value="VENTAS">Ventas</option>
              <option value="OPERACION">Operacion</option>
            </select>
          </label>
          <label className="field">
            <span>Clave</span>
            <input name="password" required type="password" />
          </label>
        </div>

        <button className="primary-button" type="submit">
          Guardar usuario
        </button>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo</th>
              <th>Rol</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  {user.username}
                  <span className="table-meta">{user.name}</span>
                </td>
                <td>{user.email}</td>
                <td>{user.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProductLineSection({
  productLines
}: {
  productLines: ProductLineView[];
}) {
  return (
    <>
      <form action="/api/admin/product-lines" className="stack-form" method="post">
        <label className="field">
          <span>Linea</span>
          <input name="name" required type="text" />
        </label>

        <label className="field">
          <span>Nota</span>
          <textarea name="notes" rows={2} />
        </label>

        <button className="primary-button" type="submit">
          Guardar linea
        </button>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Linea</th>
              <th>Productos</th>
            </tr>
          </thead>
          <tbody>
            {productLines.length === 0 ? (
              <tr>
                <td colSpan={2}>No hay lineas registradas.</td>
              </tr>
            ) : (
              productLines.map((line) => (
                <tr key={line.id}>
                  <td>{line.name}</td>
                  <td>{line.productCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FormulaSection({
  blockProducts,
  formulas,
  rawProducts
}: {
  blockProducts: ProductOption[];
  formulas: FormulaView[];
  rawProducts: ProductOption[];
}) {
  return (
    <>
      <form action="/api/admin/formulas" className="stack-form" method="post">
        <div className="split-fields three-fields">
          <label className="field">
            <span>Bloque</span>
            <select defaultValue="" name="blockProductId" required>
              <option value="">Seleccionar</option>
              {blockProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                  {product.dimensionLabel ? ` - ${product.dimensionLabel}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Cemento</span>
            <select defaultValue="" name="cementProductId" required>
              <option value="">Seleccionar</option>
              {rawProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Arena</span>
            <select defaultValue="" name="sandProductId" required>
              <option value="">Seleccionar</option>
              {rawProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="split-fields three-fields">
          <label className="field">
            <span>Bolsas de cemento</span>
            <input min="0.01" name="cementBagsQty" required step="0.01" type="number" />
          </label>

          <label className="field">
            <span>Latas de arena</span>
            <input min="0.01" name="sandLatasQty" required step="0.01" type="number" />
          </label>

          <label className="field">
            <span>Salida de bloques</span>
            <input min="0.01" name="outputQty" required step="0.01" type="number" />
          </label>
        </div>

        <label className="field">
          <span>Nota</span>
          <textarea name="notes" rows={2} />
        </label>

        <button className="primary-button" type="submit">
          Guardar formula
        </button>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Bloque</th>
              <th>Cemento</th>
              <th>Arena</th>
              <th>Salida</th>
            </tr>
          </thead>
          <tbody>
            {formulas.map((formula) => (
              <tr key={formula.id}>
                <td>{formula.blockName}</td>
                <td>{`${formatQuantity(formula.cementBagsQty)} bolsa(s) - ${formula.cementName}`}</td>
                <td>{`${formatQuantity(formula.sandLatasQty)} lata(s) - ${formula.sandName}`}</td>
                <td>{formatQuantity(formula.outputQty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function VehicleSection({ vehicles }: { vehicles: VehicleView[] }) {
  const [editingVehicle, setEditingVehicle] = useState<VehicleView | null>(null);
  const isEditing = editingVehicle !== null;

  return (
    <>
      <form
        action="/api/admin/vehicles"
        className="stack-form"
        key={editingVehicle?.id ?? "create-vehicle"}
        method="post"
      >
        <input name="action" type="hidden" value={isEditing ? "update-vehicle" : "create"} />
        {editingVehicle ? (
          <input name="vehicleId" type="hidden" value={editingVehicle.id} />
        ) : null}

        {editingVehicle ? (
          <div className="edit-banner">
            <span>
              Editando carro: <strong>{editingVehicle.label}</strong>
            </span>
            <button className="ghost-button" onClick={() => setEditingVehicle(null)} type="button">
              Cancelar
            </button>
          </div>
        ) : null}

        <div className="split-fields three-fields">
          <label className="field">
            <span>Nombre del carro</span>
            <input defaultValue={editingVehicle?.label ?? ""} name="label" required type="text" />
          </label>
          <label className="field">
            <span>Placa</span>
            <input defaultValue={editingVehicle?.plate ?? ""} name="plate" type="text" />
          </label>
          <label className="field">
            <span>Capacidad kg</span>
            <input
              defaultValue={editingVehicle ? formatInputNumber(editingVehicle.maxLoadKg) : ""}
              min="0"
              name="maxLoadKg"
              step="0.01"
              type="number"
            />
          </label>
        </div>

        <label className="field">
          <span>Nota</span>
          <textarea defaultValue={editingVehicle?.notes ?? ""} name="notes" rows={2} />
        </label>

        <div className="form-actions">
          <button className="primary-button" type="submit">
            {isEditing ? "Actualizar carro" : "Guardar carro"}
          </button>
          {isEditing ? (
            <button className="ghost-button" onClick={() => setEditingVehicle(null)} type="button">
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Carro</th>
              <th>Placa</th>
              <th>Capacidad</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id}>
                <td>{vehicle.label}</td>
                <td>{vehicle.plate ?? "-"}</td>
                <td>{vehicle.maxLoadKg > 0 ? `${formatQuantity(vehicle.maxLoadKg)} kg` : "-"}</td>
                <td>
                  <button className="ghost-button" onClick={() => setEditingVehicle(vehicle)} type="button">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TransportProviderSection({
  providers
}: {
  providers: TransportProviderView[];
}) {
  return (
    <>
      <form action="/api/admin/transport-providers" className="stack-form" method="post">
        <div className="split-fields">
          <label className="field">
            <span>Proveedor</span>
            <input name="name" required type="text" />
          </label>
          <label className="field">
            <span>Telefono</span>
            <input name="phone" type="text" />
          </label>
        </div>

        <label className="field">
          <span>Nota</span>
          <textarea name="notes" rows={2} />
        </label>

        <button className="primary-button" type="submit">
          Guardar proveedor
        </button>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Telefono</th>
            </tr>
          </thead>
          <tbody>
            {providers.length === 0 ? (
              <tr>
                <td colSpan={2}>No hay proveedores registrados.</td>
              </tr>
            ) : (
              providers.map((provider) => (
                <tr key={provider.id}>
                  <td>{provider.name}</td>
                  <td>{provider.phone ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-CO", {
    currency: "COP",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatProfitPercent(salePrice: number, standardCost: number) {
  if (standardCost <= 0 || salePrice <= 0) return "-";

  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "percent"
  }).format((salePrice - standardCost) / standardCost);
}

function formatInputNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2
  }).format(value);
}

function formatCategory(category: ProductView["category"]) {
  if (category === "RAW_MATERIAL") return "Materia prima";
  if (category === "BLOCK") return "Bloque";
  return "General";
}

function formatRawMaterialType(value: ProductView["rawMaterialType"]) {
  if (value === "CEMENT") return "Cemento";
  if (value === "SAND") return "Arena";
  return "-";
}
