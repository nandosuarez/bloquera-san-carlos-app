import { NextRequest, NextResponse } from "next/server";
import {
  PendingDeliveryError,
  parseQuantity,
  registerPendingPurchase,
  validateMovementDate
} from "@/lib/pending-deliveries";
import { redirectTo } from "@/lib/redirects";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

function redirectToModule(request: NextRequest, query: string) {
  return redirectTo(request, `/pendientes-entrega?${query}`);
}

export async function POST(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null
  );

  if (!session) {
    return redirectTo(request, "/login");
  }

  const formData = await request.formData();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  const quantityInput = String(formData.get("quantity") ?? "");
  const movementOnInput = String(formData.get("movementOn") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!customerId || !productId || !quantityInput || !movementOnInput) {
    return redirectToModule(request, "error=missing_purchase_fields");
  }

  try {
    await registerPendingPurchase({
      customerId,
      movementOn: validateMovementDate(movementOnInput),
      notes,
      productId,
      quantity: parseQuantity(quantityInput),
      recordedByUserId: session.userId
    });

    return redirectToModule(request, "success=purchase_saved");
  } catch (error) {
    console.error("Error saving pending purchase", error);

    if (error instanceof PendingDeliveryError) {
      return redirectToModule(request, `error=${error.code}`);
    }

    return redirectToModule(request, "error=server_error");
  }
}
