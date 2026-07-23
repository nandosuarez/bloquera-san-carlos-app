import { getDb } from "@/lib/db";

export type CustomerImportResult = {
  created: number;
  skipped: number;
  totalRows: number;
  updated: number;
};

export class CustomerImportError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "CustomerImportError";
  }
}

type CustomerImportRow = {
  address: string | null;
  name: string;
  notes: string | null;
  phone: string | null;
};

export async function importCustomersFromCsv(csvContent: string): Promise<CustomerImportResult> {
  const rows = parseCsv(csvContent);

  if (rows.length < 2) {
    throw new CustomerImportError("empty_customer_import", "El archivo no tiene clientes.");
  }

  const header = rows[0].map(normalizeHeader);
  const nameIndex = findHeaderIndex(header, ["name", "nombre", "cliente"]);

  if (nameIndex === -1) {
    throw new CustomerImportError(
      "missing_customer_import_name",
      "El archivo debe tener una columna Nombre."
    );
  }

  const phoneIndex = findHeaderIndex(header, ["phone", "telefono", "telefono 1", "teléfono"]);
  const addressIndex = findHeaderIndex(header, ["address", "direccion", "dirección"]);
  const notesIndex = findHeaderIndex(header, ["notes", "nota", "notas"]);
  const customersByKey = new Map<string, CustomerImportRow>();
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const name = normalizeText(row[nameIndex]);

    if (!name) {
      skipped += 1;
      continue;
    }

    const current = customersByKey.get(name.toLocaleLowerCase("es-CO"));
    const next = {
      address: normalizeNullable(row[addressIndex]),
      name,
      notes: normalizeNullable(row[notesIndex]),
      phone: normalizeNullable(row[phoneIndex])
    };

    customersByKey.set(name.toLocaleLowerCase("es-CO"), {
      address: next.address ?? current?.address ?? null,
      name,
      notes: next.notes ?? current?.notes ?? null,
      phone: next.phone ?? current?.phone ?? null
    });
  }

  if (customersByKey.size === 0) {
    throw new CustomerImportError("empty_customer_import", "No se encontraron clientes validos.");
  }

  const client = await getDb().connect();
  let created = 0;
  let updated = 0;

  try {
    await client.query("BEGIN");

    for (const customer of customersByKey.values()) {
      const result = await client.query<{ inserted: boolean }>(
        `
          INSERT INTO customer (name, phone, address, notes, is_active)
          VALUES ($1, $2, $3, $4, TRUE)
          ON CONFLICT ((LOWER(name)))
          DO UPDATE SET
            phone = COALESCE(EXCLUDED.phone, customer.phone),
            address = COALESCE(EXCLUDED.address, customer.address),
            notes = COALESCE(EXCLUDED.notes, customer.notes),
            is_active = TRUE,
            updated_at = NOW()
          RETURNING (xmax = 0) AS inserted
        `,
        [customer.name, customer.phone, customer.address, customer.notes]
      );

      if (result.rows[0]?.inserted) {
        created += 1;
      } else {
        updated += 1;
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    created,
    skipped,
    totalRows: rows.length - 1,
    updated
  };
}

function findHeaderIndex(header: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return header.findIndex((item) => normalizedAliases.includes(item));
}

function normalizeHeader(value: string) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO");
}

function normalizeNullable(value: string | undefined) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeText(value: string | undefined) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsv(content: string) {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((items) => items.some((item) => normalizeText(item)));
}
