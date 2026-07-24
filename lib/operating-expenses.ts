import { getDb } from "@/lib/db";

export type OperatingExpenseCategory =
  | "SERVICES"
  | "RENT"
  | "PAYROLL"
  | "SUPPLIES"
  | "TAX"
  | "SECURITY"
  | "OTHER";

type ExpenseRow = {
  category: OperatingExpenseCategory;
  concept: string;
  created_at: Date;
  expense_on: string;
  id: string;
  notes: string | null;
  payment_method: string | null;
  provider_name: string | null;
  total_amount: string;
};

export class OperatingExpenseError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function createOperatingExpense(input: {
  category: OperatingExpenseCategory | null;
  concept: string;
  expenseOn: string;
  notes: string;
  paymentMethod: string;
  providerId: string;
  recordedByUserId: string;
  totalAmount: number | null;
}) {
  if (
    !input.category ||
    !input.concept ||
    !isIsoDate(input.expenseOn) ||
    !input.providerId
  ) {
    throw new OperatingExpenseError(
      "missing_expense_fields",
      "Completa los datos del gasto."
    );
  }

  if (!input.totalAmount || input.totalAmount <= 0) {
    throw new OperatingExpenseError(
      "invalid_amount",
      "El valor debe ser mayor a cero."
    );
  }

  const provider = await getDb().query<{ name: string }>(
    `
      SELECT name
      FROM transport_provider
      WHERE id = $1
        AND is_active = TRUE
    `,
    [input.providerId]
  );

  if (!provider.rows[0]) {
    throw new OperatingExpenseError(
      "provider_not_found",
      "Selecciona un proveedor activo."
    );
  }

  const result = await getDb().query<{ id: string }>(
    `
      INSERT INTO operating_expense (
        expense_on,
        category,
        concept,
        provider_id,
        provider_name,
        total_amount,
        payment_method,
        notes,
        recorded_by_user_id
      )
      VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `,
    [
      input.expenseOn,
      input.category,
      input.concept,
      input.providerId,
      provider.rows[0].name,
      roundMoney(input.totalAmount),
      optionalText(input.paymentMethod),
      optionalText(input.notes),
      input.recordedByUserId
    ]
  );

  return { expenseId: result.rows[0].id };
}

export async function voidOperatingExpense(input: {
  expenseId: string;
  reason: string;
  recordedByUserId: string;
}) {
  const result = await getDb().query(
    `
      UPDATE operating_expense
      SET
        is_voided = TRUE,
        voided_at = NOW(),
        voided_by_user_id = $2,
        void_reason = $3,
        updated_at = NOW()
      WHERE id = $1
        AND is_voided = FALSE
    `,
    [input.expenseId, input.recordedByUserId, optionalText(input.reason)]
  );

  if (!result.rowCount) {
    throw new OperatingExpenseError(
      "expense_not_found",
      "El gasto no existe o ya fue anulado."
    );
  }
}

export async function getOperatingExpenseOverview(input: {
  category: OperatingExpenseCategory | null;
  dateFrom: string;
  dateTo: string;
}) {
  const result = await getDb().query<ExpenseRow>(
    `
      SELECT
        id,
        expense_on::text,
        category,
        concept,
        provider_name,
        total_amount,
        payment_method,
        notes,
        created_at
      FROM operating_expense
      WHERE is_voided = FALSE
        AND expense_on BETWEEN $1::date AND $2::date
        AND ($3::text IS NULL OR category = $3)
      ORDER BY expense_on DESC, created_at DESC
    `,
    [input.dateFrom, input.dateTo, input.category]
  );
  const expenses = result.rows.map((row) => ({
    category: row.category,
    concept: row.concept,
    createdAt: row.created_at,
    expenseOn: row.expense_on,
    id: row.id,
    notes: row.notes,
    paymentMethod: row.payment_method,
    providerName: row.provider_name,
    totalAmount: Number(row.total_amount)
  }));
  const byCategory = new Map<OperatingExpenseCategory, number>();

  for (const expense of expenses) {
    byCategory.set(
      expense.category,
      (byCategory.get(expense.category) ?? 0) + expense.totalAmount
    );
  }

  return {
    byCategory: [...byCategory.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((left, right) => right.total - left.total),
    expenses,
    stats: {
      records: expenses.length,
      total: expenses.reduce((total, expense) => total + expense.totalAmount, 0)
    }
  };
}

export function normalizeExpenseCategory(
  value?: string | null
): OperatingExpenseCategory | null {
  if (
    value === "SERVICES" ||
    value === "RENT" ||
    value === "PAYROLL" ||
    value === "SUPPLIES" ||
    value === "TAX" ||
    value === "SECURITY" ||
    value === "OTHER"
  ) {
    return value;
  }

  return null;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function optionalText(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
