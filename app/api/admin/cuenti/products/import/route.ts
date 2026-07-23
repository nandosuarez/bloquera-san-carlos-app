import { NextRequest, NextResponse } from "next/server";
import { CuentiIntegrationError } from "@/lib/cuenti";
import { syncProductsFromCuenti } from "@/lib/cuenti-product-sync";
import { requireAdminRequest } from "@/lib/permissions";
import { redirectTo } from "@/lib/redirects";

function redirectToPage(request: NextRequest, query: string) {
  return redirectTo(request, `/administracion?section=cuenti&${query}`);
}

export async function POST(request: NextRequest) {
  const session = requireAdminRequest(request);

  if (session instanceof NextResponse) {
    return session;
  }

  try {
    const result = await syncProductsFromCuenti();
    const query = new URLSearchParams({
      created: String(result.created),
      skipped: String(result.skipped),
      success: "cuenti_products_synced",
      total: String(result.totalRows),
      updated: String(result.updated)
    });

    return redirectToPage(request, query.toString());
  } catch (error) {
    console.error("Error syncing Cuenti products", error);

    if (error instanceof CuentiIntegrationError) {
      return redirectToPage(request, `error=${error.code}`);
    }

    return redirectToPage(request, "error=server_error");
  }
}
