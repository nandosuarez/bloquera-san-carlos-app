const DEFAULT_CUENTI_API_BASE_URL =
  "https://integrator-apps-api-dok.cuenti.co/api";
const DEFAULT_CUENTI_COMPANY_ID = "7760";

type CuentiRawResponse = {
  data?: unknown;
  message?: string;
  success?: boolean;
};

export type CuentiConfigStatus = {
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

export type CuentiConnectionResult = {
  branchCount: number | null;
  message: string;
};

export type CuentiReferenceItem = {
  detail: string | null;
  id: string;
  name: string;
};

export type CuentiReferenceData = {
  banks: CuentiReferenceItem[];
  branches: CuentiReferenceItem[];
  consecutives: CuentiReferenceItem[];
  employees: CuentiReferenceItem[];
  errors: Array<{
    label: string;
    message: string;
  }>;
  loadedAt: string;
  paymentMethods: CuentiReferenceItem[];
};

export type CuentiCustomer = {
  address: string | null;
  cuentiCustomerId: string | null;
  email: string | null;
  identification: string | null;
  name: string;
  notes: string | null;
  phone: string | null;
};

export class CuentiIntegrationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function getCuentiConfigStatus(): CuentiConfigStatus {
  const baseUrl = normalizeUrl(
    process.env.CUENTI_API_BASE_URL ?? DEFAULT_CUENTI_API_BASE_URL
  );
  const companyId =
    normalizeOptionalText(process.env.CUENTI_COMPANY_ID) ??
    DEFAULT_CUENTI_COMPANY_ID;
  const branchId = normalizeOptionalText(process.env.CUENTI_BRANCH_ID);
  const warehouseId = normalizeOptionalText(process.env.CUENTI_WAREHOUSE_ID);
  const sellerId = normalizeOptionalText(process.env.CUENTI_SELLER_ID);
  const employeeId = normalizeOptionalText(process.env.CUENTI_EMPLOYEE_ID);
  const consecutiveId = normalizeOptionalText(process.env.CUENTI_CONSECUTIVE_ID);
  const hasToken = Boolean(normalizeOptionalText(process.env.CUENTI_API_TOKEN));
  const documentRequirements: Array<[string, string | null]> = [
    ["CUENTI_BRANCH_ID", branchId],
    ["CUENTI_WAREHOUSE_ID", warehouseId],
    ["CUENTI_SELLER_ID", sellerId],
    ["CUENTI_EMPLOYEE_ID", employeeId],
    ["CUENTI_CONSECUTIVE_ID", consecutiveId]
  ];
  const missingForDocuments = documentRequirements
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    baseUrl,
    branchId,
    companyId,
    consecutiveId,
    employeeId,
    hasToken,
    isReadyForDocuments: hasToken && missingForDocuments.length === 0,
    isReadyForQueries: hasToken && Boolean(companyId),
    missingForDocuments,
    sellerId,
    warehouseId
  };
}

export async function testCuentiConnection(): Promise<CuentiConnectionResult> {
  const credentials = getCuentiCredentials();
  const payload = await requestCuentiData(credentials, "branches");

  return {
    branchCount: countResponseItems(payload),
    message: getResponseMessage(payload) ?? "Conexion con Cuenti exitosa."
  };
}

export async function getCuentiReferenceData(): Promise<CuentiReferenceData> {
  const credentials = getCuentiCredentials();
  const catalogRequests = [
    ["branches", "Sucursales"],
    ["employees", "Empleados"],
    ["consecutive", "Consecutivos"],
    ["banks", "Bancos"],
    ["payment-methods", "Medios de pago"]
  ] as const;
  const results = await Promise.all(
    catalogRequests.map(async ([endpoint, label]) => {
      try {
        const payload = await requestCuentiData(credentials, endpoint);
        return {
          endpoint,
          items: extractCatalogItems(payload, endpoint),
          label,
          message: null
        };
      } catch (error) {
        return {
          endpoint,
          items: [],
          label,
          message:
            error instanceof Error
              ? error.message
              : "No fue posible consultar esta referencia."
        };
      }
    })
  );

  return {
    banks: getCatalogItems(results, "banks"),
    branches: getCatalogItems(results, "branches"),
    consecutives: getCatalogItems(results, "consecutive"),
    employees: getCatalogItems(results, "employees"),
    errors: results
      .filter((result) => result.message)
      .map((result) => ({
        label: result.label,
        message: result.message ?? "No fue posible consultar esta referencia."
      })),
    loadedAt: new Date().toISOString(),
    paymentMethods: getCatalogItems(results, "payment-methods")
  };
}

