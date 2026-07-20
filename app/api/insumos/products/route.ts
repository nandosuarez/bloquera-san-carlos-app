import { NextRequest, NextResponse } from "next/server";
import {
  OperationsError,
  setProductAsRawMaterial,
  type RawMaterialType
} from "@/lib/operations";
import { redirectTo } from "@/lib/redirects";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

function redirectToPage(request: NextRequest, query: string) {
  return redirectTo(request, `/insumos?${query}`);
}

export async function POST(request: NextRequest) {
  const session = verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null
  );

  if (!session) {
    return redirectTo(request, "/login");
  }

  const formData = await request.formData();
  const productId = String(formData.get("productId") ?? "").trim();
  const rawMaterialType = normalizeRawMaterialType(
    String(formData.get("rawMaterialType") ?? "")
  );
  const action = String(formData.get("action") ?? "").trim();
  const shouldBeRawMaterial = action === "add";

  if (!productId || (action !== "add" && action !== "remove")) {
    return redirectToPage(request, "error=missing_inventory_fields");
  }

  try {
    await setProductAsRawMaterial({
      productId,
      rawMaterialType,
      shouldBeRawMaterial
    });

    return redirectToPage(
      request,
      shouldBeRawMaterial
        ? "success=raw_material_added"
        : "success=raw_material_removed"
    );
  } catch (error) {
    console.error("Error updating raw material category", error);

    if (error instanceof OperationsError) {
      return redirectToPage(request, `error=${error.code}`);
    }

    return redirectToPage(request, "error=server_error");
  }
}

function normalizeRawMaterialType(value: string): RawMaterialType | null {
  if (value === "CEMENT" || value === "SAND") return value;
  return null;
}
