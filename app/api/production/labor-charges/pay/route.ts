import { NextRequest, NextResponse } from "next/server";
import { OperationsError, payLaborCharges } from "@/lib/operations";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

function redirectToPage(request: NextRequest, query: string) {
  return NextResponse.redirect(new URL(`/pagos-bloques?${query}`, request.url), 303);
}

export async function POST(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null
  );

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const formData = await request.formData();
  const paidOn = String(formData.get("paidOn") ?? "").trim();
  const paymentNotes = String(formData.get("paymentNotes") ?? "");
  const selectedChargeIds = formData
    .getAll("chargeIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const legacyChargeId = String(formData.get("chargeId") ?? "").trim();
  const chargeIds =
    selectedChargeIds.length > 0
      ? selectedChargeIds
      : legacyChargeId
        ? [legacyChargeId]
        : [];

  if (!paidOn) {
    return redirectToPage(request, "error=missing_payment_fields");
  }

  if (chargeIds.length === 0) {
    return redirectToPage(request, "error=missing_payment_selection");
  }

  try {
    await payLaborCharges({
      chargeIds,
      paidOn,
      paymentNotes,
      recordedByUserId: session.userId
    });

    return redirectToPage(request, "success=labor_payment_saved");
  } catch (error) {
    console.error("Error paying labor charge", error);

    if (error instanceof OperationsError) {
      return redirectToPage(request, `error=${error.code}`);
    }

    return redirectToPage(request, "error=server_error");
  }
}