export async function getAllCuentiCustomers(): Promise<CuentiCustomer[]> {
  const credentials = getCuentiCredentials();
  const customers: CuentiCustomer[] = [];
  const pageSize = 100;
  const maxPages = 100;

  for (let page = 1; page <= maxPages; page += 1) {
    const payload = await requestCuentiData(credentials, "customers", {
      page: String(page),
      pageSize: String(pageSize)
    });
    const items = extractResponseItems(payload);

    for (const item of items) {
      const customer = mapCuentiCustomer(item);

      if (customer) {
        customers.push(customer);
      }
    }

    const pagination = extractPagination(payload);

    if (items.length === 0) break;
    if (pagination.totalPages && page >= pagination.totalPages) break;
    if (!pagination.totalPages && items.length < pageSize) break;
  }

  return dedupeCuentiCustomers(customers);
}

function getCuentiCredentials() {
  const status = getCuentiConfigStatus();
  const token = normalizeOptionalText(process.env.CUENTI_API_TOKEN);

  if (!token) {
    throw new CuentiIntegrationError(
      "missing_cuenti_token",
      "Falta configurar CUENTI_API_TOKEN."
    );
  }

  if (!status.companyId) {
    throw new CuentiIntegrationError(
      "missing_cuenti_company",
      "Falta configurar CUENTI_COMPANY_ID."
    );
  }

  return {
    baseUrl: status.baseUrl,
    companyId: status.companyId,
    token
  };
}

async function requestCuentiData(
  credentials: {
    baseUrl: string;
    companyId: string;
    token: string;
  },
  endpoint: string,
  searchParams: Record<string, string> = {}
) {
  const url = new URL(
    `${credentials.baseUrl}/integrations/generic/data/${endpoint}`
  );
  url.searchParams.set("companyId", credentials.companyId);

  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }

  let response: Response;

  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: buildCuentiHeaders(credentials)
    });
  } catch (error) {
    throw new CuentiIntegrationError(
      "cuenti_unavailable",
      error instanceof Error ? error.message : "No fue posible conectar con Cuenti."
    );
  }

  const payload = await readJsonResponse(response);

  if (!response.ok) {
    throw new CuentiIntegrationError(
      "cuenti_connection_failed",
      buildApiErrorMessage(response, payload)
    );
  }

  return payload;
}

