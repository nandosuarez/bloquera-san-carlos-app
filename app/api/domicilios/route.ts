import { NextRequest, NextResponse } from "next/server";
import {
  DeliveryServiceError,
  scheduleDeliveryService
} from "@/lib/delivery-services";
import { recordAuditLog } from "@/lib/audit";
import { requireSalesRequest } from "@/lib/permissions";
import { redirectTo } from "@/lib/redirects";

function redirectToModule(request: NextRequest, query: string) {
  return redirectTo(request, `/domicilios?${query}`);
}

export async function POST(request: NextRequest) {
  const session = requireSalesRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const formData = await request.formData();
  const serviceOnInput = String(formData.get("serviceOn") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const customerAddress = String(formData.get("customerAddress") ?? "").trim();
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  const collaboratorId = String(formData.get("collaboratorId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const productIds = formData.getAll("productId").map((value) => String(value).trim());
  const quantities = formData.getAll("quantity").map((value) => String(value).trim());
  const tripCounts = formData.getAll("tripCount").map((value) => String(value).trim());

  if (!serviceOnInput || !customerId || !vehicleId || !collaboratorId) {
    return redirectToModule(request, "error=missing_service_fields");
  }

  let serviceOn: string;

  try {
    serviceOn = validateServiceDate(serviceOnInput);
  } catch (error) {
    if (error instanceof DeliveryServiceError) {
      return redirectToModule(request, `error=${error.code}`);
    }
    return redirectToModule(request, "error=server_error");
  }

  try {
    const items = parseItems(productIds, quantities, tripCounts);

    const result = await scheduleDeliveryService({
      collaboratorId,
      customerAddress,
      customerId,
      customerPhone,
      items,
      notes,
      recordedByUserId: session.userId,
      serviceOn,
      vehicleId
    });

    await recordAuditLog({
      action: "CREATE",
      actor: session,
      entityId: result.serviceId,
      entityType: "delivery_service",
      summary: "Domicilio programado"
    });

    return redirectToModule(request, "success=delivery_service_saved");
  } catch (error) {
    console.error("Error saving delivery service", error);

    if (error instanceof DeliveryServiceError) {
      return redirectToModule(request, `error=${error.code}`);
    }

    return redirectToModule(request, "error=server_error");
  }
}

function parseItems(productIds: string[], quantities: string[], tripCounts: string[]) {
  const items: Array<{ productId: string; quantity: number; tripCount: number }> = [];
  const maxLength = Math.max(productIds.length, quantities.length, tripCounts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const productId = productIds[index] ?? "";
    const quantityRaw = quantities[index] ?? "";
    const tripCountRaw = tripCounts[index] ?? "1";
    const hasProduct = Boolean(productId.trim());
    const hasQuantity = Boolean(quantityRaw.trim());

    if (!hasProduct && !hasQuantity) {
      continue;
    }

    if (!hasProduct || !hasQuantity) {
      throw new DeliveryServiceError(
        "missing_service_items",
        "Cada producto debe tener su cantidad."
      );
    }

    const quantity = parseQuantity(quantityRaw);
    const tripCount = parseTripCount(tripCountRaw);
    items.push({ productId, quantity, tripCount });
  }

  if (items.length === 0) {
    throw new DeliveryServiceError(
      "missing_service_items",
      "Agrega al menos un producto con cantidad."
    );
  }

  return items;
}

function parseTripCount(value: string) {
  const tripCount = Number(value.replace(",", "."));

  if (!Number.isInteger(tripCount) || tripCount <= 0) {
    throw new DeliveryServiceError(
      "invalid_trip_count",
      "El numero de viajes debe ser mayor a cero."
    );
  }

  return tripCount;
}

function parseQuantity(value: string) {
  const quantity = Number(value.replace(",", "."));

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new DeliveryServiceError(
      "invalid_quantity",
      "La cantidad debe ser mayor a cero."
    );
  }

  return Math.round(quantity * 100) / 100;
}

function validateServiceDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DeliveryServiceError("invalid_date", "La fecha no es valida.");
  }

  return value;
}
