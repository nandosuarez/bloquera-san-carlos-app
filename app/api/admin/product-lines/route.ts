import { NextRequest, NextResponse } from "next/server";
import { createProductLine, OperationsError } from "@/lib/operations";
import { requireAdminRequest } from "@/lib/permissions";

function redirectToPage(request: NextRequest, query: string) {
  return NextResponse.redirect(
    new URL(`/administracion?section=product-lines&${query}`, request.url),
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
    await createProductLine({
      name: String(formData.get("name") ?? ""),
      notes: String(formData.get("notes") ?? "")
    });

    return redirectToPage(request, "success=product_line_saved");
  } catch (error) {
    console.error("Error creating product line", error);

    if (error instanceof OperationsError) {
      return redirectToPage(request, `error=${error.code}`);
    }

    return redirectToPage(request, "error=server_error");
  }
}
