const DEFAULT_CUENTI_API_BASE_URL =
  "https://integrator-apps-api-dok.cuenti.co/api";
const DEFAULT_CUENTI_COMPANY_ID = "7760";

type CuentiRawResponse = {
  data?: unknown;
  message?: string;
  msg?: string;
  success?: boolean;
};

type CuentiCredentials = {
  baseUrl: string;
  companyId: string;
  token: string;
};

export type CuentiConfigStatus = {
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
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

export type CuentiProduct = {
  barcode: string | null;
  cuentiProductId: string | null;
  name: string;
  notes: string | null;
  salePrice: number | null;
  sku: string | null;
  standardCost: number | null;
  stockQty: number | null;
  unitName: string | null;
  weightKg: number | null;
};

export type CuentiProductListResult = {
  branchCandidates: string[];
  branchId: string | null;
  products: CuentiProduct[];
  rawItemsSeen: number;
};

export type CuentiProductStockResult = {
  branchCandidates: string[];
  branchId: string | null;
  rawItemsSeen: number;
  stockQty: number | null;
};

export type CuentiSaleSource = "invoice" | "order";

export type CuentiSaleSummary = {
  branchId: string | null;
  cuentiCustomerId: string | null;
  cuentiSaleId: string;
  customerAddress: string | null;
  customerIdentification: string | null;
  customerName: string | null;
  customerPhone: string | null;
  documentNumber: string | null;
  saleDate: string | null;
  source: CuentiSaleSource;
  status: string | null;
  totalAmount: number | null;
};

export type CuentiSaleItem = {
  cuentiProductId: string | null;
  name: string;
  quantity: number;
  sku: string | null;
  unitName: string | null;
};

export type CuentiSaleDetail = CuentiSaleSummary & {
  items: CuentiSaleItem[];
};

export type CuentiSalesListResult = {
  branchCandidates: string[];
  branchId: string | null;
  rawItemsSeen: number;
  sales: CuentiSaleSummary[];
};

export type CuentiInvoiceSyncItem = CuentiSaleItem & {
  costAmount: number | null;
  discountAmount: number | null;
  externalLineId: string | null;
  grossAmount: number | null;
  grossProfit: number | null;
  lineNumber: number | null;
  netAmount: number | null;
  rawPayload: unknown;
  taxAmount: number | null;
  totalAmount: number | null;
  unitCost: number | null;
  unitPrice: number | null;
};

export type CuentiInvoiceSyncDetail = CuentiSaleSummary & {
  balanceDue: number | null;
  costAmount: number | null;
  discountAmount: number | null;
  grossAmount: number | null;
  grossProfit: number | null;
  isVoided: boolean;
  items: CuentiInvoiceSyncItem[];
  netAmount: number | null;
  paidAmount: number | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  rawPayload: unknown;
  returnAmount: number | null;
  saleTime: string | null;
  sourceUpdatedAt: string | null;
  taxAmount: number | null;
};

export type CuentiInvoiceSyncRecord = {
  rawPayload: unknown;
  summary: CuentiSaleSummary;
};

export type CuentiInvoiceSyncPage = {
  branchId: string;
  page: number;
  pageSize: number;
  rawItemsSeen: number;
  records: CuentiInvoiceSyncRecord[];
  total: number | null;
  totalPages: number | null;
};

export type CuentiPaymentDirection = "IN" | "OUT" | "UNKNOWN";

export type CuentiPaymentSyncRecord = {
  amount: number | null;
  bankName: string | null;
  counterpartyExternalId: string | null;
  counterpartyName: string | null;
  direction: CuentiPaymentDirection;
  documentNumber: string | null;
  externalId: string;
  isVoided: boolean;
  paymentDate: string | null;
  paymentMethod: string | null;
  paymentTime: string | null;
  rawPayload: unknown;
  relatedDocumentId: string | null;
  relatedDocumentNumber: string | null;
  relatedDocumentType: string | null;
  sourceUpdatedAt: string | null;
  status: string | null;
};

export type CuentiPaymentSyncPage = {
  branchId: string;
  page: number;
  pageSize: number;
  rawItemsSeen: number;
  records: CuentiPaymentSyncRecord[];
  total: number | null;
  totalPages: number | null;
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
  const branchId = normalizeOptionalText(process.env.CUENTI_BRANCH_ID) ?? companyId;
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
    autoSyncEnabled: process.env.CUENTI_AUTO_SYNC_ENABLED === "true",
    autoSyncIntervalMinutes: Math.max(
      15,
      Number(process.env.CUENTI_AUTO_SYNC_INTERVAL_MINUTES ?? 60) || 60
    ),
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

export async function getAllCuentiProducts(): Promise<CuentiProductListResult> {
  const status = getCuentiConfigStatus();

  if (!status.branchId) {
    throw new CuentiIntegrationError(
      "missing_cuenti_branch",
      "Falta configurar CUENTI_BRANCH_ID."
    );
  }

  const credentials = getCuentiCredentials();
  const branchCandidates = await getCuentiProductBranchCandidates(
    credentials,
    status
  );
  let bestResult: CuentiProductBranchResult | null = null;

  for (const branchId of branchCandidates) {
    const firstPageResult = await getCuentiProductsForBranch(credentials, branchId, 1);
    const branchResult =
      firstPageResult.rawItemsSeen > 0
        ? firstPageResult
        : await getCuentiProductsForBranch(credentials, branchId, 0);

    if (!bestResult || branchResult.rawItemsSeen > bestResult.rawItemsSeen) {
      bestResult = branchResult;
    }

    if (branchResult.products.length > 0) {
      return {
        branchCandidates,
        branchId,
        products: dedupeCuentiProducts(branchResult.products),
        rawItemsSeen: branchResult.rawItemsSeen
      };
    }
  }

  return {
    branchCandidates,
    branchId: bestResult?.branchId ?? null,
    products: [],
    rawItemsSeen: bestResult?.rawItemsSeen ?? 0
  };
}

export async function getCuentiProductStock(
  ref: string
): Promise<CuentiProductStockResult> {
  const normalizedRef = normalizeOptionalText(ref);
  const status = getCuentiConfigStatus();

  if (!normalizedRef) {
    throw new CuentiIntegrationError(
      "missing_cuenti_product_ref",
      "Falta la referencia del producto de Cuenti."
    );
  }

  if (!status.branchId) {
    throw new CuentiIntegrationError(
      "missing_cuenti_branch",
      "Falta configurar CUENTI_BRANCH_ID."
    );
  }

  const credentials = getCuentiCredentials();
  const branchCandidates = await getCuentiProductBranchCandidates(
    credentials,
    status
  );
  let bestResult: CuentiProductStockBranchResult | null = null;

  for (const branchId of branchCandidates) {
    try {
      const branchResult = await getCuentiProductStockForBranch(
        credentials,
        branchId,
        normalizedRef
      );

      if (!bestResult || branchResult.rawItemsSeen > bestResult.rawItemsSeen) {
        bestResult = branchResult;
      }

      if (branchResult.stockQty !== null) {
        return {
          branchCandidates,
          branchId,
          rawItemsSeen: branchResult.rawItemsSeen,
          stockQty: branchResult.stockQty
        };
      }
    } catch (error) {
      console.warn("Could not load Cuenti product stock for branch", {
        branchId,
        message: error instanceof Error ? error.message : "Unknown Cuenti error"
      });
    }
  }

  return {
    branchCandidates,
    branchId: bestResult?.branchId ?? null,
    rawItemsSeen: bestResult?.rawItemsSeen ?? 0,
    stockQty: bestResult?.stockQty ?? null
  };
}

export async function getCuentiSales(input?: {
  dateFrom?: string | null;
  dateTo?: string | null;
  page?: number | null;
  pageSize?: number | null;
}): Promise<CuentiSalesListResult> {
  const status = getCuentiConfigStatus();

  if (!status.branchId) {
    throw new CuentiIntegrationError(
      "missing_cuenti_branch",
      "Falta configurar CUENTI_BRANCH_ID."
    );
  }

  const credentials = getCuentiCredentials();
  const branchCandidates = await getCuentiProductBranchCandidates(
    credentials,
    status
  );
  let bestResult: CuentiSalesBranchResult | null = null;
  let lastError: unknown = null;

  for (const branchId of branchCandidates) {
    try {
      const requestedPage = normalizePositiveInteger(input?.page, 1);
      const branchResult = await getCuentiSalesForBranch(
        credentials,
        branchId,
        {
          dateFrom: normalizeDateFilter(input?.dateFrom),
          dateTo: normalizeDateFilter(input?.dateTo),
          page: requestedPage,
          pageSize: normalizePositiveInteger(input?.pageSize, 30)
        }
      );

      if (!bestResult || branchResult.rawItemsSeen > bestResult.rawItemsSeen) {
        bestResult = branchResult;
      }

      if (branchResult.sales.length > 0) {
        return {
          branchCandidates,
          branchId,
          rawItemsSeen: branchResult.rawItemsSeen,
          sales: branchResult.sales
        };
      }
    } catch (error) {
      lastError = error;
      console.warn("Could not load Cuenti sales for branch", {
        branchId,
        message: error instanceof Error ? error.message : "Unknown Cuenti error"
      });
    }
  }

  if (!bestResult && lastError) {
    throw lastError;
  }

  return {
    branchCandidates,
    branchId: bestResult?.branchId ?? null,
    rawItemsSeen: bestResult?.rawItemsSeen ?? 0,
    sales: bestResult?.sales ?? []
  };
}

export async function getCuentiSaleDetail(
  ref: string,
  source: CuentiSaleSource = "invoice"
): Promise<CuentiSaleDetail | null> {
  const normalizedRef = normalizeOptionalText(ref);
  const status = getCuentiConfigStatus();

  if (!normalizedRef) {
    throw new CuentiIntegrationError(
      "missing_cuenti_sale_ref",
      "Falta la referencia de la venta de Cuenti."
    );
  }

  if (!status.branchId) {
    throw new CuentiIntegrationError(
      "missing_cuenti_branch",
      "Falta configurar CUENTI_BRANCH_ID."
    );
  }

  const credentials = getCuentiCredentials();
  const branchCandidates = await getCuentiProductBranchCandidates(
    credentials,
    status
  );
  let bestResult: CuentiSaleDetailBranchResult | null = null;
  let bestScore = -1;
  let lastError: unknown = null;

  for (const branchId of branchCandidates) {
    try {
      const branchResult = await getCuentiSaleDetailForBranch(
        credentials,
        branchId,
        normalizedRef,
        source
      );
      const branchScore = scoreCuentiSaleDetail(branchResult.sale);

      if (!bestResult || branchScore > bestScore) {
        bestResult = branchResult;
        bestScore = branchScore;
      }

      if (
        branchResult.sale?.customerName &&
        branchResult.sale.items.length > 0
      ) {
        return branchResult.sale;
      }
    } catch (error) {
      lastError = error;
      console.warn("Could not load Cuenti sale detail for branch", {
        branchId,
        message: error instanceof Error ? error.message : "Unknown Cuenti error",
        ref: normalizedRef
      });
    }
  }

  if (!bestResult && lastError) {
    throw lastError;
  }

  return bestResult?.sale ?? null;
}

export async function getCuentiInvoiceSyncPage(input: {
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize?: number;
}): Promise<CuentiInvoiceSyncPage> {
  const status = getCuentiConfigStatus();

  if (!status.branchId) {
    throw new CuentiIntegrationError(
      "missing_cuenti_branch",
      "Falta configurar CUENTI_BRANCH_ID."
    );
  }

  const credentials = getCuentiCredentials();
  const page = Math.max(1, normalizePositiveInteger(input.page, 1));
  const pageSize = Math.min(
    200,
    Math.max(1, normalizePositiveInteger(input.pageSize, 100))
  );
  const payload = await requestCuentiData(credentials, "invoices", {
    branchId: status.branchId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    page: String(page),
    pageSize: String(pageSize)
  });
  const rawItems = extractResponseItems(payload);
  const records = rawItems
    .map((rawPayload) => {
      const summary = mapCuentiSaleSummary(rawPayload, status.branchId, "invoice");

      return summary ? { rawPayload, summary } : null;
    })
    .filter((record): record is CuentiInvoiceSyncRecord => Boolean(record));
  const pagination = extractCuentiPagination(payload);

  return {
    branchId: status.branchId,
    page: pagination.page ?? page,
    pageSize: pagination.pageSize ?? pageSize,
    rawItemsSeen: rawItems.length,
    records,
    total: pagination.total,
    totalPages: pagination.totalPages
  };
}

export async function getCuentiInvoiceSyncDetail(
  ref: string
): Promise<CuentiInvoiceSyncDetail | null> {
  const normalizedRef = normalizeOptionalText(ref);
  const status = getCuentiConfigStatus();

  if (!normalizedRef) {
    throw new CuentiIntegrationError(
      "missing_cuenti_sale_ref",
      "Falta la referencia de la factura de Cuenti."
    );
  }

  if (!status.branchId) {
    throw new CuentiIntegrationError(
      "missing_cuenti_branch",
      "Falta configurar CUENTI_BRANCH_ID."
    );
  }

  const credentials = getCuentiCredentials();
  const payload = await requestCuentiData(credentials, "invoice", {
    branchId: status.branchId,
    ref: normalizedRef
  });

  return mapCuentiInvoiceSyncDetail(
    payload,
    status.branchId,
    normalizedRef
  );
}

export async function getCuentiPaymentSyncPage(input: {
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize?: number;
}): Promise<CuentiPaymentSyncPage> {
  const status = getCuentiConfigStatus();

  if (!status.branchId) {
    throw new CuentiIntegrationError(
      "missing_cuenti_branch",
      "Falta configurar CUENTI_BRANCH_ID."
    );
  }

  const credentials = getCuentiCredentials();
  const page = Math.max(1, normalizePositiveInteger(input.page, 1));
  const pageSize = Math.min(
    200,
    Math.max(1, normalizePositiveInteger(input.pageSize, 100))
  );
  const payload = await requestCuentiData(credentials, "payments", {
    branchId: status.branchId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    page: String(page),
    pageSize: String(pageSize)
  });
  const rawItems = extractResponseItems(payload);
  const records = rawItems
    .map((rawPayload) =>
      mapCuentiPaymentSyncRecord(rawPayload, null, rawPayload)
    )
    .filter((record): record is CuentiPaymentSyncRecord => Boolean(record));
  const pagination = extractCuentiPagination(payload);

  return {
    branchId: status.branchId,
    page: pagination.page ?? page,
    pageSize: pagination.pageSize ?? pageSize,
    rawItemsSeen: rawItems.length,
    records,
    total: pagination.total,
    totalPages: pagination.totalPages
  };
}

export async function getCuentiPaymentSyncDetail(
  ref: string
): Promise<CuentiPaymentSyncRecord | null> {
  const normalizedRef = normalizeOptionalText(ref);
  const status = getCuentiConfigStatus();

  if (!normalizedRef) {
    throw new CuentiIntegrationError(
      "missing_cuenti_payment_ref",
      "Falta la referencia del pago de Cuenti."
    );
  }

  if (!status.branchId) {
    throw new CuentiIntegrationError(
      "missing_cuenti_branch",
      "Falta configurar CUENTI_BRANCH_ID."
    );
  }

  const credentials = getCuentiCredentials();
  const payload = await requestCuentiData(credentials, "payment", {
    branchId: status.branchId,
    ref: normalizedRef
  });

  return mapCuentiPaymentSyncRecord(payload, normalizedRef, payload);
}

export async function getCuentiPurchaseSyncDetail(
  ref: string
): Promise<CuentiInvoiceSyncDetail | null> {
  const normalizedRef = normalizeOptionalText(ref);
  const status = getCuentiConfigStatus();

  if (!normalizedRef) {
    throw new CuentiIntegrationError(
      "missing_cuenti_purchase_ref",
      "Falta la referencia de la compra de Cuenti."
    );
  }

  if (!status.branchId) {
    throw new CuentiIntegrationError(
      "missing_cuenti_branch",
      "Falta configurar CUENTI_BRANCH_ID."
    );
  }

  const credentials = getCuentiCredentials();
  const payload = await requestCuentiData(credentials, "purchase", {
    branchId: status.branchId,
    ref: normalizedRef
  });
  const detail = mapCuentiInvoiceSyncDetail(
    payload,
    status.branchId,
    normalizedRef
  );

  return detail
    ? {
        ...detail,
        cuentiSaleId: normalizedRef,
        rawPayload: payload
      }
    : null;
}

function scoreCuentiSaleDetail(sale: CuentiSaleDetail | null) {
  if (!sale) {
    return -1;
  }

  return (
    (sale.customerName ? 20 : 0) +
    (sale.customerIdentification ? 8 : 0) +
    (sale.documentNumber ? 8 : 0) +
    (sale.saleDate ? 4 : 0) +
    sale.items.length * 2
  );
}

type CuentiProductBranchResult = {
  branchId: string;
  products: CuentiProduct[];
  rawItemsSeen: number;
};

type CuentiProductStockBranchResult = {
  branchId: string;
  rawItemsSeen: number;
  stockQty: number | null;
};

type CuentiSalesBranchResult = {
  branchId: string;
  rawItemsSeen: number;
  sales: CuentiSaleSummary[];
};

type CuentiSaleDetailBranchResult = {
  branchId: string;
  rawItemsSeen: number;
  sale: CuentiSaleDetail | null;
};

async function getCuentiProductsForBranch(
  credentials: CuentiCredentials,
  branchId: string,
  firstPage: number
): Promise<CuentiProductBranchResult> {
  const products: CuentiProduct[] = [];
  const defaultProductPageSize = 20;
  const maxPages = 100;
  let rawItemsSeen = 0;

  for (let page = firstPage; page < firstPage + maxPages; page += 1) {
    const payload = await requestCuentiData(credentials, "products", {
      branchId,
      page: String(page)
    });
    const items = extractResponseItems(payload);
    let mappedOnPage = 0;
    rawItemsSeen += items.length;

    for (const item of items) {
      const product = mapCuentiProduct(item);

      if (product) {
        products.push(product);
        mappedOnPage += 1;
      }
    }

    if (items.length > 0 && mappedOnPage === 0) {
      console.warn("Cuenti products page had items but none could be mapped", {
        branchId,
        firstItemKeys: getInspectableKeys(items[0]),
        page,
        rawItems: items.length
      });
    }

    const pagination = extractPagination(payload);

    if (items.length === 0) break;
    if (pagination.totalPages && page >= pagination.totalPages) break;
    if (!pagination.totalPages && items.length < defaultProductPageSize) break;
  }

  if (rawItemsSeen > 0 && products.length === 0) {
    console.warn("Cuenti products response had raw items but no usable products", {
      branchId,
      rawItemsSeen
    });
  }

  return {
    branchId,
    products,
    rawItemsSeen
  };
}

async function getCuentiProductBranchCandidates(
  credentials: CuentiCredentials,
  status: CuentiConfigStatus
) {
  const candidates = [status.branchId, status.companyId].filter(
    (value): value is string => Boolean(value)
  );

  try {
    const payload = await requestCuentiData(credentials, "branches");
    const branchIds = extractCatalogItems(payload, "branches").map((branch) => branch.id);

    candidates.push(...branchIds);
  } catch (error) {
    console.warn("Could not load Cuenti branches before product sync", {
      message: error instanceof Error ? error.message : "Unknown Cuenti error"
    });
  }

  return uniqueStrings(candidates);
}

async function getCuentiProductStockForBranch(
  credentials: CuentiCredentials,
  branchId: string,
  ref: string
): Promise<CuentiProductStockBranchResult> {
  const payload = await requestCuentiData(credentials, "inventory", {
    branchId,
    ref
  });
  const items = extractResponseItems(payload);
  const stockQty = mapCuentiStockItems(items, payload);

  if (items.length > 0 && stockQty === null) {
    console.warn("Cuenti inventory response had items but no stock value", {
      branchId,
      firstItemKeys: getInspectableKeys(items[0]),
      ref,
      rawItems: items.length
    });
  }

  return {
    branchId,
    rawItemsSeen: items.length,
    stockQty
  };
}

async function getCuentiSalesForBranch(
  credentials: CuentiCredentials,
  branchId: string,
  input: {
    dateFrom: string | null;
    dateTo: string | null;
    page: number;
    pageSize: number;
  }
): Promise<CuentiSalesBranchResult> {
  const searchParams: Record<string, string> = {
    branchId,
    page: String(input.page),
    pageSize: String(input.pageSize)
  };

  if (input.dateFrom) searchParams.dateFrom = input.dateFrom;
  if (input.dateTo) searchParams.dateTo = input.dateTo;

  const sources: Array<{
    endpoint: string;
    source: CuentiSaleSource;
  }> = [
    { endpoint: "invoices", source: "invoice" },
    { endpoint: "orders", source: "order" }
  ];
  const sales: CuentiSaleSummary[] = [];
  let rawItemsSeen = 0;
  let successfulSources = 0;
  let lastError: unknown = null;

  for (const { endpoint, source } of sources) {
    try {
      const payload = await requestCuentiData(
        credentials,
        endpoint,
        searchParams
      );
      const items = extractResponseItems(payload);
      const mappedSales = items
        .map((item) => mapCuentiSaleSummary(item, branchId, source))
        .filter((item): item is CuentiSaleSummary => Boolean(item));

      successfulSources += 1;
      rawItemsSeen += items.length;
      sales.push(...mappedSales);

      if (items.length > 0 && mappedSales.length === 0) {
        console.warn(`Cuenti ${endpoint} response had no usable sales`, {
          branchId,
          firstItemKeys: getInspectableKeys(items[0]),
          rawItems: items.length
        });
      }
    } catch (error) {
      lastError = error;
      console.warn(`Could not load Cuenti ${endpoint}`, {
        branchId,
        message: error instanceof Error ? error.message : "Unknown Cuenti error"
      });
    }
  }

  if (successfulSources === 0 && lastError) {
    throw lastError;
  }

  return {
    branchId,
    rawItemsSeen,
    sales: dedupeAndSortCuentiSales(sales)
  };
}

async function getCuentiSaleDetailForBranch(
  credentials: CuentiCredentials,
  branchId: string,
  ref: string,
  source: CuentiSaleSource
): Promise<CuentiSaleDetailBranchResult> {
  const payload = await requestCuentiData(credentials, source, {
    branchId,
    ref
  });
  const sale = mapCuentiSaleDetail(payload, branchId, ref, source);

  return {
    branchId,
    rawItemsSeen: countResponseItems(payload),
    sale
  };
}

function getCuentiCredentials(): CuentiCredentials {
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
  credentials: CuentiCredentials,
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

function buildCuentiHeaders(credentials: CuentiCredentials) {
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
  const message =
    typeof payload.message === "string" && payload.message.trim()
      ? payload.message.trim()
      : typeof payload.msg === "string" && payload.msg.trim()
        ? payload.msg.trim()
        : null;

  return message
    ? message
    : null;
}

function extractCatalogItems(payload: CuentiRawResponse, endpoint: string) {
  return extractResponseItems(payload)
    .map((item, index) => mapReferenceItem(item, endpoint, index))
    .filter((item): item is CuentiReferenceItem => Boolean(item));
}

function extractResponseItems(payload: CuentiRawResponse) {
  return extractItemsFromUnknown(payload) ?? [];
}

function extractCuentiPagination(payload: CuentiRawResponse) {
  const data = getCaseInsensitiveValue(payload, "data");
  const pagination =
    (isRecord(data) && getCaseInsensitiveValue(data, "pagination")) ??
    getCaseInsensitiveValue(payload, "pagination");
  const record = isRecord(pagination) ? pagination : {};

  return {
    page: normalizeIntegerOrNull(
      getCaseInsensitiveValue(record, "page")
    ),
    pageSize: normalizeIntegerOrNull(
      getCaseInsensitiveValue(record, "pageSize") ??
        getCaseInsensitiveValue(record, "page_size")
    ),
    total: normalizeIntegerOrNull(
      getCaseInsensitiveValue(record, "total")
    ),
    totalPages: normalizeIntegerOrNull(
      getCaseInsensitiveValue(record, "totalPages") ??
        getCaseInsensitiveValue(record, "total_pages")
    )
  };
}

function extractItemsFromUnknown(value: unknown, depth = 0): unknown[] | null {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value) || depth > 4) {
    return null;
  }

  const dataValue = getCaseInsensitiveValue(value, "data");

  if (dataValue !== undefined) {
    const dataItems = extractItemsFromUnknown(dataValue, depth + 1);

    if (dataItems !== null) {
      return dataItems;
    }

    if (isRecord(dataValue)) {
      return [dataValue];
    }
  }

  const listKeys = [
    "items",
    "rows",
    "records",
    "results",
    "result",
    "productos",
    "products",
    "lista",
    "list",
    "content"
  ];

  for (const key of listKeys) {
    const nestedValue = getCaseInsensitiveValue(value, key);

    if (nestedValue === undefined) {
      continue;
    }

    const nestedItems = extractItemsFromUnknown(nestedValue, depth + 1);

    if (nestedItems !== null) {
      return nestedItems;
    }
  }

  const firstArray = Object.values(value).find((entry) => Array.isArray(entry));

  return Array.isArray(firstArray) ? firstArray : null;
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

function mapCuentiSaleSummary(
  value: unknown,
  branchId: string | null,
  source: CuentiSaleSource
): CuentiSaleSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const record = flattenRecord(value);
  const cuentiSaleId = findCuentiTransactionId(record, source);
  const documentNumber = findFirstTextValue(record, [
    "numero_factura",
    "numeroFactura",
    "factura",
    "invoice_number",
    "numero_pedido",
    "numeroPedido",
    "pedido",
    "orderNumber",
    "order_number",
    "consecutivo",
    "numero_consecutivo",
    "numeroConsecutivo",
    "numero",
    "documento",
    "documentNumber",
    "document_number",
    "codigo",
    "ref",
    "referencia"
  ]);
  const customerName =
    buildCuentiCustomerName(record) ??
    findFirstTextValue(record, [
      "nombre_tercero",
      "tercero",
      "nombre_proveedor",
      "nombreProveedor",
      "proveedor",
      "supplierName",
      "supplier_name",
      "customerName",
      "customer_name",
      "razon_social_cliente",
      "cliente_nombre"
    ]);
  const saleDate = normalizeCuentiDate(
    findFirstTextValue(record, [
      "fecha",
      "date_register",
      "fecha_factura",
      "fechaFactura",
      "fecha_pedido",
      "fechaPedido",
      "fecha_registro",
      "fechaRegistro",
      "createdAt",
      "created_at",
      "date",
      "invoiceDate",
      "orderDate",
      "saleDate"
    ])
  );
  const totalAmount = findFirstNumberValue(record, [
    "total",
    "valor_total",
    "valorTotal",
    "total_factura",
    "totalFactura",
    "gran_total",
    "grandTotal",
    "neto",
    "valor"
  ]);

  if (!cuentiSaleId && !documentNumber && !customerName) {
    return null;
  }

  return {
    branchId,
    cuentiCustomerId: findFirstTextValue(record, [
      "id_cliente",
      "idCliente",
      "customerId",
      "id_customer",
      "idTercero",
      "tercero_id",
      "id_tercero",
      "id_proveedor",
      "idProveedor",
      "supplierId",
      "supplier_id"
    ]),
    cuentiSaleId: cuentiSaleId ?? documentNumber ?? `${customerName}-${saleDate ?? ""}`,
    customerAddress: findFirstTextValue(record, [
      "direccion",
      "direccion_cliente",
      "direccionCliente",
      "customerAddress",
      "address"
    ]),
    customerIdentification: findFirstTextValue(record, [
      "identificacion",
      "identificacion_cliente",
      "numero_identificacion",
      "identificacionCliente",
      "nitCliente",
      "nit",
      "documento_cliente",
      "document",
      "customerDocument"
    ]),
    customerName,
    customerPhone: findFirstTextValue(record, [
      "telefono1",
      "telefono2",
      "telefono",
      "telefono_cliente",
      "customerPhone",
      "phone",
      "celular",
      "mobile"
    ]),
    documentNumber,
    saleDate,
    source,
    status: findFirstTextValue(record, [
      "estado",
      "status",
      "state",
      "estado_factura",
      "estado_pedido",
      "orderStatus",
      "invoiceStatus"
    ]),
    totalAmount
  };
}

function mapCuentiSaleDetail(
  payload: CuentiRawResponse,
  branchId: string,
  fallbackRef: string,
  source: CuentiSaleSource
): CuentiSaleDetail | null {
  const detailSource = getCaseInsensitiveValue(payload, "data") ?? payload;
  const headerSource = resolveCuentiSaleHeader(detailSource) ?? payload;
  const summary =
    mapCuentiSaleSummary(headerSource, branchId, source) ??
    mapCuentiSaleSummary(payload, branchId, source) ?? {
      branchId,
      cuentiCustomerId: null,
      cuentiSaleId: fallbackRef,
      customerAddress: null,
      customerIdentification: null,
      customerName: null,
      customerPhone: null,
      documentNumber: null,
      saleDate: null,
      source,
      status: null,
      totalAmount: null
    };
  const itemCandidates = extractCuentiSaleItemCandidates(detailSource);
  const items = itemCandidates
    .map(mapCuentiSaleItem)
    .filter((item): item is CuentiSaleItem => Boolean(item));

  return {
    ...summary,
    branchId,
    cuentiSaleId: summary.cuentiSaleId || fallbackRef,
    source,
    items
  };
}

function mapCuentiInvoiceSyncDetail(
  payload: CuentiRawResponse,
  branchId: string,
  fallbackRef: string
): CuentiInvoiceSyncDetail | null {
  const detailSource = getCaseInsensitiveValue(payload, "data") ?? payload;
  const headerSource = resolveCuentiSaleHeader(detailSource) ?? payload;
  const summary =
    mapCuentiSaleSummary(headerSource, branchId, "invoice") ??
    mapCuentiSaleSummary(payload, branchId, "invoice");

  if (!summary) {
    return null;
  }

  const headerRecord = isRecord(headerSource)
    ? flattenRecord(headerSource)
    : flattenRecord(payload);
  const items = extractCuentiSaleItemCandidates(detailSource)
    .map(mapCuentiInvoiceSyncItem)
    .filter((item): item is CuentiInvoiceSyncItem => Boolean(item));
  const itemCostAmount = sumKnownAmounts(items.map((item) => item.costAmount));
  const itemNetAmount = sumKnownAmounts(items.map((item) => item.netAmount));
  const itemTaxAmount = sumKnownAmounts(items.map((item) => item.taxAmount));
  const itemTotalAmount = sumKnownAmounts(items.map((item) => item.totalAmount));
  const taxAmount = findFirstNumberValue(headerRecord, [
    "total_impuestos",
    "totalImpuestos",
    "tax_amount",
    "taxAmount",
    "impuestos",
    "iva",
    "total_iva"
  ]) ?? itemTaxAmount;
  const grossAmount =
    findFirstNumberValue(headerRecord, [
      "total_neto",
      "totalNeto",
      "total",
      "valor_total",
      "valorTotal",
      "total_factura",
      "totalFactura",
      "grandTotal",
      "total_amount"
    ]) ??
    summary.totalAmount ??
    itemTotalAmount;
  const netAmount =
    findFirstNumberValue(headerRecord, [
      "total_sin_impuestos",
      "totalSinImpuestos",
      "subtotal_sin_impuestos",
      "subtotalSinImpuestos",
      "net_amount",
      "netAmount",
      "subtotal"
    ]) ??
    itemNetAmount ??
    subtractKnownAmounts(grossAmount, taxAmount);
  const costAmount =
    findFirstNumberValue(headerRecord, [
      "costo_total",
      "costoTotal",
      "total_costo",
      "totalCosto",
      "cost_amount",
      "costAmount",
      "total_cost"
    ]) ?? itemCostAmount;
  const grossProfit =
    findFirstNumberValue(headerRecord, [
      "utilidad",
      "utilidad_total",
      "utilidadTotal",
      "gross_profit",
      "grossProfit",
      "profit"
    ]) ?? subtractKnownAmounts(netAmount, costAmount);

  return {
    ...summary,
    balanceDue: findFirstNumberValue(headerRecord, [
      "total_pendiente_pago",
      "totalPendientePago",
      "saldo_pendiente",
      "saldoPendiente",
      "balance_due",
      "balanceDue"
    ]),
    costAmount,
    cuentiSaleId: summary.cuentiSaleId || fallbackRef,
    discountAmount: findFirstNumberValue(headerRecord, [
      "total_descuento",
      "totalDescuento",
      "descuento",
      "discount_amount",
      "discountAmount"
    ]),
    grossAmount,
    grossProfit,
    isVoided:
      findFirstBooleanValue(headerRecord, [
        "es_nula",
        "esNula",
        "anulada",
        "is_voided",
        "isVoided",
        "voided"
      ]) ?? isVoidedStatus(summary.status),
    items,
    netAmount,
    paidAmount: findFirstNumberValue(headerRecord, [
      "total_abono",
      "total_Abono",
      "totalAbono",
      "valor_pagado",
      "valorPagado",
      "paid_amount",
      "paidAmount"
    ]),
    paymentMethod: findFirstTextValue(headerRecord, [
      "medio_pago",
      "medioPago",
      "payment_method",
      "paymentMethod",
      "forma_pago",
      "formaPago"
    ]),
    paymentStatus: findFirstTextValue(headerRecord, [
      "estado_pago",
      "estadoPago",
      "payment_status",
      "paymentStatus"
    ]),
    rawPayload: payload,
    returnAmount: findFirstNumberValue(headerRecord, [
      "total_devoluciones",
      "totalDevoluciones",
      "devoluciones",
      "return_amount",
      "returnAmount"
    ]),
    saleTime: normalizeCuentiTime(
      findFirstTextValue(headerRecord, [
        "hora",
        "hora_factura",
        "horaFactura",
        "sale_time",
        "saleTime",
        "time"
      ])
    ),
    sourceUpdatedAt: normalizeCuentiTimestamp(
      findFirstTextValue(headerRecord, [
        "updatedAt",
        "updated_at",
        "fecha_actualizacion",
        "fechaActualizacion",
        "date_updated",
        "fecha_generacion",
        "fechaGeneracion"
      ])
    ),
    taxAmount
  };
}

function mapCuentiPaymentSyncRecord(
  value: unknown,
  fallbackRef: string | null,
  rawPayload: unknown
): CuentiPaymentSyncRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const detailSource = getCaseInsensitiveValue(value, "data") ?? value;
  const record = isRecord(detailSource)
    ? flattenRecord(detailSource)
    : flattenRecord(value);
  const externalId =
    findFirstTextValue(record, [
      "id_pago",
      "idPago",
      "paymentId",
      "payment_id",
      "id_transaccion",
      "idTransaccion",
      "transactionId",
      "transaction_id",
      "id"
    ]) ?? fallbackRef;

  if (!externalId) {
    return null;
  }

  const directionText = findFirstTextValue(record, [
    "naturaleza",
    "direction",
    "tipo_movimiento",
    "tipoMovimiento",
    "movement_type",
    "movementType",
    "tipo_pago",
    "tipoPago",
    "payment_type",
    "paymentType",
    "tipo_documento",
    "tipoDocumento"
  ]);
  const amount = findFirstNumberValue(record, [
    "valor_pago",
    "valorPago",
    "payment_amount",
    "paymentAmount",
    "valor",
    "amount",
    "total",
    "monto"
  ]);
  const status = findFirstTextValue(record, [
    "estado",
    "status",
    "state",
    "estado_pago",
    "estadoPago"
  ]);

  return {
    amount: amount === null ? null : Math.abs(amount),
    bankName: findFirstTextValue(record, [
      "nombre_banco",
      "nombreBanco",
      "banco",
      "bank_name",
      "bankName",
      "bank"
    ]),
    counterpartyExternalId: findFirstTextValue(record, [
      "id_tercero",
      "idTercero",
      "id_cliente",
      "idCliente",
      "id_proveedor",
      "idProveedor",
      "counterpartyId",
      "customerId",
      "supplierId"
    ]),
    counterpartyName: findFirstTextValue(record, [
      "nombre_tercero",
      "nombreTercero",
      "tercero",
      "nombre_cliente",
      "nombreCliente",
      "cliente",
      "nombre_proveedor",
      "nombreProveedor",
      "proveedor",
      "counterpartyName",
      "customerName",
      "supplierName"
    ]),
    direction: normalizePaymentDirection(directionText, amount),
    documentNumber: findFirstTextValue(record, [
      "numero_pago",
      "numeroPago",
      "paymentNumber",
      "payment_number",
      "consecutivo",
      "numero",
      "documentNumber"
    ]),
    externalId,
    isVoided:
      findFirstBooleanValue(record, [
        "es_nulo",
        "esNulo",
        "anulado",
        "anulada",
        "is_voided",
        "isVoided",
        "voided"
      ]) ?? isVoidedStatus(status),
    paymentDate: normalizeCuentiDate(
      findFirstTextValue(record, [
        "fecha_pago",
        "fechaPago",
        "paymentDate",
        "payment_date",
        "fecha",
        "date_register",
        "fecha_registro",
        "fechaRegistro",
        "createdAt",
        "created_at",
        "date"
      ])
    ),
    paymentMethod: findFirstTextValue(record, [
      "medio_pago",
      "medioPago",
      "nombre_medio_pago",
      "nombreMedioPago",
      "forma_pago",
      "formaPago",
      "payment_method",
      "paymentMethod"
    ]),
    paymentTime: normalizeCuentiTime(
      findFirstTextValue(record, [
        "hora",
        "hora_pago",
        "horaPago",
        "payment_time",
        "paymentTime",
        "time"
      ])
    ),
    rawPayload,
    relatedDocumentId: findFirstTextValue(record, [
      "id_documento",
      "idDocumento",
      "documentId",
      "document_id",
      "id_factura",
      "idFactura",
      "invoiceId",
      "invoice_id",
      "id_compra",
      "idCompra",
      "purchaseId",
      "purchase_id"
    ]),
    relatedDocumentNumber: findFirstTextValue(record, [
      "numero_documento",
      "numeroDocumento",
      "documentNumber",
      "document_number",
      "numero_factura",
      "numeroFactura",
      "invoiceNumber",
      "numero_compra",
      "numeroCompra",
      "purchaseNumber"
    ]),
    relatedDocumentType: findFirstTextValue(record, [
      "tipo_documento",
      "tipoDocumento",
      "documentType",
      "document_type",
      "nombre_tipo_documento",
      "nombreTipoDocumento"
    ]),
    sourceUpdatedAt: normalizeCuentiTimestamp(
      findFirstTextValue(record, [
        "updatedAt",
        "updated_at",
        "fecha_actualizacion",
        "fechaActualizacion",
        "date_updated"
      ])
    ),
    status
  };
}

