import { NextRequest, NextResponse } from "next/server";
import {
  cancelDeliveryService,
  DeliveryServiceError
} from "@/lib/delivery-services";
import { recordAuditLog } from "@/lib/audit";
import { requireSalesRequest } from "@/lib/permissions";
import { redirectTo } from "@/lib/redirects";

function redirectToModule(request: NextRequest, section: string, query: string) {
  return redirectTo(request, `/domicilios?section=${section}&${query}`);
}

export async function POST(request: NextRequest) {
  const session = requireSalesRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const formData = await request.formData();
  const section = String(formData.get("section") ?? "servicios");
  const serviceId = String(formData.get("serviceId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!serviceId) {
    return redirectToModule(request, section, "error=service_not_found");
  }

  try {
    await cancelDeliveryService({
      reason,
      recordedByUserId: session.userId,
      serviceId
    });

    await recordAuditLog({
      action: "CANCEL",
      actor: session,
      entityId: serviceId,
      entityType: "delivery_service",
      summary: "Domicilio anulado"
    });

    return redirectToModule(request, section, "success=delivery_canceled");
  } catch (error) {
    console.error("Error canceling delivery service", error);

    if (error instanceof DeliveryServiceError) {
      return redirectToModule(request, section, `error=${error.code}`);
    }

    return redirectToModule(request, section, "error=server_error");
  }
}
