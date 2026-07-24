import { getDb } from "@/lib/db";

type SummaryRow = {
  average_ticket: string;
  cost_amount: string;
  gross_amount: string;
  gross_profit: string;
  invoice_count: string;
  margin_percent: string | null;
  net_amount: string;
  return_amount: string;
  tax_amount: string;
  units_sold: string;
};

type DailyRow = {
  cost_amount: string;
  gross_profit: string;
  margin_percent: string | null;
  net_amount: string;
  sale_on: string;
  transaction_count: string;
};

type ProductRow = {
  average_gross_unit_price: string | null;
  average_unit_cost: string | null;
  gross_profit: string;
  lines_without_cost: string;
  margin_percent: string | null;
  name: string;
  net_amount: string;
  product_id: string;
  product_line_name: string | null;
  quantity_sold: string;
  sku: string | null;
  transaction_count: string;
};

type PriceOpportunityRow = ProductRow & {
  current_sale_price: string | null;
  opportunity_amount: string;
  suggested_gross_price: string | null;
};

type ProductLineRow = {
  gross_profit: string;
  line_name: string;
  margin_percent: string | null;
  net_amount: string;
  transaction_count: string;
};

type QualityRow = {
  invoices_without_items: string;
  lines_without_cost: string;
  unreconciled_invoices: string;
  voided_invoices: string;
};

type FinancialSummaryRow = {
  cash_in: string;
  cash_out: string;
  operating_expenses: string;
  purchase_amount: string;
  purchase_count: string;
  stock_products: string;
  stock_units: string;
  stock_value: string;
  unknown_cash: string;
};

type ExpenseBreakdownRow = {
  amount: string;
  category: string;
  records: string;
};

type InventoryRow = {
  inventory_value: string;
  min_stock_qty: string;
  name: string;
  quantity: string;
  sku: string | null;
  unit_cost: string;
};

type PaymentBreakdownRow = {
  amount: string;
  direction: "IN" | "OUT" | "UNKNOWN";
  records: string;
};

export type ManagementAnalytics = {
  dailySales: Array<{
    costAmount: number;
    grossProfit: number;
    marginPercent: number | null;
    netAmount: number;
    saleOn: string;
    transactionCount: number;
  }>;
  dateFrom: string;
  dateTo: string;
  lineMix: Array<{
    grossProfit: number;
    lineName: string;
    marginPercent: number | null;
    netAmount: number;
    transactionCount: number;
  }>;
  financial: {
    cashIn: number;
    cashOut: number;
    expenseBreakdown: Array<{
      amount: number;
      category: string;
      records: number;
    }>;
    inventory: Array<{
      inventoryValue: number;
      minStockQty: number;
      name: string;
      quantity: number;
      sku: string | null;
      unitCost: number;
    }>;
    operatingExpenses: number;
    operatingProfit: number;
    paymentBreakdown: Array<{
      amount: number;
      direction: "IN" | "OUT" | "UNKNOWN";
      records: number;
    }>;
    purchaseAmount: number;
    purchaseCount: number;
    stockProducts: number;
    stockUnits: number;
    stockValue: number;
    unknownCash: number;
  };
  priceOpportunities: Array<{
    averageGrossUnitPrice: number | null;
    averageUnitCost: number | null;
    currentSalePrice: number | null;
    grossProfit: number;
    marginPercent: number | null;
    name: string;
    netAmount: number;
    opportunityAmount: number;
    productId: string;
    productLineName: string | null;
    quantitySold: number;
    sku: string | null;
    suggestedGrossPrice: number | null;
    transactionCount: number;
  }>;
  previousSummary: ManagementSummary;
  quality: {
    invoicesWithoutItems: number;
    linesWithoutCost: number;
    unreconciledInvoices: number;
    voidedInvoices: number;
  };
  summary: ManagementSummary;
  targetMargin: number;
  topProducts: Array<{
    averageGrossUnitPrice: number | null;
    averageUnitCost: number | null;
    grossProfit: number;
    linesWithoutCost: number;
    marginPercent: number | null;
    name: string;
    netAmount: number;
    productId: string;
    productLineName: string | null;
    quantitySold: number;
    sku: string | null;
    transactionCount: number;
  }>;
};

