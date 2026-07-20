import { getDb } from "@/lib/db";

type VehicleRow = {
  created_at: Date;
  id: string;
  is_active: boolean;
  label: string;
  max_load_kg: string;
  notes: string | null;
  plate: string | null;
  updated_at: Date;
};

export type DeliveryVehicle = {
  createdAt: Date;
  id: string;
  isActive: boolean;
  label: string;
  maxLoadKg: number;
  notes: string | null;
  plate: string | null;
  updatedAt: Date;
};

export class VehicleError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function listVehicles(): Promise<DeliveryVehicle[]> {
  const result = await getDb().query<VehicleRow>(
    `
      SELECT
        id,
        label,
        plate,
        max_load_kg,
        notes,
        is_active,
        created_at,
        updated_at
      FROM delivery_vehicle
      ORDER BY label
    `
  );

  return result.rows.map((row) => ({
    createdAt: row.created_at,
    id: row.id,
    isActive: row.is_active,
    label: row.label,
    maxLoadKg: Number(row.max_load_kg),
    notes: row.notes,
    plate: row.plate,
    updatedAt: row.updated_at
  }));
}

export async function createVehicle(input: {
  label: string;
  maxLoadKg?: number | null;
  notes?: string | null;
  plate?: string | null;
}) {
  const label = normalizeLabel(input.label);

  if (!label) {
    throw new VehicleError("missing_vehicle_label", "Escribe el nombre del carro.");
  }

  try {
    await getDb().query(
      `
        INSERT INTO delivery_vehicle (label, plate, notes, max_load_kg)
        VALUES ($1, $2, $3, $4)
      `,
      [
        label,
        normalizeOptionalText(input.plate),
        normalizeOptionalText(input.notes),
        normalizePositiveNumber(input.maxLoadKg)
      ]
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      throw new VehicleError(
        "duplicate_vehicle",
        "Ese carro o placa ya existe en la administracion."
      );
    }

    throw error;
  }
}

export async function updateVehicle(input: {
  label: string;
  maxLoadKg?: number | null;
  notes?: string | null;
  plate?: string | null;
  vehicleId: string;
}) {
  const vehicleId = input.vehicleId.trim();
  const label = normalizeLabel(input.label);

  if (!vehicleId || !label) {
    throw new VehicleError("missing_vehicle_label", "Escribe el nombre del carro.");
  }

  try {
    const result = await getDb().query<{ id: string }>(
      `
        UPDATE delivery_vehicle
        SET
          label = $2,
          plate = $3,
          max_load_kg = $4,
          notes = $5,
          updated_at = NOW()
        WHERE id = $1
          AND is_active = TRUE
        RETURNING id
      `,
      [
        vehicleId,
        label,
        normalizeOptionalText(input.plate),
        normalizePositiveNumber(input.maxLoadKg),
        normalizeOptionalText(input.notes)
      ]
    );

    if (result.rowCount === 0) {
      throw new VehicleError("vehicle_not_found", "El carro no existe.");
    }
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      throw new VehicleError(
        "duplicate_vehicle",
        "Ese carro o placa ya existe en la administracion."
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

function normalizePositiveNumber(value?: number | null) {
  if (!value || !Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100) / 100;
}
