import { NextRequest, NextResponse } from "next/server";
import {
  DeliveryServiceError,
  completeDeliveryService
} from "@/lib/delivery-services";
import { recordAuditLog } from "@/lib/audit";
import { requireSalesRequest } from "@/lib/permissions";

function redirectToModule(request: NextRequest, section: string, query: string) {
  return NextResponse.redirect(
    new URL(`/domicilios?section=${section}&${query}`, request.url),
    303
  );
}

export async function POST(request: NextRequest) {
  const session = requireSalesRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const formData = await request.formData();
  const serviceId = String(formData.get("serviceId") ?? "").trim();
  const completionTimeInput = String(formData.get("completionTime") ?? "").trim();
  const section = normalizeSection(String(formData.get("section") ?? ""));

  if (!serviceId || !completionTimeInput) {
    return redirectToModule(request, section, "error=missing_completion_fields");
  }

  try {
    await completeDeliveryService({
      completionTime: validateClockTime(completionTimeInput),
      recordedByUserId: session.userId,
      serviceId
    });

    await recordAuditLog({
      action: "COMPLETE",
      actor: session,
      entityId: serviceId,
      entityType: "delivery_service",
      summary: "Domicilio completado"
    });

    return redirectToModule(request, section, "success=delivery_completed");
  } catch (error) {
    console.error("Error completing delivery service", error);

    if (error instanceof DeliveryServiceError) {
      return redirectToModule(request, section, `error=${error.code}`);
    }

    return redirectToModule(request, section, "error=server_error");
  }
}

function validateClockTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new DeliveryServiceError("invalid_time", "La hora no es valida.");
  }

  const [hours, minutes] = value.split(":").map(Number);
  const validHours = Number.isInteger(hours) && hours >= 0 && hours <= 23;
  const validMinutes = Number.isInteger(minutes) && minutes >= 0 && minutes <= 59;

  if (!validHours || !validMinutes) {
    throw new DeliveryServiceError("invalid_time", "La hora no es valida.");
  }

  return value;
}

function normalizeSection(value: string) {
  if (value === "productos") return "productos";
  if (value === "servicios") return "servicios";
  return "programar";
}