export type ManagementSummary = {
  averageTicket: number;
  costAmount: number;
  grossAmount: number;
  grossProfit: number;
  invoiceCount: number;
  marginPercent: number | null;
  netAmount: number;
  returnAmount: number;
  taxAmount: number;
  unitsSold: number;
};

export async function getAnalyticsAvailableRange() {
  const result = await getDb().query<{
    date_from: string | null;
    date_to: string | null;
  }>(
    `
      SELECT
        MIN(sale_on)::text AS date_from,
        MAX(sale_on)::text AS date_to
      FROM analytics.fact_sale
    `
  );

  return {
    dateFrom: result.rows[0]?.date_from ?? null,
    dateTo: result.rows[0]?.date_to ?? null
  };
}

export async function getManagementAnalytics(input: {
  dateFrom: string;
  dateTo: string;
  targetMargin: number;
}): Promise<ManagementAnalytics> {
  const previousRange = getPreviousRange(input.dateFrom, input.dateTo);
  const [
    summary,
    previousSummary,
    dailyResult,
    productsResult,
    opportunitiesResult,
    linesResult,
    qualityResult,
    financialResult,
    expenseBreakdownResult,
    inventoryResult,
    paymentBreakdownResult
  ] = await Promise.all([
    querySummary(input.dateFrom, input.dateTo),
    querySummary(previousRange.dateFrom, previousRange.dateTo),
    getDb().query<DailyRow>(
      `
        SELECT
          sale_on::text,
          transaction_count::text,
          net_amount::text,
          cost_amount::text,
          gross_profit::text,
          margin_percent::text
        FROM analytics.daily_sales
        WHERE sale_on BETWEEN $1::date AND $2::date
        ORDER BY sale_on
      `,
      [input.dateFrom, input.dateTo]
    ),
    getDb().query<ProductRow>(
      productPerformanceSql("ORDER BY net_amount DESC NULLS LAST LIMIT 15"),
      [input.dateFrom, input.dateTo]
    ),
    getDb().query<PriceOpportunityRow>(
      `
        ${productPerformanceCte()}
        SELECT
          product_id,
          sku,
          name,
          product_line_name,
          transaction_count::text,
          quantity_sold::text,
          net_amount::text,
          gross_profit::text,
          margin_percent::text,
          lines_without_cost::text,
          average_gross_unit_price::text,
          average_unit_cost::text,
          current_sale_price::text,
          GREATEST(($3::numeric * net_amount) - gross_profit, 0)::text
            AS opportunity_amount,
          CASE
            WHEN average_unit_cost IS NULL OR $3::numeric >= 1 THEN NULL
            ELSE (
              average_unit_cost / (1 - $3::numeric)
            ) * (1 + effective_tax_rate)
          END::text AS suggested_gross_price
        FROM product_sales
        WHERE
          net_amount > 0
          AND average_unit_cost > 0
          AND lines_without_cost = 0
          AND margin_percent < $3::numeric
        ORDER BY opportunity_amount DESC, net_amount DESC
        LIMIT 15
      `,
      [input.dateFrom, input.dateTo, input.targetMargin]
    ),
    getDb().query<ProductLineRow>(
      `
        SELECT
          COALESCE(
            product.product_line_name,
            product.category,
            'Sin linea'
          ) AS line_name,
          COUNT(DISTINCT sale.id)::text AS transaction_count,
          COALESCE(SUM(item.net_amount), 0)::text AS net_amount,
          COALESCE(SUM(item.gross_profit), 0)::text AS gross_profit,
          CASE
            WHEN COALESCE(SUM(item.net_amount), 0) = 0 THEN NULL
            ELSE (
              COALESCE(SUM(item.gross_profit), 0)
              / SUM(item.net_amount)
            )::text
          END AS margin_percent
        FROM analytics.fact_sale_item AS item
        INNER JOIN analytics.fact_sale AS sale
          ON sale.id = item.sale_id
        LEFT JOIN analytics.dim_product AS product
          ON product.id = item.product_id
        WHERE
          sale.sale_on BETWEEN $1::date AND $2::date
          AND sale.is_voided = FALSE
        GROUP BY COALESCE(
          product.product_line_name,
          product.category,
          'Sin linea'
        )
        ORDER BY SUM(item.net_amount) DESC NULLS LAST
        LIMIT 8
      `,
      [input.dateFrom, input.dateTo]
    ),
    getDb().query<QualityRow>(
      `
        WITH item_totals AS (
          SELECT
            sale.id AS sale_id,
            COUNT(item.id) AS item_count,
            SUM(item.net_amount) AS item_net_amount
          FROM analytics.fact_sale AS sale
          LEFT JOIN analytics.fact_sale_item AS item
            ON item.sale_id = sale.id
          WHERE sale.sale_on BETWEEN $1::date AND $2::date
            AND sale.is_voided = FALSE
          GROUP BY sale.id
        )
        SELECT
          (
            SELECT COUNT(*)
            FROM analytics.fact_sale
            WHERE sale_on BETWEEN $1::date AND $2::date
              AND is_voided = TRUE
          )::text AS voided_invoices,
          (
            SELECT COUNT(*)
            FROM analytics.fact_sale_item AS item
            INNER JOIN analytics.fact_sale AS sale
              ON sale.id = item.sale_id
            WHERE sale.sale_on BETWEEN $1::date AND $2::date
              AND sale.is_voided = FALSE
              AND item.cost_status = 'MISSING'
          )::text AS lines_without_cost,
          COUNT(*) FILTER (WHERE item_count = 0)::text AS invoices_without_items,
          COUNT(*) FILTER (
            WHERE item_count > 0
              AND ABS(
                COALESCE(
                  (
                    SELECT fact.net_amount
                    FROM analytics.fact_sale AS fact
                    WHERE fact.id = item_totals.sale_id
                  ),
                  0
                ) - COALESCE(item_net_amount, 0)
              ) > GREATEST(
                1,
                ABS(
                  COALESCE(
                    (
                      SELECT fact.net_amount
                      FROM analytics.fact_sale AS fact
                      WHERE fact.id = item_totals.sale_id
                    ),
                    0
                  )
                ) * 0.01
              )
          )::text AS unreconciled_invoices
        FROM item_totals
      `,
      [input.dateFrom, input.dateTo]
    ),
    getDb().query<FinancialSummaryRow>(
      `
        SELECT
          COALESCE((
            SELECT SUM(total_amount)
            FROM analytics.operating_expenses
            WHERE expense_on BETWEEN $1::date AND $2::date
              AND is_voided = FALSE
          ), 0)::text AS operating_expenses,
          COALESCE((
            SELECT SUM(amount)
            FROM analytics.fact_payment
            WHERE payment_on BETWEEN $1::date AND $2::date
              AND direction = 'IN'
              AND is_voided = FALSE
          ), 0)::text AS cash_in,
          COALESCE((
            SELECT SUM(amount)
            FROM analytics.fact_payment
            WHERE payment_on BETWEEN $1::date AND $2::date
              AND direction = 'OUT'
              AND is_voided = FALSE
          ), 0)::text AS cash_out,
          COALESCE((
            SELECT SUM(amount)
            FROM analytics.fact_payment
            WHERE payment_on BETWEEN $1::date AND $2::date
              AND direction = 'UNKNOWN'
              AND is_voided = FALSE
          ), 0)::text AS unknown_cash,
          COALESCE((
            SELECT SUM(gross_amount)
            FROM analytics.fact_purchase
            WHERE purchase_on BETWEEN $1::date AND $2::date
              AND is_voided = FALSE
          ), 0)::text AS purchase_amount,
          (
            SELECT COUNT(*)
            FROM analytics.fact_purchase
            WHERE purchase_on BETWEEN $1::date AND $2::date
              AND is_voided = FALSE
          )::text AS purchase_count,
          COALESCE((
            SELECT SUM(snapshot.quantity)
            FROM analytics.fact_inventory_snapshot AS snapshot
            WHERE snapshot.snapshot_on = (
              SELECT MAX(latest.snapshot_on)
              FROM analytics.fact_inventory_snapshot AS latest
              WHERE latest.snapshot_on <= $2::date
            )
          ), 0)::text AS stock_units,
          COALESCE((
            SELECT SUM(snapshot.inventory_value)
            FROM analytics.fact_inventory_snapshot AS snapshot
            WHERE snapshot.snapshot_on = (
              SELECT MAX(latest.snapshot_on)
              FROM analytics.fact_inventory_snapshot AS latest
              WHERE latest.snapshot_on <= $2::date
            )
          ), 0)::text AS stock_value,
          (
            SELECT COUNT(*)
            FROM analytics.fact_inventory_snapshot AS snapshot
            WHERE snapshot.snapshot_on = (
              SELECT MAX(latest.snapshot_on)
              FROM analytics.fact_inventory_snapshot AS latest
              WHERE latest.snapshot_on <= $2::date
            )
          )::text AS stock_products
      `,
      [input.dateFrom, input.dateTo]
    ),
    getDb().query<ExpenseBreakdownRow>(
      `
        SELECT
          category,
          COUNT(*)::text AS records,
          COALESCE(SUM(total_amount), 0)::text AS amount
        FROM analytics.operating_expenses
        WHERE expense_on BETWEEN $1::date AND $2::date
          AND is_voided = FALSE
        GROUP BY category
        ORDER BY SUM(total_amount) DESC
      `,
      [input.dateFrom, input.dateTo]
    ),
    getDb().query<InventoryRow>(
      `
        WITH latest_snapshot AS (
          SELECT MAX(snapshot_on) AS snapshot_on
          FROM analytics.fact_inventory_snapshot
          WHERE snapshot_on <= $1::date
        )
        SELECT
          product.name,
          product.sku,
          snapshot.quantity::text,
          COALESCE(snapshot.unit_cost, 0)::text AS unit_cost,
          COALESCE(snapshot.inventory_value, 0)::text AS inventory_value,
          COALESCE(local_product.min_stock_qty, 0)::text AS min_stock_qty
        FROM analytics.fact_inventory_snapshot AS snapshot
        INNER JOIN latest_snapshot
          ON latest_snapshot.snapshot_on = snapshot.snapshot_on
        INNER JOIN analytics.dim_product AS product
          ON product.id = snapshot.product_id
        LEFT JOIN product AS local_product
          ON local_product.id = snapshot.local_product_id
        ORDER BY
          CASE
            WHEN snapshot.quantity <= COALESCE(local_product.min_stock_qty, 0)
              THEN 0
            ELSE 1
          END,
          snapshot.inventory_value DESC NULLS LAST
        LIMIT 15
      `,
      [input.dateTo]
    ),
    getDb().query<PaymentBreakdownRow>(
      `
        SELECT
          direction,
          COUNT(*)::text AS records,
          COALESCE(SUM(amount), 0)::text AS amount
        FROM analytics.fact_payment
        WHERE payment_on BETWEEN $1::date AND $2::date
          AND is_voided = FALSE
        GROUP BY direction
        ORDER BY direction
      `,
      [input.dateFrom, input.dateTo]
    )
  ]);
  const quality = qualityResult.rows[0];
  const financial = financialResult.rows[0];

  return {
    dailySales: dailyResult.rows.map((row) => ({
      costAmount: Number(row.cost_amount),
      grossProfit: Number(row.gross_profit),
      marginPercent: nullableNumber(row.margin_percent),
      netAmount: Number(row.net_amount),
      saleOn: row.sale_on,
      transactionCount: Number(row.transaction_count)
    })),
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    financial: {
      cashIn: Number(financial?.cash_in ?? 0),
      cashOut: Number(financial?.cash_out ?? 0),
      expenseBreakdown: expenseBreakdownResult.rows.map((row) => ({
        amount: Number(row.amount),
        category: row.category,
        records: Number(row.records)
      })),
      inventory: inventoryResult.rows.map((row) => ({
        inventoryValue: Number(row.inventory_value),
        minStockQty: Number(row.min_stock_qty),
        name: row.name,
        quantity: Number(row.quantity),
        sku: row.sku,
        unitCost: Number(row.unit_cost)
      })),
      operatingExpenses: Number(financial?.operating_expenses ?? 0),
      operatingProfit:
        summary.grossProfit - Number(financial?.operating_expenses ?? 0),
      paymentBreakdown: paymentBreakdownResult.rows.map((row) => ({
        amount: Number(row.amount),
        direction: row.direction,
        records: Number(row.records)
      })),
      purchaseAmount: Number(financial?.purchase_amount ?? 0),
      purchaseCount: Number(financial?.purchase_count ?? 0),
      stockProducts: Number(financial?.stock_products ?? 0),
      stockUnits: Number(financial?.stock_units ?? 0),
      stockValue: Number(financial?.stock_value ?? 0),
      unknownCash: Number(financial?.unknown_cash ?? 0)
    },
    lineMix: linesResult.rows.map((row) => ({
      grossProfit: Number(row.gross_profit),
      lineName: row.line_name,
      marginPercent: nullableNumber(row.margin_percent),
      netAmount: Number(row.net_amount),
      transactionCount: Number(row.transaction_count)
    })),
    priceOpportunities: opportunitiesResult.rows.map(mapPriceOpportunity),
    previousSummary,
    quality: {
      invoicesWithoutItems: Number(quality?.invoices_without_items ?? 0),
      linesWithoutCost: Number(quality?.lines_without_cost ?? 0),
      unreconciledInvoices: Number(quality?.unreconciled_invoices ?? 0),
      voidedInvoices: Number(quality?.voided_invoices ?? 0)
    },
    summary,
    targetMargin: input.targetMargin,
    topProducts: productsResult.rows.map(mapProduct),
  };
}

