import { NextRequest, NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { requireAdminRequest } from "@/lib/permissions";

const TABLES = [
  "customer",
  "collaborator",
  "product_line",
  "product",
  "delivery_vehicle",
  "transport_provider",
  "delivery_service",
  "delivery_service_item",
  "transport_cost",
  "pending_delivery_account",
  "pending_delivery_movement",
  "block_production_batch",
  "inventory_movement",
  "production_labor_charge"
];

export async function GET(request: NextRequest) {
  const session = requireAdminRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const chunks: string[] = [];

  for (const table of TABLES) {
    const result = await getDb().query<Record<string, unknown>>(
      `SELECT * FROM ${table} ORDER BY created_at DESC NULLS LAST`
    );
    chunks.push(`# ${table}`);

    if (result.rows.length === 0) {
      chunks.push("sin_registros");
      chunks.push("");
      continue;
    }

    const headers = Object.keys(result.rows[0]);
    chunks.push(headers.map(csvCell).join(","));

    for (const row of result.rows) {
      chunks.push(headers.map((header) => csvCell(formatValue(row[header]))).join(","));
    }

    chunks.push("");
  }

  await recordAuditLog({
    action: "EXPORT",
    actor: session,
    entityType: "backup",
    summary: "Backup CSV descargado"
  });

  const fileDate = new Date().toISOString().slice(0, 10);

  return new NextResponse(`\uFEFF${chunks.join("\n")}`, {
    headers: {
      "Content-Disposition": `attachment; filename="backup_bloquera_${fileDate}.csv"`,
      "Content-Type": "text/csv; charset=utf-8"
    }
  });
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