function buildCuentiHeaders(credentials: {
  companyId: string;
  token: string;
}) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${credentials.token}`,
    "X-Auth-Token-Empresa": credentials.companyId
  };
}

async function readJsonResponse(response: Response): Promise<CuentiRawResponse> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as CuentiRawResponse;
  } catch {
    return {
      message: text.slice(0, 220)
    };
  }
}

function buildApiErrorMessage(response: Response, payload: CuentiRawResponse) {
  return (
    getResponseMessage(payload) ??
    `Cuenti respondio ${response.status} ${response.statusText}`.trim()
  );
}

function getResponseMessage(payload: CuentiRawResponse) {
  return typeof payload.message === "string" && payload.message.trim()
    ? payload.message.trim()
    : null;
}

function extractCatalogItems(payload: CuentiRawResponse, endpoint: string) {
  return extractResponseItems(payload)
    .map((item, index) => mapReferenceItem(item, endpoint, index))
    .filter((item): item is CuentiReferenceItem => Boolean(item));
}

function extractResponseItems(payload: CuentiRawResponse) {
  const data = payload.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (isRecord(data) && Array.isArray(data.items)) {
    return data.items;
  }

  if (isRecord(data)) {
    return [data];
  }

  return [];
}

function mapReferenceItem(
  value: unknown,
  endpoint: string,
  index: number
): CuentiReferenceItem | null {
  if (!isRecord(value)) {
    const textValue = String(value ?? "").trim();

    return textValue
      ? {
          detail: null,
          id: String(index + 1),
          name: textValue
        }
      : null;
  }

  const id = findFirstTextValue(value, buildIdKeys(endpoint));
  const name =
    findFirstTextValue(value, buildNameKeys(endpoint)) ??
    id ??
    `Registro ${index + 1}`;

  return {
    detail: buildReferenceDetail(value, id, name),
    id: id ?? String(index + 1),
    name
  };
}

function mapCuentiCustomer(value: unknown): CuentiCustomer | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = buildCuentiCustomerName(value);

  if (!name) {
    return null;
  }

  const cuentiCustomerId = findFirstTextValue(value, [
    "id_cliente",
    "idCliente",
    "customerId",
    "id_customer",
    "id"
  ]);
  const identification = findFirstTextValue(value, [
    "identificacion",
    "numero_identificacion",
    "id_number",
    "nit",
    "documento",
    "document",
    "codigo_interno"
  ]);
  const phone = findFirstTextValue(value, [
    "telefono1",
    "telefono2",
    "telefono3",
    "telefono",
    "phone",
    "celular",
    "mobile"
  ]);
  const address = findFirstTextValue(value, ["direccion", "address"]);
  const email = findFirstTextValue(value, ["email1", "email2", "email", "correo"]);
  const notes = findFirstTextValue(value, ["nota", "notas", "notes"]);

  return {
    address,
    cuentiCustomerId,
    email,
    identification,
    name,
    notes,
    phone
  };
}

function buildCuentiCustomerName(record: Record<string, unknown>) {
  const directName = findFirstTextValue(record, [
    "nombre_cliente",
    "nombreCliente",
    "cliente",
    "razon_social",
    "razonSocial",
    "nombre",
    "name"
  ]);

  if (directName) {
    return directName;
  }

  const nameParts = [
    "primer_nombre",
    "segundo_nombre",
    "primer_apellido",
    "segundo_apellido"
  ]
    .map((key) => findFirstTextValue(record, [key]))
    .filter(Boolean);

  return nameParts.length > 0 ? nameParts.join(" ") : null;
}

function buildIdKeys(endpoint: string) {
  const baseKeys = ["id", "codigo", "code", "ref"];

  if (endpoint === "branches") {
    return ["id_sucursal", "idSucursal", "id_branch", "branchId", ...baseKeys];
  }

  if (endpoint === "employees") {
    return ["id_empleado", "idEmpleado", "employeeId", "id_vendedor", ...baseKeys];
  }

  if (endpoint === "consecutive") {
    return ["id_consecutivo", "idConsecutivo", "consecutiveId", ...baseKeys];
  }

  if (endpoint === "banks") {
    return ["id_banco", "idBanco", "bankId", ...baseKeys];
  }

  if (endpoint === "payment-methods") {
    return ["id_medio_pago", "idMedioPago", "paymentMethodId", ...baseKeys];
  }

  return baseKeys;
}

function buildNameKeys(endpoint: string) {
  const baseKeys = [
    "nombre",
    "name",
    "descripcion",
    "description",
    "detalle",
    "label"
  ];

  if (endpoint === "branches") {
    return ["nombre_sucursal", "sucursal", "branchName", ...baseKeys];
  }

  if (endpoint === "employees") {
    return [
      "nombre_empleado",
      "empleado",
      "nombre_completo",
      "fullName",
      ...baseKeys
    ];
  }

  if (endpoint === "consecutive") {
    return ["consecutivo", "prefijo", "resolucion", ...baseKeys];
  }

  if (endpoint === "banks") {
    return ["banco", "bankName", ...baseKeys];
  }

  if (endpoint === "payment-methods") {
    return ["medio_pago", "forma_pago", "paymentMethod", ...baseKeys];
  }

  return baseKeys;
}

function findFirstTextValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const directValue = normalizeUnknownText(record[key]);

    if (directValue) {
      return directValue;
    }

    const caseInsensitiveKey = Object.keys(record).find(
      (recordKey) =>
        recordKey.toLocaleLowerCase("es-CO") === key.toLocaleLowerCase("es-CO")
    );
    const caseInsensitiveValue = caseInsensitiveKey
      ? normalizeUnknownText(record[caseInsensitiveKey])
      : null;

    if (caseInsensitiveValue) {
      return caseInsensitiveValue;
    }
  }

  return null;
}

function normalizeUnknownText(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    const normalized = String(value).trim();
    return normalized ? normalized : null;
  }

  return null;
}

function buildReferenceDetail(
  record: Record<string, unknown>,
  id: string | null,
  name: string
) {
  const selectedValues = Object.entries(record)
    .map(([key, value]) => [key, normalizeUnknownText(value)] as const)
    .filter(([, value]) => value)
    .filter(([, value]) => value !== id && value !== name)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${value}`);

  return selectedValues.length > 0 ? selectedValues.join(" | ") : null;
}

function getCatalogItems(
  results: Array<{
    endpoint: string;
    items: CuentiReferenceItem[];
  }>,
  endpoint: string
) {
  return results.find((result) => result.endpoint === endpoint)?.items ?? [];
}

function extractPagination(payload: CuentiRawResponse) {
  const data = payload.data;

  if (!isRecord(data) || !isRecord(data.pagination)) {
    return {
      totalPages: null
    };
  }

  const totalPages = Number(data.pagination.totalPages);

  return {
    totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : null
  };
}

function dedupeCuentiCustomers(customers: CuentiCustomer[]) {
  const customersByKey = new Map<string, CuentiCustomer>();

  for (const customer of customers) {
    const key =
      customer.cuentiCustomerId ??
      customer.identification ??
      customer.name.toLocaleLowerCase("es-CO");

    customersByKey.set(key, mergeCuentiCustomer(customersByKey.get(key), customer));
  }

  return [...customersByKey.values()];
}

function mergeCuentiCustomer(
  current: CuentiCustomer | undefined,
  next: CuentiCustomer
): CuentiCustomer {
  if (!current) {
    return next;
  }

  return {
    address: next.address ?? current.address,
    cuentiCustomerId: next.cuentiCustomerId ?? current.cuentiCustomerId,
    email: next.email ?? current.email,
    identification: next.identification ?? current.identification,
    name: next.name || current.name,
    notes: next.notes ?? current.notes,
    phone: next.phone ?? current.phone
  };
}

function countResponseItems(payload: CuentiRawResponse) {
  return extractResponseItems(payload).length;
}

function normalizeUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
