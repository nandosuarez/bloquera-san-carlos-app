import { NextRequest, NextResponse } from "next/server";
import {
  createTransportCost,
  normalizeCostType,
  TransportCostError,
  voidTransportCost
} from "@/lib/transport-costs";
import { recordAuditLog } from "@/lib/audit";
import { requireOperationsRequest } from "@/lib/permissions";

function redirectToModule(request: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`/costos-transporte?${query}`, request.url), 303);
}

export async function POST(request: NextRequest) {
  const session = requireOperationsRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const formData = await request.formData();
  const action = String(formData.get("action") ?? "create");

  if (action === "void") {
    try {
      const costId = String(formData.get("costId") ?? "");
      await voidTransportCost({
        costId,
        reason: String(formData.get("reason") ?? ""),
        recordedByUserId: session.userId
      });
      await recordAuditLog({
        action: "VOID",
        actor: session,
        entityId: costId,
        entityType: "transport_cost",
        summary: "Costo de transporte anulado"
      });

      return redirectToModule(request, "success=transport_cost_voided");
    } catch (error) {
      console.error("Error voiding transport cost", error);

      if (error instanceof TransportCostError) {
        return redirectToModule(request, `error=${error.code}`);
      }

      return redirectToModule(request, "error=server_error");
    }
  }

  const costOn = String(formData.get("costOn") ?? "").trim();
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  const providerId = String(formData.get("providerId") ?? "").trim();
  const costType = normalizeCostType(String(formData.get("costType") ?? ""));
  const concept = String(formData.get("concept") ?? "").trim();
  const totalCost = parseOptionalNumber(formData.get("totalCost"));
  const notes = String(formData.get("notes") ?? "").trim();

  if (costType === "ALL") {
    return redirectToModule(request, "error=missing_transport_cost_fields");
  }

  try {
    const result = await createTransportCost({
      concept,
      costOn,
      costType,
      notes,
      providerId,
      recordedByUserId: session.userId,
      totalCost,
      vehicleId
    });

    await recordAuditLog({
      action: "CREATE",
      actor: session,
      entityId: result.costId,
      entityType: "transport_cost",
      summary: "Costo de transporte creado"
    });

    return redirectToModule(request, "success=transport_cost_saved");
  } catch (error) {
    console.error("Error saving transport cost", error);

    if (error instanceof TransportCostError) {
      return redirectToModule(request, `error=${error.code}`);
    }

    return redirectToModule(request, "error=server_error");
  }
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
