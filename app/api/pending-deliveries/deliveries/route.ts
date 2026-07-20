import { NextRequest, NextResponse } from "next/server";
import {
  PendingDeliveryError,
  parseQuantity,
  registerPendingDelivery,
  validateMovementDate
} from "@/lib/pending-deliveries";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

function redirectToModule(request: NextRequest, query: string) {
  return NextResponse.redirect(
    new URL(`/pendientes-entrega?${query}`, request.url),
    303
  );
}

export async function POST(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null
  );

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const formData = await request.formData();
  const accountId = String(formData.get("accountId") ?? "").trim();
  const quantityInput = String(formData.get("quantity") ?? "");
  const movementOnInput = String(formData.get("movementOn") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!accountId || !quantityInput || !movementOnInput) {
    return redirectToModule(request, "error=missing_delivery_fields");
  }

  try {
    await registerPendingDelivery({
      accountId,
      movementOn: validateMovementDate(movementOnInput),
      notes,
      quantity: parseQuantity(quantityInput),
      recordedByUserId: session.userId
    });

    return redirectToModule(request, "success=delivery_saved");
  } catch (error) {
    console.error("Error saving pending delivery", error);

    if (error instanceof PendingDeliveryError) {
      return redirectToModule(request, `error=${error.code}`);
    }

    return redirectToModule(request, "error=server_error");
  }
}