function normalizePaymentDirection(
  value: string | null,
  amount: number | null
): CuentiPaymentDirection {
  const normalized = normalizeFieldKey(value ?? "");
  const incomingTerms = [
    "ingreso",
    "entrada",
    "recibido",
    "recaudo",
    "cobro",
    "income"
  ];
  const outgoingTerms = [
    "egreso",
    "salida",
    "proveedor",
    "compra",
    "gasto",
    "expense"
  ];

  if (
    normalized === "in" ||
    incomingTerms.some((term) => normalized === term || normalized.includes(term))
  ) {
    return "IN";
  }

  if (
    normalized === "out" ||
    outgoingTerms.some((term) => normalized === term || normalized.includes(term))
  ) {
    return "OUT";
  }

  if (amount !== null && amount < 0) {
    return "OUT";
  }

  return "UNKNOWN";
}

function mapCuentiInvoiceSyncItem(value: unknown): CuentiInvoiceSyncItem | null {
  const baseItem = mapCuentiSaleItem(value);

  if (!baseItem || !isRecord(value)) {
    return null;
  }

  const record = flattenRecord(value);
  const quantity = baseItem.quantity;
  const explicitUnitCost = findFirstNumberValue(record, [
    "costo_unitario",
    "costoUnitario",
    "unit_cost",
    "unitCost",
    "cost"
  ]);
  const explicitCostAmount = findFirstNumberValue(record, [
    "costo_total",
    "costoTotal",
    "total_costo",
    "totalCosto",
    "total_cost",
    "cost_amount",
    "costAmount"
  ]);
  const costAmount =
    explicitCostAmount ??
    (explicitUnitCost !== null ? explicitUnitCost * quantity : null);
  const unitCost =
    explicitUnitCost ??
    (costAmount !== null && quantity !== 0 ? costAmount / quantity : null);
  const unitPrice = findFirstNumberValue(record, [
    "precio_unitario",
    "precioUnitario",
    "unit_price",
    "unitPrice",
    "real_price",
    "realPrice",
    "price"
  ]);
  const taxAmount = findFirstNumberValue(record, [
    "valor_impuesto",
    "valorImpuesto",
    "total_impuestos",
    "totalImpuestos",
    "tax_amount",
    "taxAmount",
    "tax"
  ]);
  const totalAmount =
    findFirstNumberValue(record, [
      "total_neto",
      "totalNeto",
      "total",
      "valor_total",
      "valorTotal",
      "total_amount",
      "totalAmount"
    ]) ?? (unitPrice !== null ? unitPrice * quantity : null);
  const netAmount =
    findFirstNumberValue(record, [
      "total_sin_impuestos",
      "totalSinImpuestos",
      "net_amount",
      "netAmount",
      "subtotal",
      "total_before_tax",
      "totalBeforeTax"
    ]) ?? subtractKnownAmounts(totalAmount, taxAmount);
  const grossProfit = subtractKnownAmounts(netAmount, costAmount);

  return {
    ...baseItem,
    costAmount,
    discountAmount: findFirstNumberValue(record, [
      "descuento",
      "discount",
      "discount_amount",
      "discountAmount"
    ]),
    externalLineId: findFirstTextValue(record, [
      "id_detalle",
      "idDetalle",
      "detail_id",
      "detailId",
      "line_id",
      "lineId",
      "id"
    ]),
    grossAmount: totalAmount,
    grossProfit,
    lineNumber: findFirstNumberValue(record, [
      "linea",
      "linea_numero",
      "lineNumber",
      "line_number",
      "item"
    ]),
    netAmount,
    rawPayload: value,
    taxAmount,
    totalAmount,
    unitCost,
    unitPrice
  };
}