async function querySummary(
  dateFrom: string,
  dateTo: string
): Promise<ManagementSummary> {
  const result = await getDb().query<SummaryRow>(
    `
      SELECT
        COUNT(*) FILTER (WHERE sale.is_voided = FALSE)::text AS invoice_count,
        COALESCE(
          SUM(sale.gross_amount) FILTER (WHERE sale.is_voided = FALSE),
          0
        )::text AS gross_amount,
        COALESCE(
          SUM(sale.return_amount) FILTER (WHERE sale.is_voided = FALSE),
          0
        )::text AS return_amount,
        COALESCE(
          SUM(sale.tax_amount) FILTER (WHERE sale.is_voided = FALSE),
          0
        )::text AS tax_amount,
        COALESCE(
          SUM(sale.net_amount) FILTER (WHERE sale.is_voided = FALSE),
          0
        )::text AS net_amount,
        COALESCE(
          SUM(sale.cost_amount) FILTER (WHERE sale.is_voided = FALSE),
          0
        )::text AS cost_amount,
        COALESCE(
          SUM(sale.gross_profit) FILTER (WHERE sale.is_voided = FALSE),
          0
        )::text AS gross_profit,
        CASE
          WHEN COALESCE(
            SUM(sale.net_amount) FILTER (WHERE sale.is_voided = FALSE),
            0
          ) = 0 THEN NULL
          ELSE (
            COALESCE(
              SUM(sale.gross_profit) FILTER (WHERE sale.is_voided = FALSE),
              0
            )
            / SUM(sale.net_amount) FILTER (WHERE sale.is_voided = FALSE)
          )::text
        END AS margin_percent,
        (
          CASE
            WHEN COUNT(*) FILTER (WHERE sale.is_voided = FALSE) = 0 THEN 0
            ELSE (
              COALESCE(
                SUM(sale.gross_amount) FILTER (WHERE sale.is_voided = FALSE),
                0
              )
              / COUNT(*) FILTER (WHERE sale.is_voided = FALSE)
            )
          END
        )::text AS average_ticket,
        COALESCE(
          (
            SELECT SUM(item.quantity)
            FROM analytics.fact_sale_item AS item
            INNER JOIN analytics.fact_sale AS item_sale
              ON item_sale.id = item.sale_id
            WHERE item_sale.sale_on BETWEEN $1::date AND $2::date
              AND item_sale.is_voided = FALSE
          ),
          0
        )::text AS units_sold
      FROM analytics.fact_sale AS sale
      WHERE sale.sale_on BETWEEN $1::date AND $2::date
    `,
    [dateFrom, dateTo]
  );
  const row = result.rows[0];

  return {
    averageTicket: Number(row?.average_ticket ?? 0),
    costAmount: Number(row?.cost_amount ?? 0),
    grossAmount: Number(row?.gross_amount ?? 0),
    grossProfit: Number(row?.gross_profit ?? 0),
    invoiceCount: Number(row?.invoice_count ?? 0),
    marginPercent: nullableNumber(row?.margin_percent ?? null),
    netAmount: Number(row?.net_amount ?? 0),
    returnAmount: Number(row?.return_amount ?? 0),
    taxAmount: Number(row?.tax_amount ?? 0),
    unitsSold: Number(row?.units_sold ?? 0)
  };
}

