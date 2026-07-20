import { getDb } from "@/lib/db";

type TransportProviderRow = {
  created_at: Date;
  id: string;
  is_active: boolean;
  name: string;
  notes: string | null;
  phone: string | null;
  updated_at: Date;
};

export type TransportProvider = {
  createdAt: Date;
  id: string;
  isActive: boolean;
  name: string;
  notes: string | null;
  phone: string | null;
  updatedAt: Date;
};

export class TransportProviderError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function listTransportProviders(): Promise<TransportProvider[]> {
  const result = await getDb().query<TransportProviderRow>(
    `
      SELECT
        id,
        name,
        phone,
        notes,
        is_active,
        created_at,
        updated_at
      FROM transport_provider
      ORDER BY name
    `
  );

  return result.rows.map((row) => ({
    createdAt: row.created_at,
    id: row.id,
    isActive: row.is_active,
    name: row.name,
    notes: row.notes,
    phone: row.phone,
    updatedAt: row.updated_at
  }));
}

export async function createTransportProvider(input: {
  name: string;
  notes?: string | null;
  phone?: string | null;
}) {
  const name = normalizeLabel(input.name);

  if (!name) {
    throw new TransportProviderError(
      "missing_transport_provider_name",
      "Escribe el nombre del proveedor."
    );
  }

  try {
    await getDb().query(
      `
        INSERT INTO transport_provider (name, phone, notes)
        VALUES ($1, $2, $3)
      `,
      [name, normalizeOptionalText(input.phone), normalizeOptionalText(input.notes)]
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      throw new TransportProviderError(
        "duplicate_transport_provider",
        "Ese proveedor ya existe."
      );
    }

    throw error;
  }
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
