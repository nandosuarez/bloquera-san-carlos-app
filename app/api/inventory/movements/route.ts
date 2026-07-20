import { NextRequest, NextResponse } from "next/server";
import { OperationsError, recordInventoryAdjustment } from "@/lib/operations";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

function redirectToTarget(request: NextRequest, target: string, query: string) {
  return NextResponse.redirect(new URL(`${target}?${query}`, request.url), 303);
}

export async function POST(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null
  );

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const formData = await request.formData();
  const productId = String(formData.get("productId") ?? "").trim();
  const movementOn = String(formData.get("movementOn") ?? "").trim();
  const quantity = Number(String(formData.get("quantity") ?? "").replace(",", "."));
  const movementType = String(formData.get("movementType") ?? "").trim();
  const returnTo = normalizeReturnTo(String(formData.get("returnTo") ?? ""));
  const unitCostRaw = String(formData.get("unitCost") ?? "").trim();
  const unitCost = unitCostRaw
    ? Number(unitCostRaw.replace(",", "."))
    : null;

  if (!productId || !movementOn || !Number.isFinite(quantity) || quantity <= 0) {
    return redirectToTarget(request, returnTo, "error=missing_inventory_fields");
  }

  try {
    await recordInventoryAdjustment({
      movementOn,
      movementType: movementType === "MANUAL_OUT" ? "MANUAL_OUT" : "MANUAL_IN",
      notes: String(formData.get("notes") ?? ""),
      productId,
      quantity,
      recordedByUserId: session.userId,
      unitCost: Number.isFinite(unitCost ?? NaN) ? unitCost : null
    });

    return redirectToTarget(request, returnTo, "success=inventory_saved");
  } catch (error) {
    console.error("Error saving inventory movement", error);

    if (error instanceof OperationsError) {
      return redirectToTarget(request, returnTo, `error=${error.code}`);
    }

    return redirectToTarget(request, returnTo, "error=server_error");
  }
}

function normalizeReturnTo(value: string) {
  if (value === "/insumos") return "/insumos";
  return "/inventario";
}