function productPerformanceSql(orderClause: string) {
  return `
    ${productPerformanceCte()}
    SELECT
      product_id,
      sku,
      name,
      product_line_name,
      transaction_count::text,
      quantity_sold::text,
      net_amount::text,
      gross_profit::text,
      margin_percent::text,
      lines_without_cost::text,
      average_gross_unit_price::text,
      average_unit_cost::text
    FROM product_sales
    ${orderClause}
  `;
}

function productPerformanceCte() {
  return `
    WITH product_sales AS (
      SELECT
        product.id AS product_id,
        product.sku,
        product.name,
        product.product_line_name,
        product.current_sale_price,
        COUNT(DISTINCT sale.id) AS transaction_count,
        COALESCE(SUM(item.quantity), 0) AS quantity_sold,
        COALESCE(SUM(item.net_amount), 0) AS net_amount,
        COALESCE(SUM(item.gross_profit), 0) AS gross_profit,
        CASE
          WHEN COALESCE(SUM(item.net_amount), 0) = 0 THEN NULL
          ELSE COALESCE(SUM(item.gross_profit), 0) / SUM(item.net_amount)
        END AS margin_percent,
        COUNT(*) FILTER (
          WHERE item.cost_status = 'MISSING'
        ) AS lines_without_cost,
        CASE
          WHEN COALESCE(SUM(item.quantity), 0) = 0 THEN NULL
          ELSE COALESCE(SUM(item.gross_amount), 0) / SUM(item.quantity)
        END AS average_gross_unit_price,
        CASE
          WHEN COALESCE(SUM(item.quantity), 0) = 0
            OR COUNT(*) FILTER (WHERE item.cost_status = 'MISSING') > 0
            THEN NULL
          ELSE COALESCE(SUM(item.cost_amount), 0) / SUM(item.quantity)
        END AS average_unit_cost,
        CASE
          WHEN COALESCE(SUM(item.net_amount), 0) = 0 THEN 0
          ELSE COALESCE(SUM(item.tax_amount), 0) / SUM(item.net_amount)
        END AS effective_tax_rate
      FROM analytics.fact_sale_item AS item
      INNER JOIN analytics.fact_sale AS sale
        ON sale.id = item.sale_id
      INNER JOIN analytics.dim_product AS product
        ON product.id = item.product_id
      WHERE
        sale.sale_on BETWEEN $1::date AND $2::date
        AND sale.is_voided = FALSE
      GROUP BY
        product.id,
        product.sku,
        product.name,
        product.product_line_name,
        product.current_sale_price
    )
  `;
}

