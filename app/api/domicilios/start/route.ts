import { NextRequest, NextResponse } from "next/server";
import { DeliveryServiceError, startDeliveryService } from "@/lib/delivery-services";
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
  const departureOnInput = String(formData.get("departureOn") ?? "").trim();
  const departureTimeInput = String(formData.get("departureTime") ?? "").trim();
  const section = normalizeSection(String(formData.get("section") ?? ""));

  if (!serviceId || !departureOnInput || !departureTimeInput) {
    return redirectToModule(request, section, "error=missing_start_fields");
  }

  try {
    await startDeliveryService({
      departureOn: validateServiceDate(departureOnInput),
      departureTime: validateClockTime(departureTimeInput),
      recordedByUserId: session.userId,
      serviceId
    });

    await recordAuditLog({
      action: "START",
      actor: session,
      entityId: serviceId,
      entityType: "delivery_service",
      summary: "Domicilio iniciado"
    });

    return redirectToModule(request, section, "success=delivery_started");
  } catch (error) {
    console.error("Error starting delivery service", error);

    if (error instanceof DeliveryServiceError) {
      return redirectToModule(request, section, `error=${error.code}`);
    }

    return redirectToModule(request, section, "error=server_error");
  }
}

function validateServiceDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DeliveryServiceError("invalid_date", "La fecha no es valida.");
  }

  return value;
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