function dedupeAndSortCuentiSales(sales: CuentiSaleSummary[]) {
  const uniqueSales = new Map<string, CuentiSaleSummary>();

  for (const sale of sales) {
    const key = `${sale.source}:${sale.cuentiSaleId}`;

    if (!uniqueSales.has(key)) {
      uniqueSales.set(key, sale);
    }
  }

  return [...uniqueSales.values()].sort((left, right) => {
    const dateComparison = (right.saleDate ?? "").localeCompare(
      left.saleDate ?? ""
    );

    return dateComparison !== 0
      ? dateComparison
      : (right.documentNumber ?? right.cuentiSaleId).localeCompare(
          left.documentNumber ?? left.cuentiSaleId,
          "es-CO",
          { numeric: true }
        );
  });
}

function findCuentiTransactionId(
  record: Record<string, unknown>,
  source: CuentiSaleSource
) {
  const explicitId = findFirstTextValue(record, [
    "id_transaccion",
    "idTransaccion",
    "id_transaction",
    "id_transaccion_encabezado",
    "idTransaccionEncabezado",
    "id_encabezado",
    "idEncabezado",
    "transactionId",
    "transaction_id",
    "id_factura",
    "idFactura",
    "invoiceId",
    "invoice_id",
    "id_pedido",
    "idPedido",
    "orderId",
    "order_id",
    "id_venta",
    "idVenta",
    "saleId",
    "referencia",
    "ref",
    "id"
  ]);

  if (explicitId) {
    return explicitId;
  }

  const sourceTerms =
    source === "order"
      ? [
          "transaccion",
          "transaction",
          "encabezado",
          "pedido",
          "order",
          "venta",
          "sale"
        ]
      : [
          "transaccion",
          "transaction",
          "encabezado",
          "factura",
          "invoice",
          "venta",
          "sale"
        ];
  const excludedTerms = [
    "cliente",
    "customer",
    "tercero",
    "producto",
    "product",
    "sucursal",
    "branch",
    "empresa",
    "company",
    "tipo",
    "type",
    "vendedor",
    "seller",
    "empleado",
    "employee"
  ];

  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = normalizeFieldKey(key);

    if (
      !normalizedKey.includes("id") ||
      !sourceTerms.some((term) => normalizedKey.includes(term)) ||
      excludedTerms.some((term) => normalizedKey.includes(term))
    ) {
      continue;
    }

    const normalizedValue = normalizeUnknownText(value);

    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return null;
}

function normalizeFieldKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .replace(/[^a-z0-9]/g, "");
}

function resolveCuentiSaleHeader(value: unknown): unknown | null {
  if (!isRecord(value)) {
    return null;
  }

  const headerKeys = [
    "encabezado",
    "header",
    "factura",
    "invoice",
    "pedido",
    "order",
    "venta",
    "sale",
    "documento",
    "document"
  ];

  for (const key of headerKeys) {
    const nestedValue = getCaseInsensitiveValue(value, key);

    if (isRecord(nestedValue)) {
      return nestedValue;
    }
  }

  return value;
}

function extractCuentiSaleItemCandidates(value: unknown, depth = 0): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value) || depth > 4) {
    return [];
  }

  const itemKeys = [
    "items",
    "detalles",
    "detalle",
    "details",
    "detail",
    "lineas",
    "lineItems",
    "lines",
    "productos",
    "products",
    "lstDetalle",
    "lstProductos",
    "detalleFactura",
    "detalle_factura",
    "invoiceItems"
  ];

  for (const key of itemKeys) {
    const nestedValue = getCaseInsensitiveValue(value, key);

    if (Array.isArray(nestedValue)) {
      return nestedValue;
    }

    const nestedItems = extractCuentiSaleItemCandidates(nestedValue, depth + 1);

    if (nestedItems.length > 0) {
      return nestedItems;
    }
  }

  for (const nestedValue of Object.values(value)) {
    if (Array.isArray(nestedValue)) {
      return nestedValue;
    }
  }

  return [];
}

