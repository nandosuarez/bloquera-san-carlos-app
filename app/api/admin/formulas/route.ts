import { NextRequest, NextResponse } from "next/server";
import { OperationsError, saveBlockFormula } from "@/lib/operations";
import { requireAdminRequest } from "@/lib/permissions";

function redirectToPage(request: NextRequest, query: string) {
  return NextResponse.redirect(
    new URL(`/administracion?section=formulas&${query}`, request.url),
    303
  );
}

export async function POST(request: NextRequest) {
  const session = requireAdminRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  const formData = await request.formData();

  try {
    await saveBlockFormula({
      blockProductId: String(formData.get("blockProductId") ?? ""),
      cementBagsQty: parseNumber(formData.get("cementBagsQty")),
      cementProductId: String(formData.get("cementProductId") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      outputQty: parseNumber(formData.get("outputQty")),
      sandLatasQty: parseNumber(formData.get("sandLatasQty")),
      sandProductId: String(formData.get("sandProductId") ?? "")
    });

    return redirectToPage(request, "success=formula_saved");
  } catch (error) {
    console.error("Error saving formula", error);

    if (error instanceof OperationsError) {
      return redirectToPage(request, `error=${error.code}`);
    }

    return redirectToPage(request, "error=server_error");
  }
}

function parseNumber(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}