function mapProduct(row: ProductRow) {
  return {
    averageGrossUnitPrice: nullableNumber(row.average_gross_unit_price),
    averageUnitCost: nullableNumber(row.average_unit_cost),
    grossProfit: Number(row.gross_profit),
    linesWithoutCost: Number(row.lines_without_cost),
    marginPercent: nullableNumber(row.margin_percent),
    name: row.name,
    netAmount: Number(row.net_amount),
    productId: row.product_id,
    productLineName: row.product_line_name,
    quantitySold: Number(row.quantity_sold),
    sku: row.sku,
    transactionCount: Number(row.transaction_count)
  };
}

function mapPriceOpportunity(row: PriceOpportunityRow) {
  return {
    ...mapProduct(row),
    currentSalePrice: nullableNumber(row.current_sale_price),
    opportunityAmount: Number(row.opportunity_amount),
    suggestedGrossPrice: nullableNumber(row.suggested_gross_price)
  };
}

function nullableNumber(value: string | null) {
  return value === null ? null : Number(value);
}

function getPreviousRange(dateFrom: string, dateTo: string) {
  const start = new Date(`${dateFrom}T12:00:00Z`);
  const end = new Date(`${dateTo}T12:00:00Z`);
  const rangeDays =
    Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000)) + 1;
  const previousTo = new Date(start);
  previousTo.setUTCDate(previousTo.getUTCDate() - 1);
  const previousFrom = new Date(previousTo);
  previousFrom.setUTCDate(previousFrom.getUTCDate() - rangeDays + 1);

  return {
    dateFrom: previousFrom.toISOString().slice(0, 10),
    dateTo: previousTo.toISOString().slice(0, 10)
  };
}