function mapCuentiSaleItem(value: unknown): CuentiSaleItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const record = flattenRecord(value);
  const name = findFirstTextValue(record, [
    "nombre_producto",
    "nombreProducto",
    "product_name",
    "producto",
    "descripcion_producto",
    "descripcion",
    "description",
    "nombre",
    "name"
  ]);
  const cuentiProductId = findFirstTextValue(record, [
    "id_producto",
    "idProducto",
    "productId",
    "id_product",
    "producto_id",
    "id"
  ]);
  const sku = findFirstTextValue(record, [
    "sku",
    "product_code",
    "referencia",
    "codigo",
    "codigo_interno",
    "codigoInterno",
    "code",
    "ref"
  ]);
  const quantity = findFirstNumberValue(record, [
    "cantidad",
    "cantidad_producto",
    "cantidadProducto",
    "cantidad_vendida",
    "cantidadVendida",
    "quantity",
    "qty",
    "cant",
    "unidades"
  ]);

  if ((!name && !cuentiProductId && !sku) || !quantity || quantity <= 0) {
    return null;
  }

  return {
    cuentiProductId,
    name: name ?? sku ?? cuentiProductId ?? "Producto Cuenti",
    quantity: Math.round(quantity * 100) / 100,
    sku,
    unitName: findFirstTextValue(record, [
      "unidad",
      "unit",
      "unidad_medida",
      "unidadMedida",
      "unitName"
    ])
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

function mapCuentiProduct(value: unknown): CuentiProduct | null {
  if (!isRecord(value)) {
    return null;
  }

  const record = flattenRecord(value);
  const name = findFirstTextValue(record, [
    "nombre_producto",
    "nombreProducto",
    "product_name",
    "producto",
    "descripcion_producto",
    "descripcion",
    "description",
    "nombre",
    "name"
  ]);

  if (!name) {
    return null;
  }

  const cuentiProductId = findFirstTextValue(record, [
    "id_producto",
    "idProducto",
    "productId",
    "id_product",
    "id"
  ]);
  const sku = findFirstTextValue(record, [
    "sku",
    "product_code",
    "referencia",
    "codigo",
    "codigo_interno",
    "codigoInterno",
    "code",
    "ref"
  ]);
  const barcode = findFirstTextValue(record, [
    "codigo_barras",
    "codigoBarras",
    "barcode",
    "barCode",
    "ean"
  ]);
  const unitName = findFirstTextValue(record, [
    "unidad",
    "unit",
    "unidad_medida",
    "unidadMedida",
    "unitName"
  ]);
  const salePrice = findFirstNumberValue(record, [
    "precio_venta",
    "precioVenta",
    "salePrice",
    "precio",
    "precio_sucursal",
    "precioSucursal",
    "valor_venta",
    "valorVenta"
  ]);
  const standardCost = findFirstNumberValue(record, [
    "costo",
    "costo_unitario",
    "costoUnitario",
    "standardCost",
    "precio_compra",
    "precioCompra",
    "costo_promedio",
    "costoPromedio"
  ]);
  const stockQty = findFirstNumberValue(record, [
    "existencia",
    "existencias",
    "stock",
    "inventario",
    "cantidad",
    "quantity"
  ]);
  const weightKg = findFirstNumberValue(record, [
    "peso",
    "peso_kg",
    "pesoKg",
    "weight",
    "weightKg"
  ]);
  const notes = findFirstTextValue(record, ["nota", "notas", "notes"]);

  return {
    barcode,
    cuentiProductId,
    name,
    notes,
    salePrice,
    sku,
    standardCost,
    stockQty,
    unitName,
    weightKg
  };
}

function mapCuentiStockItems(items: unknown[], payload: CuentiRawResponse) {
  const stockValues = items
    .map(mapCuentiStockValue)
    .filter((value): value is number => value !== null);

  if (stockValues.length > 0) {
    return stockValues.reduce((total, value) => total + value, 0);
  }

  return mapCuentiStockValue(payload);
}

function mapCuentiStockValue(value: unknown) {
  if (!isRecord(value)) {
    return normalizeUnknownNumber(value);
  }

  const record = flattenRecord(value);

  return findFirstNumberValue(record, [
    "existencia",
    "existencias",
    "stock",
    "stock_actual",
    "stockActual",
    "inventario",
    "cantidad",
    "quantity",
    "qty",
    "saldo",
    "saldo_actual",
    "saldoActual",
    "disponible",
    "cantidad_disponible",
    "cantidadDisponible",
    "available",
    "availableQty"
  ]);
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

function getCaseInsensitiveValue(record: Record<string, unknown>, key: string) {
  if (key in record) {
    return record[key];
  }

  const caseInsensitiveKey = Object.keys(record).find(
    (recordKey) =>
      recordKey.toLocaleLowerCase("es-CO") === key.toLocaleLowerCase("es-CO")
  );

  return caseInsensitiveKey ? record[caseInsensitiveKey] : undefined;
}

function flattenRecord(record: Record<string, unknown>, depth = 0) {
  const flattened: Record<string, unknown> = { ...record };

  if (depth >= 2) {
    return flattened;
  }

  for (const value of Object.values(record)) {
    if (!isRecord(value)) {
      continue;
    }

    const nested = flattenRecord(value, depth + 1);

    for (const [nestedKey, nestedValue] of Object.entries(nested)) {
      if (!(nestedKey in flattened)) {
        flattened[nestedKey] = nestedValue;
      }
    }
  }

  return flattened;
}

function getInspectableKeys(value: unknown) {
  if (!isRecord(value)) {
    return [];
  }

  return Object.keys(value).slice(0, 20);
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

function findFirstNumberValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = normalizeUnknownNumber(record[key]);

    if (value !== null) {
      return value;
    }

    const caseInsensitiveKey = Object.keys(record).find(
      (recordKey) =>
        recordKey.toLocaleLowerCase("es-CO") === key.toLocaleLowerCase("es-CO")
    );
    const caseInsensitiveValue = caseInsensitiveKey
      ? normalizeUnknownNumber(record[caseInsensitiveKey])
      : null;

    if (caseInsensitiveValue !== null) {
      return caseInsensitiveValue;
    }
  }

  return null;
}

function findFirstBooleanValue(
  record: Record<string, unknown>,
  keys: string[]
) {
  for (const key of keys) {
    const directValue = normalizeUnknownBoolean(record[key]);

    if (directValue !== null) {
      return directValue;
    }

    const caseInsensitiveKey = Object.keys(record).find(
      (recordKey) =>
        recordKey.toLocaleLowerCase("es-CO") === key.toLocaleLowerCase("es-CO")
    );
    const caseInsensitiveValue = caseInsensitiveKey
      ? normalizeUnknownBoolean(record[caseInsensitiveKey])
      : null;

    if (caseInsensitiveValue !== null) {
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

function normalizeUnknownNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/\$/g, "")
    .replace(/\s/g, "");

  if (!normalized) {
    return null;
  }

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");
  const dotCount = normalized.match(/\./g)?.length ?? 0;
  const numericText =
    hasComma && hasDot
      ? normalized.replace(/\./g, "").replace(",", ".")
      : hasComma
        ? normalized.replace(",", ".")
        : dotCount > 1
          ? normalized.replace(/\./g, "")
          : normalized;
  const parsed = Number(numericText);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeUnknownBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLocaleLowerCase("es-CO");

  if (["1", "true", "si", "sí", "yes", "anulada", "anulado"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "activa", "activo"].includes(normalized)) {
    return false;
  }

  return null;
}

function normalizeIntegerOrNull(value: unknown) {
  const normalized = normalizeUnknownNumber(value);

  return normalized !== null && Number.isFinite(normalized)
    ? Math.max(0, Math.trunc(normalized))
    : null;
}

function sumKnownAmounts(values: Array<number | null>) {
  const knownValues = values.filter((value): value is number => value !== null);

  return knownValues.length > 0
    ? knownValues.reduce((sum, value) => sum + value, 0)
    : null;
}

function subtractKnownAmounts(
  minuend: number | null,
  subtrahend: number | null
) {
  return minuend !== null && subtrahend !== null
    ? minuend - subtrahend
    : null;
}

function isVoidedStatus(value: string | null) {
  const normalized = value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO");

  return Boolean(
    normalized &&
      ["anulada", "anulado", "cancelada", "cancelado", "voided"].some((term) =>
        normalized.includes(term)
      )
  );
}

function normalizeCuentiTime(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);

  if (hour > 23 || minute > 59 || second > 59) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

function normalizeCuentiTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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

function dedupeCuentiProducts(products: CuentiProduct[]) {
  const productsByKey = new Map<string, CuentiProduct>();

  for (const product of products) {
    const key =
      product.cuentiProductId ??
      product.sku ??
      product.barcode ??
      product.name.toLocaleLowerCase("es-CO");

    productsByKey.set(key, mergeCuentiProduct(productsByKey.get(key), product));
  }

  return [...productsByKey.values()];
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

function mergeCuentiProduct(
  current: CuentiProduct | undefined,
  next: CuentiProduct
): CuentiProduct {
  if (!current) {
    return next;
  }

  return {
    barcode: next.barcode ?? current.barcode,
    cuentiProductId: next.cuentiProductId ?? current.cuentiProductId,
    name: next.name || current.name,
    notes: next.notes ?? current.notes,
    salePrice: next.salePrice ?? current.salePrice,
    sku: next.sku ?? current.sku,
    standardCost: next.standardCost ?? current.standardCost,
    stockQty: next.stockQty ?? current.stockQty,
    unitName: next.unitName ?? current.unitName,
    weightKg: next.weightKg ?? current.weightKg
  };
}

function countResponseItems(payload: CuentiRawResponse) {
  return extractResponseItems(payload).length;
}

function normalizeDateFilter(value?: string | null) {
  const normalized = normalizeOptionalText(value);

  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function normalizeCuentiDate(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);

  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0");
    const month = slashMatch[2].padStart(2, "0");

    return `${slashMatch[3]}-${month}-${day}`;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Bogota"
  }).format(parsed);
}

function normalizePositiveInteger(value: number | null | undefined, fallback: number) {
  return Number.isInteger(value) && value !== null && value !== undefined && value >= 0
    ? value
    : fallback;
}

function normalizeUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
