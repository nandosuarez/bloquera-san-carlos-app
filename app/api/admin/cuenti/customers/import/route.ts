import { NextRequest, NextResponse } from "next/server";
import { syncCustomersFromCuenti } from "@/lib/cuenti-customer-sync";
import { CuentiIntegrationError } from "@/lib/cuenti";
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
    const result = await syncCustomersFromCuenti();
    const query = new URLSearchParams({
      created: String(result.created),
      skipped: String(result.skipped),
      success: "cuenti_customers_synced",
      total: String(result.totalRows),
      updated: String(result.updated)
    });

    return redirectToPage(request, query.toString());
  } catch (error) {
    console.error("Error syncing Cuenti customers", error);

    if (error instanceof CuentiIntegrationError) {
      return redirectToPage(request, `error=${error.code}`);
    }

    return redirectToPage(request, "error=server_error");
  }
}
