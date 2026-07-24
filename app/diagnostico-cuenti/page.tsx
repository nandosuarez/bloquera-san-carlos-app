import { getDb } from "@/lib/db";
import { requireAdminPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type SourceRecordRow = {
  document_number: string | null;
  payload: unknown;
  source_date: string | null;
};

type DiagnosticField = {
  path: string;
  type: string;
  value: string | number | boolean | null;
};

const PAYMENT_KEY_PATTERN =
  /(pag|abono|payment|saldo|balance|medio|forma|total|valor|monto|cash|efectivo)/;

export default async function CuentiDiagnosticsPage() {
  requireAdminPage();
  const result = await getDb().query<SourceRecordRow>(
    `
      SELECT
        document_number,
        source_date::text,
        payload
      FROM integration.source_record
      WHERE source_system = 'CUENTI'
        AND entity_type = 'INVOICE_DETAIL'
      ORDER BY source_date DESC NULLS LAST, last_seen_at DESC
      LIMIT 1
    `
  );
  const row = result.rows[0];
  const diagnostics = {
    documentNumber: row?.document_number ?? null,
    paymentFields: row ? collectPaymentFields(row.payload) : [],
    sourceDate: row?.source_date ?? null
  };

  return (
    <main style={{ padding: "32px" }}>
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(diagnostics, null, 2)}
      </pre>
    </main>
  );
}

function collectPaymentFields(payload: unknown) {
  const fields: DiagnosticField[] = [];

  visitValue(payload, "$", fields, 0);

  return fields.slice(0, 120);
}

function visitValue(
  value: unknown,
  path: string,
  fields: DiagnosticField[],
  depth: number
) {
  if (fields.length >= 120 || depth > 8 || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    value.slice(0, 3).forEach((item, index) => {
      visitValue(item, `${path}[${index}]`, fields, depth + 1);
    });
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(
    value as Record<string, unknown>
  )) {
    if (fields.length >= 120) {
      return;
    }

    const fieldPath = `${path}.${key}`;
    const normalizedKey = key
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (PAYMENT_KEY_PATTERN.test(normalizedKey)) {
      fields.push({
        path: fieldPath,
        type: Array.isArray(nestedValue) ? "array" : typeof nestedValue,
        value:
          nestedValue === null ||
          ["boolean", "number", "string"].includes(typeof nestedValue)
            ? (nestedValue as string | number | boolean | null)
            : null
      });
    }

    visitValue(nestedValue, fieldPath, fields, depth + 1);
  }
}
